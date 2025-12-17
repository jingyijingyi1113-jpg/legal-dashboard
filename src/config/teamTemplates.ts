import type { TeamTemplate, FieldOption } from '@/types/timesheet';

// ==================== 业务管理及合规检测中心 ====================
const businessManagementCategories: FieldOption[] = [
  {
    value: '_1检测相关_常规',
    label: '检测相关_常规',
    children: [
      { value: '1.1 跨境收单业务合规检测', label: '1.1 跨境收单业务合规检测' },
      { value: '1.2 整体合规/法务工作机制检测', label: '1.2 整体合规/法务工作机制检测' },
      { value: '1.3 2024年支付合规团队自查复验', label: '1.3 2024年支付合规团队自查复验' },
      { value: '1.4 金融消保长效工作机制后续检测', label: '1.4 金融消保长效工作机制后续检测' },
      { value: '1.5 梧桐稳智平台 采购与合规性检测', label: '1.5 梧桐稳智平台 采购与合规性检测' },
      { value: '1.6 PA OKR/BSC review', label: '1.6 PA OKR/BSC review' },
      { value: '1.7 境外机构制裁检测', label: '1.7 境外机构制裁检测' },
    ],
  },
  {
    value: '_2检测相关_快速',
    label: '检测相关_快速',
    children: [
      { value: '2.1 非金融平台治理检测', label: '2.1 非金融平台治理检测' },
      { value: '2.2 涉俄制裁风险管理与应对有效性检测', label: '2.2 涉俄制裁风险管理与应对有效性检测' },
      { value: '2.3 跨团队、多主体评估流程检测', label: '2.3 跨团队、多主体评估流程检测' },
      { value: '2.4 金融持牌主体反洗钱检测', label: '2.4 金融持牌主体反洗钱检测' },
      { value: '2.5 金融主体投诉管理工作检测', label: '2.5 金融主体投诉管理工作检测' },
      { value: '2.6 圳星/Tenpay Global 反洗钱整体检测', label: '2.6 圳星/Tenpay Global 反洗钱整体检测' },
      { value: '2.7 服务商商户不能同一验证', label: '2.7 服务商商户不能同一验证' },
    ],
  },
  {
    value: '_3业务管理相关_业务战略总结',
    label: '业务管理相关_业务战略总结',
    children: [
      { value: '3.1 OKR、BSC会议', label: '3.1 OKR、BSC会议' },
      { value: '3.2 部门年度BSC/OKR制定、调整', label: '3.2 部门年度BSC/OKR制定、调整' },
      { value: '3.3 部门战略工作汇报、总结', label: '3.3 部门战略工作汇报、总结' },
      { value: '3.4 集团、部门层面各类业务信息总结报送', label: '3.4 集团、部门层面各类业务信息总结报送' },
    ],
  },
  {
    value: '_4业务管理相关_项目跟进',
    label: '业务管理相关_项目跟进',
    children: [
      { value: '4.1 正向价值项目', label: '4.1 正向价值项目' },
      { value: '4.2 反洗钱制裁相关项目', label: '4.2 反洗钱制裁相关项目' },
      { value: '4.3 支付相关项目', label: '4.3 支付相关项目' },
      { value: '4.4 金融理财相关项目', label: '4.4 金融理财相关项目' },
      { value: '4.5 消保相关项目', label: '4.5 消保相关项目' },
      { value: '4.6 境外主体合规管理', label: '4.6 境外主体合规管理' },
      { value: '4.7 金融科技相关', label: '4.7 金融科技相关' },
      { value: '4.8 检测项目后续跟踪', label: '4.8 检测项目后续跟踪' },
    ],
  },
  {
    value: '_5公共_流程机制',
    label: '公共_流程机制',
    children: [
      { value: '5.1 跨部门/团队流程梳理', label: '5.1 跨部门/团队流程梳理' },
      { value: '5.2 VOC量化评估', label: '5.2 VOC量化评估' },
      { value: '5.3 内部工作机制优化', label: '5.3 内部工作机制优化' },
    ],
  },
  {
    value: '_6公共_部门公共事务支持',
    label: '公共_部门公共事务支持',
    children: [
      { value: '6.1 各部门管理例会及业务会议', label: '6.1 各部门管理例会及业务会议' },
      { value: '6.2 预算管理', label: '6.2 预算管理' },
      { value: '6.3 IT管理', label: '6.3 IT管理' },
      { value: '6.4 管理类总结', label: '6.4 管理类总结' },
      { value: '6.5 其他', label: '6.5 其他' },
    ],
  },
  {
    value: '_7公共_执业管理',
    label: '公共_执业管理',
    children: [
      { value: '7.1 知识分享-公司内', label: '7.1 知识分享-公司内' },
      { value: '7.2 知识分享-公司外', label: '7.2 知识分享-公司外' },
      { value: '7.3 参加内、外部培训', label: '7.3 参加内、外部培训' },
      { value: '7.4 金融合规培训体系升级', label: '7.4 金融合规培训体系升级' },
      { value: '7.5 内部知识管理体系搭建', label: '7.5 内部知识管理体系搭建' },
      { value: '7.6 AI信息赋能能力建设', label: '7.6 AI信息赋能能力建设' },
      { value: '7.7 内部员工成长体系建设', label: '7.7 内部员工成长体系建设' },
      { value: '7.8 团队影响力建设', label: '7.8 团队影响力建设' },
    ],
  },
  {
    value: '_8管理_仅leader使用',
    label: '管理_仅leader使用',
    children: [
      { value: '8.1 员工培养及辅导', label: '8.1 员工培养及辅导' },
      { value: '8.2 跨团队管理事务沟通', label: '8.2 跨团队管理事务沟通' },
      { value: '8.3 管理类会议组织及参会', label: '8.3 管理类会议组织及参会' },
      { value: '8.4 组织氛围建设', label: '8.4 组织氛围建设' },
      { value: '8.5 团队招聘', label: '8.5 团队招聘' },
    ],
  },
  {
    value: '_9其他',
    label: '其他',
    children: [
      { value: '9.1 工时填写', label: '9.1 工时填写' },
      { value: '9.2 团队/部门例会', label: '9.2 团队/部门例会' },
      { value: '9.3 团队日报/周报/月报填写', label: '9.3 团队日报/周报/月报填写' },
      { value: '9.4 差旅路途时间', label: '9.4 差旅路途时间' },
      { value: '9.5 商务招待（非工作时间段）', label: '9.5 商务招待（非工作时间段）' },
    ],
  },
];

