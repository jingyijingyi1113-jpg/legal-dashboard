#!/bin/bash
# 本地打包脚本 - 在 Mac 上执行
# 注意：此脚本会排除数据库文件，避免覆盖服务器上的用户数据

echo "===== 开始构建和打包 ====="

cd /Users/jingyiding/CodeBuddy/20251127100303

# 1. 构建前端
echo "正在构建前端..."
npm run build

if [ $? -ne 0 ]; then
    echo "前端构建失败！"
    exit 1
fi

# 2. 准备部署包目录
echo "正在准备部署包..."
rm -rf deploy_package/frontend
mkdir -p deploy_package/frontend

# 3. 复制前端文件
cp -r dist/* deploy_package/frontend/

# 4. 打包（排除数据库文件，避免覆盖服务器数据）
echo "正在打包（排除数据库）..."
tar --exclude='deploy_package/data/timesheet.db' -czvf timesheet_deploy.tar.gz deploy_package/

echo ""
echo "===== 打包完成 ====="
echo "文件位置: /Users/jingyiding/CodeBuddy/20251127100303/timesheet_deploy.tar.gz"
echo ""
echo "【重要】数据库文件已排除，服务器上的用户数据不会被覆盖"
echo ""
echo "===== 手动部署步骤 ====="
echo "1. 上传 timesheet_deploy.tar.gz 到服务器 /tmp/"
echo ""
echo "2. 在 OrcaTerm 执行以下命令："
echo ""
cat << 'EOF'
# 停止旧服务
sudo pkill -f "python3 app.py" 2>/dev/null
sudo pkill -f "http.server 8081" 2>/dev/null

# 解压新包
cd /tmp && sudo tar -xzvf timesheet_deploy.tar.gz

# 启动后端 (端口 5001)
cd /tmp/deploy_package && sudo nohup python3 app.py > /tmp/timesheet.log 2>&1 &

# 启动前端 (端口 8081)
cd /tmp/deploy_package/frontend && sudo nohup python3 -m http.server 8081 > /tmp/frontend.log 2>&1 &

# 确认服务运行
sleep 2 && ps aux | grep -E "(app.py|http.server)" | grep -v grep
EOF
echo ""
echo "3. 访问: http://9.135.78.109:8081 (强制刷新 Cmd+Shift+R)"
