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
            region TEXT DEFAULT 'CN',
            user_group TEXT,
            avatar TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 添加新字段（如果不存在）
    try:
        cursor.execute('ALTER TABLE users ADD COLUMN region TEXT DEFAULT "CN"')
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute('ALTER TABLE users ADD COLUMN user_group TEXT')
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute('ALTER TABLE users ADD COLUMN ai_enabled INTEGER DEFAULT 0')
    except sqlite3.OperationalError:
        pass
    
    # 系统配置表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 初始化AI功能默认配置
    cursor.execute('''
        INSERT OR IGNORE INTO system_config (key, value) VALUES ('ai_mode', 'off')
    ''')
    
    # AI反馈追踪表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ai_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_id TEXT NOT NULL,
            user_input TEXT NOT NULL,
            ai_result TEXT NOT NULL,
            final_result TEXT,
            field_count INTEGER DEFAULT 0,
            matched_count INTEGER DEFAULT 0,
            accuracy REAL DEFAULT 0,
            timesheet_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            submitted_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # 部门表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS departments (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 团队表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS teams (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            department_id TEXT NOT NULL,
            description TEXT,
            leader_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (department_id) REFERENCES departments(id),
            FOREIGN KEY (leader_id) REFERENCES users(id)
        )
    ''')
    
    # 小组表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS groups_table (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            team_id TEXT NOT NULL,
            description TEXT,
            leader_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (team_id) REFERENCES teams(id),
            FOREIGN KEY (leader_id) REFERENCES users(id)
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
            user_group TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            submitted_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # 添加 user_group 字段（如果不存在）
    try:
        cursor.execute('ALTER TABLE timesheet_entries ADD COLUMN user_group TEXT')
    except sqlite3.OperationalError:
        pass
    
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
    
    # 用户常用模版表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_templates (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            team_id TEXT NOT NULL,
            name TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # 初始化默认数据
    _init_default_data(cursor)
    
    conn.commit()
    conn.close()
    print("数据库初始化完成")

def _init_default_data(cursor):
    """初始化默认部门、团队、小组数据"""
    now = datetime.now().isoformat()
    
    # 检查是否已有部门数据
    cursor.execute('SELECT COUNT(*) FROM departments')
    if cursor.fetchone()[0] == 0:
        # 创建默认部门
        cursor.execute('''
            INSERT INTO departments (id, name, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        ''', ('dept-001', '合规交易部', '负责公司合规与交易相关事务', now, now))
    
    # 检查是否已有团队数据
    cursor.execute('SELECT COUNT(*) FROM teams')
    if cursor.fetchone()[0] == 0:
        # 创建默认团队
        default_teams = [
            ('team-001', '业务管理及合规检测中心', 'dept-001', '负责业务管理和合规检测工作'),
            ('team-002', '投资法务中心', 'dept-001', '负责投资相关法务工作'),
            ('team-003', '公司及国际金融事务中心', 'dept-001', '负责公司及国际金融事务'),
        ]
        for team in default_teams:
            cursor.execute('''
                INSERT INTO teams (id, name, department_id, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (team[0], team[1], team[2], team[3], now, now))
    
    # 检查是否已有小组数据
    cursor.execute('SELECT COUNT(*) FROM groups_table')
    if cursor.fetchone()[0] == 0:
        # 创建默认小组（投资法务中心下的小组）
        default_groups = [
            ('group-001', '1组', 'team-002', '投资法务中心1组'),
            ('group-002', '2组', 'team-002', '投资法务中心2组'),
            ('group-003', '3组', 'team-002', '投资法务中心3组'),
            ('group-004', '4组', 'team-002', '投资法务中心4组'),
            ('group-005', '5组', 'team-002', '投资法务中心5组'),
            ('group-006', '6组', 'team-002', '投资法务中心6组'),
        ]
        for group in default_groups:
            cursor.execute('''
                INSERT INTO groups_table (id, name, team_id, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (group[0], group[1], group[2], group[3], now, now))

# 用户模型操作
class User:
    @staticmethod
    def create(username, password_hash, real_name, email, team, center, role='user', region='CN', user_group=None):
        conn = get_db()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO users (username, password_hash, real_name, email, team, center, role, region, user_group)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (username, password_hash, real_name, email, team, center, role, region, user_group))
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
        cursor.execute('SELECT id, username, real_name, email, team, center, role, region, user_group, ai_enabled, created_at FROM users')
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
    
    @staticmethod
    def delete(user_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
        conn.commit()
        conn.close()
    
    @staticmethod
    def batch_create(users_list):
        """批量创建用户"""
        conn = get_db()
        cursor = conn.cursor()
        created = 0
        for u in users_list:
            try:
                cursor.execute('''
                    INSERT INTO users (username, password_hash, real_name, email, team, center, role, region, user_group)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (u['username'], u['password_hash'], u['real_name'], u['email'], 
                      u['team'], u['center'], u.get('role', 'user'), u.get('region', 'CN'), u.get('user_group')))
                created += 1
            except sqlite3.IntegrityError:
                pass
        conn.commit()
        conn.close()
        return created

# 部门模型操作
class Department:
    @staticmethod
    def create(dept_id, name, description=None):
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        try:
            cursor.execute('''
                INSERT INTO departments (id, name, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (dept_id, name, description, now, now))
            conn.commit()
            return dept_id
        except sqlite3.IntegrityError:
            return None
        finally:
            conn.close()
    
    @staticmethod
    def get_all():
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM departments ORDER BY created_at')
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    @staticmethod
    def find_by_id(dept_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM departments WHERE id = ?', (dept_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    @staticmethod
    def update(dept_id, **kwargs):
        conn = get_db()
        cursor = conn.cursor()
        fields = ', '.join([f"{k} = ?" for k in kwargs.keys()])
        values = list(kwargs.values()) + [dept_id]
        cursor.execute(f'UPDATE departments SET {fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?', values)
        conn.commit()
        conn.close()
    
    @staticmethod
    def delete(dept_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM departments WHERE id = ?', (dept_id,))
        conn.commit()
        conn.close()

# 团队模型操作
class Team:
    @staticmethod
    def create(team_id, name, department_id, description=None, leader_id=None):
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        try:
            cursor.execute('''
                INSERT INTO teams (id, name, department_id, description, leader_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (team_id, name, department_id, description, leader_id, now, now))
            conn.commit()
            return team_id
        except sqlite3.IntegrityError:
            return None
        finally:
            conn.close()
    
    @staticmethod
    def get_all():
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM teams ORDER BY created_at')
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    @staticmethod
    def find_by_id(team_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM teams WHERE id = ?', (team_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    @staticmethod
    def find_by_department(department_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM teams WHERE department_id = ? ORDER BY created_at', (department_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    @staticmethod
    def update(team_id, **kwargs):
        conn = get_db()
        cursor = conn.cursor()
        fields = ', '.join([f"{k} = ?" for k in kwargs.keys()])
        values = list(kwargs.values()) + [team_id]
        cursor.execute(f'UPDATE teams SET {fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?', values)
        conn.commit()
        conn.close()
    
    @staticmethod
    def delete(team_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM teams WHERE id = ?', (team_id,))
        conn.commit()
        conn.close()

# 小组模型操作
class Group:
    @staticmethod
    def create(group_id, name, team_id, description=None, leader_id=None):
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        try:
            cursor.execute('''
                INSERT INTO groups_table (id, name, team_id, description, leader_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (group_id, name, team_id, description, leader_id, now, now))
            conn.commit()
            return group_id
        except sqlite3.IntegrityError:
            return None
        finally:
            conn.close()
    
    @staticmethod
    def get_all():
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM groups_table ORDER BY created_at')
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    @staticmethod
    def find_by_id(group_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM groups_table WHERE id = ?', (group_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    @staticmethod
    def find_by_team(team_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM groups_table WHERE team_id = ? ORDER BY created_at', (team_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    @staticmethod
    def update(group_id, **kwargs):
        conn = get_db()
        cursor = conn.cursor()
        fields = ', '.join([f"{k} = ?" for k in kwargs.keys()])
        values = list(kwargs.values()) + [group_id]
        cursor.execute(f'UPDATE groups_table SET {fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?', values)
        conn.commit()
        conn.close()
    
    @staticmethod
    def delete(group_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM groups_table WHERE id = ?', (group_id,))
        conn.commit()
        conn.close()

# 工时记录模型操作
class TimesheetEntry:
    @staticmethod
    def create(entry_id, user_id, username, date, hours, status, data, user_group=None):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO timesheet_entries (id, user_id, username, date, hours, status, data, user_group)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (entry_id, user_id, username, date, hours, status, json.dumps(data, ensure_ascii=False), user_group))
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
            SELECT te.*, 
                   COALESCE(u.real_name, te.username) as real_name, 
                   COALESCE(u.team, json_extract(te.data, '$.teamName')) as team, 
                   COALESCE(u.center, json_extract(te.data, '$.teamId')) as center 
            FROM timesheet_entries te
            LEFT JOIN users u ON te.user_id = u.id
            WHERE (u.center = ? OR json_extract(te.data, '$.teamId') = ?)
        '''
        params = [center, center]
        if team:
            query += ' AND (u.team = ? OR json_extract(te.data, \'$.teamName\') = ?)'
            params.append(team)
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
    def find_by_team_name(team_name, start_date=None, end_date=None):
        """根据团队名称获取工时记录（manager用）"""
        conn = get_db()
        cursor = conn.cursor()
        query = '''
            SELECT te.*, 
                   COALESCE(u.real_name, te.username) as real_name, 
                   COALESCE(u.team, json_extract(te.data, '$.teamName')) as team, 
                   COALESCE(u.center, json_extract(te.data, '$.teamId')) as center 
            FROM timesheet_entries te
            LEFT JOIN users u ON te.user_id = u.id
            WHERE (u.team = ? OR json_extract(te.data, '$.teamName') = ?)
        '''
        params = [team_name, team_name]
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
            SELECT te.*, 
                   COALESCE(u.real_name, te.username) as real_name, 
                   COALESCE(u.team, json_extract(te.data, '$.teamName')) as team, 
                   COALESCE(u.center, json_extract(te.data, '$.teamId')) as center 
            FROM timesheet_entries te
            LEFT JOIN users u ON te.user_id = u.id
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
    def batch_delete(entry_ids):
        """批量删除工时记录"""
        if not entry_ids:
            return 0
        conn = get_db()
        cursor = conn.cursor()
        placeholders = ','.join(['?' for _ in entry_ids])
        cursor.execute(f'DELETE FROM timesheet_entries WHERE id IN ({placeholders})', entry_ids)
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        return deleted
    
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
    
    @staticmethod
    def batch_create(entries_list):
        """批量创建工时记录（如果ID已存在则更新）"""
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        
        inserted = 0
        for entry in entries_list:
            try:
                # 使用 INSERT OR REPLACE 处理重复ID
                cursor.execute('''
                    INSERT OR REPLACE INTO timesheet_entries 
                    (id, user_id, username, date, hours, status, data, user_group, created_at, updated_at, submitted_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    entry['id'],
                    entry['user_id'],
                    entry['username'],
                    entry['date'],
                    entry.get('hours', 0),
                    entry.get('status', 'submitted'),
                    json.dumps(entry.get('data', {}), ensure_ascii=False),
                    entry.get('user_group'),
                    now,
                    now,
                    now if entry.get('status') == 'submitted' else None
                ))
                inserted += 1
            except Exception as e:
                print(f"[DEBUG] 插入记录失败: {entry.get('id')}, 错误: {e}")
                continue
        
        conn.commit()
        conn.close()
        return inserted

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

# 用户常用模版模型操作
class UserTemplate:
    @staticmethod
    def create(template_id, user_id, team_id, name, data):
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        cursor.execute('''
            INSERT INTO user_templates (id, user_id, team_id, name, data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (template_id, user_id, team_id, name, json.dumps(data, ensure_ascii=False), now, now))
        conn.commit()
        conn.close()
        return template_id
    
    @staticmethod
    def find_by_user(user_id, team_id=None):
        conn = get_db()
        cursor = conn.cursor()
        if team_id:
            cursor.execute('SELECT * FROM user_templates WHERE user_id = ? AND team_id = ? ORDER BY created_at DESC', (user_id, team_id))
        else:
            cursor.execute('SELECT * FROM user_templates WHERE user_id = ? ORDER BY created_at DESC', (user_id,))
        rows = cursor.fetchall()
        conn.close()
        templates = []
        for row in rows:
            template = dict(row)
            template['data'] = json.loads(template['data']) if template['data'] else {}
            templates.append(template)
        return templates
    
    @staticmethod
    def find_by_id(template_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM user_templates WHERE id = ?', (template_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            template = dict(row)
            template['data'] = json.loads(template['data']) if template['data'] else {}
            return template
        return None
    
    @staticmethod
    def update(template_id, **kwargs):
        conn = get_db()
        cursor = conn.cursor()
        if 'data' in kwargs:
            kwargs['data'] = json.dumps(kwargs['data'], ensure_ascii=False)
        fields = ', '.join([f"{k} = ?" for k in kwargs.keys()])
        values = list(kwargs.values()) + [template_id]
        cursor.execute(f'UPDATE user_templates SET {fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?', values)
        conn.commit()
        conn.close()
    
    @staticmethod
    def delete(template_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM user_templates WHERE id = ?', (template_id,))
        conn.commit()
        conn.close()

# 系统配置模型操作
class SystemConfig:
    @staticmethod
    def get(key, default=None):
        """获取配置值"""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT value FROM system_config WHERE key = ?', (key,))
        row = cursor.fetchone()
        conn.close()
        return row['value'] if row else default
    
    @staticmethod
    def set(key, value):
        """设置配置值"""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        ''', (key, value))
        conn.commit()
        conn.close()
    
    @staticmethod
    def get_all():
        """获取所有配置"""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT key, value, updated_at FROM system_config')
        rows = cursor.fetchall()
        conn.close()
        return {row['key']: row['value'] for row in rows}


# AI反馈追踪模型
class AIFeedback:
    @staticmethod
    def create(user_id, session_id, user_input, ai_result):
        """创建AI反馈记录"""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO ai_feedback (user_id, session_id, user_input, ai_result)
            VALUES (?, ?, ?, ?)
        ''', (user_id, session_id, user_input, json.dumps(ai_result, ensure_ascii=False)))
        feedback_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return feedback_id
    
    @staticmethod
    def update_final_result(session_id, final_result, timesheet_id=None):
        """更新最终结果并计算精准度"""
        conn = get_db()
        cursor = conn.cursor()
        
        # 获取原始AI结果
        cursor.execute('SELECT ai_result FROM ai_feedback WHERE session_id = ? ORDER BY id DESC LIMIT 1', (session_id,))
        row = cursor.fetchone()
        
        if row:
            ai_result = json.loads(row['ai_result'])
            
            # 计算匹配度
            field_count = 0
            matched_count = 0
            
            for key, ai_value in ai_result.items():
                if key in ['description']:  # 跳过描述字段的精确匹配
                    continue
                field_count += 1
                final_value = final_result.get(key)
                if final_value is not None:
                    # 数值类型比较
                    if isinstance(ai_value, (int, float)) and isinstance(final_value, (int, float)):
                        if abs(float(ai_value) - float(final_value)) < 0.01:
                            matched_count += 1
                    # 字符串比较
                    elif str(ai_value).strip() == str(final_value).strip():
                        matched_count += 1
            
            accuracy = (matched_count / field_count * 100) if field_count > 0 else 0
            
            cursor.execute('''
                UPDATE ai_feedback 
                SET final_result = ?, field_count = ?, matched_count = ?, accuracy = ?, 
                    timesheet_id = ?, submitted_at = CURRENT_TIMESTAMP
                WHERE session_id = ?
            ''', (json.dumps(final_result, ensure_ascii=False), field_count, matched_count, accuracy, timesheet_id, session_id))
            
            conn.commit()
        
        conn.close()
    
    @staticmethod
    def get_statistics(start_date=None, end_date=None, user_id=None):
        """获取AI精准度统计"""
        conn = get_db()
        cursor = conn.cursor()
        
        query = '''
            SELECT 
                COUNT(*) as total_sessions,
                AVG(accuracy) as avg_accuracy,
                SUM(field_count) as total_fields,
                SUM(matched_count) as total_matched,
                COUNT(CASE WHEN accuracy >= 80 THEN 1 END) as high_accuracy_count,
                COUNT(CASE WHEN accuracy >= 50 AND accuracy < 80 THEN 1 END) as medium_accuracy_count,
                COUNT(CASE WHEN accuracy < 50 THEN 1 END) as low_accuracy_count
            FROM ai_feedback
            WHERE submitted_at IS NOT NULL
        '''
        params = []
        
        if start_date:
            query += ' AND DATE(created_at) >= ?'
            params.append(start_date)
        if end_date:
            query += ' AND DATE(created_at) <= ?'
            params.append(end_date)
        if user_id:
            query += ' AND user_id = ?'
            params.append(user_id)
        
        cursor.execute(query, params)
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'totalSessions': row['total_sessions'] or 0,
                'avgAccuracy': round(row['avg_accuracy'] or 0, 2),
                'totalFields': row['total_fields'] or 0,
                'totalMatched': row['total_matched'] or 0,
                'highAccuracyCount': row['high_accuracy_count'] or 0,
                'mediumAccuracyCount': row['medium_accuracy_count'] or 0,
                'lowAccuracyCount': row['low_accuracy_count'] or 0
            }
        return None
    
    @staticmethod
    def get_daily_statistics(days=30):
        """获取每日AI精准度统计"""
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as sessions,
                AVG(accuracy) as avg_accuracy,
                SUM(field_count) as total_fields,
                SUM(matched_count) as total_matched
            FROM ai_feedback
            WHERE submitted_at IS NOT NULL
              AND created_at >= DATE('now', ?)
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        ''', (f'-{days} days',))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [{
            'date': row['date'],
            'sessions': row['sessions'],
            'avgAccuracy': round(row['avg_accuracy'] or 0, 2),
            'totalFields': row['total_fields'] or 0,
            'totalMatched': row['total_matched'] or 0
        } for row in rows]
    
    @staticmethod
    def get_recent_feedbacks(limit=50):
        """获取最近的反馈记录"""
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT af.*, u.username, u.real_name
            FROM ai_feedback af
            LEFT JOIN users u ON af.user_id = u.id
            WHERE af.submitted_at IS NOT NULL
            ORDER BY af.created_at DESC
            LIMIT ?
        ''', (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [{
            'id': row['id'],
            'userId': row['user_id'],
            'username': row['username'],
            'realName': row['real_name'],
            'sessionId': row['session_id'],
            'userInput': row['user_input'],
            'aiResult': json.loads(row['ai_result']) if row['ai_result'] else {},
            'finalResult': json.loads(row['final_result']) if row['final_result'] else {},
            'fieldCount': row['field_count'],
            'matchedCount': row['matched_count'],
            'accuracy': row['accuracy'],
            'createdAt': row['created_at'],
            'submittedAt': row['submitted_at']
        } for row in rows]


if __name__ == '__main__':
    init_db()
