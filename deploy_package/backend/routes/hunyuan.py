# -*- coding: utf-8 -*-
from flask import Blueprint, request, jsonify
import json
import os
import re
import requests

hunyuan_bp = Blueprint('hunyuan', __name__)

# 腾讯混元API配置（OpenAI兼容方式）
HUNYUAN_API_KEY = os.environ.get('HUNYUAN_API_KEY', 'sk-REkFTYHoiMqifDs8QomuZm8m5Pm1bCmm8BhIXY3dguzKx3jW')
HUNYUAN_API_URL = "https://api.hunyuan.cloud.tencent.com/v1/chat/completions"


# 投资法务中心专用提示词
INVEST_LEGAL_PROMPT = """你是投资法务中心的工时录入助手，负责从用户的自然语言描述中提取工时信息并匹配到对应的表单字段。

**业务背景知识：**
投资法务中心主要处理投资相关的法务工作，包括M&A交易、投资项目法务支持、资本市场合规等。

**OKR/BSC Item (关键任务) 常见选项及Narrative关键词映射：**

1. **投资项目全流程法务支持 Full-process legal support for investments** (最常用，占比72%)
   - 关键词：DD/LDD/尽职调查、SPA/SHA/协议、TS/Term Sheet/条款清单、KYC、审阅/review、起草/draft、谈判/negotiate、M&A/并购、IPO/上市、基金/fund、证券/securities、会议/call、股东/shareholder
   - 典型Narrative：审阅SPA、修改TS、KYC文件准备、DD报告审阅、weekly call、项目进度讨论、股东核查、股东特殊权利

2. **精细化管理工具搭建 Adoption of refined management tools** (2.3%)
   - 关键词：管理工具、系统、流程优化、VOC

3. **资本市场、投融资活动创新突破 Innovative breakthroughs in investments and capital market transactions** (1.4%)
   - 关键词：资本市场、创新、投融资

4. **控股和重点投资公司法务风险管理 Legal risk management for controlled and key invested portfolios** (1.1%)
   - 关键词：控股、重点投资、风险管理、投后管理

5. **海外投资合规管理 Overseas investment compliance management** (1.0%)
   - 关键词：海外/overseas、境外、合规

6. **国际业务(投资)监管应对 Interaction with regulators for international investments** (0.8%)
   - 关键词：监管/regulatory、国际业务

7. **反洗钱及制裁法务支持 Legal support for anti-money laundering and sanctions compliance** (0.4%)
   - 关键词：AML/反洗钱、制裁/sanction

**Work Category (工作类型) 常见选项：**
- Drafting/reviewing/negotiating legal documents (起草/审阅/谈判法律文件) - 最常用
- Conducting LDD/reviewing LDD results (进行LDD/审阅LDD结果)
- Participating in meetings/calls (参加会议/电话会议)
- Conducting legal research (法律研究)
- Providing training sessions/knowledge sharing (培训/知识分享)
- Preparing knowhow/memo/client alert (准备知识库/备忘录)
- Others (其他)"""


# 公司及国际金融事务中心专用提示词
CORP_INTL_PROMPT = """你是公司及国际金融事务中心的工时录入助手，负责从用户的自然语言描述中提取工时信息并匹配到对应的表单字段。

**业务背景知识：**
公司及国际金融事务中心主要处理公司法务、国际业务合规、金融监管应对等工作。

**OKR/BSC Item (关键任务) 常见选项及Narrative关键词映射：**

1. **CTD-0103 境内外主体/办公室合规管理 Compliance management for domestic and overseas entities/offices** (最常用)
   - 关键词：主体/entity、办公室/office、合规/compliance、公司/corporate、租赁/lease

2. **CTD-0104 境内外金融业务资质申请 Application for domestic and overseas financial business licenses**
   - 关键词：牌照/license、资质、申请、金融业务

3. **CTD-0201 国际监管趋势监测、预判 Monitoring and forecasting international regulatory trends**
   - 关键词：监管/regulatory、趋势、预判、政策

4. **CTD-0202 国际业务监管应对 Interaction with regulators for international business**
   - 关键词：监管应对、regulators、国际业务

5. **CTD-0301 反洗钱及制裁法务支持 Legal support for anti-money laundering and sanctions compliance**
   - 关键词：AML/反洗钱、制裁/sanction、合规

**Work Category (工作类型) 常见选项：**
- Drafting/reviewing/commenting on documents (起草/审阅/评论文件) - 最常用
- Discussing with internal legal team/internal stakeholders/external counsels (内部/外部讨论)
- Conducting legal analysis and research (法律分析和研究)
- Participating training sessions/team meetings (参加培训/团队会议)
- Others (其他)"""


