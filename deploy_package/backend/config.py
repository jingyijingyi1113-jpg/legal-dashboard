# -*- coding: utf-8 -*-
import os

# 环境变量
ENV = os.environ.get('FLASK_ENV', 'development')
IS_PRODUCTION = ENV == 'production'

# 数据库配置
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_DIR = os.path.join(BASE_DIR, 'data')
DATABASE_FILE = os.path.join(DATABASE_DIR, 'timesheet.db')

# 确保数据目录存在
os.makedirs(DATABASE_DIR, exist_ok=True)

# Flask 配置
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
DEBUG = not IS_PRODUCTION

# CORS 配置 - 生产环境添加服务器地址
CORS_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://9.135.78.109:8081',
    'http://9.135.78.109',
]

# 服务器配置
HOST = '0.0.0.0'
PORT = int(os.environ.get('PORT', 5001))
