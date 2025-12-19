# -*- coding: utf-8 -*-
from flask import Blueprint, request, jsonify
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import User, SystemConfig
from routes.auth import token_required

config_bp = Blueprint('config', __name__)

@config_bp.route('/ai-config', methods=['GET'])
@token_required
def get_ai_config():
    """获取AI功能配置"""
    user = User.find_by_id(request.user_id)
    if not user:
        return jsonify({'success': False, 'message': '用户不存在'}), 404
    
    ai_mode = SystemConfig.get('ai_mode', 'off')
    user_ai_enabled = bool(user.get('ai_enabled', 0))
    
    # 判断当前用户是否可以使用AI
    can_use_ai = False
    if ai_mode == 'all':
        can_use_ai = True
    elif ai_mode == 'selective':
        can_use_ai = user_ai_enabled
    # ai_mode == 'off' 时 can_use_ai 保持 False
    
    return jsonify({
        'success': True,
        'data': {
            'aiMode': ai_mode,
            'userAiEnabled': user_ai_enabled,
            'canUseAi': can_use_ai
        }
    })

@config_bp.route('/ai-config', methods=['PUT'])
@token_required
def update_ai_config():
    """更新AI功能配置（仅管理员）"""
    admin = User.find_by_id(request.user_id)
    if admin['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    data = request.get_json()
    ai_mode = data.get('aiMode')
    
    if ai_mode not in ['off', 'selective', 'all']:
        return jsonify({'success': False, 'message': '无效的AI模式'}), 400
    
    SystemConfig.set('ai_mode', ai_mode)
    
    return jsonify({
        'success': True,
        'message': 'AI配置已更新',
        'data': {'aiMode': ai_mode}
    })

@config_bp.route('/users/<int:user_id>/ai-enabled', methods=['PUT'])
@token_required
def update_user_ai_enabled(user_id):
    """更新用户AI功能开关（仅管理员）"""
    admin = User.find_by_id(request.user_id)
    if admin['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    target_user = User.find_by_id(user_id)
    if not target_user:
        return jsonify({'success': False, 'message': '用户不存在'}), 404
    
    data = request.get_json()
    ai_enabled = 1 if data.get('aiEnabled', False) else 0
    
    User.update(user_id, ai_enabled=ai_enabled)
    
    return jsonify({
        'success': True,
        'message': 'AI权限已更新',
        'data': {'aiEnabled': bool(ai_enabled)}
    })
