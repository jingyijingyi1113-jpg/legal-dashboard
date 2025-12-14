# -*- coding: utf-8 -*-
"""
业务管理与合规检测中心 - AI工时助手精准度测试脚本
"""

import pandas as pd
import requests
import json
import time
from datetime import datetime
from typing import Dict, List, Any

# 配置
API_URL = "http://localhost:5001/api/hunyuan/parse"
CENTER = "biz"  # 业务管理与合规检测中心

# 字段映射：历史数据列名 -> AI返回字段名
FIELD_MAPPING = {
    "工作分类": "category",
    "任务名称": "task",
    "标签": "tag",
    "关键任务": "keyTask",
    "小时数": "hours",
    "工作类型": "workType",
    "描述": "description"
}

# 业务管理与合规检测中心的表单字段定义（与前端一致）
FORM_FIELDS = [
    {
        "key": "category",
        "label": "事项分类",
        "required": True,
        "options": [
            {"value": "_1检测相关_常规", "label": "检测相关-常规"},
            {"value": "_2检测相关_快速", "label": "检测相关-快速"},
            {"value": "_3业务管理相关_业务战略总结", "label": "业务管理相关-业务战略总结"},
            {"value": "_4业务管理相关_项目跟进", "label": "业务管理相关-项目跟进"},
            {"value": "_5公共_流程机制", "label": "公共-流程机制"},
            {"value": "_6公共_部门公共事务支持", "label": "公共-部门公共事务支持"},
            {"value": "_7公共_执业管理", "label": "公共-执业管理"},
            {"value": "_8管理_仅leader使用", "label": "管理-仅leader使用"},
            {"value": "_9其他", "label": "其他"}
        ]
    },
    {
        "key": "task",
        "label": "任务名称",
        "required": True,
        "options": [
            {"value": "1.2 整体合规/法务工作机制检测", "label": "1.2 整体合规/法务工作机制检测"},
            {"value": "1.5 梧桐稳智平台 采购与合规性检测", "label": "1.5 梧桐稳智平台采购与合规性检测"},
            {"value": "2.2 涉俄制裁风险管理与应对有效性检测", "label": "2.2 涉俄制裁风险管理与应对有效性检测"},
            {"value": "2.4 金融持牌主体反洗钱检测", "label": "2.4 金融持牌主体反洗钱检测"},
            {"value": "3.1 OKR、BSC会议", "label": "3.1 OKR、BSC会议"},
            {"value": "3.2 部门年度BSC\\OKR制定、调整", "label": "3.2 部门年度BSC/OKR制定、调整"},
            {"value": "3.3 部门战略工作汇报、总结", "label": "3.3 部门战略工作汇报、总结"},
            {"value": "3.4 集团、部门层面各类业务信息总结报送", "label": "3.4 集团、部门层面各类业务信息总结报送"},
            {"value": "4.3 支付相关项目", "label": "4.3 支付相关项目"},
            {"value": "4.4 金融理财相关项目", "label": "4.4 金融理财相关项目"},
            {"value": "4.5 消保相关项目", "label": "4.5 消保相关项目"},
            {"value": "4.6 境外主体合规管理", "label": "4.6 境外主体合规管理"},
            {"value": "5.1 跨部门/团队流程梳理", "label": "5.1 跨部门/团队流程梳理"},
            {"value": "5.2 VOC量化评估", "label": "5.2 VOC量化评估"},
            {"value": "5.3 内部工作机制优化", "label": "5.3 内部工作机制优化"},
            {"value": "6.1 各部门管理例会及业务会议", "label": "6.1 各部门管理例会及业务会议"},
            {"value": "6.2 业管团队内部会议", "label": "6.2 业管团队内部会议"},
            {"value": "6.3 预算管理", "label": "6.3 预算管理"},
            {"value": "6.4 IT管理", "label": "6.4 IT管理"},
            {"value": "6.5 管理类总结", "label": "6.5 管理类总结"},
            {"value": "6.6 其他", "label": "6.6 其他"},
            {"value": "7.3 参加内、外部培训", "label": "7.3 参加内、外部培训"},
            {"value": "7.4 金融合规培训体系升级", "label": "7.4 金融合规培训体系升级"},
            {"value": "7.6 AI信息赋能能力建设", "label": "7.6 AI信息赋能能力建设"},
            {"value": "9.2 团队/部门例会", "label": "9.2 团队/部门例会"},
            {"value": "9.3 团队日报/周报/月报填写", "label": "9.3 团队日报/周报/月报填写"}
        ]
    },
    {
        "key": "tag",
        "label": "标签",
        "required": True,
        "options": [
            {"value": "_OKR", "label": "OKR"},
            {"value": "_BSC", "label": "BSC"},
            {"value": "_Others", "label": "Others"}
        ]
    },
    {
        "key": "keyTask",
        "label": "关键任务",
        "required": True,
        "options": [
            {"value": "合规检测项目开展", "label": "合规检测项目开展"},
            {"value": "VOC量化评估体系", "label": "VOC量化评估体系"},
            {"value": "检测机制持续优化", "label": "检测机制持续优化"},
            {"value": "正向价值机制维护与运行", "label": "正向价值机制维护与运行"},
            {"value": "五部门战略工作机制运营维护", "label": "五部门战略工作机制运营维护"},
            {"value": "金融职能支持部门跨团队流程制定及优化", "label": "金融职能支持部门跨团队流程制定及优化"},
            {"value": "金融职能支持部门信息上报运营", "label": "金融职能支持部门信息上报运营"},
            {"value": "金融职能支持部门日常运营支持 ", "label": "金融职能支持部门日常运营支持"},
            {"value": "金融合规培训活动运营", "label": "金融合规培训活动运营"},
            {"value": "AI信息赋能能力持续建设", "label": "AI信息赋能能力持续建设"},
            {"value": "全面支持香港钱包合规管理及监管沟通等工作", "label": "全面支持香港钱包合规管理及监管沟通等工作"},
            {"value": "风险合规预警平台搭建", "label": "风险合规预警平台搭建"},
            {"value": "知识管理优化", "label": "知识管理优化"},
            {"value": "预算管理机制维护", "label": "预算管理机制维护"},
            {"value": "财付通一号位梳理及合规闭环流程制定", "label": "财付通一号位梳理及合规闭环流程制定"},
            {"value": "研发项目与IT系统搭建", "label": "研发项目与IT系统搭建"},
            {"value": "无", "label": "无"}
        ]
    },
    {
        "key": "hours",
        "label": "小时数",
        "required": True,
        "options": []
    },
    {
        "key": "workType",
        "label": "工作类型",
        "required": True,
        "options": [
            {"value": "项目方案讨论、制定", "label": "项目方案讨论、制定"},
            {"value": "项目调研、访谈、资料查阅学习等工作", "label": "项目调研、访谈、资料查阅学习等工作"},
            {"value": "项目执行相关的数据调取/分析、抽样工作", "label": "项目执行相关的数据调取/分析、抽样工作"},
            {"value": "项目执行结果分析、总结、汇报工作", "label": "项目执行结果分析、总结、汇报工作"},
            {"value": "项目跟踪", "label": "项目跟踪"},
            {"value": "部门各类会议支持（包括会议前期准备、会议召开、会议总结等工作）", "label": "部门各类会议支持"},
            {"value": "部门内/跨部门知识分享", "label": "部门内/跨部门知识分享"},
            {"value": "部门拉通类项目推进", "label": "部门拉通类项目推进"},
            {"value": "部门各类公共支持事务答疑", "label": "部门各类公共支持事务答疑"},
            {"value": "团队、部门目标管理工作", "label": "团队、部门目标管理工作"},
            {"value": "参与工作相关的各类培训", "label": "参与工作相关的各类培训"},
            {"value": "其他", "label": "其他"}
        ]
    },
    {
        "key": "description",
        "label": "工作描述",
        "required": False,
        "options": []
    }
]


