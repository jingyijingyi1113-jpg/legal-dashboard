# -*- coding: utf-8 -*-
from flask import Blueprint, request, jsonify, send_file
import sys
import os
import json
import pandas as pd
from datetime import datetime
import threading
import time
import schedule
import smtplib
import zipfile
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import get_db, User
from routes.auth import token_required
from config import (
    EMAIL_ENABLED, EMAIL_SMTP_SERVER, EMAIL_SMTP_PORT,
    EMAIL_SENDER, EMAIL_PASSWORD, EMAIL_RECEIVERS, EMAIL_MAX_SIZE_MB
)

backup_bp = Blueprint('backup', __name__)

# 备份目录
BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backups')

# 确保备份目录存在
os.makedirs(BACKUP_DIR, exist_ok=True)

def get_all_data():
    """获取所有工时数据"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT te.*, u.username, u.real_name, u.center, u.team
        FROM timesheet_entries te
        LEFT JOIN users u ON te.user_id = u.id
        ORDER BY te.created_at DESC
    ''')
    
    rows = cursor.fetchall()
    conn.close()
    
    data = []
    for row in rows:
        entry = dict(row)
        if entry.get('data'):
            try:
                json_data = json.loads(entry['data'])
                entry.update(json_data)
            except:
                pass
        if 'data' in entry:
            del entry['data']
        data.append(entry)
    
    return data

def export_to_excel(filename=None, data=None):
    """导出数据到 Excel 文件"""
    try:
        if data is None:
            data = get_all_data()
        
        if not data:
            return None, "没有数据可导出"
        
        df = pd.DataFrame(data)
        
        # 生成文件名
        if not filename:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"工时数据备份_{timestamp}.xlsx"
        
        filepath = os.path.join(BACKUP_DIR, filename)
        
        # 导出到 Excel
        df.to_excel(filepath, index=False, engine='openpyxl')
        
        return filepath, None
    except Exception as e:
        return None, str(e)

def export_by_month(data):
    """按月份分表导出，返回文件路径列表"""
    if not data:
        return [], "没有数据可导出"
    
    df = pd.DataFrame(data)
    
    # 确保有日期字段
    date_col = None
    for col in ['date', 'work_date', 'created_at']:
        if col in df.columns:
            date_col = col
            break
    
    if not date_col:
        # 没有日期字段，直接导出单个文件
        filepath, error = export_to_excel(data=data)
        return [filepath] if filepath else [], error
    
    # 转换日期并按月分组
    df['_month'] = pd.to_datetime(df[date_col], errors='coerce').dt.to_period('M')
    
    filepaths = []
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    for month, group in df.groupby('_month'):
        group = group.drop(columns=['_month'])
        month_str = str(month).replace('-', '')
        filename = f"工时数据备份_{month_str}_{timestamp}.xlsx"
        filepath = os.path.join(BACKUP_DIR, filename)
        group.to_excel(filepath, index=False, engine='openpyxl')
        filepaths.append(filepath)
    
    return filepaths, None

def compress_file(filepath):
    """压缩文件为 zip"""
    zip_path = filepath.replace('.xlsx', '.zip')
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.write(filepath, os.path.basename(filepath))
    return zip_path

def send_email_with_attachment(subject, body, attachments):
    """发送带附件的邮件"""
    if not EMAIL_ENABLED:
        print("邮件功能未启用")
        return False, "邮件功能未启用"
    
    if not EMAIL_SENDER or not EMAIL_PASSWORD or not EMAIL_RECEIVERS:
        print("邮件配置不完整")
        return False, "邮件配置不完整"
    
    try:
        # 创建邮件
        msg = MIMEMultipart()
        msg['From'] = EMAIL_SENDER
        msg['To'] = ', '.join([r for r in EMAIL_RECEIVERS if r])
        msg['Subject'] = subject
        
        # 邮件正文
        msg.attach(MIMEText(body, 'plain', 'utf-8'))
        
        # 添加附件
        for filepath in attachments:
            if not os.path.exists(filepath):
                continue
            
            with open(filepath, 'rb') as f:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(f.read())
                encoders.encode_base64(part)
                
                filename = os.path.basename(filepath)
                # 使用 RFC 2231 编码处理中文文件名
                from email.header import Header
                from urllib.parse import quote
                encoded_filename = quote(filename, safe='')
                part.add_header('Content-Disposition', 'attachment', filename=('utf-8', '', filename))
                msg.attach(part)
        
        # 发送邮件 - 使用配置中的 SMTP 服务器
        if EMAIL_SMTP_PORT == 465:
            # SSL 模式
            server = smtplib.SMTP_SSL(EMAIL_SMTP_SERVER, EMAIL_SMTP_PORT, timeout=30)
        else:
            # STARTTLS 模式
            server = smtplib.SMTP(EMAIL_SMTP_SERVER, EMAIL_SMTP_PORT, timeout=30)
            server.ehlo()
            server.starttls()
            server.ehlo()
        
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        print(f"邮件发送成功: {subject}")
        return True, None
    except Exception as e:
        error_msg = f"邮件发送失败: {str(e)}"
        print(error_msg)
        return False, error_msg

def backup_and_send_email():
    """备份并发送邮件（智能处理大文件）"""
    print(f"[{datetime.now()}] 开始备份并发送邮件...")
    
    # 1. 先导出完整备份
    data = get_all_data()
    if not data:
        print(f"[{datetime.now()}] 没有数据可备份")
        return
    
    filepath, error = export_to_excel(data=data)
    if error:
        print(f"[{datetime.now()}] 备份失败: {error}")
        return
    
    print(f"[{datetime.now()}] 备份成功: {filepath}")
    
    # 2. 检查文件大小
    file_size_mb = os.path.getsize(filepath) / 1024 / 1024
    max_size_mb = EMAIL_MAX_SIZE_MB
    
    attachments = []
    temp_files = []  # 临时文件，发送后删除
    
    if file_size_mb <= max_size_mb:
        # 文件大小正常，直接发送
        attachments = [filepath]
        send_method = "直接发送"
    else:
        # 文件过大，先尝试压缩
        print(f"[{datetime.now()}] 文件过大 ({file_size_mb:.2f}MB)，尝试压缩...")
        zip_path = compress_file(filepath)
        temp_files.append(zip_path)
        zip_size_mb = os.path.getsize(zip_path) / 1024 / 1024
        
        if zip_size_mb <= max_size_mb:
            # 压缩后可以发送
            attachments = [zip_path]
            send_method = f"压缩发送 ({zip_size_mb:.2f}MB)"
        else:
            # 压缩后仍然过大，按月份分表
            print(f"[{datetime.now()}] 压缩后仍过大 ({zip_size_mb:.2f}MB)，按月份分表...")
            month_files, error = export_by_month(data)
            if error:
                print(f"[{datetime.now()}] 分表失败: {error}")
                return
            
            # 压缩每个月份文件
            for mf in month_files:
                mf_zip = compress_file(mf)
                attachments.append(mf_zip)
                temp_files.append(mf_zip)
                temp_files.append(mf)  # 月份 xlsx 也是临时的
            
            send_method = f"分表发送 ({len(month_files)} 个月份)"
    
    # 3. 发送邮件
    if EMAIL_ENABLED and attachments:
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M')
        subject = f"【工时系统】数据自动备份 - {timestamp}"
        body = f"""工时管理系统自动备份

