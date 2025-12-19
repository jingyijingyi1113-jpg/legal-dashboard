#!/bin/bash
# CVM 更新脚本 - 在 9.135.78.109 服务器上执行
# 代码目录: /data/anydev/CTD-Timesheet/
# 数据库: /data/anydev/CTD-Timesheet-data/timesheet.db

echo "===== 开始更新部署 ====="

CODE_DIR="/data/anydev/CTD-Timesheet"
DATA_DIR="/data/anydev/CTD-Timesheet-data"

# 1. 停止旧服务
echo "正在停止旧服务..."
pkill -f "gunicorn.*app:app" 2>/dev/null
pkill -f "python3.*app.py" 2>/dev/null
sleep 2

# 2. 备份当前版本
echo "正在备份当前版本..."
BACKUP_DIR="${CODE_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
cp -r "$CODE_DIR" "$BACKUP_DIR" 2>/dev/null || true

# 3. 解压新版本
echo "正在解压新版本..."
cd /tmp
tar -xzf deploy_update.tar.gz

# 4. 更新前端文件
echo "正在更新前端文件..."
rm -rf "$CODE_DIR/frontend/assets"
cp -r /tmp/deploy_update/frontend/* "$CODE_DIR/frontend/"

# 5. 更新后端文件
echo "正在更新后端文件..."
cp /tmp/deploy_update/backend/app.py "$CODE_DIR/backend/"
cp /tmp/deploy_update/backend/models.py "$CODE_DIR/backend/"
cp /tmp/deploy_update/backend/config.py "$CODE_DIR/backend/"
cp -r /tmp/deploy_update/backend/routes "$CODE_DIR/backend/"

# 6. 确保数据库目录存在并链接正确
echo "正在检查数据库配置..."
mkdir -p "$DATA_DIR"
if [ ! -f "$CODE_DIR/backend/data/timesheet.db" ]; then
    mkdir -p "$CODE_DIR/backend/data"
    ln -sf "$DATA_DIR/timesheet.db" "$CODE_DIR/backend/data/timesheet.db"
fi

# 7. 启动后端服务
echo "正在启动后端服务..."
cd "$CODE_DIR/backend"
source .venv/bin/activate 2>/dev/null || python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -q 2>/dev/null
nohup python3 app.py > "$CODE_DIR/backend.log" 2>&1 &
sleep 3

# 8. 验证服务
echo "正在验证服务..."
echo ""
echo "后端状态:"
curl -s http://127.0.0.1:5001/api/health
echo ""

# 9. 清理临时文件
rm -rf /tmp/deploy_update

echo ""
echo "===== 更新完成 ====="
echo "访问地址: http://9.135.78.109:5001"