# 业务管理与合规检测中心专用提示词
BIZ_COMPLIANCE_PROMPT = """你是业务管理与合规检测中心的工时录入助手，负责从用户的自然语言描述中提取工时信息并匹配到对应的表单字段。

**核心判断逻辑（按优先级）：**

1. **香港钱包/金管局相关** → category=_4业务管理相关_项目跟进, task=4.6 境外主体合规管理, tag=_BSC, keyTask=全面支持香港钱包合规管理及监管沟通等工作
   关键词：香港钱包、金管局、HKMA、境外合规、IRA报告、上云

2. **涉俄制裁/falcon相关** → category=_2检测相关_快速, task=2.2 涉俄制裁风险管理与应对有效性检测, tag=_OKR, keyTask=合规检测项目开展
   关键词：涉俄、制裁、falcon、问题清单、检测发现、检测汇报

3. **梧桐平台相关** → category=_1检测相关_常规, task=1.5 梧桐稳智平台 采购与合规性检测, tag=_OKR, keyTask=合规检测项目开展
   关键词：梧桐、稳智平台

4. **AI/F8相关** → category=_7公共_执业管理, task=7.6 AI信息赋能能力建设, tag=_BSC, keyTask=AI信息赋能能力持续建设
   关键词：AI、F8、小程序开发、知识库建设、外采

5. **反洗钱培训/课程物料** → category=_7公共_执业管理, task=7.4 金融合规培训体系升级, tag=_BSC, keyTask=金融合规培训活动运营
   关键词：反洗钱课程、培训物料、课程制作、培训体系

6. **消保项目** → category=_4业务管理相关_项目跟进, task=4.5 消保相关项目, tag=_BSC/_Others
   关键词：消保、函询、一号位、融担

7. **S1季报/重大信息/谈参** → category=_6公共_部门公共事务支持, task=6.5 管理类总结, tag=_BSC, keyTask=金融职能支持部门信息上报运营
   关键词：S1季报、重大信息、谈参、信息周报、leon汇报议题

8. **BSC/OKR整理调整** → category=_3业务管理相关_业务战略总结, task=3.2 部门年度BSC\\OKR制定、调整, tag=_BSC, keyTask=五部门战略工作机制运营维护
   关键词：BSC整理、OKR调整、PA BSC、BSC修订

9. **BSC/OKR会议** → category=_3业务管理相关_业务战略总结, task=3.1 OKR、BSC会议, tag=_BSC
   关键词：BSC会议、OKR会议、BSC Review会议

10. **预算/研发费用** → category=_6公共_部门公共事务支持, task=6.3 预算管理 或 6.4 IT管理, tag=_BSC
    关键词：预算、研发费用、财管、律所费用

11. **VOC/工时数据review** → category=_5公共_流程机制, task=5.2 VOC量化评估, tag=_OKR, keyTask=VOC量化评估体系
    关键词：VOC、工时数据、量化评估、工时填报系统

12. **流程梳理/分工讨论** → category=_5公共_流程机制, task=5.1 跨部门/团队流程梳理
    关键词：流程梳理、分工讨论、跨部门流程

13. **CTD会议/例会** → category=_6公共_部门公共事务支持, task=6.1 各部门管理例会及业务会议, tag=_BSC, keyTask=五部门战略工作机制运营维护
    关键词：CTD会议、PA例会、管理例会、业管例会

14. **offsite/团队活动** → category=_9其他, task=9.2 团队/部门例会, tag=_Others, keyTask=无
    关键词：offsite、团队展示、团队活动

15. **常规检测项目** → category=_1检测相关_常规, task=1.2 整体合规/法务工作机制检测, tag=_OKR, keyTask=合规检测项目开展
    关键词：CFIUS、检测项目、访谈方案、调研问卷、抽样检查

16. **模糊/无法归类** → category=_6公共_部门公共事务支持, task=6.6 其他, tag=_Others, keyTask=无
    关键词：沟通、协调、其他事务

**工作类型(workType)判断规则：**
- 项目方案讨论、制定：讨论、方案、制定、规划、设计、研议
- 项目调研、访谈、资料查阅学习等工作：调研、访谈、学习、阅读、研读
- 项目执行相关的数据调取/分析、抽样工作：数据、抽样、分析、调取、OKR映射
- 项目执行结果分析、总结、汇报工作：汇报、总结、报告、review、整理、编制
- 项目跟踪：跟进、跟踪、进度
- 部门各类会议支持（包括会议前期准备、会议召开、会议总结等工作）：会议、例会、纪要、会前准备、视频准备
- 部门内/跨部门知识分享：分享、知识分享
- 部门拉通类项目推进：拉通、推进、协调多部门、物料制作、体系升级
- 部门各类公共支持事务答疑：答疑、支持、协调、沟通、上报
- 团队、部门目标管理工作：目标管理、香港钱包合规管理
- 参与工作相关的各类培训：参加培训、课程学习、培训课程
- 其他：无法归类、杂项、考勤、周报设计"""


