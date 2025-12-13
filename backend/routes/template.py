# -*- coding: utf-8 -*-
from flask import Blueprint, request, jsonify
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import Template, User
from routes.auth import token_required

template_bp = Blueprint('template', __name__)

@template_bp.route('/templates', methods=['GET'])
@token_required
def get_templates():
    """获取所有模板"""
    templates = Template.get_all()
    return jsonify({'success': True, 'data': templates})

@template_bp.route('/templates/<center>', methods=['GET'])
@token_required
def get_template_by_center(center):
    """获取指定中心的模板"""
    team = request.args.get('team')
    template = Template.find_by_center(center, team)
    
    if not template:
        return jsonify({'success': False, 'message': '模板不存在'}), 404
    
    return jsonify({'success': True, 'data': template})

@template_bp.route('/templates', methods=['POST'])
@token_required
def create_or_update_template():
    """创建或更新模板（管理员）"""
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    data = request.get_json()
    
    center = data.get('center')
    team = data.get('team')
    name = data.get('name', f'{center}工时模板')
    fields = data.get('fields', [])
    
    if not center:
        return jsonify({'success': False, 'message': '中心名称不能为空'}), 400
    
    Template.create_or_update(center, team, name, fields)
    
    return jsonify({'success': True, 'message': '模板保存成功'})

@template_bp.route('/my-template', methods=['GET'])
@token_required
def get_my_template():
    """获取当前用户所属中心的模板"""
    user = User.find_by_id(request.user_id)
    center = user['center']
    team = user['team']
    
    # 先尝试获取团队专属模板
    template = Template.find_by_center(center, team)
    
    # 如果没有团队专属模板，获取中心通用模板
    if not template:
        template = Template.find_by_center(center, None)
    
    if not template:
        # 返回默认模板
        return jsonify({
            'success': True,
            'data': {
                'center': center,
                'team': team,
                'name': '默认模板',
                'fields': [
                    {'key': 'category', 'label': '工作类别', 'type': 'select', 'required': True, 'options': ['日常工作', '项目工作', '会议', '其他']},
                    {'key': 'hours', 'label': '工时', 'type': 'number', 'required': True, 'min': 0, 'max': 24},
                    {'key': 'description', 'label': '工作描述', 'type': 'text', 'required': False}
                ]
            }
        })
    
    return jsonify({'success': True, 'data': template})
