import { DashboardData, AIReport, ConfigStatus, APIConfig, ModelValidationResponse, PersonaId, Article, WordStat, FormattedCollection } from '../types';

const LS_CONFIG_KEY = 'xinhua_insight_api_config';
const LS_DATA_KEY = 'xinhua_insight_local_data';

// Xinhua Net Mobile (UTF-8 encoded)
const TARGET_URL = 'https://m.news.cn/';
// CORS proxy fallback pool (public services are unstable, so we try multiple providers)
const CRAWL_PROXIES = [
  {
    name: 'allorigins_raw',
    buildUrl: (target: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}&t=${Date.now()}`,
    parseText: async (res: Response) => res.text()
  },
  {
    name: 'allorigins_get',
    buildUrl: (target: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(target)}&t=${Date.now()}`,
    parseText: async (res: Response) => {
      const data = await res.json();
      return data?.contents || '';
    }
  },
  {
    name: 'codetabs',
    buildUrl: (target: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
    parseText: async (res: Response) => res.text()
  }
];

// --- Local Configuration Management ---

const getStoredConfig = (): APIConfig | null => {
  const stored = localStorage.getItem(LS_CONFIG_KEY);
  return stored ? JSON.parse(stored) : null;
};

const saveStoredConfig = (config: APIConfig) => {
  localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(config));
};

// --- Local Data Management (The Browser is now the Database) ---

const getStoredData = (): DashboardData | null => {
  const stored = localStorage.getItem(LS_DATA_KEY);
  return stored ? JSON.parse(stored) : null;
};

const saveStoredData = (data: DashboardData) => {
  localStorage.setItem(LS_DATA_KEY, JSON.stringify(data));
};

// --- Helper for Dates ---
const getTodayDate = () => {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
};

const normalizeWhitespace = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

const normalizeTitle = (title: string): string => {
  return normalizeWhitespace(
    title
      .replace(/^【[^】]+】/g, '')
      .replace(/^\[[^\]]+\]/g, '')
      .replace(/^\([^\)]+\)/g, '')
  );
};

const canonicalizeUrl = (href: string): string => {
  const url = new URL(href, TARGET_URL);
  url.hash = '';
  ['utm_source', 'utm_medium', 'utm_campaign', 'from'].forEach((key) => {
    url.searchParams.delete(key);
  });
  return url.toString();
};

const extractDateFromUrl = (url: string): string | null => {
  const candidates = [
    /\/(\d{4})(\d{2})(\d{2})\//,
    /\/(\d{4})\/(\d{2})(\d{2})\//,
    /\/(\d{4})-(\d{2})\/(\d{2})\//
  ];

  for (const pattern of candidates) {
    const dateMatch = url.match(pattern);
    if (dateMatch) {
      return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    }
  }
  return null;
};

const isWithinHours = (date: string, limitHours?: number): boolean => {
  if (!limitHours) return true;
  const dateTime = new Date(`${date}T00:00:00+08:00`).getTime();
  const now = Date.now();
  const diffHours = (now - dateTime) / (1000 * 60 * 60);
  return diffHours <= limitHours;
};

const formatCollectionAsMarkdown = (data: DashboardData): string => {
  const lines: string[] = [];
  lines.push(`# Xinhua Insight Collection (${data.stats?.date ?? getTodayDate()})`);
  lines.push('');
  lines.push(`- Total Articles: ${data.stats?.total_articles ?? data.articles.length}`);
  lines.push(`- Last Updated: ${data.stats?.last_updated ?? new Date().toLocaleTimeString()}`);
  lines.push(`- Cleaned At: ${data.cleaned_at ?? new Date().toISOString()}`);
  lines.push('');
  lines.push('## Top Keywords');
  lines.push('');

  (data.stats?.top_keywords ?? []).forEach((kw) => {
    lines.push(`- ${kw.word}: ${kw.count}`);
  });

  lines.push('');
  lines.push('## Articles');
  lines.push('');

  data.articles.forEach((article, index) => {
    lines.push(`${index + 1}. [${article.title}](${article.url}) (${article.date})`);
  });

  return lines.join('\n');
};

// --- Client-Side Analysis Helpers ---

