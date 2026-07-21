# get-bilibili-dynamic-for-ci

通过 GitHub Actions + Playwright 定时获取指定 B 站用户的最新动态，自动提交回仓库。

## 工作原理

```
定时触发 (schedule) ──► GitHub Actions ──► Playwright 无头浏览器
                                              │
                                              ▼
                                          打开 B 站空间动态页
                                              │
                                              ▼
                                          提取动态列表 (opus/video/转发)
                                              │
                                              ▼
                                          写入 dynamic.json ──► git commit & push
```

## 使用方式

### 1. 配置用户 UID

默认抓取 UID `3494372658121066`。如需修改：

- **通过 GitHub Variables（推荐）**：在仓库 Settings → Actions → Variables → New variable，添加 `BILIBILI_UID`，值为目标用户 UID
- **或** 直接修改 `src/fetch-dynamic.js` 第 4 行的默认值

### 2. 触发抓取

- **定时**：每天 UTC 0:00（北京时间 8:00）自动运行
- **手动**：在 GitHub 仓库 Actions 页面点击 `Fetch Bilibili Dynamics` → `Run workflow`

### 3. 查看结果

每次运行后 `dynamic.json` 会被更新并提交到仓库。

## 输出格式

```json
{
  "uid": "3494372658121066",
  "fetched_at": "2026-07-21T12:00:00.000Z",
  "count": 13,
  "dynamics": [
    {
      "id": "1187318613542961155",
      "type": "置顶",
      "content": "博客链接 https://lm-xiao-fen.github.io",
      "time": "04月04日",
      "url": "https://www.bilibili.com/opus/1187318613542961155"
    },
    {
      "id": "BV1XmKB65EgY",
      "type": "视频",
      "content": "01:48:04 【mc，破碎的剧本】不是怎么老把我踢出去 302 0",
      "time": "2天前 · 投稿了视频",
      "url": "https://www.bilibili.com/video/BV1XmKB65EgY"
    }
  ]
}
```

### 字段说明

| 字段 | 说明 |
|------|------|
| `id` | opus 数字 ID（文字动态）或 BV 号（视频动态） |
| `type` | `置顶` / `动态` / `视频` / `转发` |
| `content` | 动态文本内容 |
| `time` | 发布时间（B 站相对时间格式） |
| `url` | 动态原文链接 |

## 本地测试

```bash
npm install
npx playwright install chromium
BILIBILI_UID=3494372658121066 npm run fetch
```

## 项目结构

```
├── .github/workflows/fetch-dynamic.yml   # GitHub Actions 工作流
├── src/fetch-dynamic.js                  # Playwright 抓取脚本
├── package.json                          # Node.js 配置
├── dynamic.json                          # 输出文件（CI 自动生成）
└── .gitignore
```
