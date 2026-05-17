# 跨时空锐评 — 本地启动指南

## 目录结构

```
debate-app/
├── server/
│   └── index.js        ← 后端主服务（所有 Prompt + API 路由）
├── public/
│   ├── index.html      ← 前端页面
│   └── js/
│       ├── api.js      ← 后端接口封装
│       ├── game.js     ← 游戏状态和核心逻辑
│       └── main.js     ← UI 渲染和交互
├── .env.example        ← API Key 配置模板
├── package.json
└── README.md
```

## 启动步骤

### 1. 安装依赖

```bash
cd debate-app
npm install
```

### 2. 配置 API Key

```bash
cp .env.example .env
```

打开 `.env` 文件，把你的 DeepSeek API Key 填进去：

```
DEEPSEEK_API_KEY=sk-你的key
```

### 3. 启动服务

```bash
npm start
```

开发模式（文件改动自动重启）：

```bash
npm run dev
```

### 4. 打开浏览器

```
http://localhost:3000
```

---

## API 路由一览

| 路由 | 功能 |
|------|------|
| GET  /api/health | 检查服务和 Key 状态 |
| POST /api/song/analyze | 歌曲分析，返回情绪标签、观众建议等 |
| POST /api/deliberation/speak | 议论期单条发言 |
| POST /api/debate/speak | 辩论发言 |
| POST /api/judge/score | 裁判单轮评分 |
| POST /api/gr/intervene | Gr 小姐介入发言 |
| POST /api/audience/speak | 随机观众发言 |
| POST /api/judge/verdict | 最终判词 |

---

## 部署上线

任意支持 Node.js 的平台均可部署：
- **Railway** / **Render**：直接连 GitHub 仓库，设置环境变量 `DEEPSEEK_API_KEY`
- **VPS**：`npm start` 配合 PM2 守护进程

---

## 常见问题

**Q: 报错 `DEEPSEEK_API_KEY 未配置`**
A: 检查 `.env` 文件是否存在且 Key 填写正确

**Q: `Cannot find module 'node-fetch'`**
A: 运行 `npm install` 重新安装依赖

**Q: 页面空白**
A: 检查 `public/index.html` 是否存在