// 标签带有关键任务的联动关系
const businessManagementTags: FieldOption[] = [
  {
    value: '_BSC',
    label: 'BSC',
    children: [
      { value: '检测机制持续优化', label: '检测机制持续优化' },
      { value: '正向价值机制维护与运行', label: '正向价值机制维护与运行' },
      { value: '金融科技板块跟进与运行', label: '金融科技板块跟进与运行' },
      { value: '五部门战略工作机制运营维护', label: '五部门战略工作机制运营维护' },
      { value: '产品清单全盘梳理', label: '产品清单全盘梳理' },
      { value: '校招生轮岗机制维护', label: '校招生轮岗机制维护' },
      { value: '知识管理优化', label: '知识管理优化' },
      { value: '预算管理机制维护', label: '预算管理机制维护' },
      { value: '团队专业能力培养及影响力提升', label: '团队专业能力培养及影响力提升' },
      { value: '风险合规预警平台搭建', label: '风险合规预警平台搭建' },
      { value: '研发项目与IT系统搭建', label: '研发项目与IT系统搭建' },
      { value: '金融合规培训活动运营', label: '金融合规培训活动运营' },
      { value: 'AI信息赋能能力持续建设', label: 'AI信息赋能能力持续建设' },
      { value: '金融职能支持部门信息上报运营', label: '金融职能支持部门信息上报运营' },
      { value: '金融职能支持部门跨团队流程制定及优化', label: '金融职能支持部门跨团队流程制定及优化' },
      { value: '金融职能支持部门日常运营支持', label: '金融职能支持部门日常运营支持' },
      { value: '反诈合规履职工作框架及机制明确', label: '反诈合规履职工作框架及机制明确' },
      { value: '消保合规框架及一号位梳理支持', label: '消保合规框架及一号位梳理支持' },
      { value: '财付通一号位梳理及合规闭环流程制定', label: '财付通一号位梳理及合规闭环流程制定' },
      { value: '全面支持香港钱包合规管理及监管沟通等工作', label: '全面支持香港钱包合规管理及监管沟通等工作' },
    ],
  },
  {
    value: '_OKR',
    label: 'OKR',
    children: [
      { value: '合规检测项目开展', label: '合规检测项目开展' },
      { value: 'VOC量化评估体系', label: 'VOC量化评估体系' },
    ],
  },
  {
    value: '_Others',
    label: 'Others',
    children: [], // Others没有关键任务
  },
];

