
export interface WordStat {
  word: string;
  count: number;
}

export interface BasicData {
  date: string;
  total_articles: number;
  last_updated: string;
  top_keywords: WordStat[];
}

export interface Article {
  title: string;
  url: string;
  date: string;
  content?: string; // Optional as we might not display full content in list
}

export interface DashboardData {
  stats: BasicData | null;
  articles: Article[];
  cleaned_at?: string;
  collection_notes?: string;
  markdown_digest?: string;
}

export interface FormattedCollection {
  generated_at: string;
  source: string;
  article_count: number;
  keywords: WordStat[];
  articles: Article[];
}

export interface AIAnalysisTopic {
  topic_name: string;
  summary: string;
}

export interface AIAnalysisKeyword {
  word: string;
  weight: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface StrategicAdvice {
  title: string;
  content: string;
  risk_level: 'High' | 'Medium' | 'Low';
}

export interface AIReport {
  period_summary: string;
  top_keywords: AIAnalysisKeyword[];
  core_topics: AIAnalysisTopic[];
  policy_signal: string;
  strategic_advice: StrategicAdvice;
}

export interface APIConfig {
  provider: 'openai' | 'deepseek' | 'ollama';
  apiKey?: string;
  baseUrl?: string;
  modelId?: string;
}

export interface ConfigStatus {
  configured: boolean;
  provider?: string;
  modelId?: string;
}

export type Language = 'en' | 'zh' | 'jp';
export type PersonaId = 'youtuber' | 'economist' | 'observer' | 'plain_spoken' | 'exam_prep';

export interface ModelValidationResponse {
  valid: boolean;
  models: string[]; // List of available model IDs
  message?: string;
  test_response?: string; // Content of the short test request
}
