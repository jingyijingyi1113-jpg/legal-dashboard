#!/bin/bash
# 工时管理系统部署脚本
# 服务器: 9.135.78.109
# 前端端口: 8081 (Nginx)
# 后端端口: 5001 (Flask)

set -e

# 配置
SERVER="9.135.78.109"
DEPLOY_DIR="/opt/timesheet"
BACKEND_PORT=5001

echo "=========================================="
echo "工时管理系统部署脚本"
echo "=========================================="

# 1. 构建前端
echo "[1/5] 构建前端..."
npm run build

# 2. 创建部署包
echo "[2/5] 创建部署包..."
rm -rf deploy_package
mkdir -p deploy_package
cp -r dist deploy_package/
cp -r backend deploy_package/
cp deploy/nginx.conf deploy_package/
rm -rf deploy_package/backend/__pycache__
rm -rf deploy_package/backend/routes/__pycache__
rm -f deploy_package/backend/*.db
rm -f deploy_package/backend/data/*.db

# 3. 创建服务器启动脚本
cat > deploy_package/start_backend.sh << 'EOF'
#!/bin/bash
cd /opt/timesheet/backend
export FLASK_ENV=production
export SECRET_KEY=$(openssl rand -hex 32)

# 安装依赖
pip3 install -r requirements.txt -q

# 使用 gunicorn 启动（生产环境）
if command -v gunicorn &> /dev/null; then
    gunicorn -w 4 -b 0.0.0.0:5001 app:app --daemon --pid /tmp/timesheet_backend.pid
else
    # 回退到 Flask 开发服务器
    nohup python3 app.py > /var/log/timesheet_backend.log 2>&1 &
    echo $! > /tmp/timesheet_backend.pid
fi

echo "后端服务已启动，PID: $(cat /tmp/timesheet_backend.pid)"
EOF

cat > deploy_package/stop_backend.sh << 'EOF'
#!/bin/bash
if [ -f /tmp/timesheet_backend.pid ]; then
    kill $(cat /tmp/timesheet_backend.pid) 2>/dev/null || true
    rm -f /tmp/timesheet_backend.pid
    echo "后端服务已停止"
else
    pkill -f "gunicorn.*app:app" 2>/dev/null || true
    pkill -f "python3.*app.py" 2>/dev/null || true
    echo "后端服务已停止"
fi
EOF

chmod +x deploy_package/*.sh

echo "[3/5] 部署包创建完成: deploy_package/"

echo ""
echo "=========================================="
echo "请手动执行以下步骤完成部署："
echo "=========================================="
echo ""
echo "1. 上传部署包到服务器:"
echo "   scp -r deploy_package/* root@${SERVER}:${DEPLOY_DIR}/"
echo ""
echo "2. SSH 登录服务器:"
echo "   ssh root@${SERVER}"
echo ""
echo "3. 安装 Nginx 配置:"
echo "   cp ${DEPLOY_DIR}/nginx.conf /etc/nginx/conf.d/timesheet.conf"
echo "   nginx -t && nginx -s reload"
echo ""
echo "4. 启动后端服务:"
echo "   cd ${DEPLOY_DIR} && ./start_backend.sh"
echo ""
echo "5. 访问系统:"
echo "   http://${SERVER}:8081"
echo ""
echo "=========================================="