const businessManagementWorkTypes: FieldOption[] = [
  { value: '项目调研、访谈、资料查阅学习等工作', label: '项目调研、访谈、资料查阅学习等工作' },
  { value: '项目方案讨论、制定', label: '项目方案讨论、制定' },
  { value: '项目执行相关的数据调取/分析、抽样工作', label: '项目执行相关的数据调取/分析、抽样工作' },
  { value: '项目执行结果分析、总结、汇报工作', label: '项目执行结果分析、总结、汇报工作' },
  { value: '项目跟踪', label: '项目跟踪' },
  { value: '部门各类会议支持', label: '部门各类会议支持（包括会议前期准备、会议召开、会议总结等工作）' },
  { value: '部门各类公共支持事务答疑', label: '部门各类公共支持事务答疑' },
  { value: '部门拉通类项目推进', label: '部门拉通类项目推进' },
  { value: '部门内/跨部门知识分享', label: '部门内/跨部门知识分享' },
  { value: '团队、部门目标管理工作', label: '团队、部门目标管理工作' },
  { value: '参与工作相关的各类培训', label: '参与工作相关的各类培训' },
  { value: '其他', label: '其他' },
];

// ==================== 投资法务中心 ====================
// Deal/Matter Category 及其对应的 Work Category 选项
const investmentLegalCategories: FieldOption[] = [
  {
    value: 'Investment Related - M&A Deal',
    label: 'Investment Related - M&A Deal',
    children: [
      { value: 'Drafting/reviewing/revising legal documents', label: 'Drafting/reviewing/revising legal documents' },
      { value: 'Internal/external discussion on/negotiation of legal documents', label: 'Internal/external discussion on/negotiation of legal documents' },
      { value: 'Conducting LDD/reviewing LDD results', label: 'Conducting LDD/reviewing LDD results' },
      { value: 'Conducting legal researches', label: 'Conducting legal researches' },
      { value: 'Interacting with authorities/regulators', label: 'Interacting with authorities/regulators' },
      { value: 'Reverting to inquiries', label: 'Reverting to inquiries' },
      { value: 'Others', label: 'Others' },
    ],
  },
  {
    value: 'Investment Related - IPO',
    label: 'Investment Related - IPO',
    children: [
      { value: 'Drafting/reviewing/revising legal documents', label: 'Drafting/reviewing/revising legal documents' },
      { value: 'Internal/external discussion on/negotiation of legal documents', label: 'Internal/external discussion on/negotiation of legal documents' },
      { value: 'Conducting LDD/reviewing LDD results', label: 'Conducting LDD/reviewing LDD results' },
      { value: 'Conducting legal researches', label: 'Conducting legal researches' },
      { value: 'Interacting with authorities/regulators', label: 'Interacting with authorities/regulators' },
      { value: 'Reverting to inquiries', label: 'Reverting to inquiries' },
      { value: 'Others', label: 'Others' },
    ],
  },
  {
    value: 'Investment Related - Corporate Matter',
    label: 'Investment Related - Corporate Matter',
    children: [
      { value: 'Drafting/reviewing/revising legal documents', label: 'Drafting/reviewing/revising legal documents' },
      { value: 'Internal/external discussion on/negotiation of legal documents', label: 'Internal/external discussion on/negotiation of legal documents' },
      { value: 'Conducting LDD/reviewing LDD results', label: 'Conducting LDD/reviewing LDD results' },
      { value: 'Conducting legal researches', label: 'Conducting legal researches' },
      { value: 'Interacting with authorities/regulators', label: 'Interacting with authorities/regulators' },
      { value: 'Reverting to inquiries', label: 'Reverting to inquiries' },
      { value: 'Others', label: 'Others' },
    ],
  },
  {
    value: 'Non-Investment Related - Other Departments',
    label: 'Non-Investment Related - Other Departments',
    children: [
      { value: 'CTD（合规交易部 - 公司事务及国际监管法务中心）', label: 'CTD（合规交易部 - 公司事务及国际监管法务中心）' },
      { value: 'AMLSC（反洗钱与制裁合规部）', label: 'AMLSC（反洗钱与制裁合规部）' },
      { value: 'FLCD（金融法律合规部）', label: 'FLCD（金融法律合规部）' },
      { value: 'FPAD（金融业务公共事务部）', label: 'FPAD（金融业务公共事务部）' },
      { value: 'FCRPD（集团金融消费者权益保护部）', label: 'FCRPD（集团金融消费者权益保护部）' },
      { value: 'Others', label: 'Others' },
    ],
  },
  {
    value: 'Public - Infrastructure & Guidance',
    label: 'Public - Infrastructure & Guidance',
    children: [
      { value: 'Preparing policies/procedures/guidance/booklet alert', label: 'Preparing policies/procedures/guidance/booklet alert' },
      { value: 'Establishing/improving IT systems', label: 'Establishing/improving IT systems' },
      { value: 'Updating internal templates', label: 'Updating internal templates' },
      { value: 'Participating training sessions', label: 'Participating training sessions' },
      { value: 'Others', label: 'Others' },
    ],
  },
  {
    value: 'Public - Knowledge Accumulation & Sharing',
    label: 'Public - Knowledge Accumulation & Sharing',
    children: [
      { value: 'Preparing knowhow/memo/client alert', label: 'Preparing knowhow/memo/client alert' },
      { value: 'Providing training sessions/knowledge sharing', label: 'Providing training sessions/knowledge sharing' },
      { value: 'Conducting CTD Documents Collation Project (iWiki)', label: 'Conducting CTD Documents Collation Project (iWiki)' },
      { value: 'Relevant matters related to engagement of law firms/team\'s legal fees', label: 'Relevant matters related to engagement of law firms/team\'s legal fees' },
      { value: 'Others', label: 'Others' },
    ],
  },
  {
    value: 'Public - Others',
    label: 'Public - Others',
    children: [
      { value: 'Participating regular team meetings', label: 'Participating regular team meetings' },
      { value: 'Recording/reviewing deals updates/weekly time reports/other team summaries', label: 'Recording/reviewing deals updates/weekly time reports/other team summaries' },
      { value: 'Supporting GCTSM-related matters', label: 'Supporting GCTSM-related matters' },
      { value: 'Interacting with regulators', label: 'Interacting with regulators' },
      { value: 'Others', label: 'Others' },
    ],
  },
];