const extractKeywords = (titles: string[]): WordStat[] => {
  const stopWords = new Set(['中国', '工作', '强调', '指出', '会议', '活动', '关于', '进行', '加强', '推进', '发展', '人民', '重要', '精神', '甚至', '为了', '学习', '全面', '贯彻', '落实', '深入', '坚持']);
  const frequency: Record<string, number> = {};

  titles.forEach(title => {
    // Remove non-chinese characters
    const cleanLine = title.replace(/[^\u4e00-\u9fa5]/g, '');
    for (let i = 0; i < cleanLine.length - 1; i++) {
      const word = cleanLine.substring(i, i + 2);
      if (stopWords.has(word)) continue;
      
      frequency[word] = (frequency[word] || 0) + 1;
    }
    // Also try 3-grams
    for (let i = 0; i < cleanLine.length - 2; i++) {
        const word = cleanLine.substring(i, i + 3);
        if (frequency[word.substring(0,2)] > 1) {
             frequency[word] = (frequency[word] || 0) + 2; 
        }
    }
  });

  return Object.entries(frequency)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
};

// --- Prompts ---

const SYSTEM_PROMPT_BASE = `
Role: You are a "Deep Logic Decoder" for Chinese political news. You do NOT trust the surface meaning of official "Baguwen" (bureaucratic formalism).
Core Logic: "What is emphasized is what is lacking. What is repressed is what is feared."
Task: Analyze the Xinhua Net headlines to find the *real* government intent and hidden crises.
Methodology:
1. Strip away "positive energy" adjectives.
2. Link high-frequency keywords (e.g., "Security", "Struggle", "Stability") to specific underlying threats (e.g., economic collapse, social unrest, war preparation).
3. The "Strategic Advice" must be cynical, realistic, and actionable for an individual trying to survive or profit in this environment.

Output: Strict JSON format only. No Markdown.
JSON Structure:
{
  "period_summary": "A concise, brutal summary of what the government is actually worrying about this week.",
  "top_keywords": [{"word": "keyword", "weight": 90, "sentiment": "positive/neutral/negative"}],
  "core_topics": [{"topic_name": "Topic", "summary": "The official narrative vs. the hidden reality."}],
  "policy_signal": "Prediction of the next crackdown or policy shift based on tone intensity.",
  "strategic_advice": {
    "title": "Short, Punchy Advice",
    "content": "Specific action: Buy/Sell/Hoard/Run/Lay low. No vague platitudes.",
    "risk_level": "High/Medium/Low"
  }
}
Force Simplified Chinese output for all values.
`;

const PERSONA_INSTRUCTIONS: Record<PersonaId, string> = {
  youtuber: `
    Perspective: "Modern Survivalist & Runxue (润学) Practitioner".
    Focus: Physical safety, border controls, social instability, and wealth confiscation risks.
    Tone: Alarmist but practical. Cynical.
    Decoding Guide:
    - "Social Stability" -> Prepare for increased surveillance and crackdowns.
    - "Food Security" -> Hoard non-perishables; supply chains may break.
    - "National Security" -> Passport controls might tighten; foreign exchange constraints.
    - Advice Focus: Protecting yourself and your family from the "Iron Fist".
  `,
  economist: `
    Perspective: "Bear Market Macro-Strategist".
    Focus: Liquidity traps, local debt crises, tax enforcement, and capital flight.
    Tone: Cold, calculating, data-driven skepticism.
    Decoding Guide:
    - "High-Quality Development" -> The old growth model is dead; expect stagnation.
    - "Financial Risk Prevention" -> Small banks may fail; move cash to big 4 banks or hard assets.
    - "Common Prosperity" -> Tax audits on the wealthy/middle class are coming.
    - Advice Focus: Asset preservation, currency hedging, avoiding sectors in the crosshairs.
  `,
  observer: `
    Perspective: "Kremlinology / Zhongnanhai Watcher".
    Focus: Power struggles, personnel changes, ideological purification, and mobilization for conflict.
    Tone: Analytical, historical, reading between the lines.
    Decoding Guide:
    - Who is speaking? Who is missing from the headlines? (Absence is a signal).
    - "Political Stance" -> Loyalty purges are active.
    - "Struggle (斗争)" -> Preparation for external conflict or internal purge.
    - Advice Focus: Understanding the political wind direction to avoid standing on the wrong side.
  `,
  plain_spoken: `
    Perspective: "The Truth-Telling Neighbor (Big Vernacular)".
    Focus: Synthesizing Economics, Politics, and Survival into simple terms for the average citizen.
    Tone: "Speak Human Language" (说人话). Down-to-earth, slang-heavy, direct, slightly humorous but deadly serious about risks.
    Decoding Guide:
    - Translate "Fiscal Policy" to "The government is running out of money, watch your wallet."
    - Translate "Security" to "Don't go out at night, don't talk online."
    - Summarize complex risks into: "Save money," "Buy gold," "Don't buy a house," "Prepare for hard times."
    - Advice Focus: Simple, actionable steps for a common family to survive the coming storm.
  `,
  exam_prep: `
    Perspective: "Civil Service & Graduate Exam Mentor (Gongkao/Kaoyan)".
    Focus: Identifying "Political Theory" exam points (政治考点), "Essay (Shenlun)" material (申论素材), and interpreting hiring trends based on policy weight.
    Tone: Practical, encouraging, academic but realistic. Analyzes news as "Standard Answers" to be memorized.
    Decoding Guide:
    - Identify key slogans (e.g., "New Quality Productive Forces") -> Mark as "Must-Memorize Terms".
    - "Strengthen X Dept" -> Suggest applying to X Department (it has budget and power).
    - "Rectify Y Sector" -> Advise avoiding jobs in Y Sector.
    - "Strategic Advice" Section: Provide specific essay structures or arguments derived from current news.
    - "Risk Level": Interpret as "Competition Difficulty" or "Policy Change Risk".
    - Advice Focus: How to use these topics in an exam answer, and which government agencies are rising in power (good for career).
  `
};

