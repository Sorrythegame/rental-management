#!/bin/bash
set -e

DOMAIN="lys001.top"
EMAIL="${1:-your-email@example.com}"

echo "=== 1. 确保目录存在 ==="
mkdir -p certbot/conf certbot/www

echo "=== 2. 启动 HTTP 模式服务 ==="
docker compose up -d --build

echo "=== 3. 等待服务就绪 ==="
sleep 10

echo "=== 4. 申请 SSL 证书 ==="
docker run --rm \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

echo "=== 5. 切换到 HTTPS 配置 ==="
cp nginx/nginx.https.conf nginx/nginx.conf
docker compose exec nginx nginx -s reload

echo ""
echo "========================================"
echo "  部署完成！请访问 https://$DOMAIN"
echo "========================================"