def load_test_data(file_path: str, sample_size: int = 50) -> pd.DataFrame:
    """加载测试数据"""
    df = pd.read_excel(file_path, sheet_name='工作任务数据')
    # 过滤有效数据
    df = df[df['描述'].notna() & (df['描述'] != '')]
    # 随机抽样
    if len(df) > sample_size:
        df = df.sample(n=sample_size, random_state=42)
    return df


def call_ai_parse(description: str, include_hours: bool = False) -> Dict[str, Any]:
    """调用AI解析接口"""
    # 如果需要测试小时数解析，在描述中加入时间信息
    message = description
    
    payload = {
        "message": message,
        "fields": FORM_FIELDS,
        "center": CENTER,
        "teamName": "业务管理与合规检测中心"
    }
    
    try:
        response = requests.post(API_URL, json=payload, timeout=30)
        result = response.json()
        if result.get("success") and result.get("data"):
            return result["data"]
        return {}
    except Exception as e:
        print(f"API调用失败: {e}")
        return {}


def normalize_value(value: Any) -> str:
    """标准化值用于比较"""
    if pd.isna(value):
        return ""
    return str(value).strip().lower()


def compare_field(ai_value: Any, expected_value: Any, field_name: str) -> Dict[str, Any]:
    """比较单个字段"""
    ai_norm = normalize_value(ai_value)
    expected_norm = normalize_value(expected_value)
    
    # 精确匹配
    exact_match = ai_norm == expected_norm
    
    # 部分匹配（AI值包含在期望值中，或期望值包含在AI值中）
    partial_match = ai_norm in expected_norm or expected_norm in ai_norm if ai_norm and expected_norm else False
    
    return {
        "field": field_name,
        "ai_value": ai_value,
        "expected_value": expected_value,
        "exact_match": exact_match,
        "partial_match": partial_match,
        "ai_returned": ai_value is not None and ai_value != ""
    }


