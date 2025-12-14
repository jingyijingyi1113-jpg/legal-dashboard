#!/bin/bash
# 服务器更新脚本 - 在 9.135.78.109 服务器上执行
# 使用方法: 将此脚本内容复制到 OrcaTerm 终端执行

echo "===== 开始更新部署 ====="

# 1. 停止旧服务
echo "正在停止旧服务..."
pkill -f "python3 app.py" 2>/dev/null
pkill -f "http.server 8081" 2>/dev/null
sleep 2

# 2. 备份旧版本（可选）
echo "正在备份旧版本..."
if [ -d "/opt/timesheet" ]; then
    cp -r /opt/timesheet /opt/timesheet_backup_$(date +%Y%m%d_%H%M%S)
fi

# 3. 解压新版本
echo "正在解压新版本..."
mkdir -p /opt/timesheet
tar -xzf /tmp/timesheet_deploy.tar.gz -C /opt/timesheet

# 4. 启动后端
echo "正在启动后端..."
cd /opt/timesheet/backend
nohup python3 app.py > /opt/timesheet/backend.log 2>&1 &
sleep 2

# 5. 启动前端
echo "正在启动前端..."
cd /opt/timesheet/dist
nohup python3 -m http.server 8081 > /opt/timesheet/frontend.log 2>&1 &
sleep 2

# 6. 验证服务
echo "正在验证服务..."
echo ""
echo "后端状态:"
curl -s http://127.0.0.1:5001/api/health
echo ""
echo ""
echo "前端状态:"
curl -s http://127.0.0.1:8081/ | head -3
echo ""

echo "===== 更新完成 ====="
echo "访问地址: http://9.135.78.109:8081"