// --- Helpers ---

const cleanJson = (text: string): string => {
  let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    cleaned = cleaned.substring(start, end + 1);
  }
  return cleaned;
};

const fetchWithTimeout = async (url: string, timeoutMs = 12000): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const fetchTargetHtmlWithProxyFallback = async (targetUrl: string): Promise<{ html: string; proxyUsed: string }> => {
  const errors: string[] = [];

  for (const proxy of CRAWL_PROXIES) {
    try {
      const response = await fetchWithTimeout(proxy.buildUrl(targetUrl));
      if (!response.ok) {
        errors.push(`${proxy.name}: HTTP ${response.status}`);
        continue;
      }

      const html = (await proxy.parseText(response)).trim();
      if (!html || html.length < 200) {
        errors.push(`${proxy.name}: empty/short body`);
        continue;
      }

      if (!html.includes('<html') && !html.includes('<!doctype html')) {
        errors.push(`${proxy.name}: non-html payload`);
        continue;
      }

      return { html, proxyUsed: proxy.name };
    } catch (e: any) {
      errors.push(`${proxy.name}: ${e?.message || 'request failed'}`);
    }
  }

  throw new Error(`All proxies failed. ${errors.join(' | ')}`);
};

// --- API Implementation ---

export const api = {
  getLatestData: async (): Promise<DashboardData | null> => {
    // 1. Try to get from LocalStorage
    const localData = getStoredData();
    if (localData) {
        return localData;
    }
    // 2. If nothing in local, return null to prompt the UI to "Crawl"
    return null; 
  },

  crawlNews: async (params?: { limit_hours?: number }): Promise<boolean> => {
    try {
      console.log(`Starting client-side crawl of ${TARGET_URL}...`);
      
      const { html: htmlText, proxyUsed } = await fetchTargetHtmlWithProxyFallback(TARGET_URL);
      console.log(`Crawl proxy success: ${proxyUsed}`);
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      const extractedArticles: Article[] = [];
      const selectors = '.headline a, .swiper-slide .tit a, .list li a, .products li a';
      const linkElements = Array.from(doc.querySelectorAll(selectors));

      const today = getTodayDate();

      linkElements.forEach((el) => {
         const title = normalizeTitle(el.textContent || '');
         const href = el.getAttribute('href');
         
         if (title && title.length > 6 && href && !href.includes('javascript:')) {
             let fullUrl = href;
             try {
               fullUrl = canonicalizeUrl(href);
             } catch (e) {
               return;
             }

             // Attempt to extract date from URL 
             const date = extractDateFromUrl(fullUrl) ?? today;

             if (!isWithinHours(date, params?.limit_hours)) {
              return;
             }

             extractedArticles.push({
                 title,
                 url: fullUrl,
                 date: date
             });
         }
      });

      const uniqueArticles = Array.from(new Map(extractedArticles.map(item => [`${item.title}-${item.url}`, item])).values());
      
      if (uniqueArticles.length === 0) {
          throw new Error("No articles found in parsed HTML");
      }

      // Sort by date descending
      uniqueArticles.sort((a, b) => b.date.localeCompare(a.date));

      const topKeywords = extractKeywords(uniqueArticles.map(a => a.title));
      
      const newData: DashboardData = {
          stats: {
              date: getTodayDate(),
              total_articles: uniqueArticles.length,
              last_updated: new Date().toLocaleTimeString(),
              top_keywords: topKeywords
          },
          articles: uniqueArticles.slice(0, 50),
          cleaned_at: new Date().toISOString(),
          collection_notes: `Normalized title/url/date + limit_hours filter. Proxy fallback: ${CRAWL_PROXIES.map(p => p.name).join(', ')}`
      };

      newData.markdown_digest = formatCollectionAsMarkdown(newData);

      saveStoredData(newData);
      return true;

    } catch (e) {
      console.warn("Client-side crawl failed:", e);
      return false;
    }
  },

  getFormattedCollection: async (): Promise<{ json: FormattedCollection | null; markdown: string }> => {
    const localData = getStoredData();
    if (!localData || !localData.stats) {
      return { json: null, markdown: '' };
    }

    const json: FormattedCollection = {
      generated_at: new Date().toISOString(),
      source: TARGET_URL,
      article_count: localData.articles.length,
      keywords: localData.stats.top_keywords,
      articles: localData.articles
    };

    return {
      json,
      markdown: localData.markdown_digest || formatCollectionAsMarkdown(localData)
    };
  },

  getConfigStatus: async (): Promise<ConfigStatus> => {
    const stored = getStoredConfig();
    if (stored && stored.apiKey) {
      return { configured: true, provider: stored.provider, modelId: stored.modelId };
    }
    return { configured: false };
  },

  validateConfig: async (config: { provider: string, apiKey: string, baseUrl?: string, modelId?: string }): Promise<ModelValidationResponse> => {
    try {
      const isOllama = config.provider === 'ollama';
      let url = config.baseUrl;
      if (!url) {
        if (config.provider === 'openai') url = 'https://api.openai.com/v1';
        if (config.provider === 'deepseek') url = 'https://api.deepseek.com';
        if (isOllama) url = 'http://localhost:11434/v1';
      }
      
      url = url?.replace(/\/+$/, '');

      const payload = {
        model: config.modelId,
        messages: [
          { role: "user", content: "Say 'Hello' in lower case." }
        ],
        max_tokens: 10
      };

      const res = await fetch(`${url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Provider Error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";

      return { valid: true, models: [config.modelId || 'default'], message: "Connection Successful!", test_response: content };

    } catch (e: any) {
      console.error("Validation Error:", e);
      return { valid: false, models: [], message: e.message || "Connection Failed" };
    }
  },

  updateConfig: async (config: APIConfig): Promise<boolean> => {
    try {
      saveStoredConfig(config);
      return true;
    } catch (e) {
      return false;
    }
  },

  analyzeAI: async (personaId: PersonaId, articles: Article[]): Promise<AIReport> => {
    const config = getStoredConfig();
    if (!config) throw new Error("Configuration missing.");

    // Truncate to save tokens (Use first 25 titles)
    const recentArticles = articles.slice(0, 25).map(a => `- ${a.title}`).join('\n');
    const userPrompt = `Here are the latest news titles from Xinhua Net:\n${recentArticles}`;
    
    const isOllama = config.provider === 'ollama';
    let url = config.baseUrl;
    if (!url) {
      if (config.provider === 'openai') url = 'https://api.openai.com/v1';
      if (config.provider === 'deepseek') url = 'https://api.deepseek.com';
      if (isOllama) url = 'http://localhost:11434/v1';
    }
    url = url?.replace(/\/+$/, '');

    try {
      const res = await fetch(`${url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.modelId,
          messages: [
            { role: "system", content: SYSTEM_PROMPT_BASE + "\n" + PERSONA_INSTRUCTIONS[personaId] },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7,
          response_format: { type: "json_object" }
        })
      });

      if (!res.ok) {
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const rawContent = data.choices?.[0]?.message?.content;
      
      if (!rawContent) throw new Error("Empty response from AI");

      const cleanedJson = cleanJson(rawContent);
      return JSON.parse(cleanedJson);

    } catch (e: any) {
      console.error("AI Generation Error:", e);
      throw new Error("Failed to generate report: " + e.message);
    }
  }
};
