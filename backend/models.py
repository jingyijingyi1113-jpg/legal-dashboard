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
        cursor.execute('SELECT id, username, real_name, email, team, center, role, region, user_group, created_at FROM users')
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
        """批量创建工时记录"""
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        
        # 准备批量插入数据
        values = []
        for entry in entries_list:
            values.append((
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
        
        cursor.executemany('''
            INSERT INTO timesheet_entries (id, user_id, username, date, hours, status, data, user_group, created_at, updated_at, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', values)
        
        inserted = cursor.rowcount
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

if __name__ == '__main__':
    init_db()