def detect_center_from_message(user_message: str, fields_info: str) -> str:
    """根据用户消息和字段信息检测所属中心"""
    combined = (user_message + " " + fields_info).lower()
    
    # 检测投资法务中心关键词
    invest_keywords = ['投资法务', 'investment', 'm&a', 'spa', 'sha', 'ldd', 'term sheet', 
                       'ipo', '并购', '尽职调查', '资本市场', 'capital market', 'fund', '基金',
                       'deal/matter', 'shareholder', '股东']
    for kw in invest_keywords:
        if kw in combined:
            return 'invest'
    
    # 检测公司及国际金融事务中心关键词
    corp_keywords = ['公司及国际金融', '国际金融事务', 'corporate', 'international', 
                     'tencent cloud', 'wechat pay', 'fintech', 'entity', 'office',
                     '境内外主体', '国际监管', 'regulatory']
    for kw in corp_keywords:
        if kw in combined:
            return 'corp'
    
    # 检测业务管理与合规检测中心关键词
    biz_keywords = ['业务管理', '合规检测', '检测项目', 'voc', '五部门', '香港钱包']
    for kw in biz_keywords:
        if kw in combined:
            return 'biz'
    
    return 'default'


def check_hours_mentioned(user_message: str) -> bool:
    """检查用户消息中是否提到了时间/小时数"""
    # 时间相关的关键词和模式
    time_patterns = [
        r'\d+\.?\d*\s*[hH小时]',  # 2h, 2.5h, 2小时
        r'\d+\.?\d*\s*hours?',    # 2 hours
        r'半小时', r'半个小时',
        r'一个半小时', r'两个半小时',
        r'[一二三四五六七八九十]+小时',  # 中文数字+小时
        r'\d+\s*分钟',            # 30分钟
        r'[一二三四五六七八九十]+分钟',
    ]
    
    for pattern in time_patterns:
        if re.search(pattern, user_message):
            return True
    return False