const investmentLegalBSCItems: FieldOption[] = [
  { value: '境内投融资法务服务', label: '境内投融资法务服务 Domestic investment legal services' },
  { value: '境外投融资法务服务', label: '境外投融资法务服务 Overseas investment legal services' },
  { value: '国际监管趋势监测、预判', label: '国际监管趋势监测、预判 Monitoring and forecasting international regulatory trends' },
  { value: '境内投融资资本市场监管发展与重大政策争取与风险应对', label: '境内投融资资本市场监管发展与重大政策争取与风险应对' },
  { value: '执业管理平台体系完善', label: '执业管理平台体系完善 Perfection of the professional management platform' },
  { value: '优化Hotdesk和专家组制度', label: '优化Hotdesk和专家组制度 Optimization of Hotdesk and expert panel system' },
  { value: '精细化管理工具搭建', label: '精细化管理工具搭建 Adoption of refined management tools' },
];

// 投资法务中心 - BSC Tag 选项
const investmentLegalBSCTags: FieldOption[] = [
  { value: 'BSC', label: 'BSC' },
  { value: 'Others', label: 'Others' },
];

// 投资法务中心 - 分组选项（Source Path）
const investmentLegalGroups: FieldOption[] = [
  { value: '1组', label: '1组' },
  { value: '2组', label: '2组' },
  { value: '3组', label: '3组' },
  { value: '4组', label: '4组' },
  { value: '5组', label: '5组' },
  { value: '6组', label: '6组' },
];

