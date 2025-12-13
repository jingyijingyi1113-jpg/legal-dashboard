# -*- coding: utf-8 -*-
from flask import Flask, jsonify
from flask_cors import CORS
from config import SECRET_KEY, DEBUG, CORS_ORIGINS, HOST, PORT
from models import init_db
from routes.auth import auth_bp
from routes.timesheet import timesheet_bp
from routes.template import template_bp

app = Flask(__name__)
app.config['SECRET_KEY'] = SECRET_KEY
app.config['JSON_AS_ASCII'] = False

# 配置 CORS
CORS(app, origins=CORS_ORIGINS, supports_credentials=True)

# 注册蓝图
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(timesheet_bp, url_prefix='/api/timesheet')
app.register_blueprint(template_bp, url_prefix='/api')

# 健康检查
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': '服务运行正常'})

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
