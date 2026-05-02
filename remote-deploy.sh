#!/bin/bash
set -e

# 相机租赁管理系统 - 服务器自动化部署脚本
# 适用系统：CentOS 8.x / AlmaLinux 8 / Rocky Linux 8
# 用法：chmod +x remote-deploy.sh && ./remote-deploy.sh

DOMAIN="lys001.top"
PROJECT_DIR="/opt/rental-management"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then
  err "请使用 root 权限运行此脚本 (sudo ./remote-deploy.sh)"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  相机租赁管理系统 - 服务器部署脚本${NC}"
echo -e "${BLUE}========================================${NC}"

# ============================================
# 1. 安装基础工具
# ============================================
log "步骤 1/7: 安装基础工具..."
dnf install -y yum-utils git curl 2>/dev/null || yum install -y yum-utils git curl

# ============================================
# 2. 安装 Docker
# ============================================
log "步骤 2/7: 检查并安装 Docker..."
if ! command -v docker &>/dev/null; then
  log "Docker 未安装，开始安装..."
  yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo 2>/dev/null || \
    dnf config-manager --add-repo=https://download.docker.com/linux/centos/docker-ce.repo
  dnf install -y docker-ce docker-ce-cli containerd.io 2>/dev/null || \
    yum install -y docker-ce docker-ce-cli containerd.io
  systemctl start docker
  systemctl enable docker
  log "Docker 安装完成"
else
  log "Docker 已安装，跳过"
fi

# 检查 Docker 是否运行
if ! systemctl is-active --quiet docker; then
  systemctl start docker
  systemctl enable docker
fi

# ============================================
# 3. 安装 Docker Compose
# ============================================
log "步骤 3/7: 检查并安装 Docker Compose..."
if docker compose version &>/dev/null; then
  COMPOSE_CMD="docker compose"
  log "Docker Compose (v2 插件) 已安装"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
  log "Docker Compose (独立二进制) 已安装"
else
  log "Docker Compose 未安装，开始安装..."
  # 优先尝试安装 v2 插件
  DOCKER_CONFIG=${DOCKER_CONFIG:-/usr/libexec/docker/cli-plugins}
  mkdir -p "$DOCKER_CONFIG"
  curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" -o "$DOCKER_CONFIG/docker-compose"
  chmod +x "$DOCKER_CONFIG/docker-compose"
  if docker compose version &>/dev/null; then
    COMPOSE_CMD="docker compose"
    log "Docker Compose (v2 插件) 安装完成"
  else
    # 备用方案：独立二进制
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    COMPOSE_CMD="docker-compose"
    log "Docker Compose (独立二进制) 安装完成"
  fi
fi

# ============================================
# 4. 克隆代码仓库
# ============================================
log "步骤 4/7: 拉取项目代码..."

# 如果目录已存在，询问是否覆盖
if [ -d "$PROJECT_DIR/.git" ]; then
  warn "检测到项目已存在: $PROJECT_DIR"
  read -p "是否执行 git pull 更新代码? [Y/n]: " UPDATE_GIT
  UPDATE_GIT=${UPDATE_GIT:-Y}
  if [[ "$UPDATE_GIT" =~ ^[Yy]$ ]]; then
    cd "$PROJECT_DIR"
    git pull
    log "代码已更新"
  fi
else
  read -p "请输入 Git 仓库地址 (例如 https://github.com/xxx/rental-management.git): " GIT_REPO
  if [ -z "$GIT_REPO" ]; then
    err "Git 仓库地址不能为空"
  fi
  git clone "$GIT_REPO" "$PROJECT_DIR"
  log "代码克隆完成"
fi

cd "$PROJECT_DIR"

# ============================================
# 5. 配置环境变量
# ============================================
log "步骤 5/7: 配置环境变量..."

if [ -f ".env" ]; then
  warn ".env 文件已存在"
  read -p "是否重新生成 .env? [y/N]: " REGEN_ENV
  REGEN_ENV=${REGEN_ENV:-N}
