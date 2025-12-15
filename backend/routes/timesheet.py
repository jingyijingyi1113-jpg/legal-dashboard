# -*- coding: utf-8 -*-
from flask import Blueprint, request, jsonify
import uuid
from datetime import datetime, timedelta
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import TimesheetEntry, User
from routes.auth import token_required

timesheet_bp = Blueprint('timesheet', __name__)

@timesheet_bp.route('/entries', methods=['GET'])
@token_required
def get_entries():
    """获取当前用户的工时记录"""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    entries = TimesheetEntry.find_by_user(request.user_id, start_date, end_date)
    return jsonify({'success': True, 'data': entries})

@timesheet_bp.route('/entries', methods=['POST'])
@token_required
def create_entry():
    """创建工时记录"""
    data = request.get_json()
    
    entry_id = data.get('id') or str(uuid.uuid4())
    date = data.get('date')
    hours = data.get('hours', 0)
    status = data.get('status', 'draft')
    entry_data = data.get('data', {})
    user_group = data.get('user_group') or entry_data.get('userGroup')
    
    if not date:
        return jsonify({'success': False, 'message': '日期不能为空'}), 400
    
    TimesheetEntry.create(
        entry_id=entry_id,
        user_id=request.user_id,
        username=request.username,
        date=date,
        hours=hours,
        status=status,
        data=entry_data,
        user_group=user_group
    )
    
    return jsonify({
        'success': True,
        'message': '创建成功',
        'data': {'id': entry_id}
    })

@timesheet_bp.route('/entries/<entry_id>', methods=['GET'])
@token_required
def get_entry(entry_id):
    """获取单条工时记录"""
    entry = TimesheetEntry.find_by_id(entry_id)
    if not entry:
        return jsonify({'success': False, 'message': '记录不存在'}), 404
    
    if entry['user_id'] != request.user_id:
        user = User.find_by_id(request.user_id)
        if user['role'] != 'admin':
            return jsonify({'success': False, 'message': '权限不足'}), 403
    
    return jsonify({'success': True, 'data': entry})

@timesheet_bp.route('/entries/<entry_id>', methods=['PUT'])
@token_required
def update_entry(entry_id):
    """更新工时记录"""
    entry = TimesheetEntry.find_by_id(entry_id)
    if not entry:
        return jsonify({'success': False, 'message': '记录不存在'}), 404
    
    if entry['user_id'] != request.user_id:
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    if entry['status'] == 'submitted':
        return jsonify({'success': False, 'message': '已提交的记录不能修改'}), 400
    
    data = request.get_json()
    update_fields = {}
    
    if 'date' in data:
        update_fields['date'] = data['date']
    if 'hours' in data:
        update_fields['hours'] = data['hours']
    if 'data' in data:
        update_fields['data'] = data['data']
    
    TimesheetEntry.update(entry_id, **update_fields)
    
    return jsonify({'success': True, 'message': '更新成功'})

@timesheet_bp.route('/entries/<entry_id>', methods=['DELETE'])
@token_required
def delete_entry(entry_id):
    """删除工时记录"""
    entry = TimesheetEntry.find_by_id(entry_id)
    if not entry:
        return jsonify({'success': False, 'message': '记录不存在'}), 404
    
    if entry['user_id'] != request.user_id:
        user = User.find_by_id(request.user_id)
        if user['role'] != 'admin':
            return jsonify({'success': False, 'message': '权限不足'}), 403
    
    TimesheetEntry.delete(entry_id)
    
    return jsonify({'success': True, 'message': '删除成功'})

@timesheet_bp.route('/entries/<entry_id>/submit', methods=['POST'])
@token_required
def submit_entry(entry_id):
    """提交工时记录"""
    entry = TimesheetEntry.find_by_id(entry_id)
    if not entry:
        return jsonify({'success': False, 'message': '记录不存在'}), 404
    
    if entry['user_id'] != request.user_id:
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    if entry['status'] == 'submitted':
        return jsonify({'success': False, 'message': '记录已提交'}), 400
    
    TimesheetEntry.submit(entry_id)
    
    return jsonify({'success': True, 'message': '提交成功'})

