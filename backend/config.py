# -*- coding: utf-8 -*-
import os

# 数据库配置
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_DIR = os.path.join(BASE_DIR, 'data')
DATABASE_FILE = os.path.join(DATABASE_DIR, 'timesheet.db')

# 确保数据目录存在
os.makedirs(DATABASE_DIR, exist_ok=True)

# Flask 配置
SECRET_KEY = 'your-secret-key-change-in-production'
DEBUG = True

# CORS 配置
CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']

# 服务器配置
HOST = '0.0.0.0'
PORT = 5001