else
  REGEN_ENV="Y"
fi

if [[ "$REGEN_ENV" =~ ^[Yy]$ ]]; then
  read -p "请输入 MySQL root 密码 [默认: CameraRental@2026]: " MYSQL_PASS
  MYSQL_PASS=${MYSQL_PASS:-CameraRental@2026}

  read -p "请输入 JWT 密钥 [留空则自动生成]: " JWT_SECRET
  if [ -z "$JWT_SECRET" ]; then
    if command -v openssl &>/dev/null; then
      JWT_SECRET=$(openssl rand -base64 32)
    else
      JWT_SECRET="change-me-$(date +%s)-random-secret-key"
    fi
    log "已自动生成 JWT 密钥"
  fi

  cat > .env <<EOF
# 数据库配置
MYSQL_ROOT_PASSWORD=$MYSQL_PASS

# JWT 密钥
JWT_SECRET=$JWT_SECRET
EOF
  log ".env 文件已生成"
fi

# 读取配置用于后续显示
MYSQL_PASS=$(grep MYSQL_ROOT_PASSWORD .env | cut -d'=' -f2 | head -1)
JWT_SECRET=$(grep JWT_SECRET .env | cut -d'=' -f2 | head -1)

# ============================================
# 6. 构建并启动服务
# ============================================
log "步骤 6/7: 构建并启动服务（首次启动使用 HTTP 模式）..."

mkdir -p certbot/conf certbot/www

# nginx.conf 默认已是 HTTP 配置，无需额外处理
# 若后续更新部署，证书已存在时 nginx.https.conf 可直接使用

$COMPOSE_CMD down 2>/dev/null || true
$COMPOSE_CMD up -d --build

log "服务已启动，等待就绪..."
sleep 15

# 检查服务状态
if ! $COMPOSE_CMD ps | grep -q "Up"; then
  err "服务启动失败，请检查日志: $COMPOSE_CMD logs"
fi

# ============================================
# 7. 申请 SSL 证书
# ============================================
log "步骤 7/7: 申请 SSL 证书..."

read -p "请输入你的邮箱（用于 Let's Encrypt 注册）: " EMAIL
if [ -z "$EMAIL" ]; then
  warn "邮箱为空，跳过 SSL 证书申请。后续可手动执行 certbot 申请。"
  log "部署完成（HTTP 模式）。访问: http://$DOMAIN"
  exit 0
fi

log "正在为 $DOMAIN 申请 SSL 证书..."
docker run --rm \
  -v "$PROJECT_DIR/certbot/conf:/etc/letsencrypt" \
  -v "$PROJECT_DIR/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

log "证书申请成功，切换到 HTTPS..."
cp -f nginx/nginx.https.conf nginx/nginx.conf
$COMPOSE_CMD exec nginx nginx -s reload

# ============================================
# 完成
# ============================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}访问地址:${NC}"
echo -e "  前台页面: https://$DOMAIN"
echo -e "  API 接口: https://$DOMAIN/api"
echo ""
echo -e "${BLUE}配置信息:${NC}"
echo -e "  项目目录: $PROJECT_DIR"
echo -e "  MySQL 密码: ${YELLOW}$MYSQL_PASS${NC}"
echo -e "  数据库名: camera_rental"
echo -e "  JWT 密钥: 已保存在 $PROJECT_DIR/.env"
echo ""
echo -e "${BLUE}常用命令:${NC}"
echo -e "  查看状态: cd $PROJECT_DIR && $COMPOSE_CMD ps"
echo -e "  查看日志: cd $PROJECT_DIR && $COMPOSE_CMD logs -f"
echo -e "  重启服务: cd $PROJECT_DIR && $COMPOSE_CMD restart"
echo -e "  备份数据库: docker exec rental-db mysqldump -uroot -p'$MYSQL_PASS' camera_rental > backup.sql"
echo ""
echo -e "${YELLOW}提示: 请确保域名 $DOMAIN 已解析到本机公网 IP，且安全组已开放 80/443 端口${NC}"