// ==================== 公司及国际金融事务中心 ====================
const internationalFinanceCategories: FieldOption[] = [
  {
    value: '_BSC',
    label: 'BSC',
    children: [
      { value: 'CTD-0101 境外金融业务资质申请', label: 'CTD-0101 境外金融业务资质申请 (国际金融业务牌照申请)' },
      { value: 'CTD-0105 集团融资支持', label: 'CTD-0105 集团融资支持 Group financing' },
      { value: 'CTD-0106 国际监管趋势监测、预判 (研究国际监管环境)', label: 'CTD-0106 国际监管趋势监测、预判 (研究国际监管环境和趋势)' },
      { value: 'CTD-0106 国际监管趋势监测、预判 (海外高风险法律)', label: 'CTD-0106 国际监管趋势监测、预判 (海外高风险法律的合规工作)' },
      { value: 'CTD-0201 境外主体/办公室合规管理', label: 'CTD-0201 境外主体/办公室合规管理' },
      { value: 'CTD-0202 国际人力资源合规管理', label: 'CTD-0202 国际人力资源合规管理 Overseas HR support' },
      { value: 'CTD-0203 国际业务合规管理', label: 'CTD-0203 国际业务合规管理 Overseas businesses/products compliance' },
      { value: 'CTD-0204 集团上市合规风险管理', label: 'CTD-0204 集团上市合规风险管理 Listing Rules compliance' },
      { value: 'CTD-0205 反洗钱和制裁合规支持(境外)', label: 'CTD-0205 反洗钱和制裁合规支持(境外) AML and Sanctions compliance' },
      { value: 'CTD-0209 境外金融持牌主体业务合规管理', label: 'CTD-0209 境外金融持牌主体业务合规管理' },
      { value: 'CTD-0210 海外投资合规管理', label: 'CTD-0210 海外投资合规管理 Overseas investment compliance (CFIUS)' },
      { value: 'CTD-0301 国际业务监管应对', label: 'CTD-0301 国际业务监管应对 International regulatory requests/queries/responses' },
      { value: 'CTD-0401 执业管理平台体系完善', label: 'CTD-0401 执业管理平台体系完善 (智能化工作开发及运用)' },
      { value: 'CTD-0402 优化Hotdesk制度', label: 'CTD-0402 优化Hotdesk制度 Optimising Hotdesks' },
      { value: 'CTD-0403 精细化管理工具搭建', label: 'CTD-0403 精细化管理工具搭建 (优化完善VOC工作记录工具)' },
    ],
  },
  {
    value: '_Others',
    label: 'Others',
    children: [
      { value: '团队内部会议 Team meetings', label: '团队内部会议 Team meetings' },
      { value: '账单处理 Billing', label: '账单处理 Billing' },
      { value: '绩效统计（工时和项目数据）', label: '绩效统计（工时和项目数据）Timesheet and matters recording' },
    ],
  },
  {
    value: '_Management',
    label: 'Management',
    children: [
      { value: '管理例会 Management meetings', label: '管理例会 Management meetings' },
      { value: '预算规划 Budget planning', label: '预算规划 Budget planning' },
      { value: '人才管理 Human resources', label: '人才管理 Human resources' },
      { value: '工作总结/汇报', label: '工作总结/汇报 Internal reportings / achievement summary' },
      { value: '一般管理 General management', label: '一般管理 General management' },
    ],
  },
  {
    value: '_Non_CTD_兼岗',
    label: 'Non-CTD (兼岗)',
    children: [
      { value: 'Global Research (GPA)', label: 'Global Research (GPA)' },
      { value: 'International Regulatory Policy (GPA)', label: 'International Regulatory Policy (GPA)' },
    ],
  },
];

const internationalFinanceVirtualGroups: FieldOption[] = [
  { value: 'Listing Rules and Corporate Governance', label: 'Listing Rules and Corporate Governance' },
  { value: 'Group Financing', label: 'Group Financing' },
  { value: 'International Financial', label: 'International Financial' },
  { value: 'Non-CTD (兼岗)', label: 'Non-CTD (兼岗)' },
];

