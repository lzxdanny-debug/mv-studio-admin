# MV Studio Admin

MV Studio 的管理后台，围绕 **MV 流水线** 进行运维：项目/镜头排查、用户与积分、反馈、风格库、周边工具与 COS 配置。

## 技术栈

- **框架**：Next.js 16 (App Router) + React 18
- **样式**：Tailwind CSS
- **图表**：Recharts
- **状态管理**：Zustand（鉴权持久化）
- **数据请求**：TanStack Query v5（含 Devtools）
- **部署**：Cloudflare Workers（通过 `@opennextjs/cloudflare`）

## 关联服务

| 服务 | 本地地址 | 备注 |
|---|---|---|
| API 后端 | `http://localhost:4001` | `mv-studio-api`（NestJS） |
| 前台应用 | `http://localhost:4000` | `mv-studio-web` |
| 本管理后台 | `http://localhost:4002` | 本仓库（`pnpm dev`） |

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.local.example .env.local       # 或修改 .env.development
```

| 变量名 | 说明 | 示例 |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | API 后端地址 | `http://localhost:4001/api` |
| `NEXT_PUBLIC_MAIN_APP_URL` | 前台应用地址（跳转用） | `http://localhost:4000` |

### 3. 启动开发服务器

```bash
pnpm dev
# 访问 http://localhost:4002
```

### 4. 登录管理员账号

启动后端 `mv-studio-api` 时通过环境变量 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 自动 upsert 一个本地管理员账号。本仓库登录入口位于 `/login`。

## 信息架构

```
/admin                       仪表盘（MV 项目统计、趋势、镜头执行）
/admin/mv/projects           MV 项目列表
/admin/mv/projects/[id]      MV 项目详情（基础信息 / 镜头 / 规划 / 成片历史）
/admin/mv/shots              跨项目镜头清单（运维 retry / reset）
/admin/mv/styles             风格库（含预览图与重生触发）
/admin/tools/lrc             LRC 任务（内存态）
/admin/tools/quick-video     快速视频任务状态查询
/admin/users                 用户列表
/admin/users/[id]            用户详情（积分流水、最近 MV、反馈）
/admin/feedback              用户反馈
/admin/settings              系统设置（COS 凭证）
```

所有页面均调用 `mv-studio-api` 的 `/admin/*` 接口，后端通过 `AdminModule` + `RolesGuard + @Roles(ADMIN)` 集中保护。

## 常用命令

```bash
pnpm dev          # 开发模式（4002 端口）
pnpm build        # 标准构建
pnpm build:cf     # Cloudflare Workers 构建
pnpm lint         # ESLint
```

## 目录结构

```
src/
├── app/
│   ├── admin/              # 后台所有路由
│   ├── login/              # 登录页
│   └── providers.tsx       # QueryClient + Devtools
├── components/             # data-table / status-badge / shot-card / query-state / admin-sidebar
├── lib/                    # api.ts (axios + JWT) / utils.ts (cn, formatDate)
└── stores/                 # auth.store.ts (Zustand persist)
```

## 部署

通过 Cloudflare 绑定 GitHub 仓库自动部署：

- Build command: `pnpm build:cf`
- Node.js version: `20`
- 环境变量：`NEXT_PUBLIC_API_URL`、`NEXT_PUBLIC_MAIN_APP_URL`
