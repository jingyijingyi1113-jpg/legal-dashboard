# -*- coding: utf-8 -*-
from flask import Blueprint, request, jsonify
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import Department, Team, Group
from routes.auth import token_required

org_bp = Blueprint('organization', __name__)

# ==================== 部门 API ====================

@org_bp.route('/departments', methods=['GET'])
@token_required
def get_departments():
    """获取所有部门"""
    departments = Department.get_all()
    return jsonify({
        'success': True,
        'data': [{
            'id': d['id'],
            'name': d['name'],
            'description': d.get('description'),
            'createdAt': d['created_at'],
            'updatedAt': d['updated_at']
        } for d in departments]
    })

@org_bp.route('/departments', methods=['POST'])
@token_required
def create_department():
    """创建部门（管理员）"""
    from models import User
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    data = request.get_json()
    name = data.get('name')
    description = data.get('description', '')
    
    if not name:
        return jsonify({'success': False, 'message': '部门名称不能为空'}), 400
    
    import time
    dept_id = f"dept-{int(time.time() * 1000)}"
    result = Department.create(dept_id, name, description)
    
    if result:
        return jsonify({'success': True, 'message': '部门创建成功', 'data': {'id': dept_id}})
    else:
        return jsonify({'success': False, 'message': '部门名称已存在'}), 400

@org_bp.route('/departments/<dept_id>', methods=['PUT'])
@token_required
def update_department(dept_id):
    """更新部门（管理员）"""
    from models import User
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    data = request.get_json()
    Department.update(dept_id, name=data.get('name'), description=data.get('description', ''))
    return jsonify({'success': True, 'message': '部门更新成功'})

@org_bp.route('/departments/<dept_id>', methods=['DELETE'])
@token_required
def delete_department(dept_id):
    """删除部门（管理员）"""
    from models import User
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    # 检查是否有团队属于该部门
    teams = Team.find_by_department(dept_id)
    if teams:
        return jsonify({'success': False, 'message': '该部门下还有团队，请先删除团队'}), 400
    
    Department.delete(dept_id)
    return jsonify({'success': True, 'message': '部门删除成功'})

# ==================== 团队 API ====================

@org_bp.route('/teams', methods=['GET'])
@token_required
def get_teams():
    """获取所有团队"""
    teams = Team.get_all()
    return jsonify({
        'success': True,
        'data': [{
            'id': t['id'],
            'name': t['name'],
            'departmentId': t['department_id'],
            'description': t.get('description'),
            'leaderId': t.get('leader_id'),
            'createdAt': t['created_at'],
            'updatedAt': t['updated_at']
        } for t in teams]
    })

@org_bp.route('/teams', methods=['POST'])
@token_required
def create_team():
    """创建团队（管理员）"""
    from models import User
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    data = request.get_json()
    name = data.get('name')
    department_id = data.get('departmentId')
    description = data.get('description', '')
    leader_id = data.get('leaderId')
    
    if not name or not department_id:
        return jsonify({'success': False, 'message': '团队名称和所属部门不能为空'}), 400
    
    import time
    team_id = f"team-{int(time.time() * 1000)}"
    result = Team.create(team_id, name, department_id, description, leader_id)
    
    if result:
        return jsonify({'success': True, 'message': '团队创建成功', 'data': {'id': team_id}})
    else:
        return jsonify({'success': False, 'message': '团队名称已存在'}), 400

@org_bp.route('/teams/<team_id>', methods=['PUT'])
@token_required
def update_team(team_id):
    """更新团队（管理员）"""
    from models import User
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    data = request.get_json()
    Team.update(team_id, 
                name=data.get('name'), 
                department_id=data.get('departmentId'),
                description=data.get('description', ''),
                leader_id=data.get('leaderId'))
    return jsonify({'success': True, 'message': '团队更新成功'})

@org_bp.route('/teams/<team_id>', methods=['DELETE'])
@token_required
def delete_team(team_id):
    """删除团队（管理员）"""
    from models import User
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    # 检查是否有小组属于该团队
    groups = Group.find_by_team(team_id)
    if groups:
        return jsonify({'success': False, 'message': '该团队下还有小组，请先删除小组'}), 400
    
    Team.delete(team_id)
    return jsonify({'success': True, 'message': '团队删除成功'})

# ==================== 小组 API ====================

@org_bp.route('/groups', methods=['GET'])
@token_required
def get_groups():
    """获取所有小组"""
    team_id = request.args.get('teamId')
    if team_id:
        groups = Group.find_by_team(team_id)
    else:
        groups = Group.get_all()
    
    return jsonify({
        'success': True,
        'data': [{
            'id': g['id'],
            'name': g['name'],
            'teamId': g['team_id'],
            'description': g.get('description'),
            'leaderId': g.get('leader_id'),
            'createdAt': g['created_at'],
            'updatedAt': g['updated_at']
        } for g in groups]
    })

@org_bp.route('/groups', methods=['POST'])
@token_required
def create_group():
    """创建小组（管理员）"""
    from models import User
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    data = request.get_json()
    name = data.get('name')
    team_id = data.get('teamId')
    description = data.get('description', '')
    leader_id = data.get('leaderId')
    
    if not name or not team_id:
        return jsonify({'success': False, 'message': '小组名称和所属团队不能为空'}), 400
    
    import time
    group_id = f"group-{int(time.time() * 1000)}"
    result = Group.create(group_id, name, team_id, description, leader_id)
    
    if result:
        return jsonify({'success': True, 'message': '小组创建成功', 'data': {'id': group_id}})
    else:
        return jsonify({'success': False, 'message': '该团队下已存在同名小组'}), 400

@org_bp.route('/groups/<group_id>', methods=['PUT'])
@token_required
def update_group(group_id):
    """更新小组（管理员）"""
    from models import User
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    data = request.get_json()
    Group.update(group_id, 
                 name=data.get('name'), 
                 team_id=data.get('teamId'),
                 description=data.get('description', ''),
                 leader_id=data.get('leaderId'))
    return jsonify({'success': True, 'message': '小组更新成功'})

@org_bp.route('/groups/<group_id>', methods=['DELETE'])
@token_required
def delete_group(group_id):
    """删除小组（管理员）"""
    from models import User
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    Group.delete(group_id)
    return jsonify({'success': True, 'message': '小组删除成功'})
