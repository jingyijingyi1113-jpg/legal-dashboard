import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { TemplateField, FieldOption } from '@/types/timesheet';
import { aiFeedbackApi } from '@/api/index';

// API基础URL - 生产环境使用相对路径
const API_BASE_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:5001');

// 生成唯一会话ID
const generateSessionId = () => `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

interface AIAssistantProps {
  fields: TemplateField[];
  teamName?: string;  // 用户所属团队名称
  onFillForm: (data: Record<string, string | number>, sessionId?: string) => void;
}

// 语音识别类型声明
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function AIAssistant({ fields, teamName, onFillForm }: AIAssistantProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [useAI, setUseAI] = useState(true); // 是否使用混元AI
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // 初始化欢迎消息
  useEffect(() => {
    if (!initializedRef.current) {
      setMessages([{ 
        role: 'assistant', 
        content: t('timesheet.ai.welcomeMessage', { 
          defaultValue: '你好！我是工时录入助手。你可以用自然语言描述你的工作，我会帮你自动填写表单。\n\n例如："今天做了2小时合同审核" 或 "花了3小时处理日常法务工作"' 
        })
      }]);
      initializedRef.current = true;
    }
  }, [t]);

  // 记录AI反馈
  const recordAiFeedback = useCallback(async (sessionId: string, userInput: string, aiResult: Record<string, unknown>) => {
    try {
      await aiFeedbackApi.record(sessionId, userInput, aiResult);
    } catch (error) {
      console.error('Failed to record AI feedback:', error);
    }
  }, []);

  // 检查语音识别支持
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognition);
  }, []);

  // 检查混元API配置状态
  useEffect(() => {
    const checkAIConfig = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/hunyuan/config`);
        const data = await response.json();
        setAiConfigured(data.configured);
        if (!data.configured) {
          setUseAI(false);
        }
      } catch {
        setAiConfigured(false);
        setUseAI(false);
      }
    };
    checkAIConfig();
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 中文数字转阿拉伯数字
  const chineseToNumber = (text: string): string => {
    const chineseNums: Record<string, string> = {
      '零': '0', '一': '1', '二': '2', '两': '2', '三': '3', '四': '4',
      '五': '5', '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
      '半': '0.5'
    };
    
    let result = text;
    
    // 处理 "X个半小时" -> X.5
    result = result.replace(/([一二两三四五六七八九]|[1-9])个半(?:小时)?/g, (_, num) => {
      const n = chineseNums[num] || num;
      return (parseFloat(n) + 0.5) + '小时';
    });
    
    // 处理 "半小时" -> 0.5小时
    result = result.replace(/半(?:个)?小时/g, '0.5小时');
    
    // 处理 "十X" -> 1X
    result = result.replace(/十([一二三四五六七八九])/g, (_, num) => '1' + chineseNums[num]);
    
    // 处理单独的 "十" -> 10
    result = result.replace(/十(?:个)?(?:小时)/g, '10小时');
    
    // 替换中文数字
    for (const [cn, num] of Object.entries(chineseNums)) {
      result = result.replace(new RegExp(cn, 'g'), num);
    }
    
    return result;
  };

  // 解析用户输入
  const parseInput = (text: string): Record<string, string | number> => {
    const result: Record<string, string | number> = {};
    
    // 先转换中文数字
    const normalizedText = chineseToNumber(text);
    const lowerText = normalizedText.toLowerCase();

    // 解析小时数
    const hoursPatterns = [
      /(\d+(?:\.\d+)?)\s*(?:小时|个小时|h|hour|hours)/i,
      /(?:做了|花了|用了|工作了?|弄了)\s*(\d+(?:\.\d+)?)\s*(?:小时|个小时|h)?/i,
      /(\d+(?:\.\d+)?)\s*(?:个)?(?:钟头)/i,
    ];
    
    for (const pattern of hoursPatterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        result.hours = parseFloat(match[1]);
        break;
      }
    }

    // 遍历所有字段，尝试匹配选项
    for (const field of fields) {
      if (field.key === 'hours' || field.key === 'description') continue;
      
      const options = field.options || [];
      
      // 扁平化嵌套选项
      const flatOptions: FieldOption[] = [];
      const flattenOptions = (opts: FieldOption[]) => {
        for (const opt of opts) {
          flatOptions.push(opt);
          if (opt.children) {
            flattenOptions(opt.children);
          }
        }
      };
      flattenOptions(options);

      // 尝试匹配选项
      for (const opt of flatOptions) {
        const optLabel = opt.label.toLowerCase();
        const optValue = opt.value.toLowerCase();
        
        // 检查是否包含选项关键词
        if (lowerText.includes(optLabel) || lowerText.includes(optValue)) {
          result[field.key] = opt.value;
          break;
        }
        
        // 模糊匹配：检查选项中的关键词（至少2个字符）
        const keywords = optLabel.split(/[\s\/\-\(\)（）、，]+/).filter(k => k.length >= 2);
        for (const keyword of keywords) {
          if (lowerText.includes(keyword)) {
            result[field.key] = opt.value;
            break;
          }
        }
        if (result[field.key]) break;
      }
    }

    // 提取描述（去掉已识别的部分）
    let description = text;
    if (result.hours) {
      description = description.replace(/[一二两三四五六七八九十\d]+(?:\.\d+)?(?:个半)?(?:小时|个小时|h|hour|hours|钟头)/gi, '');
    }
    description = description.replace(/(?:做了|花了|用了|工作了?|弄了|今天|昨天|上午|下午|我)/g, '').trim();
    if (description) {
      result.description = description;
    }

    return result;
  };

  // 生成回复
  const generateResponse = (parsed: Record<string, string | number>): string => {
    const filled: string[] = [];
    const notFound: string[] = [];

    if (parsed.hours) {
      filled.push(`${t('timesheet.ai.hoursLabel')}: ${parsed.hours}${t('timesheet.form.hoursUnit')}`);
    }

    for (const field of fields) {
      if (field.key === 'hours' || field.key === 'description') continue;
      
      if (parsed[field.key]) {
        const options = field.options || [];
        const flatOptions: FieldOption[] = [];
        const flattenOptions = (opts: FieldOption[]) => {
          for (const opt of opts) {
            flatOptions.push(opt);
            if (opt.children) {
              flattenOptions(opt.children);
            }
          }
        };
        flattenOptions(options);
        
        const opt = flatOptions.find(o => o.value === parsed[field.key]);
        if (opt) {
          filled.push(`${field.label}: ${opt.label}`);
        }
      } else if (field.required) {
        notFound.push(field.label);
      }
    }

    let response = '';
    if (filled.length > 0) {
      response += `${t('timesheet.ai.recognized')}\n${filled.map(f => `  • ${f}`).join('\n')}`;
    }
    
    if (notFound.length > 0) {
      response += `\n\n${t('timesheet.ai.needManualSelect')}\n${notFound.map(f => `  • ${f}`).join('\n')}`;
    }

    if (filled.length === 0) {
      response = t('timesheet.ai.notRecognized');
    }

    return response;
  };

  // 根据团队名称确定中心类型
  const getCenterFromTeam = (team: string): string | undefined => {
    const teamLower = team.toLowerCase();
    // 投资法务中心
    if (teamLower.includes('投资法务') || teamLower.includes('investment')) {
      return 'invest';
    }
    // 公司及国际金融事务中心
    if (teamLower.includes('公司及国际金融') || teamLower.includes('国际金融事务') || 
        teamLower.includes('corporate') || teamLower.includes('international')) {
      return 'corp';
    }
    // 业务管理与合规检测中心
    if (teamLower.includes('业务管理') || teamLower.includes('合规检测')) {
      return 'biz';
    }
    return undefined;
  };

  // 调用混元API解析
  const callHunyuanAPI = async (message: string): Promise<Record<string, string | number>> => {
    try {
      const center = teamName ? getCenterFromTeam(teamName) : undefined;
      
      const response = await fetch(`${API_BASE_URL}/api/hunyuan/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          center,  // 传递中心类型
          teamName,  // 传递团队名称供后端参考
          fields: fields.map(f => ({
            key: f.key,
            label: f.label,
            required: f.required,
            options: f.options,
          })),
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.data) {
        return data.data;
      }
      
      return {};
    } catch (error) {
      console.error('混元API调用失败:', error);
      return {};
    }
  };

  // 处理发送
  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsProcessing(true);

    try {
      let parsed: Record<string, string | number>;
      
      if (useAI && aiConfigured) {
        // 使用混元AI解析
        parsed = await callHunyuanAPI(userMessage);
        // 如果AI解析失败，回退到本地解析
        if (Object.keys(parsed).length === 0) {
          parsed = parseInput(userMessage);
        }
      } else {
        // 使用本地解析
        parsed = parseInput(userMessage);
      }
      
      const response = generateResponse(parsed);
      
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      
      // 如果解析出内容，填充表单并记录AI反馈
      if (Object.keys(parsed).length > 0) {
        const sessionId = generateSessionId();
        setCurrentSessionId(sessionId);
        
        // 记录AI填充结果
        await recordAiFeedback(sessionId, userMessage, parsed);
        
        // 填充表单，传递sessionId
        onFillForm(parsed, sessionId);
      }
    } catch (error) {
      console.error('处理失败:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: t('timesheet.ai.processingError')
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // 开始语音识别
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'zh-CN';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // 停止语音识别
  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  return (
    <>
      {/* 悬浮按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-300/50 hover:shadow-xl hover:shadow-purple-400/50 hover:scale-110 transition-all duration-300 flex items-center justify-center group"
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <svg className="w-7 h-7 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse" />
      </button>

      {/* 对话框 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
            {/* 头部 */}
            <div className="relative px-5 py-4 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-600">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{t('timesheet.ai.title')}</h3>
                    <p className="text-xs text-white/70">
                      {useAI && aiConfigured ? t('timesheet.ai.hunyuanAI') : t('timesheet.ai.localParsing')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {aiConfigured && (
                    <button
                      onClick={() => setUseAI(!useAI)}
                      className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                        useAI 
                          ? 'bg-white/20 text-white' 
                          : 'bg-white/10 text-white/60 hover:bg-white/15'
                      }`}
                      title={useAI ? t('timesheet.ai.switchToLocal') : t('timesheet.ai.switchToAI')}
                    >
                      {useAI ? t('timesheet.ai.aiMode') : t('timesheet.ai.localMode')}
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* 消息区域 */}
            <div className="h-80 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-50 to-white">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-br-md'
                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <div className="p-4 border-t border-slate-100 bg-white">
              <div className="flex items-center gap-2">
                {speechSupported && (
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
                      isListening
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-slate-100 text-slate-500 hover:bg-violet-100 hover:text-violet-600'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                )}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder={isListening ? t('timesheet.ai.listening') : t('timesheet.ai.inputPlaceholder')}
                    className="w-full h-11 px-4 pr-12 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-50 focus:bg-white transition-all"
                    disabled={isListening}
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim() || isProcessing}
                  className="flex-shrink-0 w-11 h-11 p-0 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </Button>
              </div>
              {isListening && (
                <p className="mt-2 text-xs text-center text-red-500 animate-pulse">
                  {t('timesheet.ai.recording')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
