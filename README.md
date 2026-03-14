# 📰 新华洞察 (Xinhua Insight) v1.1

> **读懂字里行间的焦虑 | Decoding Bureaucratic Formalism**

[![English](https://img.shields.io/badge/docs-English-lightgrey.svg)](README_EN.md)
![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)
![Tech](https://img.shields.io/badge/stack-React_19_·_Vite_·_Tailwind-38bdf8)
![Privacy](https://img.shields.io/badge/privacy-Local_Storage_Only-green)

**新华洞察 (Xinhua Insight)** 是一个**纯前端**的新闻情报仪表盘。它旨在剥离官方通稿中“正能量”的形容词，通过词频统计和 AI 深度推理，还原政策、经济与社会管控背后的底层逻辑。

这是一个**去中心化**的分析工具，没有后端服务器，数据掌握在你手中。

---

## 🆕 v1.1 发布

- 抓取与清洗链路增强（标题/URL/日期标准化、时间窗过滤）。
- 新增结构化收录输出（JSON + Markdown digest）。
- 详见发布说明：`docs/RELEASE_v1.1.0.md`。

---

## 🛠 技术原理与采集逻辑 (Technical Deep Dive)

本项目采用 **"Client-Side Only" (纯客户端)** 架构，所有的数据抓取、清洗、存储和分析均在用户的浏览器中完成。

### 1. 🔍 数据采集 (The Crawler)
由于浏览器同源策略 (SOP) 的限制，直接访问新闻网站会被拦截。我们采用了以下方案：
*   **目标源**: `https://m.news.cn/` (新华网移动端，结构更轻量，时政新闻更集中)。
*   **CORS 代理**: 使用 `AllOrigins` 或类似的公共代理服务绕过跨域限制。
    ```javascript
    // 伪代码示例
    const proxy = 'https://api.allorigins.win/raw?url=';
    const target = 'https://m.news.cn/';
    fetch(proxy + target);
    ```
*   **编码处理**: 手动处理 `ArrayBuffer` 并使用 `TextDecoder('utf-8')` 解码，防止乱码。

### 2. 🧹 数据清洗与解析
*   **DOM 解析**: 利用浏览器原生的 `DOMParser` 将抓取到的 HTML 字符串转换为文档对象。
*   **选择器策略**: 针对性提取 `.headline`, `.swiper-slide`, `.list li` 等核心新闻区域。
*   **日期提取**: 并不依赖网页显示的日期，而是通过正则表达式从 URL 结构 (如 `/2024-03/15/`) 中提取发布日期，确保时间准确。

### 3. 📊 本地词频统计
*   **分词算法**: 前端内置轻量级中文分词逻辑（基于 N-gram 和停用词库）。
*   **去噪**: 自动剔除“加强”、“推进”、“重要”、“坚持”等无实际信息量的“八股文虚词”，只保留“安全”、“风险”、“斗争”等具有实指意义的名词。

### 4. 🤖 AI 增强分析
*   **提示词工程 (Prompt Engineering)**: 内置五套精心设计的 System Prompts（如“润学生存指南”、“宏观空头”、“考公上岸”等）。
*   **BYOK 模式**: 支持用户填入自己的 OpenAI/DeepSeek Key 或连接本地 Ollama 模型，AI 交互直接发生在用户浏览器与模型供应商之间。

---

## ✨ 核心功能

### 🤖 多视角 AI 解码 (Persona Analysis)
我们不制造新闻摘要，我们提供**解读**。不同的 AI 人格戴着不同的有色眼镜：

| 视角 | 核心逻辑与关注点 |
|------|------------------|
| 🗣️ **大白话 (推荐)** | **真话翻译机**。拒绝谜语人，将“逆周期调节”翻译为“央行放水”，将“财政紧平衡”翻译为“政府没钱了”。直接给出普通家庭的生存建议。 |
| 🏃‍♂️ **现实生存 (润学)** | **焦虑预警机**。关注人身自由、边境管控、物资短缺和社会治安铁拳。核心建议通常涉及：跑路、囤货、低调。 |
| 📉 **防御性理财 (空头)** | **悲观经济学家**。无视 GDP 增长率，只看地方债雷爆、税收倒查和汇率贬值风险。核心建议：现金为王，换汇，不买房。 |
| 🕵️ **中南海听床 (政治)** | **政治观察家**。通过分析“谁出席了会议”、“谁缺席了”、“提法有什么微小变化”来推断权力斗争和路线清洗。 |
| 🎓 **考公考研 (上岸)** | **标准答案库**。将新闻视为申论素材库和政治考点。分析政策风向以判断各部门招录趋势（谁在扩权招人，谁在边缘化）。 |

### 🔒 隐私至上
*   **零数据库**: 所有抓取的文章、分析报告、API Key 仅存储在浏览器的 `localStorage` 中。
*   **清除缓存**: 清除浏览器缓存即销毁所有数据。

---

## 🚀 快速开始

### 环境要求
*   Node.js (v18+)
*   一个 API Key (OpenAI, DeepSeek) 或者本地运行的 Ollama。

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/xinhua-insight.git
cd xinhua-insight

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

浏览器访问 `http://localhost:3000` 即可使用。

---

## ⚙️ 配置指南

点击右上角的 **设置 (⚙️)** 图标。本系统支持多种模型接入方式。

### 🔌 场景一：官方服务 (Standard)
直接使用 OpenAI 或 DeepSeek 的官方 API。
1. **Provider**: 选择 `OpenAI` 或 `DeepSeek`。
2. **API Key**: 输入你的 `sk-...` 密钥。
3. **Model ID**: 输入模型名 (如 `gpt-4o`, `deepseek-chat`)。

### 🔌 场景二：兼容 OpenAI 格式的第三方服务 (Any OpenAI-Compatible)
如果你使用 **OneAPI**, **Moonshot (Kimi)**, **Yi (零一万物)**, **Groq** 或其他中转服务：
1. **Provider**: 选择 `OpenAI`。
2. **Base URL**: 修改为第三方服务的 API 地址 (例如 `https://api.moonshot.cn/v1` 或你的中转域名)。
3. **API Key**: 输入对应的密钥。
4. **Model ID**: 输入该平台支持的模型名 (如 `moonshot-v1-8k`)。

### 🏠 场景三：本地隐私模型 (Local Ollama)
完全离线运行，数据不出本地。
1. 确保本地安装并运行了 Ollama (`ollama serve`)。
2. **Provider**: 选择 `Local Ollama`。
3. **Base URL**: 默认为 `http://localhost:11434`。
4. **Model ID**: 输入本地模型名 (如 `llama3`, `qwen:7b`)。
5. **注意**: 此时你拥有完全的数据主权。

---

## ⚠️ 免责声明

本项目仅供**教育和研究使用**。
1.  **数据来源**: 所有数据均来自公开的新闻网站。
2.  **AI 解读**: AI 生成的观点基于特定的“提示词工程”逻辑，带有明显的主观预设（如批判性视角或应试视角），**不代表**开发者的政治立场，也**不构成**任何投资或法律建议。
3.  请遵守当地法律法规使用互联网服务。

---

<p align="center">
  Made with ❤️ by the Xinhua Insight Team
</p>
