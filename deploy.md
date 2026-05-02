# 相机租赁管理系统 - Docker 部署指南

## 服务器环境要求

- **操作系统**：CentOS 8.2 64位（或其他支持 Docker 的 Linux 发行版）
- **域名**：`lys001.top`（已解析到服务器公网 IP）
- **端口**：服务器安全组需开放 `80` 和 `443` 端口

---

## 一、服务器初始化（CentOS 8.2）

使用 SSH 登录服务器后，依次执行：

```bash
# 1. 安装 Docker
sudo dnf config-manager --add-repo=https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io

# 2. 启动并启用 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 3. 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. 验证安装
docker --version
docker-compose --version
```

---

## 二、上传项目代码

将本地项目上传到服务器的 `/opt/rental-management` 目录（推荐方式：Git 克隆 或 SCP/rsync）。

```bash
# 示例：通过 Git 克隆（需先将代码推送到远程仓库）
cd /opt
git clone <你的仓库地址> rental-management
cd rental-management
```

---

## 三、配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env（务必修改密码和密钥）
nano .env
```

`.env` 文件示例：

```env
MYSQL_ROOT_PASSWORD=你的强密码
JWT_SECRET=你的随机密钥
```

> **安全提示**：`JWT_SECRET` 建议使用 `openssl rand -base64 32` 生成。

---

## 四、一键部署（含 SSL 证书自动申请）

### 4.1 修改域名（如需要）

如果实际域名不是 `lys001.top`，请修改以下文件中的域名：
- `nginx/nginx.conf`：第 3 行 `server_name`
- `nginx/nginx.https.conf`：第 3 行和第 14 行 `server_name`
- `init-ssl.sh`：第 4 行 `DOMAIN`

### 4.2 执行部署脚本

```bash
# 给脚本执行权限
chmod +x init-ssl.sh

# 执行部署（替换为你的邮箱，用于 Let's Encrypt 注册）
./init-ssl.sh your-email@example.com
```

脚本会自动完成：
1. 构建并启动 MySQL + 后端 + Nginx（HTTP 模式）
2. 等待服务就绪
3. 通过 Certbot 申请 SSL 证书
4. 切换 Nginx 到 HTTPS 配置并 reload

---

## 五、手动部署（如果脚本执行失败）

```bash
# 1. 确保目录存在
mkdir -p certbot/conf certbot/www

# 2. 首次启动（HTTP 模式）
docker compose up -d --build

# 3. 手动申请证书（将 your-email@example.com 替换为你的邮箱）
docker run --rm \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d lys001.top

# 4. 切换到 HTTPS 配置
cp nginx/nginx.https.conf nginx/nginx.conf
docker compose exec nginx nginx -s reload
```

---

## 六、日常维护命令

```bash
# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f backend   # 后端日志
docker compose logs -f nginx     # Nginx 日志
docker compose logs -f db        # 数据库日志

# 重启服务
docker compose restart

# 更新部署（拉取新代码后）
docker compose down
docker compose up -d --build

# 备份数据库
docker exec rental-db mysqldump -uroot -p"你的密码" camera_rental > backup.sql

# 进入数据库容器
docker exec -it rental-db mysql -uroot -p
```

---

## 七、SSL 证书续期

Let's Encrypt 证书有效期为 90 天，建议设置自动续期：

```bash
# 手动续期
docker run --rm \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot renew

# 续期后重载 Nginx
docker compose exec nginx nginx -s reload
```

也可以添加到 crontab 自动续期：

```bash
# 编辑 crontab
crontab -e

# 添加以下行（每月 1 号凌晨 3 点执行续期）
0 3 1 * * cd /opt/rental-management && docker run --rm -v "$(pwd)/certbot/conf:/etc/letsencrypt" -v "$(pwd)/certbot/www:/var/www/certbot" certbot/certbot renew --quiet && docker compose exec nginx nginx -s reload
```

---

## 八、服务架构说明

| 服务 | 容器名 | 内部端口 | 外部端口 | 说明 |
|------|--------|----------|----------|------|
| MySQL | rental-db | 3306 | - | 数据持久化存储 |
| NestJS 后端 | rental-backend | 3000 | - | API 服务 |
| Nginx | rental-nginx | 80/443 | 80/443 | 静态文件 + 反向代理 |

**请求流转**：
- `https://lys001.top/` → Nginx → 前端 Vue 静态文件
- `https://lys001.top/api/*` → Nginx → 后端 NestJS (3000)
- `https://lys001.top/api/uploads/*` → Nginx → 直接读取上传文件（不走后端）

**数据持久化**：
- 数据库数据：`docker volume rental-management_db_data`
- 上传文件：`docker volume rental-management_uploads`

---

## 九、常见问题

### 1. 防火墙拦截

```bash
# 开放 80/443 端口
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 2. 域名未解析

确保证书申请前，域名 `lys001.top` 的 A 记录已指向服务器公网 IP，且 DNS 已生效：

```bash
nslookup lys001.top
```

### 3. 端口被占用

如果 80/443 被其他服务占用，先停止占用服务：

```bash
sudo lsof -i :80
sudo lsof -i :443
```
