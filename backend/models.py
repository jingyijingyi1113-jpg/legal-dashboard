# -*- coding: utf-8 -*-
import sqlite3
import json
from datetime import datetime
from config import DATABASE_FILE

def get_db():
    """获取数据库连接"""
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """初始化数据库表"""
    conn = get_db()
    cursor = conn.cursor()
    
    # 用户表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            real_name TEXT NOT NULL,
            email TEXT,
            team TEXT NOT NULL,
            center TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            avatar TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 工时记录表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS timesheet_entries (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            date TEXT NOT NULL,
            hours REAL DEFAULT 0,
            status TEXT DEFAULT 'draft',
            data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            submitted_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # 模板表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            center TEXT NOT NULL,
            team TEXT,
            name TEXT NOT NULL,
            fields TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(center, team)
        )
    ''')
    
    # 请假记录表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS leave_records (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            days REAL NOT NULL,
            reason TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    conn.commit()
    conn.close()
    print("数据库初始化完成")

# 用户模型操作
class User:
    @staticmethod
    def create(username, password_hash, real_name, email, team, center, role='user'):
        conn = get_db()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO users (username, password_hash, real_name, email, team, center, role)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (username, password_hash, real_name, email, team, center, role))
            conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None
        finally:
            conn.close()
    
    @staticmethod
    def find_by_username(username):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE username = ?', (username,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    @staticmethod
    def find_by_id(user_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    @staticmethod
    def get_all():
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT id, username, real_name, email, team, center, role, created_at FROM users')
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    @staticmethod
    def update(user_id, **kwargs):
        conn = get_db()
        cursor = conn.cursor()
        fields = ', '.join([f"{k} = ?" for k in kwargs.keys()])
        values = list(kwargs.values()) + [user_id]
        cursor.execute(f'UPDATE users SET {fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?', values)
        conn.commit()
        conn.close()

# 工时记录模型操作
class TimesheetEntry:
    @staticmethod
    def create(entry_id, user_id, username, date, hours, status, data):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO timesheet_entries (id, user_id, username, date, hours, status, data)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (entry_id, user_id, username, date, hours, status, json.dumps(data, ensure_ascii=False)))
        conn.commit()
        conn.close()
        return entry_id
    
    @staticmethod
    def find_by_id(entry_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM timesheet_entries WHERE id = ?', (entry_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            entry = dict(row)
            entry['data'] = json.loads(entry['data']) if entry['data'] else {}
            return entry
        return None
    
    @staticmethod
    def find_by_user(user_id, start_date=None, end_date=None):
        conn = get_db()
        cursor = conn.cursor()
        query = 'SELECT * FROM timesheet_entries WHERE user_id = ?'
        params = [user_id]
        if start_date:
            query += ' AND date >= ?'
            params.append(start_date)
        if end_date:
            query += ' AND date <= ?'
            params.append(end_date)
        query += ' ORDER BY date DESC, created_at DESC'
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        entries = []
        for row in rows:
            entry = dict(row)
            entry['data'] = json.loads(entry['data']) if entry['data'] else {}
            entries.append(entry)
        return entries
    
    @staticmethod
    def find_by_team(center, team=None, start_date=None, end_date=None):
        conn = get_db()
        cursor = conn.cursor()
        query = '''
            SELECT te.*, u.real_name, u.team, u.center 
            FROM timesheet_entries te
            JOIN users u ON te.user_id = u.id
            WHERE u.center = ?
        '''
        params = [center]
        if team:
            query += ' AND u.team = ?'
            params.append(team)
        if start_date:
            query += ' AND te.date >= ?'
            params.append(start_date)
        if end_date:
            query += ' AND te.date <= ?'
            params.append(end_date)
        query += ' ORDER BY te.date DESC, te.created_at DESC'
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        entries = []
        for row in rows:
            entry = dict(row)
            entry['data'] = json.loads(entry['data']) if entry['data'] else {}
            entries.append(entry)
        return entries
    
    @staticmethod
    def find_all(start_date=None, end_date=None):
        """获取所有工时记录（管理员用）"""
        conn = get_db()
        cursor = conn.cursor()
        query = '''
            SELECT te.*, u.real_name, u.team, u.center 
            FROM timesheet_entries te
            JOIN users u ON te.user_id = u.id
            WHERE 1=1
        '''
        params = []
        if start_date:
            query += ' AND te.date >= ?'
            params.append(start_date)
        if end_date:
            query += ' AND te.date <= ?'
            params.append(end_date)
        query += ' ORDER BY te.date DESC, te.created_at DESC'
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        entries = []
        for row in rows:
            entry = dict(row)
            entry['data'] = json.loads(entry['data']) if entry['data'] else {}
            entries.append(entry)
        return entries
    
    @staticmethod
    def update(entry_id, **kwargs):
        conn = get_db()
        cursor = conn.cursor()
        if 'data' in kwargs:
            kwargs['data'] = json.dumps(kwargs['data'], ensure_ascii=False)
        fields = ', '.join([f"{k} = ?" for k in kwargs.keys()])
        values = list(kwargs.values()) + [entry_id]
        cursor.execute(f'UPDATE timesheet_entries SET {fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?', values)
        conn.commit()
        conn.close()
    
    @staticmethod
    def delete(entry_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM timesheet_entries WHERE id = ?', (entry_id,))
        conn.commit()
        conn.close()
    
    @staticmethod
    def submit(entry_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE timesheet_entries 
            SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        ''', (entry_id,))
        conn.commit()
        conn.close()

# 模板模型操作
class Template:
    @staticmethod
    def create_or_update(center, team, name, fields):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO templates (center, team, name, fields)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(center, team) DO UPDATE SET
                name = excluded.name,
                fields = excluded.fields,
                updated_at = CURRENT_TIMESTAMP
        ''', (center, team, name, json.dumps(fields, ensure_ascii=False)))
        conn.commit()
        conn.close()
    
    @staticmethod
    def find_by_center(center, team=None):
        conn = get_db()
        cursor = conn.cursor()
        if team:
            cursor.execute('SELECT * FROM templates WHERE center = ? AND team = ?', (center, team))
        else:
            cursor.execute('SELECT * FROM templates WHERE center = ? AND team IS NULL', (center,))
        row = cursor.fetchone()
        conn.close()
        if row:
            template = dict(row)
            template['fields'] = json.loads(template['fields']) if template['fields'] else []
            return template
        return None
    
    @staticmethod
    def get_all():
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM templates')
        rows = cursor.fetchall()
        conn.close()
        templates = []
        for row in rows:
            template = dict(row)
            template['fields'] = json.loads(template['fields']) if template['fields'] else []
            templates.append(template)
        return templates

if __name__ == '__main__':
    init_db()
