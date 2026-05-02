# 相机租赁管理系统

Monorepo（pnpm workspace），后端 NestJS + Prisma + MySQL，前端 Vue 3 + Vite + Ant Design Vue。

## 目录结构

```
apps/
├── backend/    NestJS API（端口 3000）
└── frontend/   Vite Vue 应用（端口 5173）
```

## 环境要求

- Node.js >= 20
- pnpm >= 10
- MySQL 8.x（已存在数据库 `camera_rental`）

## 首次初始化

```bash
# 1. 安装依赖（根目录）
pnpm install

# 2. 配置后端环境变量
# 编辑 apps/backend/.env，确认 DATABASE_URL 指向你的 MySQL
# 默认值：mysql://root:root@localhost:3306/camera_rental

# 3. 应用数据库 migration 建表
pnpm --filter backend exec prisma migrate deploy

# 4. 注入默认管理员账号
pnpm --filter backend prisma:seed
```

完成后即可启动：

```bash
pnpm dev
```

前端会自动打开 http://localhost:5173/

## 默认账号

| 字段 | 值 |
|---|---|
| 用户名 | `admin` |
| 密码 | `123456` |

> 密码以 bcrypt 哈希形式（10 轮）存储在 `Admin.passwordHash`。
> 上线前请通过修改 `prisma/seed.ts` 的 `DEFAULT_ADMIN_PASSWORD` 或手动 UPDATE 重置。

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 同时启动后端 watch 模式 + 前端 Vite |
| `pnpm build` | 构建前后端 |
| `pnpm --filter backend exec prisma migrate dev --name <name>` | 在 schema 改动后生成新 migration（需交互终端） |
| `pnpm --filter backend exec prisma migrate deploy` | 应用所有未执行的 migration（CI/部署用） |
| `pnpm --filter backend prisma:seed` | 重新执行 seed（基于 upsert，幂等） |
| `pnpm --filter backend exec prisma generate` | 重新生成 Prisma Client（拉新代码后跑一次） |

## 认证流程

1. 前端 `GET /api/auth/public-key` 拿到一次性 RSA 公钥
2. 前端用 `jsencrypt` 把密码 RSA 加密
3. `POST /api/auth/login` 上送 `{ username, password: <RSA密文> }`
4. 后端解密拿到明文密码，再用 `bcrypt.compare` 与 `passwordHash` 比对
5. 通过后返回 JWT `access_token`，前端存 `localStorage`

> 后端通过 `app.setGlobalPrefix('api')` 给所有路由加了 `/api` 前缀。
> 前端 axios `baseURL: '/api'`，由 Vite dev server 把 `/api` 代理到 `http://localhost:3000`（见 `vite.config.ts` 的 `server.proxy`）。
> 上线时 nginx/网关需把 `/api/*` 转发到后端。

## 数据库迁移

- `apps/backend/prisma/schema.prisma` 是唯一真源
- 改 schema 后必须生成新 migration（不要直接 `db push`）
- migration 文件放在 `apps/backend/prisma/migrations/`，**必须提交到 git**

## 故障排查

**`pnpm dev` 报 `EADDRINUSE :::3000` 或 5173 被占**
Windows 下 `concurrently` 父进程被强杀后子进程不会跟着退出。手动清理：
```bash
netstat -ano | findstr :3000
taskkill //F //PID <pid>
```

**Prisma 报 `Property 'admin' does not exist on type 'PrismaService'`**
Prisma Client 没生成。执行 `pnpm --filter backend exec prisma generate`。

**Prisma 报 `P3005 The database schema is not empty`**
数据库里有非 schema 中定义的旧表。手动清理后再 `migrate deploy`。

**登录提示「用户名或密码错误」**
- 确认 `Admin` 表里有数据：`SELECT * FROM Admin;`
- 没有数据则执行 `pnpm --filter backend prisma:seed`

**`/api/auth/public-key` 返回 304 + index.html，`/api/auth/login` 返回 404**
请求被 Vite dev server 拦截了，没走到后端。检查：
- `apps/frontend/vite.config.ts` 的 `server.proxy` 是否配了 `/api → http://localhost:3000`
- `apps/backend/src/main.ts` 是否有 `app.setGlobalPrefix('api')`
- 改了 `vite.config.ts` 后必须重启 `pnpm dev`（HMR 不会重载 server 配置）