def call_hunyuan_api(user_message: str, fields_info: str, center: str = None) -> dict:
    """调用腾讯混元API进行智能解析（OpenAI兼容方式）"""
    try:
        if not HUNYUAN_API_KEY:
            return {"success": False, "error": "混元API密钥未配置"}
        
        # 自动检测中心类型
        if center is None:
            center = detect_center_from_message(user_message, fields_info)
        
        # 选择对应的业务背景提示词
        if center == 'invest':
            business_prompt = INVEST_LEGAL_PROMPT
        elif center == 'corp':
            business_prompt = CORP_INTL_PROMPT
        elif center == 'biz':
            business_prompt = BIZ_COMPLIANCE_PROMPT
        else:
            business_prompt = BIZ_COMPLIANCE_PROMPT
        
        # 检查用户是否提到了时间
        hours_mentioned = check_hours_mentioned(user_message)
        
        # 构建系统提示词
        if hours_mentioned:
            hours_rule = """1. hours: 工作小时数（数字），"两小时"=2，"半小时"=0.5，"一个半小时"=1.5，"1h"=1，"2.5h"=2.5，"30分钟"=0.5"""
        else:
            hours_rule = """1. hours: 用户没有提到时间，**绝对不要返回hours字段**"""
        
        system_prompt = f"""{business_prompt}

用户需要填写的表单字段如下：
{fields_info}

**解析规则：**
{hours_rule}
2. 选项格式：方括号内是父级分类名称（如_OKR、_BSC、_Others），后面是实际的选项值
3. 你必须返回实际的选项值，不是父级分类名
4. 对于tag字段，必须返回子选项的值，不能返回父级分类
5. 根据工作内容智能匹配最相关的选项
6. **极其重要：只返回用户明确提到或可以从内容直接推断的字段！**
   - 如果用户没有提到小组/Team，绝对不要返回team字段
   - 如果用户没有提到项目名称，绝对不要返回dealMatterName字段
   - 如果用户没有提到时间，绝对不要返回hours字段
   - 不要猜测、不要编造、不要假设任何信息
7. description: 工作的具体描述，从用户输入中提取或总结

**只返回JSON对象，不要有其他文字。只返回能从用户输入中直接提取或推断的字段。**"""

        headers = {
            "Authorization": f"Bearer {HUNYUAN_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "hunyuan-lite",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            "stream": False
        }
        
        response = requests.post(HUNYUAN_API_URL, headers=headers, json=payload, timeout=30)
        result = response.json()
        
        # 提取回复内容
        if "choices" in result and len(result["choices"]) > 0:
            content = result["choices"][0]["message"]["content"]
            # 尝试解析JSON
            try:
                # 清理可能的markdown代码块
                content = content.strip()
                if content.startswith("```"):
                    lines = content.split("\n")
                    content = "\n".join(lines[1:-1]) if len(lines) > 2 else content
                content = content.strip()
                if content.startswith("json"):
                    content = content[4:].strip()
                parsed_data = json.loads(content)
                
                # 后处理：清理选项值中可能的方括号前缀
                for key, value in list(parsed_data.items()):
                    if isinstance(value, str):
                        # 移除 [XXX] 前缀
                        cleaned = re.sub(r'^\[.*?\]\s*', '', value)
                        parsed_data[key] = cleaned
                
                # 后处理：过滤掉用户没有明确提到的字段
                user_msg_lower = user_message.lower()
                
                # 如果用户没有提到时间，强制移除hours字段
                if not check_hours_mentioned(user_message) and 'hours' in parsed_data:
                    del parsed_data['hours']
                
                # 如果用户没有提到小组/团队相关信息，移除team字段
                team_keywords = ['小组', '团队', 'team', '1组', '2组', '3组', '4组', '5组', 
                                 '一组', '二组', '三组', '四组', '五组', 'group']
                if not any(kw in user_msg_lower for kw in team_keywords):
                    if 'team' in parsed_data:
                        del parsed_data['team']
                
                return {"success": True, "data": parsed_data, "raw": content}
            except json.JSONDecodeError:
                return {"success": True, "data": {}, "raw": content, "parse_error": True}
        
        if "error" in result:
            return {"success": False, "error": result["error"].get("message", "API错误")}
        
        return {"success": False, "error": "API返回格式异常"}
        
    except requests.exceptions.Timeout:
        return {"success": False, "error": "API请求超时"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@hunyuan_bp.route('/parse', methods=['POST'])
def parse_timesheet():
    """解析用户输入的工时描述"""
    data = request.get_json()
    
    if not data:
        return jsonify({"success": False, "message": "请求数据为空"}), 400
    
    user_message = data.get('message', '')
    fields = data.get('fields', [])
    center = data.get('center', None)  # 可选：指定中心类型 invest/corp/biz
    team_name = data.get('teamName', '')  # 用户所属团队名称
    
    if not user_message:
        return jsonify({"success": False, "message": "消息内容为空"}), 400
    
    # 如果没有指定center，尝试从teamName推断
    if not center and team_name:
        team_lower = team_name.lower()
        if '投资法务' in team_lower or 'investment' in team_lower:
            center = 'invest'
        elif '公司及国际金融' in team_lower or '国际金融事务' in team_lower:
            center = 'corp'
        elif '业务管理' in team_lower or '合规检测' in team_lower:
            center = 'biz'
    
    # 构建字段信息描述
    fields_info = []
    for field in fields:
        field_desc = f"- {field.get('key')}: {field.get('label')}"
        if field.get('required'):
            field_desc += " (必填)"
        options = field.get('options', [])
        if options:
            # 扁平化选项，保留层级信息
            flat_options = []
            def flatten(opts, parent=""):
                for opt in opts:
                    prefix = f"[{parent}] " if parent else ""
                    flat_options.append(f"{prefix}{opt.get('value')}")
                    if opt.get('children'):
                        flatten(opt.get('children'), opt.get('label', ''))
            flatten(options)
            if flat_options:
                # 增加选项数量限制到80个，让AI有更多上下文
                field_desc += f"\n  可选值: {', '.join(flat_options[:80])}"
                if len(flat_options) > 80:
                    field_desc += f" ... 等共{len(flat_options)}个选项"
        fields_info.append(field_desc)
    
    fields_info_str = "\n".join(fields_info)
    
    # 调用混元API，传入center参数
    result = call_hunyuan_api(user_message, fields_info_str, center)
    
    return jsonify(result)


@hunyuan_bp.route('/config', methods=['GET'])
def get_config():
    """获取混元API配置状态"""
    configured = bool(HUNYUAN_API_KEY)
    return jsonify({
        "success": True,
        "configured": configured,
        "message": "混元API已配置" if configured else "混元API未配置"
    })
