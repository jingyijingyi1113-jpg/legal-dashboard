# -*- coding: utf-8 -*-
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import User
from config import SECRET_KEY

auth_bp = Blueprint('auth', __name__)

def generate_token(user_id, username):
    """生成 JWT token"""
    payload = {
        'user_id': user_id,
        'username': username,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def verify_token(token):
    """验证 JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def token_required(f):
    """Token 验证装饰器"""
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'success': False, 'message': '缺少认证令牌'}), 401
        
        if token.startswith('Bearer '):
            token = token[7:]
        
        payload = verify_token(token)
        if not payload:
            return jsonify({'success': False, 'message': '令牌无效或已过期'}), 401
        
        request.user_id = payload['user_id']
        request.username = payload['username']
        return f(*args, **kwargs)
    return decorated

@auth_bp.route('/register', methods=['POST'])
def register():
    """用户注册"""
    data = request.get_json()
    
    username = data.get('username')
    password = data.get('password')
    real_name = data.get('realName') or data.get('real_name')
    email = data.get('email', '')
    team = data.get('team')
    center = data.get('center')
    
    if not all([username, password, real_name, team, center]):
        return jsonify({'success': False, 'message': '请填写所有必填字段'}), 400
    
    # 检查用户名是否已存在
    if User.find_by_username(username):
        return jsonify({'success': False, 'message': '用户名已存在'}), 400
    
    # 创建用户
    password_hash = generate_password_hash(password)
    user_id = User.create(username, password_hash, real_name, email, team, center)
    
    if user_id:
        token = generate_token(user_id, username)
        return jsonify({
            'success': True,
            'message': '注册成功',
            'data': {
                'token': token,
                'user': {
                    'id': user_id,
                    'username': username,
                    'realName': real_name,
                    'email': email,
                    'team': team,
                    'center': center,
                    'role': 'user'
                }
            }
        })
    else:
        return jsonify({'success': False, 'message': '注册失败'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """用户登录"""
    data = request.get_json()
    
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'success': False, 'message': '请输入用户名和密码'}), 400
    
    user = User.find_by_username(username)
    if not user:
        return jsonify({'success': False, 'message': '用户不存在'}), 401
    
    if not check_password_hash(user['password_hash'], password):
        return jsonify({'success': False, 'message': '密码错误'}), 401
    
    token = generate_token(user['id'], username)
    return jsonify({
        'success': True,
        'message': '登录成功',
        'data': {
            'token': token,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'realName': user['real_name'],
                'email': user['email'],
                'team': user['team'],
                'center': user['center'],
                'role': user['role']
            }
        }
    })

@auth_bp.route('/me', methods=['GET'])
@token_required
def get_current_user():
    """获取当前用户信息"""
    user = User.find_by_id(request.user_id)
    if not user:
        return jsonify({'success': False, 'message': '用户不存在'}), 404
    
    return jsonify({
        'success': True,
        'data': {
            'id': user['id'],
            'username': user['username'],
            'realName': user['real_name'],
            'email': user['email'],
            'team': user['team'],
            'center': user['center'],
            'role': user['role']
        }
    })

@auth_bp.route('/change-password', methods=['POST'])
@token_required
def change_password():
    """修改密码"""
    data = request.get_json()
    
    old_password = data.get('oldPassword')
    new_password = data.get('newPassword')
    
    if not old_password or not new_password:
        return jsonify({'success': False, 'message': '请输入旧密码和新密码'}), 400
    
    user = User.find_by_id(request.user_id)
    if not check_password_hash(user['password_hash'], old_password):
        return jsonify({'success': False, 'message': '旧密码错误'}), 401
    
    new_hash = generate_password_hash(new_password)
    User.update(request.user_id, password_hash=new_hash)
    
    return jsonify({'success': True, 'message': '密码修改成功'})

@auth_bp.route('/users', methods=['GET'])
@token_required
def get_all_users():
    """获取所有用户（管理员）"""
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    users = User.get_all()
    return jsonify({'success': True, 'data': users})
