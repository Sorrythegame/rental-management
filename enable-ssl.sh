#!/bin/bash
set -e

# 为已部署的系统启用 HTTPS / 切换域名
# 用法：cd /opt/rental-management && ./enable-ssl.sh

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

cd "$PROJECT_DIR" || err "项目目录不存在: $PROJECT_DIR"

# 检测 docker compose 命令
if docker compose version &>/dev/null; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
else
  err "未找到 docker compose 命令"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  启用 HTTPS / 域名切换${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查 nginx 是否运行
if ! $COMPOSE_CMD ps | grep -q "rental-nginx"; then
  err "Nginx 服务未运行，请先执行 ./remote-deploy.sh 部署"
fi

read -p "请输入你的邮箱（用于 Let's Encrypt）: " EMAIL
if [ -z "$EMAIL" ]; then
  err "邮箱不能为空"
fi

log "正在为 $DOMAIN 申请 SSL 证书..."
mkdir -p certbot/conf certbot/www

docker run --rm \
  -v "$PROJECT_DIR/certbot/conf:/etc/letsencrypt" \
  -v "$PROJECT_DIR/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

log "证书申请成功，切换到 HTTPS 配置..."
cp -f nginx/nginx.https.conf nginx/nginx.conf
$COMPOSE_CMD exec nginx nginx -s reload

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  HTTPS 已启用！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}访问地址:${NC}"
echo -e "  前台页面: https://$DOMAIN"
echo -e "  API 接口: https://$DOMAIN/api"
echo ""
echo -e "${YELLOW}提示: 请确保域名 $DOMAIN 已解析到本机公网 IP${NC}"
