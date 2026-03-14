# Xinhua Insight v1.1.0 发布说明

发布日期：2026-03-14

## 版本定位

v1.1.0 是在 v1.0.0 可用版本基础上的稳定性与数据质量增强版本，重点提升“抓取 → 清洗 → 收录”的一致性与可分析性。

## 主要更新

### 1) 抓取与清洗增强

- 新增标题标准化：去前缀标签并统一空白。
- 新增 URL 规范化：转绝对地址，移除 hash 与常见追踪参数。
- 新增更稳健的日期提取规则，支持多种 URL 日期模式。
- `crawlNews({ limit_hours })` 增加按小时窗口筛选。

### 2) 结构化收录与格式化输出

- 本地数据新增元信息：
  - `cleaned_at`
  - `collection_notes`
  - `markdown_digest`
- 新增 `getFormattedCollection()`：可同时输出
  - 结构化 JSON
  - Markdown 汇总文本

### 3) 文档与版本更新

- 项目版本号升级为 `1.1.0`。
- 中英文 README 版本标识更新为 v1.1 / 1.1.0。
- 项目状态文档同步升级到 v1.1。

## 升级说明

1. 拉取最新代码并安装依赖：

```bash
npm install
```

2. 启动开发环境：

```bash
npm run dev
```

3. 生产构建校验：

```bash
npm run build
```

## 已知事项

- 当前 `npm run lint` 可能受 ESLint 9 配置迁移影响（若缺少 `eslint.config.js`）。
- 构建仍可能出现 bundle size 提示（不影响运行）。
