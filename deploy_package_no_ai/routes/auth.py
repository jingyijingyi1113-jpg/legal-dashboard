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
    region = data.get('region', 'CN')
    user_group = data.get('group')
    
    if not all([username, password, real_name, team, center]):
        return jsonify({'success': False, 'message': '请填写所有必填字段'}), 400
    
    # 检查用户名是否已存在
    if User.find_by_username(username):
        return jsonify({'success': False, 'message': '用户名已存在'}), 400
    
    # 创建用户
    password_hash = generate_password_hash(password)
    user_id = User.create(username, password_hash, real_name, email, team, center, 'user', region, user_group)
    
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
                    'role': 'user',
                    'region': region,
                    'group': user_group
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
                'role': user['role'],
                'region': user.get('region', 'CN'),
                'group': user.get('user_group')
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
            'role': user['role'],
            'region': user.get('region', 'CN'),
            'group': user.get('user_group')
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
    return jsonify({
        'success': True,
        'data': [{
            'id': u['id'],
            'username': u['username'],
            'name': u['real_name'],
            'email': u.get('email', ''),
            'team': u['team'],
            'center': u['center'],
            'role': u['role'],
            'region': u.get('region', 'CN'),
            'group': u.get('user_group'),
            'createdAt': u['created_at']
        } for u in users]
    })

@auth_bp.route('/users', methods=['POST'])
@token_required
def create_user():
    """创建用户（管理员）"""
    admin = User.find_by_id(request.user_id)
    if admin['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    data = request.get_json()
    username = data.get('username')
    password = data.get('password', '123456')
    real_name = data.get('name') or data.get('realName')
    email = data.get('email', '')
    team = data.get('team', '')
    center = data.get('center', data.get('department', '合规交易部'))
    role = data.get('role', 'user')
    region = data.get('region', 'CN')
    user_group = data.get('group')
    
    if not username or not real_name:
        return jsonify({'success': False, 'message': '用户名和姓名不能为空'}), 400
    
    if User.find_by_username(username):
        return jsonify({'success': False, 'message': '用户名已存在'}), 400
    
    password_hash = generate_password_hash(password)
    user_id = User.create(username, password_hash, real_name, email, team, center, role, region, user_group)
    
    if user_id:
        return jsonify({
            'success': True,
            'message': '用户创建成功',
            'data': {'id': user_id}
        })
    else:
        return jsonify({'success': False, 'message': '创建失败'}), 500

@auth_bp.route('/users/<int:user_id>', methods=['PUT'])
@token_required
def update_user(user_id):
    """更新用户信息（管理员）"""
    admin = User.find_by_id(request.user_id)
    if admin['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    target_user = User.find_by_id(user_id)
    if not target_user:
        return jsonify({'success': False, 'message': '用户不存在'}), 404
    
    # 禁止修改 admin 用户
    if target_user['username'] == 'admin':
        return jsonify({'success': False, 'message': '不能修改管理员账户'}), 403
    
    data = request.get_json()
    update_fields = {}
    
    if 'username' in data:
        update_fields['username'] = data['username']
    if 'name' in data or 'realName' in data:
        update_fields['real_name'] = data.get('name') or data.get('realName')
    if 'email' in data:
        update_fields['email'] = data['email']
    if 'team' in data:
        update_fields['team'] = data['team']
    if 'center' in data:
        update_fields['center'] = data['center']
    if 'role' in data:
        update_fields['role'] = data['role']
    if 'region' in data:
        update_fields['region'] = data['region']
    if 'group' in data:
        update_fields['user_group'] = data['group']
    if 'password' in data and data['password']:
        update_fields['password_hash'] = generate_password_hash(data['password'])
    
    if update_fields:
        User.update(user_id, **update_fields)
    
    return jsonify({'success': True, 'message': '用户更新成功'})

@auth_bp.route('/users/<int:user_id>', methods=['DELETE'])
@token_required
def delete_user(user_id):
    """删除用户（管理员）"""
    admin = User.find_by_id(request.user_id)
    if admin['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    target_user = User.find_by_id(user_id)
    if not target_user:
        return jsonify({'success': False, 'message': '用户不存在'}), 404
    
    if target_user['username'] == 'admin':
        return jsonify({'success': False, 'message': '不能删除管理员账户'}), 403
    
    User.delete(user_id)
    return jsonify({'success': True, 'message': '用户删除成功'})

@auth_bp.route('/users/batch-import', methods=['POST'])
@token_required
def batch_import_users():
    """批量导入用户（管理员）"""
    admin = User.find_by_id(request.user_id)
    if admin['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    data = request.get_json()
    users_data = data.get('users', [])
    
    if not users_data:
        return jsonify({'success': False, 'message': '没有要导入的用户'}), 400
    
    users_to_create = []
    for u in users_data:
        users_to_create.append({
            'username': u.get('username'),
            'password_hash': generate_password_hash(u.get('password', '123456')),
            'real_name': u.get('name') or u.get('realName', ''),
            'email': u.get('email', ''),
            'team': u.get('team', ''),
            'center': u.get('center', u.get('department', '合规交易部')),
            'role': u.get('role', 'user'),
            'region': u.get('region', 'CN'),
            'user_group': u.get('group')
        })
    
    created = User.batch_create(users_to_create)
    return jsonify({
        'success': True,
        'message': f'成功导入 {created} 个用户',
        'data': {'count': created}
    })