def run_accuracy_test(test_data: pd.DataFrame, test_fields: List[str] = None) -> Dict[str, Any]:
    """运行精准度测试"""
    if test_fields is None:
        test_fields = ["category", "task", "tag", "keyTask", "workType"]
    
    results = []
    field_stats = {field: {"total": 0, "exact": 0, "partial": 0, "returned": 0} for field in test_fields}
    
    total = len(test_data)
    print(f"\n开始测试 {total} 条数据...\n")
    
    for idx, (_, row) in enumerate(test_data.iterrows(), 1):
        description = row['描述']
        print(f"[{idx}/{total}] 测试: {description[:50]}...")
        
        # 调用AI解析
        ai_result = call_ai_parse(description)
        
        # 比较各字段
        case_result = {
            "description": description,
            "ai_result": ai_result,
            "field_comparisons": []
        }
        
        for field in test_fields:
            # 获取历史数据中的期望值
            data_col = [k for k, v in FIELD_MAPPING.items() if v == field]
            if data_col:
                expected_value = row[data_col[0]]
            else:
                expected_value = None
            
            # 获取AI返回值
            ai_value = ai_result.get(field)
            
            # 比较
            comparison = compare_field(ai_value, expected_value, field)
            case_result["field_comparisons"].append(comparison)
            
            # 统计
            field_stats[field]["total"] += 1
            if comparison["exact_match"]:
                field_stats[field]["exact"] += 1
            if comparison["partial_match"]:
                field_stats[field]["partial"] += 1
            if comparison["ai_returned"]:
                field_stats[field]["returned"] += 1
        
        results.append(case_result)
        
        # 避免API限流
        time.sleep(0.5)
    
    # 计算统计指标
    summary = {
        "total_cases": total,
        "field_accuracy": {}
    }
    
    for field, stats in field_stats.items():
        if stats["total"] > 0:
            summary["field_accuracy"][field] = {
                "exact_match_rate": round(stats["exact"] / stats["total"] * 100, 2),
                "partial_match_rate": round(stats["partial"] / stats["total"] * 100, 2),
                "return_rate": round(stats["returned"] / stats["total"] * 100, 2),
                "exact_matches": stats["exact"],
                "partial_matches": stats["partial"],
                "total": stats["total"]
            }
    
    return {
        "summary": summary,
        "results": results,
        "field_stats": field_stats
    }


