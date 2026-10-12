import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  AlertTriangle,
  User,
  Building,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  MessageSquare,
  CheckSquare,
  ArrowRight,
  PhoneCall,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import {
  BuyerRecord,
  PropertyRecord,
  AssistantResponse,
  AssistantActionDraft,
  TourTaskRecord,
} from '../types';
import { getAuthHeaders, formatTaipeiTime } from '../utils';
import { UnifiedTextInputWorkbench, TextInputMethod } from './UnifiedTextInputWorkbench';

interface VoiceAssistantWorkbenchProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  useSandbox: boolean;
  buyers: BuyerRecord[];
  properties: PropertyRecord[];
  initialBuyerId?: string | null;
  initialPropertyId?: string | null;
  onActionExecuted?: () => void;
}

export const VoiceAssistantWorkbench: React.FC<VoiceAssistantWorkbenchProps> = ({
  isOpen,
  onClose,
  token,
  useSandbox,
  buyers,
  properties,
  initialBuyerId,
  initialPropertyId,
  onActionExecuted,
}) => {
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(initialBuyerId || null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(initialPropertyId || null);
  const [textInput, setTextInput] = useState('');
  const [inputMethod, setInputMethod] = useState<TextInputMethod>('text');

  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [lastRawInput, setLastRawInput] = useState<string>('');
  const [assistantResponse, setAssistantResponse] = useState<AssistantResponse | null>(null);
  const [executingDraft, setExecutingDraft] = useState(false);
  const [executionSuccessNotice, setExecutionSuccessNotice] = useState<string | null>(null);
  const [copiedLine, setCopiedLine] = useState(false);
  const [editableLineText, setEditableLineText] = useState('');

  useEffect(() => {
    if (initialBuyerId !== undefined) setSelectedBuyerId(initialBuyerId);
  }, [initialBuyerId]);

  useEffect(() => {
    if (initialPropertyId !== undefined) setSelectedPropertyId(initialPropertyId);
  }, [initialPropertyId]);

  useEffect(() => {
    if (assistantResponse?.queryAnswer?.lineMessageDraft?.messageText) {
      setEditableLineText(assistantResponse.queryAnswer.lineMessageDraft.messageText);
    }
  }, [assistantResponse]);

  if (!isOpen) return null;

  const currentBuyer = buyers.find((b) => b.id === selectedBuyerId) || null;
  const currentProperty = properties.find((p) => p.id === selectedPropertyId) || null;

  const handleSendText = async (promptOverride?: string) => {
    const promptToSend = promptOverride || textInput;
    if (!promptToSend.trim()) return;
    setStatus('processing');
    setErrorMessage(null);
    setExecutionSuccessNotice(null);
    await sendCommand({ textPrompt: promptToSend.trim() });
    if (!promptOverride) setTextInput('');
  };

  const sendCommand = async (payload: { textPrompt?: string }) => {
    try {
      const res = await fetch('/api/assistant/chat-or-command', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(token, useSandbox),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          inputMethod,
          activeBuyerId: selectedBuyerId,
          activePropertyId: selectedPropertyId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || '助理處理指令失敗');
        setStatus('failed');
        return;
      }

      setAssistantResponse(data.response);
      setLastRawInput(data.rawInputText || payload.textPrompt || '手動文字輸入');
      setStatus('completed');
    } catch (err: any) {
      setErrorMessage(`連線異常：${err?.message || '請檢查網路連線'}`);
      setStatus('failed');
    }
  };

  const handleExecuteDraft = async (draft: AssistantActionDraft) => {
    setExecutingDraft(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/assistant/execute-draft', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(token, useSandbox),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          draftId: draft.id,
          idempotencyKey: draft.idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || '執行動作失敗');
        return;
      }

      setExecutionSuccessNotice(data.summary || '動作已成功執行並永久存入資料庫！');
      if (assistantResponse?.actionDraft) {
        setAssistantResponse({
          ...assistantResponse,
          actionDraft: {
            ...assistantResponse.actionDraft,
            status: 'executed',
            executionResultSummary: data.summary,
          },
        });
      }
      if (onActionExecuted) onActionExecuted();
    } catch (err: any) {
      setErrorMessage(`執行失敗：${err?.message || '網路異常'}`);
    } finally {
      setExecutingDraft(false);
    }
  };

  const handleCancelDraft = async (draft: AssistantActionDraft) => {
    try {
      await fetch('/api/assistant/cancel-draft', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(token, useSandbox),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ draftId: draft.id }),
      });
      if (assistantResponse?.actionDraft) {
        setAssistantResponse({
          ...assistantResponse,
          actionDraft: {
            ...assistantResponse.actionDraft,
            status: 'cancelled',
          },
        });
      }
    } catch {
      // ignore
    }
  };

  const handleCopyLine = () => {
    navigator.clipboard.writeText(editableLineText);
    setCopiedLine(true);
    setTimeout(() => setCopiedLine(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-bold shadow-md">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">房仲賈維斯｜交代工作工作台</h3>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-2 py-0.5 rounded-full font-bold">
                  Phase 3 白名單架構
                </span>
              </div>
              <p className="text-xs text-slate-300">
                以文字指令交代工作（支援手機鍵盤語音輸入），自動讀取真實資料，寫入需經您確認才執行
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            aria-label="關閉助理工作台"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Context Strip */}
        <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold">當前操作對象：</span>
            {currentBuyer ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-900 font-bold rounded-lg border border-blue-200">
                <User className="w-3.5 h-3.5" />
                <span>{currentBuyer.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedBuyerId(null)}
                  className="ml-1 text-blue-600 hover:text-blue-950"
                  title="清除當前對象（轉為全域助理）"
                >
                  ×
                </button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-200 text-slate-700 font-bold rounded-lg">
                全域助理（自動辨識或查詢全部）
              </span>
            )}

            {currentProperty && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-900 font-bold rounded-lg border border-emerald-200">
                <Building className="w-3.5 h-3.5" />
                <span>{currentProperty.title}</span>
                <button
                  type="button"
                  onClick={() => setSelectedPropertyId(null)}
                  className="ml-1 text-emerald-600 hover:text-emerald-950"
                  title="清除關聯物件"
                >
                  ×
                </button>
              </span>
            )}
          </div>

          {buyers.length > 0 && !currentBuyer && (
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-slate-500">指定客戶：</span>
              <select
                value={selectedBuyerId || ''}
                onChange={(e) => setSelectedBuyerId(e.target.value || null)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs text-slate-800"
              >
                <option value="">-- 全域 --</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Quick Command Suggestions Chips */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              常用語音／文字指令快捷：
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() =>
                  handleSendText(
                    currentBuyer
                      ? `查詢${currentBuyer.name}的需求與最近看屋進度`
                      : '查詢林小姐的需求與最近看屋進度'
                  )
                }
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-medium transition"
              >
                📋 查詢客戶需求與進度
              </button>
              <button
                type="button"
                onClick={() => handleSendText('查詢今天、明天與逾期的待辦事項')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-medium transition"
              >
                ⏰ 查詢今日與逾期待辦
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSendText(
                    currentBuyer
                      ? `產生給${currentBuyer.name}的帶看後LINE追蹤感謝訊息`
                      : '產生帶看後的LINE追蹤訊息草稿'
                  )
                }
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-medium transition"
              >
                💬 產生 LINE 追蹤訊息草稿
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSendText(
                    currentBuyer
                      ? `剛才打電話給${currentBuyer.name}，客戶說很喜歡主臥空間，但價格希望能談到合理區間`
                      : '記錄剛才電話聯繫買方的重點回饋'
                  )
                }
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-medium transition"
              >
                📞 記錄電話追蹤回饋
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSendText(
                    currentBuyer ? `幫${currentBuyer.name}依最新條件重新配案` : '重新配案'
                  )
                }
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-medium transition"
              >
                ✨ 依最新需求重新配案
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSendText(
                    currentBuyer
                      ? `幫我記一個明天下午兩點打電話給${currentBuyer.name}回報屋主底價的待辦`
                      : '幫我記一個明日聯繫屋主詢問底價的待辦'
                  )
                }
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-medium transition"
              >
                📝 建立追蹤待辦事項
              </button>
            </div>
          </div>

          {/* Status Indicators */}
          {status === 'processing' && (
            <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-5 text-center space-y-2">
              <div className="w-8 h-8 rounded-full border-3 border-cyan-600 border-t-transparent animate-spin mx-auto" />
              <div className="text-xs font-bold text-cyan-950">
                賈維斯正分析您的指令... 辨識白名單操作、讀取真實資料庫
              </div>
              <div className="text-[11px] text-cyan-700">
                意圖解析 ➔ 資料彙總 ➔ 安全草稿審查
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-900 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>處理失敗</span>
              </div>
              <p>{errorMessage}</p>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="px-3 py-1 bg-white border border-rose-300 text-rose-800 rounded-lg font-bold text-[11px]"
              >
                重試或清除錯誤
              </button>
            </div>
          )}

          {executionSuccessNotice && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 text-xs text-emerald-950 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-sm">執行完成並存檔</div>
                <p>{executionSuccessNotice}</p>
              </div>
            </div>
          )}

          {/* Results Display */}
          {status === 'completed' && assistantResponse && (
            <div className="space-y-4">
              {/* Raw recognized quote */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-700 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-500 mr-2">辨識指令原句：</span>
                  <span className="font-medium text-slate-900">「{lastRawInput}」</span>
                </div>
                <span className="text-[10px] font-mono text-cyan-700 font-bold bg-cyan-100 px-2 py-0.5 rounded-full">
                  {assistantResponse.intent}
                </span>
              </div>

              {/* 1. Unsupported Action Notice */}
              {assistantResponse.unsupportedReason && (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    <span>白名單安全限制提示</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    {assistantResponse.unsupportedReason}
                  </p>
                  {assistantResponse.availableAlternatives && (
                    <div className="text-xs text-amber-950 space-y-1 pt-2 border-t border-amber-200">
                      <div className="font-bold">支援的可用操作：</div>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        {assistantResponse.availableAlternatives.map((alt, i) => (
                          <div key={i} className="flex items-center gap-1 text-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                            <span>{alt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Disambiguation if multiple candidate buyers */}
              {assistantResponse.candidateBuyers && assistantResponse.candidateBuyers.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2.5">
                  <div className="text-xs font-bold text-blue-900">
                    {assistantResponse.queryAnswer?.text || '請選擇操作對象：'}
                  </div>
                  <div className="space-y-1.5">
                    {assistantResponse.candidateBuyers.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setSelectedBuyerId(b.id);
                          handleSendText(`查詢${b.name}的需求與進度`);
                        }}
                        className="w-full p-2.5 bg-white border border-blue-200 hover:border-blue-500 rounded-xl text-left text-xs flex items-center justify-between group transition"
                      >
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-blue-700">
                            {b.name}（{b.contactPhone}）
                          </div>
                          <div className="text-[11px] text-slate-500">{b.currentRequirementSummary}</div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Query Text Answer */}
              {assistantResponse.queryAnswer?.text && !assistantResponse.candidateBuyers && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <Sparkles className="w-4 h-4 text-cyan-600" />
                    <span>賈維斯回答／進度整理</span>
                  </div>
                  <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-line bg-slate-50 p-3.5 rounded-xl border border-slate-200 font-mono">
                    {assistantResponse.queryAnswer.text}
                  </div>
                </div>
              )}

              {/* 4. Structured Buyer Progress Cards */}
              {assistantResponse.queryAnswer?.buyerProgress && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">
                      【{assistantResponse.queryAnswer.buyerProgress.buyerName}】進度時間軸摘要
                    </span>
                    <span className="text-[11px] text-slate-500">Asia/Taipei</span>
                  </div>

                  {assistantResponse.queryAnswer.buyerProgress.unansweredQuestions.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-1">
                      <div className="font-bold text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>待查證未解答問題（優先追蹤）：</span>
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5 text-amber-950">
                        {assistantResponse.queryAnswer.buyerProgress.unansweredQuestions.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {assistantResponse.queryAnswer.buyerProgress.recentInteractions.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-600">最近互動紀錄：</div>
                      {assistantResponse.queryAnswer.buyerProgress.recentInteractions.map((item, i) => (
                        <div key={i} className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-bold text-slate-800">
                              {item.type === '帶看' ? '🏡 現場帶看' : '💬 追蹤訪談'}
                            </span>
                            <span>{formatTaipeiTime(item.date)}</span>
                          </div>
                          <p className="text-slate-700 mt-1">{item.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 5. Schedule Tasks Summary */}
              {assistantResponse.queryAnswer?.tasksSummary && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                    <span>待辦事項排程（Asia/Taipei）</span>
                    <span className="text-cyan-700">即時真實資料</span>
                  </div>

                  {assistantResponse.queryAnswer.tasksSummary.today.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span>今日待辦 ({assistantResponse.queryAnswer.tasksSummary.today.length})</span>
                      </div>
                      {assistantResponse.queryAnswer.tasksSummary.today.map((t) => (
                        <div key={t.id} className="p-2 bg-white border border-blue-200 rounded-xl text-xs flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900">{t.title}</span>
                            <span className="text-slate-500 ml-2">({t.buyerName})</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md font-bold">
                            {t.dueTimeSlot || '今日'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {assistantResponse.queryAnswer.tasksSummary.overdue.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-rose-900 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-rose-600" />
                        <span>逾期未結 ({assistantResponse.queryAnswer.tasksSummary.overdue.length})</span>
                      </div>
                      {assistantResponse.queryAnswer.tasksSummary.overdue.map((t) => (
                        <div key={t.id} className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-xs flex items-center justify-between">
                          <div>
                            <span className="font-bold text-rose-950">{t.title}</span>
                            <span className="text-rose-700 ml-2">({t.buyerName})</span>
                          </div>
                          <span className="text-[10px] text-rose-700 font-bold">{t.dueDate}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 6. LINE Message Draft with Copy Button */}
              {assistantResponse.queryAnswer?.lineMessageDraft && (
                <div className="bg-emerald-50/70 border border-emerald-300 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-700" />
                      <span className="text-xs font-bold text-emerald-950">
                        LINE 追蹤訊息草稿（台灣房仲自然語氣，不自動傳送）
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyLine}
                      className="min-h-[36px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition"
                    >
                      {copiedLine ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLine ? '已複製！' : '一鍵複製 LINE 訊息'}</span>
                    </button>
                  </div>

                  <textarea
                    rows={6}
                    value={editableLineText}
                    onChange={(e) => setEditableLineText(e.target.value)}
                    className="w-full p-3 bg-white border border-emerald-200 rounded-xl text-xs text-slate-800 leading-relaxed font-sans focus:outline-emerald-500"
                    placeholder="點擊上方按鈕複製，或在此微調文字後複製..."
                  />

                  <div className="text-[11px] text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>依客戶稱呼、帶看疑問查核與屋主善意意願整合產生，複製後可直接貼入 LINE 傳送給客戶。</span>
                  </div>
                </div>
              )}

              {/* 7. WRITE ACTION DRAFT: Explicit Agent Confirmation Required */}
              {assistantResponse.actionDraft && (
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-300 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping" />
                      <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                        寫入動作安全確認草稿
                      </span>
                    </div>
                    <span className="text-[10px] px-2.5 py-1 bg-indigo-200/70 text-indigo-900 rounded-full font-bold">
                      {assistantResponse.actionDraft.status === 'executed'
                        ? '✅ 已存檔執行'
                        : assistantResponse.actionDraft.status === 'cancelled'
                        ? '❌ 已取消'
                        : '待業務確認'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-sm sm:text-base font-bold text-slate-900">
                      {assistantResponse.actionDraft.title}
                    </h4>
                    <p className="text-xs text-slate-600">{assistantResponse.actionDraft.description}</p>
                  </div>

                  {/* Structural Field Comparison (Before & After) */}
                  <div className="bg-white rounded-xl p-3.5 border border-indigo-200 text-xs space-y-2">
                    <div className="text-[11px] font-bold text-indigo-900 border-b border-indigo-100 pb-1">
                      結構化欄位即將變更／寫入內容：
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 font-semibold">目標對象：</span>{' '}
                        <span className="font-bold text-slate-900">
                          {assistantResponse.actionDraft.targetBuyerName || '客戶追蹤'}
                        </span>
                      </div>
                      {assistantResponse.actionDraft.targetPropertyTitle && (
                        <div>
                          <span className="text-slate-500 font-semibold">關聯物件：</span>{' '}
                          <span className="font-bold text-slate-900">
                            {assistantResponse.actionDraft.targetPropertyTitle}
                          </span>
                        </div>
                      )}
                      {assistantResponse.actionDraft.params.dueDate && (
                        <div>
                          <span className="text-slate-500 font-semibold">排定預約日期：</span>{' '}
                          <span className="font-bold text-indigo-700">
                            {assistantResponse.actionDraft.params.dueDate}{' '}
                            {assistantResponse.actionDraft.params.dueTimeSlot || ''}
                          </span>
                        </div>
                      )}
                      {assistantResponse.actionDraft.params.priority && (
                        <div>
                          <span className="text-slate-500 font-semibold">優先級：</span>{' '}
                          <span className="font-bold text-amber-700">
                            {assistantResponse.actionDraft.params.priority === 'high' ? '高' : '一般'}
                          </span>
                        </div>
                      )}
                      {assistantResponse.actionDraft.params.clientFeedback && (
                        <div className="sm:col-span-2">
                          <span className="text-slate-500 font-semibold">客戶回覆重點：</span>{' '}
                          <span className="text-slate-800">
                            {assistantResponse.actionDraft.params.clientFeedback}
                          </span>
                        </div>
                      )}
                      {assistantResponse.actionDraft.params.mustHavesToAdd && (
                        <div className="sm:col-span-2">
                          <span className="text-slate-500 font-semibold">新增硬性必要條件：</span>{' '}
                          <span className="font-bold text-emerald-800">
                            {Array.isArray(assistantResponse.actionDraft.params.mustHavesToAdd)
                              ? assistantResponse.actionDraft.params.mustHavesToAdd.join('、')
                              : assistantResponse.actionDraft.params.mustHavesToAdd}
                          </span>
                        </div>
                      )}
                      {assistantResponse.actionDraft.params.budgetAdjustmentWan?.maxWan && (
                        <div className="sm:col-span-2">
                          <span className="text-slate-500 font-semibold">預算上限調整為：</span>{' '}
                          <span className="font-bold text-emerald-800">
                            {assistantResponse.actionDraft.params.budgetAdjustmentWan.maxWan} 萬元
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Confirmation Buttons */}
                  {assistantResponse.actionDraft.status === 'pending_confirmation' && (
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => handleCancelDraft(assistantResponse.actionDraft!)}
                        className="min-h-[44px] px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition"
                      >
                        取消草稿
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExecuteDraft(assistantResponse.actionDraft!)}
                        disabled={executingDraft}
                        className="min-h-[44px] px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md transition disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        <span>{executingDraft ? '寫入資料庫中...' : '確認執行存入資料庫'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200">
          <UnifiedTextInputWorkbench
            value={textInput}
            onChange={(val, method) => {
              setTextInput(val);
              if (method) setInputMethod(method);
            }}
            onSubmit={() => handleSendText()}
            submitLabel="送出指令"
            loadingLabel="賈維斯分析中..."
            isLoading={status === 'processing'}
            placeholder="請輸入指令，例如：查林小姐最近進度、整理今日待辦、幫林小姐依最新需求重新配案..."
            hintDescription="可使用手機鍵盤的麥克風輸入，送出前請確認姓名與指令重點。"
            minRows={2}
            buyerHint={currentBuyer?.name || null}
            propertyHint={currentProperty?.title || null}
          />
        </div>
      </div>
    </div>
  );
};
