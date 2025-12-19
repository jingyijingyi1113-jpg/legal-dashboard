# -*- coding: utf-8 -*-
from flask import Blueprint, request, jsonify
from models import AIFeedback
from routes.auth import token_required, admin_required

ai_feedback_bp = Blueprint('ai_feedback', __name__)


@ai_feedback_bp.route('/record', methods=['POST'])
@token_required
def record_ai_result():
    """记录AI填充结果"""
    data = request.get_json()
    
    if not data:
        return jsonify({'success': False, 'message': '请求数据为空'}), 400
    
    session_id = data.get('sessionId')
    user_input = data.get('userInput')
    ai_result = data.get('aiResult')
    
    if not session_id or not user_input or ai_result is None:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    try:
        feedback_id = AIFeedback.create(
            user_id=request.user_id,
            session_id=session_id,
            user_input=user_input,
            ai_result=ai_result
        )
        
        return jsonify({
            'success': True,
            'data': {'feedbackId': feedback_id}
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@ai_feedback_bp.route('/submit', methods=['POST'])
@token_required
def submit_final_result():
    """提交最终结果，计算精准度"""
    data = request.get_json()
    
    if not data:
        return jsonify({'success': False, 'message': '请求数据为空'}), 400
    
    session_id = data.get('sessionId')
    final_result = data.get('finalResult')
    timesheet_id = data.get('timesheetId')
    
    if not session_id or final_result is None:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    try:
        AIFeedback.update_final_result(session_id, final_result, timesheet_id)
        
        return jsonify({
            'success': True,
            'message': 'AI反馈已记录'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@ai_feedback_bp.route('/statistics', methods=['GET'])
@admin_required
def get_statistics():
    """获取AI精准度统计（仅管理员）"""
    start_date = request.args.get('startDate')
    end_date = request.args.get('endDate')
    user_id = request.args.get('userId', type=int)
    
    try:
        stats = AIFeedback.get_statistics(start_date, end_date, user_id)
        daily_stats = AIFeedback.get_daily_statistics(30)
        
        return jsonify({
            'success': True,
            'data': {
                'summary': stats,
                'daily': daily_stats
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@ai_feedback_bp.route('/recent', methods=['GET'])
@admin_required
def get_recent_feedbacks():
    """获取最近的反馈记录（仅管理员）"""
    limit = request.args.get('limit', 50, type=int)
    
    try:
        feedbacks = AIFeedback.get_recent_feedbacks(limit)
        
        return jsonify({
            'success': True,
            'data': feedbacks
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