const internationalFinanceInternalClients: FieldOption[] = [
  { value: 'MA', label: 'MA' },
  { value: 'Comsec', label: 'Comsec' },
  { value: 'HR', label: 'HR' },
  { value: 'Tax', label: 'Tax' },
  { value: 'Admin/Operations', label: 'Admin/Operations' },
  { value: 'GCTSM', label: 'GCTSM' },
  { value: 'Treasury', label: 'Treasury' },
  { value: 'CSIG', label: 'CSIG' },
  { value: 'IEGG', label: 'IEGG' },
  { value: 'WXG', label: 'WXG' },
  { value: 'WPHK', label: 'WPHK' },
  { value: 'WPMY', label: 'WPMY' },
  { value: 'Finance', label: 'Finance' },
  { value: 'FiT (ZX/TG)', label: 'FiT (ZX/TG)' },
  { value: 'Midas', label: 'Midas' },
  { value: 'Tai Fung', label: 'Tai Fung' },
  { value: 'Fusion Bank', label: 'Fusion Bank' },
  { value: 'FuSure', label: 'FuSure' },
  { value: 'Group matter', label: 'Group matter' },
  { value: 'Others', label: 'Others' },
  { value: 'N/A', label: 'N/A' },
];

const internationalFinanceWorkCategories: FieldOption[] = [
  { value: 'Drafting/reviewing/commenting on documents', label: 'Drafting/reviewing/commenting on documents' },
  { value: 'Discussing with internal legal team/internal stakeholders/external counsels', label: 'Discussing with internal legal team/internal stakeholders/external counsels' },
  { value: 'Negotiating/discussing with external parties', label: 'Negotiating/discussing with external parties' },
  { value: 'Conducting legal analysis and research', label: 'Conducting legal analysis and research' },
  { value: 'Preparing internal know-how / team admin work', label: 'Preparing internal know-how / team admin work' },
  { value: 'Preparing internal memo / policy / procedures / guidance etc.', label: 'Preparing internal memo / policy / procedures / guidance etc.' },
  { value: 'Participating in training sessions', label: 'Participating in training sessions' },
  { value: 'Internal/cross-teams knowledge sharing', label: 'Internal/cross-teams knowledge sharing' },
  { value: 'Participating training sessions/team meetings', label: 'Participating training sessions/team meetings' },
  { value: 'Liaising with regulators or preparing written response to regulators', label: 'Liaising with regulators or preparing written response to regulators' },
  { value: 'Others', label: 'Others' },
];

