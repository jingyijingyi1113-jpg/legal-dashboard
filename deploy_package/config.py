# -*- coding: utf-8 -*-
import os

# 环境变量
ENV = os.environ.get('FLASK_ENV', 'production')
IS_PRODUCTION = ENV == 'production'

# 数据库配置 - 使用外部持久化数据目录
DATABASE_DIR = '/data/anydev/CTD-Timesheet-data'
DATABASE_FILE = os.path.join(DATABASE_DIR, 'timesheet.db')

# 确保数据目录存在
os.makedirs(DATABASE_DIR, exist_ok=True)

# Flask 配置
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
DEBUG = not IS_PRODUCTION

# CORS 配置 - 生产环境添加服务器地址
CORS_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://9.135.78.109:8081',
    'http://9.135.78.109',
]

# 服务器配置
HOST = '0.0.0.0'
PORT = int(os.environ.get('PORT', 5001))

# ==================== 邮件配置 ====================
# 腾讯企业邮箱 SMTP 配置
EMAIL_ENABLED = os.environ.get('EMAIL_ENABLED', 'true').lower() == 'true'
EMAIL_SMTP_SERVER = os.environ.get('EMAIL_SMTP_SERVER', 'smtp.exmail.qq.com')
EMAIL_SMTP_PORT = int(os.environ.get('EMAIL_SMTP_PORT', 465))
EMAIL_SENDER = os.environ.get('EMAIL_SENDER', 'OMCT@tencent.com')
EMAIL_PASSWORD = os.environ.get('EMAIL_PASSWORD', 'LJ3XYGmmBn8SKnWR')
EMAIL_RECEIVERS = os.environ.get('EMAIL_RECEIVERS', 'ivyjyding@tencent.com').split(',')
EMAIL_MAX_SIZE_MB = int(os.environ.get('EMAIL_MAX_SIZE_MB', 45))