def print_report(test_result: Dict[str, Any]):
    """打印测试报告"""
    summary = test_result["summary"]
    
    print("\n" + "=" * 60)
    print("📊 AI工时助手精准度测试报告 - 业务管理与合规检测中心")
    print("=" * 60)
    print(f"\n测试样本数: {summary['total_cases']}")
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    print("\n📈 各字段精准度统计:")
    print("-" * 60)
    print(f"{'字段':<15} {'精确匹配率':<12} {'部分匹配率':<12} {'返回率':<10}")
    print("-" * 60)
    
    for field, accuracy in summary["field_accuracy"].items():
        print(f"{field:<15} {accuracy['exact_match_rate']:>8.1f}%    {accuracy['partial_match_rate']:>8.1f}%    {accuracy['return_rate']:>6.1f}%")
    
    print("-" * 60)
    
    # 计算总体精确匹配率
    total_exact = sum(s["exact_matches"] for s in summary["field_accuracy"].values())
    total_tests = sum(s["total"] for s in summary["field_accuracy"].values())
    overall_rate = round(total_exact / total_tests * 100, 2) if total_tests > 0 else 0
    print(f"\n📌 总体精确匹配率: {overall_rate}%")
    
    # 显示错误案例
    print("\n\n❌ 错误案例分析 (前10个):")
    print("-" * 60)
    
    error_cases = []
    for result in test_result["results"]:
        for comp in result["field_comparisons"]:
            if not comp["exact_match"] and comp["ai_returned"]:
                error_cases.append({
                    "description": result["description"],
                    "field": comp["field"],
                    "ai_value": comp["ai_value"],
                    "expected": comp["expected_value"]
                })
    
    for i, case in enumerate(error_cases[:10], 1):
        print(f"\n案例 {i}:")
        print(f"  描述: {case['description'][:60]}...")
        print(f"  字段: {case['field']}")
        print(f"  AI返回: {case['ai_value']}")
        print(f"  期望值: {case['expected']}")


def save_report(test_result: Dict[str, Any], output_path: str):
    """保存详细报告到Excel"""
    # 创建汇总表
    summary_data = []
    for field, accuracy in test_result["summary"]["field_accuracy"].items():
        summary_data.append({
            "字段": field,
            "精确匹配数": accuracy["exact_matches"],
            "部分匹配数": accuracy["partial_matches"],
            "测试总数": accuracy["total"],
            "精确匹配率(%)": accuracy["exact_match_rate"],
            "部分匹配率(%)": accuracy["partial_match_rate"],
            "返回率(%)": accuracy["return_rate"]
        })
    summary_df = pd.DataFrame(summary_data)
    
    # 创建详细结果表
    detail_data = []
    for result in test_result["results"]:
        row = {"描述": result["description"]}
        for comp in result["field_comparisons"]:
            row[f"{comp['field']}_AI值"] = comp["ai_value"]
            row[f"{comp['field']}_期望值"] = comp["expected_value"]
            row[f"{comp['field']}_匹配"] = "✓" if comp["exact_match"] else ("△" if comp["partial_match"] else "✗")
        detail_data.append(row)
    detail_df = pd.DataFrame(detail_data)
    
    # 保存到Excel
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        summary_df.to_excel(writer, sheet_name='精准度汇总', index=False)
        detail_df.to_excel(writer, sheet_name='详细结果', index=False)
    
    print(f"\n📁 详细报告已保存到: {output_path}")


if __name__ == "__main__":
    import sys
    
    # 参数
    data_file = "../模版&数据/数据/5-11月合规检测工时数据.xlsx"
    sample_size = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    
    print("=" * 60)
    print("🚀 AI工时助手精准度测试 - 业务管理与合规检测中心")
    print("=" * 60)
    
    # 加载测试数据
    print(f"\n📂 加载测试数据 (样本数: {sample_size})...")
    test_data = load_test_data(data_file, sample_size)
    print(f"   已加载 {len(test_data)} 条测试数据")
    
    # 运行测试
    test_result = run_accuracy_test(test_data)
    
    # 打印报告
    print_report(test_result)
    
    # 保存报告
    output_file = f"accuracy_report_biz_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    save_report(test_result, output_file)