// ==================== 团队模版配置 ====================
export const TEAM_TEMPLATES: TeamTemplate[] = [
  // 业务管理及合规检测中心
  {
    teamId: 'team-001',
    teamName: '业务管理及合规检测中心',
    fields: [
      {
        key: 'category',
        label: '事项分类',
        type: 'select',
        required: true,
        placeholder: '请选择事项分类',
        options: businessManagementCategories,
      },
      {
        key: 'task',
        label: '工作任务',
        type: 'select',
        required: true,
        placeholder: '请选择工作任务',
        options: [], // 动态根据category填充
        parentField: 'category',
      },
      {
        key: 'tag',
        label: '标签',
        type: 'select',
        required: true,
        placeholder: '请选择标签',
        options: businessManagementTags,
      },
      {
        key: 'keyTask',
        label: '关键任务',
        type: 'select',
        required: false,
        placeholder: '请选择关键任务',
        options: [], // 动态根据tag填充
        parentField: 'tag',
        conditionalRequired: {
          dependsOn: 'tag',
          when: ['_BSC', '_OKR'],
        },
      },
      {
        key: 'hours',
        label: '小时数',
        type: 'number',
        required: true,
        placeholder: '请输入小时数',
        step: 0.5,
        min: 0,
        max: 24,
      },
      {
        key: 'workType',
        label: '工作类型',
        type: 'select',
        required: true,
        placeholder: '请选择工作类型',
        options: businessManagementWorkTypes,
      },
      {
        key: 'description',
        label: '描述',
        type: 'text',
        required: false,
        placeholder: '简要描述工作内容（可选）',
      },
    ],
  },
  // 投资法务中心
  {
    teamId: 'team-002',
    teamName: '投资法务中心',
    fields: [
      {
        key: 'sourcePath',
        label: '小组 (Team)',
        type: 'select',
        required: true,
        placeholder: '请选择组别',
        options: investmentLegalGroups,
      },
      {
        key: 'category',
        label: 'Deal/Matter Category (事务类别)',
        type: 'select',
        required: true,
        placeholder: '请选择事务类别',
        options: investmentLegalCategories,
      },
      {
        key: 'dealName',
        label: 'Deal/Matter Name (项目名称)',
        type: 'text',
        required: false,
        placeholder: '请输入TIM系统中的公司名称',
        conditionalRequired: {
          dependsOn: 'category',
          when: ['Investment Related - M&A Deal', 'Investment Related - IPO', 'Investment Related - Corporate Matter'],
        },
      },
      {
        key: 'bscTag',
        label: 'BSC Tag (是否BSC事项)',
        type: 'select',
        required: true,
        placeholder: '请确认是否为CTD-ILC BSC事项',
        options: investmentLegalBSCTags,
      },
      {
        key: 'bscItem',
        label: 'BSC Item (BSC事项)',
        type: 'select',
        required: false,
        placeholder: '如为BSC事项，请选择具体项目',
        options: investmentLegalBSCItems,
        conditionalRequired: {
          dependsOn: 'bscTag',
          when: 'BSC',
        },
      },
      {
        key: 'hours',
        label: 'Hours (小时数)',
        type: 'number',
        required: true,
        placeholder: '请输入小时数',
        step: 0.1,
        min: 0,
        max: 24,
      },
      {
        key: 'workCategory',
        label: 'Work Category (工作类别)',
        type: 'select',
        required: true,
        placeholder: '请选择工作类别',
        options: [], // 动态根据category填充
        parentField: 'category',
      },
      {
        key: 'description',
        label: 'Narrative (工作描述)',
        type: 'text',
        required: false,
        placeholder: '简要描述工作内容（可选）',
      },
    ],
  },
  // 公司及国际金融事务中心
  {
    teamId: 'team-003',
    teamName: '公司及国际金融事务中心',
    fields: [
      {
        key: 'virtualGroup',
        label: 'Virtual Group',
        type: 'select',
        required: true,
        placeholder: '请选择Virtual Group',
        options: internationalFinanceVirtualGroups,
      },
      {
        key: 'internalClient',
        label: 'Internal Client',
        type: 'select',
        required: true,
        placeholder: '请选择Internal Client（如无需求方请选N/A）',
        options: internationalFinanceInternalClients,
      },
      {
        key: 'tag',
        label: 'Tag',
        type: 'select',
        required: true,
        placeholder: '请确认该事务是否为BSC事项',
        options: internationalFinanceCategories,
      },
      {
        key: 'item',
        label: 'Item',
        type: 'select',
        required: true,
        placeholder: '请选择对应事项',
        options: [],
        parentField: 'tag',
      },
      {
        key: 'hours',
        label: 'Hours',
        type: 'number',
        required: true,
        placeholder: '请输入小时数',
        step: 0.1,
        min: 0,
        max: 24,
      },
      {
        key: 'workCategory',
        label: 'Work Category',
        type: 'select',
        required: true,
        placeholder: '请选择工作类别',
        options: internationalFinanceWorkCategories,
      },
      {
        key: 'description',
        label: 'Narrative (Optional)',
        type: 'text',
        required: false,
        placeholder: '简要描述工作内容',
      },
    ],
  },
];

// 根据团队ID获取模版
export function getTeamTemplate(teamId: string): TeamTemplate | undefined {
  return TEAM_TEMPLATES.find(t => t.teamId === teamId);
}

// 根据团队名称获取模版
export function getTeamTemplateByName(teamName: string): TeamTemplate | undefined {
  return TEAM_TEMPLATES.find(t => t.teamName === teamName);
}

// 获取子选项（用于级联选择）
export function getChildOptions(parentValue: string, options: FieldOption[]): FieldOption[] {
  const parent = options.find(o => o.value === parentValue);
  return parent?.children || [];
}

// 默认模版（用于未配置的团队）
export const DEFAULT_TEMPLATE: TeamTemplate = {
  teamId: 'default',
  teamName: '默认模版',
  fields: [
    {
      key: 'project',
      label: '项目名称',
      type: 'text',
      required: true,
      placeholder: '请输入项目名称',
    },
    {
      key: 'category',
      label: '工作类别',
      type: 'text',
      required: true,
      placeholder: '请输入工作类别',
    },
    {
      key: 'hours',
      label: '小时数',
      type: 'number',
      required: true,
      placeholder: '请输入小时数',
      step: 0.5,
      min: 0,
      max: 24,
    },
    {
      key: 'description',
      label: '描述',
      type: 'text',
      required: false,
      placeholder: '简要描述工作内容（可选）',
    },
  ],
};
