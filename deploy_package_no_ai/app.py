# -*- coding: utf-8 -*-
import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from config import SECRET_KEY, DEBUG, CORS_ORIGINS, HOST, PORT
from models import init_db
from routes.auth import auth_bp
from routes.timesheet import timesheet_bp
from routes.template import template_bp
from routes.organization import org_bp
from routes.backup import backup_bp, start_backup_scheduler

# 前端静态文件目录
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frontend')

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')
app.config['SECRET_KEY'] = SECRET_KEY
app.config['JSON_AS_ASCII'] = False

# 配置 CORS
CORS(app, origins=CORS_ORIGINS, supports_credentials=True)

# 注册蓝图
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(timesheet_bp, url_prefix='/api/timesheet')
app.register_blueprint(template_bp, url_prefix='/api')
app.register_blueprint(org_bp, url_prefix='/api/organization')
app.register_blueprint(backup_bp, url_prefix='/api/backup')

# 健康检查
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': '服务运行正常'})

# 前端路由 - 提供静态文件
@app.route('/')
def serve_index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, 'assets'), filename)

# 所有非 API 路由都返回 index.html（支持前端路由）
@app.route('/<path:path>')
def serve_frontend(path):
    # 如果是 API 路由，返回 404
    if path.startswith('api/'):
        return jsonify({'success': False, 'message': '接口不存在'}), 404
    # 尝试返回静态文件
    file_path = os.path.join(FRONTEND_DIR, path)
    if os.path.isfile(file_path):
        return send_from_directory(FRONTEND_DIR, path)
    # 否则返回 index.html（支持 SPA 路由）
    return send_from_directory(FRONTEND_DIR, 'index.html')

# 错误处理
@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'message': '接口不存在'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'message': '服务器内部错误'}), 500

if __name__ == '__main__':
    # 初始化数据库
    init_db()
    
    # 启动备份调度器
    start_backup_scheduler()
    
    print(f"服务器启动中...")
    print(f"地址: http://{HOST}:{PORT}")
    print(f"API 文档:")
    print(f"  POST /api/auth/register - 用户注册")
    print(f"  POST /api/auth/login - 用户登录")
    print(f"  GET  /api/auth/me - 获取当前用户")
    print(f"  GET  /api/timesheet/entries - 获取工时记录")
    print(f"  POST /api/timesheet/entries - 创建工时记录")
    print(f"  GET  /api/timesheet/stats - 获取统计数据")
    print(f"  GET  /api/my-template - 获取我的模板")
    
    app.run(host=HOST, port=PORT, debug=DEBUG)