备份时间: {timestamp}
数据条数: {len(data)} 条
原始大小: {file_size_mb:.2f} MB
发送方式: {send_method}
附件数量: {len(attachments)} 个

此邮件由系统自动发送，请勿回复。
"""
        success, error = send_email_with_attachment(subject, body, attachments)
        if success:
            print(f"[{datetime.now()}] 邮件发送成功 ({send_method})")
        else:
            print(f"[{datetime.now()}] 邮件发送失败: {error}")
    
    # 4. 清理临时文件
    for tf in temp_files:
        try:
            if os.path.exists(tf):
                os.remove(tf)
        except:
            pass
    
    # 5. 清理旧备份
    cleanup_old_backups(keep=30)

def cleanup_old_backups(keep=30):
    """清理旧备份文件，只保留最近的 N 个"""
    try:
        files = [f for f in os.listdir(BACKUP_DIR) if f.endswith('.xlsx')]
        files.sort(reverse=True)
        
        for old_file in files[keep:]:
            os.remove(os.path.join(BACKUP_DIR, old_file))
            print(f"已删除旧备份: {old_file}")
    except Exception as e:
        print(f"清理旧备份失败: {e}")

def run_scheduler():
    """运行定时任务调度器"""
    while True:
        schedule.run_pending()
        time.sleep(60)

def start_backup_scheduler():
    """启动备份调度器"""
    # 每天早上 6 点备份（仅保存到服务器）
    schedule.every().day.at("06:00").do(scheduled_backup_only)
    # 每天中午 12 点备份（仅保存到服务器）
    schedule.every().day.at("12:00").do(scheduled_backup_only)
    # 每天晚上 18 点备份（仅保存到服务器）
    schedule.every().day.at("18:00").do(scheduled_backup_only)
    # 每天晚上 22 点发送邮件备份
    schedule.every().day.at("22:00").do(scheduled_email_backup)
    # 每周三上午 9 点检查并发送工时提醒（仅在每月第一周生效）
    schedule.every().wednesday.at("09:00").do(scheduled_timesheet_reminder)
    
    # 启动调度线程
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
    
    email_status = "已启用（每天22:00发送）" if EMAIL_ENABLED else "未启用"
    reminder_status = "已启用（每月第一周周三09:00）" if EMAIL_ENABLED else "未启用"
    print(f"备份调度器已启动（每天 6:00, 12:00, 18:00 自动备份，邮件通知: {email_status}）")
    print(f"工时提醒调度器已启动（{reminder_status}）")

def scheduled_backup_only():
    """定时备份任务（仅保存到服务器，不发邮件）"""
    print(f"[{datetime.now()}] 执行定时备份...")
    filepath, error = export_to_excel()
    if error:
        print(f"[{datetime.now()}] 备份失败: {error}")
    else:
        print(f"[{datetime.now()}] 备份成功: {filepath}")
        cleanup_old_backups(keep=30)

def scheduled_email_backup():
    """定时邮件备份任务（备份并发送邮件）"""
    print(f"[{datetime.now()}] 执行定时邮件备份...")
    if EMAIL_ENABLED:
        backup_and_send_email()
    else:
        print(f"[{datetime.now()}] 邮件功能未启用，跳过邮件发送")

# ==================== 工时填写提醒功能 ====================

def is_first_week_of_month():
    """判断当前是否为每月第一周（1-7号）"""
    today = datetime.now()
    return today.day <= 7

def get_all_user_emails():
    """获取所有用户的邮箱列表"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, real_name, email, team, center 
        FROM users 
        WHERE email IS NOT NULL AND email != '' AND role != 'admin'
    ''')
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users

def send_simple_email(to_emails, subject, body):
    """发送纯文本邮件（无附件）- 支持批量发送"""
    if not EMAIL_ENABLED:
        print("邮件功能未启用")
        return False, "邮件功能未启用"
    
    if not EMAIL_SENDER or not EMAIL_PASSWORD:
        print("邮件配置不完整")
        return False, "邮件配置不完整"
    
    if not to_emails:
        print("没有收件人")
        return False, "没有收件人"
    
    try:
        # 创建邮件
        msg = MIMEMultipart()
        msg['From'] = EMAIL_SENDER
        msg['Subject'] = subject
        
        # 邮件正文
        msg.attach(MIMEText(body, 'plain', 'utf-8'))
        
        # 连接 SMTP 服务器
        if EMAIL_SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(EMAIL_SMTP_SERVER, EMAIL_SMTP_PORT, timeout=30)
        else:
            server = smtplib.SMTP(EMAIL_SMTP_SERVER, EMAIL_SMTP_PORT, timeout=30)
            server.ehlo()
            server.starttls()
            server.ehlo()
        
        server.login(EMAIL_SENDER, EMAIL_PASSWORD)
        
        # 批量发送（分批，每批10人，间隔2秒）
        batch_size = 10
        success_count = 0
        fail_count = 0
        
        for i in range(0, len(to_emails), batch_size):
            batch = to_emails[i:i + batch_size]
            msg['To'] = ', '.join(batch)
            
            try:
                server.sendmail(EMAIL_SENDER, batch, msg.as_string())
                success_count += len(batch)
                print(f"[{datetime.now()}] 批次 {i//batch_size + 1}: 发送成功 {len(batch)} 封")
            except Exception as e:
                fail_count += len(batch)
                print(f"[{datetime.now()}] 批次 {i//batch_size + 1}: 发送失败 - {str(e)}")
            
            # 批次间隔，避免被限流
            if i + batch_size < len(to_emails):
                time.sleep(2)
        
        server.quit()
        
        print(f"[{datetime.now()}] 邮件发送完成: 成功 {success_count}, 失败 {fail_count}")
        return True, f"成功 {success_count}, 失败 {fail_count}"
    except Exception as e:
        error_msg = f"邮件发送失败: {str(e)}"
        print(error_msg)
        return False, error_msg

def send_timesheet_reminder():
    """发送工时填写提醒邮件"""
    print(f"[{datetime.now()}] 开始发送工时填写提醒邮件...")
    
    # 获取所有用户邮箱
    users = get_all_user_emails()
    if not users:
        print(f"[{datetime.now()}] 没有找到有效的用户邮箱")
        return False, "没有找到有效的用户邮箱"
    
    emails = [u['email'] for u in users if u.get('email')]
    print(f"[{datetime.now()}] 找到 {len(emails)} 个用户邮箱")
    
    # 构建邮件内容
    now = datetime.now()
    month_name = now.strftime('%Y年%m月')
    
    subject = f"【工时提醒】请及时填写 {month_name} 工时记录"
    
    body = f"""各位同事：

您好！

本月工时填写周期已开始，请您在本周内完成上月工时的填写和提交。

📌 填写入口：https://www.ctdms.woa.com
📌 截止时间：本周五 18:00 前

温馨提示：
1. 请确保工时数据的准确性和完整性
2. 如有疑问，请联系业管同事

感谢您的配合！

---
此邮件由 CTD 工时管理系统自动发送，请勿回复。
发送时间：{now.strftime('%Y-%m-%d %H:%M:%S')}
"""
    
    # 发送邮件
    success, result = send_simple_email(emails, subject, body)
    
    if success:
        print(f"[{datetime.now()}] 工时提醒邮件发送完成: {result}")
    else:
        print(f"[{datetime.now()}] 工时提醒邮件发送失败: {result}")
    
    return success, result

def scheduled_timesheet_reminder():
    """定时任务：每月第一周周三发送工时提醒"""
    print(f"[{datetime.now()}] 检查是否需要发送工时提醒...")
    
    if not is_first_week_of_month():
        print(f"[{datetime.now()}] 不是每月第一周，跳过发送")
        return
    
    if not EMAIL_ENABLED:
        print(f"[{datetime.now()}] 邮件功能未启用，跳过发送")
        return
    
    send_timesheet_reminder()

# ===== API 接口 =====

@backup_bp.route('/list', methods=['GET'])
@token_required
def list_backups():
    """获取备份文件列表"""
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    try:
        files = []
        for f in os.listdir(BACKUP_DIR):
            if f.endswith('.xlsx') or f.endswith('.zip'):
                filepath = os.path.join(BACKUP_DIR, f)
                stat = os.stat(filepath)
                files.append({
                    'filename': f,
                    'size': stat.st_size,
                    'size_mb': round(stat.st_size / 1024 / 1024, 2),
                    'created_at': datetime.fromtimestamp(stat.st_mtime).isoformat()
                })
        
        files.sort(key=lambda x: x['created_at'], reverse=True)
        
        return jsonify({'success': True, 'data': files})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@backup_bp.route('/download/<filename>', methods=['GET'])
@token_required
def download_backup(filename):
    """下载备份文件"""
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    if '..' in filename or '/' in filename:
        return jsonify({'success': False, 'message': '非法文件名'}), 400
    
    filepath = os.path.join(BACKUP_DIR, filename)
    
    if not os.path.exists(filepath):
        return jsonify({'success': False, 'message': '文件不存在'}), 404
    
    # 根据文件类型设置 MIME
    if filename.endswith('.zip'):
        mimetype = 'application/zip'
    else:
        mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    
    return send_file(
        filepath,
        as_attachment=True,
        download_name=filename,
        mimetype=mimetype
    )

@backup_bp.route('/create', methods=['POST'])
@token_required
def create_backup():
    """手动创建备份"""
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    filepath, error = export_to_excel()
    
    if error:
        return jsonify({'success': False, 'message': error}), 500
    
    filename = os.path.basename(filepath)
    stat = os.stat(filepath)
    
    return jsonify({
        'success': True,
        'message': '备份创建成功',
        'data': {
            'filename': filename,
            'size': stat.st_size,
            'size_mb': round(stat.st_size / 1024 / 1024, 2),
            'created_at': datetime.fromtimestamp(stat.st_mtime).isoformat()
        }
    })

@backup_bp.route('/delete/<filename>', methods=['DELETE'])
@token_required
def delete_backup(filename):
    """删除备份文件"""
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    if '..' in filename or '/' in filename:
        return jsonify({'success': False, 'message': '非法文件名'}), 400
    
    filepath = os.path.join(BACKUP_DIR, filename)
    
    if not os.path.exists(filepath):
        return jsonify({'success': False, 'message': '文件不存在'}), 404
    
    try:
        os.remove(filepath)
        return jsonify({'success': True, 'message': '删除成功'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@backup_bp.route('/send-email', methods=['POST'])
@token_required
def send_backup_email():
    """手动发送备份邮件"""
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    if not EMAIL_ENABLED:
        return jsonify({'success': False, 'message': '邮件功能未启用，请配置环境变量'}), 400
    
    # 在后台线程执行，避免超时
    thread = threading.Thread(target=backup_and_send_email)
    thread.start()
    
    return jsonify({
        'success': True,
        'message': '备份邮件发送任务已启动，请稍后查收邮件'
    })

@backup_bp.route('/email-config', methods=['GET'])
@token_required
def get_email_config():
    """获取邮件配置状态"""
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    return jsonify({
        'success': True,
        'data': {
            'enabled': EMAIL_ENABLED,
            'smtp_server': EMAIL_SMTP_SERVER,
            'sender': EMAIL_SENDER[:3] + '***' if EMAIL_SENDER else '',
            'receivers': [r[:3] + '***' if r else '' for r in EMAIL_RECEIVERS if r],
            'max_size_mb': EMAIL_MAX_SIZE_MB
        }
    })

@backup_bp.route('/send-reminder', methods=['POST'])
@token_required
def send_reminder_email():
    """手动发送工时填写提醒邮件"""
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    if not EMAIL_ENABLED:
        return jsonify({'success': False, 'message': '邮件功能未启用，请配置环境变量'}), 400
    
    # 获取用户数量预览
    users = get_all_user_emails()
    if not users:
        return jsonify({'success': False, 'message': '没有找到有效的用户邮箱'}), 400
    
    # 在后台线程执行，避免超时
    thread = threading.Thread(target=send_timesheet_reminder)
    thread.start()
    
    return jsonify({
        'success': True,
        'message': f'工时提醒邮件发送任务已启动，将发送给 {len(users)} 位用户，请稍后查看日志'
    })

@backup_bp.route('/reminder-preview', methods=['GET'])
@token_required
def get_reminder_preview():
    """获取工时提醒邮件预览（收件人列表）"""
    user = User.find_by_id(request.user_id)
    if user['role'] != 'admin':
        return jsonify({'success': False, 'message': '权限不足'}), 403
    
    users = get_all_user_emails()
    
    # 按中心分组统计
    center_stats = {}
    for u in users:
        center = u.get('center', '未知')
        if center not in center_stats:
            center_stats[center] = []
        center_stats[center].append({
            'real_name': u.get('real_name', ''),
            'email': u.get('email', ''),
            'team': u.get('team', '')
        })
    
    return jsonify({
        'success': True,
        'data': {
            'total_count': len(users),
            'by_center': center_stats,
            'is_first_week': is_first_week_of_month(),
            'next_reminder': '每月第一周周三 09:00'
        }
    })