@timesheet_bp.route('/entries/batch-submit', methods=['POST'])
@token_required
def batch_submit():
    """批量提交工时记录"""
    data = request.get_json()
    entry_ids = data.get('ids', [])
    
    if not entry_ids:
        return jsonify({'success': False, 'message': '请选择要提交的记录'}), 400
    
    submitted = 0
    for entry_id in entry_ids:
        entry = TimesheetEntry.find_by_id(entry_id)
        if entry and entry['user_id'] == request.user_id and entry['status'] != 'submitted':
            TimesheetEntry.submit(entry_id)
            submitted += 1
    
    return jsonify({
        'success': True,
        'message': f'成功提交 {submitted} 条记录'
    })

@timesheet_bp.route('/entries/batch-import', methods=['POST'])
@token_required
def batch_import():
    """批量导入工时记录（管理员专用）"""
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足，仅管理员可批量导入'}), 403
    
    data = request.get_json()
    entries = data.get('entries', [])
    
    print(f"[DEBUG] batch_import: 收到 {len(entries)} 条记录")
    if entries:
        print(f"[DEBUG] 第一条记录: {entries[0]}")
    
    if not entries:
        return jsonify({'success': False, 'message': '没有可导入的数据'}), 400
    
    try:
        # 批量插入
        inserted = TimesheetEntry.batch_create(entries)
        print(f"[DEBUG] batch_create 返回: {inserted}")
        return jsonify({
            'success': True,
            'message': f'成功导入 {inserted} 条记录',
            'count': inserted
        })
    except Exception as e:
        print(f"[DEBUG] batch_import 异常: {str(e)}")
        return jsonify({'success': False, 'message': f'导入失败: {str(e)}'}), 500

@timesheet_bp.route('/entries/batch-delete', methods=['POST'])
@token_required
def batch_delete():
    """批量删除工时记录（管理员专用）"""
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足，仅管理员可批量删除'}), 403
    
    data = request.get_json()
    entry_ids = data.get('ids', [])
    
    if not entry_ids:
        return jsonify({'success': False, 'message': '请选择要删除的记录'}), 400
    
    try:
        deleted = TimesheetEntry.batch_delete(entry_ids)
        return jsonify({
            'success': True,
            'message': f'成功删除 {deleted} 条记录',
            'count': deleted
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'删除失败: {str(e)}'}), 500

@timesheet_bp.route('/team-entries', methods=['GET'])
@token_required
def get_team_entries():
    """获取团队工时记录（管理员/组长）"""
    user = User.find_by_id(request.user_id)
    
    center = request.args.get('center')
    team = request.args.get('team')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    # 管理员可以查看所有数据
    if user['role'] == 'admin':
        entries = TimesheetEntry.find_all(start_date, end_date)
    else:
        # 非管理员只能查看自己中心的数据
        center = center or user['center']
        entries = TimesheetEntry.find_by_team(center, team, start_date, end_date)
    
    return jsonify({'success': True, 'data': entries})

@timesheet_bp.route('/stats', methods=['GET'])
@token_required
def get_stats():
    """获取工时统计"""
    today = datetime.now().date()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    
    # 获取用户所有记录
    entries = TimesheetEntry.find_by_user(request.user_id)
    
    today_hours = 0
    week_hours = 0
    month_hours = 0
    total_entries = len(entries)
    
    for entry in entries:
        entry_date = datetime.strptime(entry['date'], '%Y-%m-%d').date()
        hours = entry.get('hours', 0) or 0
        
        if entry_date == today:
            today_hours += hours
        if entry_date >= week_start:
            week_hours += hours
        if entry_date >= month_start:
            month_hours += hours
    
    return jsonify({
        'success': True,
        'data': {
            'todayHours': round(today_hours, 1),
            'weekHours': round(week_hours, 1),
            'monthHours': round(month_hours, 1),
            'totalEntries': total_entries
        }
    })
