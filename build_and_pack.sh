#!/bin/bash
# 本地打包脚本 - 在 Mac 上执行

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
rm -rf deploy_package
mkdir -p deploy_package/backend
mkdir -p deploy_package/dist

# 3. 复制文件
cp -r dist/* deploy_package/dist/
cp -r backend/*.py deploy_package/backend/
cp -r backend/routes deploy_package/backend/
cp -r backend/data deploy_package/backend/
cp backend/requirements.txt deploy_package/backend/ 2>/dev/null

# 4. 复制部署配置
cp deploy/nginx.conf deploy_package/ 2>/dev/null
cp deploy/*.sh deploy_package/ 2>/dev/null

# 5. 打包
echo "正在打包..."
tar -czf timesheet_deploy.tar.gz -C deploy_package .

echo "===== 打包完成 ====="
echo "文件位置: /Users/jingyiding/CodeBuddy/20251127100303/timesheet_deploy.tar.gz"
echo ""
echo "下一步: 通过 OrcaTerm 文件管理器上传到服务器 /tmp/ 目录"
