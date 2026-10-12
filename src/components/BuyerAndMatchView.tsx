import React, { useState, useEffect } from 'react';
import {
  SearchCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Edit3,
  History,
  User,
  Phone,
  Sparkles,
  Plus,
  Trash2,
  Calendar,
  MessageSquare,
  Clock,
  ArrowRight,
  X,
} from 'lucide-react';
import {
  BuyerRecord,
  MatchRunRecord,
  IntakeSessionRecord,
  FollowUpInteractionRecord,
} from '../types';
import { getAuthHeaders, formatTaipeiTime, formatConfidenceLabel } from '../utils';

interface BuyerAndMatchViewProps {
  token: string | null;
  useSandbox: boolean;
  buyers: BuyerRecord[];
  initialBuyerId: string | null;
  autoRunMatchOnMount?: boolean;
  onStartVoiceUpdateForBuyer: (buyerId: string) => void;
  onRefreshBuyers: () => void;
  onOpenAssistantForBuyer?: (buyerId: string) => void;
  onStartLineAnalysisForBuyer?: (buyerId: string) => void;
}

export const BuyerAndMatchView: React.FC<BuyerAndMatchViewProps> = ({
  token,
  useSandbox,
  buyers,
  initialBuyerId,
  autoRunMatchOnMount,
  onStartVoiceUpdateForBuyer,
  onRefreshBuyers,
  onOpenAssistantForBuyer,
  onStartLineAnalysisForBuyer,
}) => {
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>(initialBuyerId || (buyers[0]?.id ?? ''));
  const [matchRuns, setMatchRuns] = useState<MatchRunRecord[]>([]);
  const [intakeHistory, setIntakeHistory] = useState<IntakeSessionRecord[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpInteractionRecord[]>([]);
  const [activeMatchRun, setActiveMatchRun] = useState<MatchRunRecord | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'match' | 'requirement' | 'history' | 'followup'>('match');

  // Manual Follow-up Modal State
  const [showAddFollowUpModal, setShowAddFollowUpModal] = useState(false);
  const [fuChannel, setFuChannel] = useState<'phone' | 'line' | 'meeting' | 'other'>('phone');
  const [fuFeedback, setFuFeedback] = useState('');
  const [fuObservations, setFuObservations] = useState('');
  const [fuNextSteps, setFuNextSteps] = useState('');
  const [fuSaving, setFuSaving] = useState(false);

  const selectedBuyer = buyers.find((b) => b.id === selectedBuyerId) || null;

  useEffect(() => {
    if (initialBuyerId) {
      setSelectedBuyerId(initialBuyerId);
    } else if (!selectedBuyerId && buyers[0]) {
      setSelectedBuyerId(buyers[0].id);
    }
  }, [initialBuyerId, buyers]);

  useEffect(() => {
    if (!selectedBuyerId) return;
    fetchBuyerDetails(selectedBuyerId);
  }, [selectedBuyerId, token, useSandbox]);

  useEffect(() => {
    if (autoRunMatchOnMount && selectedBuyerId) {
      handleRunMatch(selectedBuyerId);
    }
  }, [autoRunMatchOnMount, selectedBuyerId]);

  const fetchBuyerDetails = async (bId: string) => {
    try {
      const [res, fuRes] = await Promise.all([
        fetch(`/api/buyers/${bId}`, {
          headers: getAuthHeaders(token, useSandbox),
        }),
        fetch(`/api/follow-ups?buyerId=${bId}`, {
          headers: getAuthHeaders(token, useSandbox),
        }),
      ]);

      if (res.ok) {
        const data = await res.json();
        setIntakeHistory(data.sessions || []);
        const runs: MatchRunRecord[] = data.matchRuns || [];
        setMatchRuns(runs);
        setActiveMatchRun(runs[0] || null);
      }

      if (fuRes.ok) {
        const fuData = await fuRes.json();
        setFollowUps(fuData.followUps || []);
      }
    } catch {
      // ignore
    }
  };

  const handleSaveManualFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuyer) return;
    if (!fuFeedback.trim()) return;
    setFuSaving(true);
    try {
      const res = await fetch('/api/follow-ups', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(token, useSandbox),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buyerId: selectedBuyer.id,
          buyerName: selectedBuyer.name,
          channel: fuChannel,
          clientFeedback: fuFeedback.trim(),
          agentObservations: fuObservations.trim() || undefined,
          agreedNextSteps: fuNextSteps.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setFollowUps((prev) => [data.followUp, ...prev]);
        setShowAddFollowUpModal(false);
        setFuFeedback('');
        setFuObservations('');
        setFuNextSteps('');
      }
    } catch {
      // ignore
    } finally {
      setFuSaving(false);
    }
  };

  const handleDeleteFollowUp = async (fuId: string) => {
    try {
      const res = await fetch(`/api/follow-ups/${fuId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token, useSandbox),
      });
      if (res.ok) {
        setFollowUps((prev) => prev.filter((f) => f.id !== fuId));
      }
    } catch {
      // ignore
    }
  };

  const handleRunMatch = async (targetId?: string) => {
    const bId = targetId || selectedBuyerId;
    if (!bId) return;
    setIsMatching(true);
    setMatchError(null);
    setActiveSubTab('match');

    try {
      const res = await fetch('/api/match/run', {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({ buyerId: bId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMatchError(data.error || '配案執行失敗');
        setIsMatching(false);
        return;
      }
      setActiveMatchRun(data.matchRun);
      setMatchRuns((prev) => [data.matchRun, ...prev]);
    } catch (err: any) {
      setMatchError(err?.message || '網路異常，無法執行配案');
    } finally {
      setIsMatching(false);
    }
  };

  if (buyers.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 space-y-3">
        <p className="text-base font-bold text-slate-800">目前尚無買方客戶建檔</p>
        <p className="text-xs text-slate-500">請點擊下方導覽列或首頁「新增語音接待」建立第一位買方需求。</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900">買方客戶與智慧配案</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              後端硬性條件篩選 ➔ 偏好權重排序 ➔ 誠實列出符合、未符合與待確認項目
            </p>
          </div>
          {selectedBuyer && (
            <div className="flex items-center gap-2">
              {onOpenAssistantForBuyer && (
                <button
                  type="button"
                  onClick={() => onOpenAssistantForBuyer(selectedBuyer.id)}
                  className="min-h-[44px] px-3.5 py-2 bg-gradient-to-r from-slate-900 to-indigo-950 hover:from-slate-800 hover:to-indigo-900 text-cyan-300 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>問助理／交代工作</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onStartVoiceUpdateForBuyer(selectedBuyer.id)}
                className="min-h-[44px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Edit3 className="w-4 h-4 text-cyan-700" />
                <span>補充／變更需求</span>
              </button>
              {onStartLineAnalysisForBuyer && (
                <button
                  type="button"
                  onClick={() => onStartLineAnalysisForBuyer(selectedBuyer.id)}
                  className="min-h-[44px] px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>分析 LINE 對話</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleRunMatch(selectedBuyer.id)}
                disabled={isMatching}
                className="min-h-[44px] px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isMatching ? '配案篩選中...' : '開始配案'}</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
          {buyers.map((b) => {
            const isSelected = b.id === selectedBuyerId;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBuyerId(b.id)}
                className={`min-h-[56px] px-4 py-2.5 rounded-xl border text-left shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="text-sm font-bold flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 opacity-75" />
                  <span>{b.name}</span>
                </div>
                <div className={`text-[11px] mt-0.5 font-mono tabular-nums ${isSelected ? 'text-cyan-300' : 'text-slate-500'}`}>
                  預算：{b.currentRequirement.budget.maxWan ? `${b.currentRequirement.budget.maxWan}萬` : '未提供'} ·{' '}
                  {b.currentRequirement.roomsAndType.minRooms
                    ? `${b.currentRequirement.roomsAndType.minRooms}房以上`
                    : '房數未定'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedBuyer && (
        <>
          {selectedBuyer.missingCriticalFields && selectedBuyer.missingCriticalFields.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 space-y-1">
                <div className="font-bold text-sm">
                  待補配案關鍵資料：{selectedBuyer.missingCriticalFields.join('、')}
                </div>
                <p>
                  客戶雖已建檔，但缺少上述關鍵條件，執行配案時將標示為「初步配案」且不會擅自推算未提供的預算。建議點擊右上方「語音補充／變更需求」向客戶追問補齊。
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setActiveSubTab('match')}
              className={`px-4 py-2 text-xs font-bold rounded-lg min-h-[38px] transition-colors ${
                activeSubTab === 'match' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              配案推薦結果 {activeMatchRun ? `(${activeMatchRun.matchedResults.length})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('requirement')}
              className={`px-4 py-2 text-xs font-bold rounded-lg min-h-[38px] transition-colors ${
                activeSubTab === 'requirement'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              買方需求表與原句來源
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('history')}
              className={`px-4 py-2 text-xs font-bold rounded-lg min-h-[38px] transition-colors ${
                activeSubTab === 'history' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              接待與配案快照紀錄 ({intakeHistory.length + matchRuns.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('followup')}
              className={`px-4 py-2 text-xs font-bold rounded-lg min-h-[38px] transition-colors ${
                activeSubTab === 'followup' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              追蹤紀錄時間軸 ({followUps.length})
            </button>
          </div>

          {matchError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-bold">
              {matchError}
            </div>
          )}

          {activeSubTab === 'match' && (
            <div className="space-y-4">
              {!activeMatchRun ? (
                <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 space-y-3">
                  <p className="text-sm font-bold text-slate-800">尚未針對「{selectedBuyer.name}」執行配案</p>
                  <p className="text-xs text-slate-500">
                    點擊下方按鈕，系統將讀取您名下有效物件，依必要條件篩選並按偏好條件排序。
                  </p>
                  <button
                    type="button"
                    onClick={() => handleRunMatch(selectedBuyer.id)}
                    disabled={isMatching}
                    className="mx-auto min-h-[44px] px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-2"
                  >
                    <SearchCheck className="w-4 h-4 text-cyan-400" />
                    <span>{isMatching ? '正在篩選配案...' : '立即開始配案'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between flex-wrap gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-xs text-cyan-400 font-medium">
                        <span>{activeMatchRun.isPreliminary ? '初步配案（尚缺部分關鍵需求）' : '正式條件配案'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          配案時間：{formatTaipeiTime(activeMatchRun.createdAt)}
                        </span>
                      </div>
                      <div className="text-sm font-bold">
                        共檢測您名下 {activeMatchRun.evaluatedCount} 間上架物件，符合必要條件共{' '}
                        <span className="text-cyan-400 font-mono">{activeMatchRun.matchedResults.length}</span> 間
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRunMatch(selectedBuyer.id)}
                      disabled={isMatching}
                      className="min-h-[40px] px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg border border-slate-700"
                    >
                      {isMatching ? '更新配案中...' : '重新執行配案'}
                    </button>
                  </div>

                  {activeMatchRun.isPreliminary && activeMatchRun.preliminaryWarnings.length > 0 && (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 text-xs text-amber-900 space-y-1">
                      <div className="font-bold">初步配案限制說明：</div>
                      <ul className="list-disc pl-5 space-y-0.5">
                        {activeMatchRun.preliminaryWarnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {activeMatchRun.matchedResults.length === 0 ? (
                    <div className="bg-white rounded-2xl p-6 border-2 border-rose-200 space-y-4">
                      <div className="flex items-start gap-3">
                        <XCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <h3 className="text-base font-bold text-slate-900">
                            無符合結果：目前沒有物件同時滿足客戶的所有必要條件
                          </h3>
                          <p className="text-xs text-slate-600 mt-1">
                            系統嚴格遵守「不自動放寬必要條件、不捏造推薦」原則。以下列出庫存物件未通過篩選的原因與可與客戶討論的放寬方向：
                          </p>
                        </div>
                      </div>

                      {activeMatchRun.relaxationSuggestions.length > 0 && (
                        <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 space-y-2">
                          <div className="text-xs font-bold text-cyan-950">建議可與客戶討論的放寬條件：</div>
                          <ul className="list-disc pl-5 text-xs text-cyan-900 space-y-1.5">
                            {activeMatchRun.relaxationSuggestions.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {activeMatchRun.rejectedSummary.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <div className="text-xs font-bold text-slate-700">庫存物件未通過必要條件明細：</div>
                          {activeMatchRun.rejectedSummary.map((rej) => (
                            <div key={rej.propertyId} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                              <div className="font-bold text-slate-800">{rej.title}</div>
                              <ul className="list-disc pl-5 text-rose-700 mt-1 space-y-0.5">
                                {rej.unmetMustHaves.map((u, idx) => (
                                  <li key={idx}>{u}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeMatchRun.matchedResults.map((item, rankIdx) => {
                        const p = item.propertySnapshot;
                        return (
                          <div
                            key={item.propertyId}
                            className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4 shadow-xs"
                          >
                            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                              <div>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <span className="font-mono font-bold text-cyan-700">推薦順位 #{rankIdx + 1}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{p.ownershipType}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>
                                    {p.city}
                                    {p.district}（{p.neighborhood}）
                                  </span>
                                </div>
                                <h3 className="text-base font-bold text-slate-900 mt-1">{p.title}</h3>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-xl font-mono font-bold text-slate-900 tabular-nums">
                                  {p.totalPriceWan.toLocaleString()} <span className="text-xs font-normal">萬元</span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {p.priceIncludesParking === 'yes'
                                    ? '含車位'
                                    : p.priceIncludesParking === 'separate'
                                    ? `車位另計 (+${p.separateParkingPriceWan ?? '待確認'}萬)`
                                    : '不含車位'}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-3 rounded-xl font-mono tabular-nums">
                              <div>
                                <span className="text-slate-400 font-sans block">坪數</span>
                                <strong className="text-slate-800">{p.buildingAreaPing} 坪</strong>
                              </div>
                              <div>
                                <span className="text-slate-400 font-sans block">格局與樓層</span>
                                <strong className="text-slate-800">
                                  {p.rooms ?? '待查'}房 / {p.floor ?? '—'}F(共{p.totalFloors ?? '—'}F)
                                </strong>
                              </div>
                              <div>
                                <span className="text-slate-400 font-sans block">屋齡與電梯</span>
                                <strong className="text-slate-800">
                                  {p.ageYears !== null ? `${p.ageYears}年` : '屋齡待確認'} ·{' '}
                                  {p.hasElevator === 'yes' ? '有電梯' : p.hasElevator === 'no' ? '無電梯' : '電梯待查'}
                                </strong>
                              </div>
                              <div>
                                <span className="text-slate-400 font-sans block">車位</span>
                                <strong className="text-slate-800">
                                  {p.parkingType} {p.parkingSpaces !== null ? `(${p.parkingSpaces}席)` : ''}
                                </strong>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 space-y-1.5">
                                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>符合的需求 ({item.matchedConditions.length})</span>
                                </div>
                                {item.matchedConditions.length === 0 ? (
                                  <p className="text-slate-500">無明確符合項目</p>
                                ) : (
                                  <ul className="list-disc pl-4 text-emerald-950 space-y-1">
                                    {item.matchedConditions.map((m, i) => (
                                      <li key={i}>{m}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>

                              <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3 space-y-1.5">
                                <div className="font-bold text-rose-900 flex items-center gap-1.5">
                                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                  <span>未達偏好項目 ({item.unmetConditions.length})</span>
                                </div>
                                {item.unmetConditions.length === 0 ? (
                                  <p className="text-slate-500">無未符合的偏好條件</p>
                                ) : (
                                  <ul className="list-disc pl-4 text-rose-950 space-y-1">
                                    {item.unmetConditions.map((u, i) => (
                                      <li key={i}>{u}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>

                              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 space-y-1.5">
                                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                                  <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                  <span>未知或待確認項目 ({item.unknownOrToVerifyConditions.length})</span>
                                </div>
                                {item.unknownOrToVerifyConditions.length === 0 ? (
                                  <p className="text-slate-500">所有欄位皆已確認</p>
                                ) : (
                                  <ul className="list-disc pl-4 text-amber-950 space-y-1">
                                    {item.unknownOrToVerifyConditions.map((uk, i) => (
                                      <li key={i}>{uk}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>

                            <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3 text-xs">
                              <div>
                                <span className="text-cyan-400 font-bold block mb-1">推薦理由與配案說明：</span>
                                <p className="text-slate-100 leading-relaxed">{item.aiRecommendationReason}</p>
                              </div>
                              {item.nextQuestionsToVerify.length > 0 && (
                                <div className="pt-2 border-t border-slate-800">
                                  <span className="text-amber-300 font-bold block mb-1">下一步應確認的問題：</span>
                                  <ul className="list-disc pl-5 text-slate-200 space-y-1">
                                    {item.nextQuestionsToVerify.map((nq, i) => (
                                      <li key={i}>{nq}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'requirement' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedBuyer.name} 的確認需求表</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                    最後更新：{formatTaipeiTime(selectedBuyer.updatedAt)}
                  </p>
                </div>
                {selectedBuyer.contactPhone && (
                  <div className="text-xs font-mono text-slate-700 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{selectedBuyer.contactPhone}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {[
                  {
                    label: '購屋目的',
                    val: selectedBuyer.currentRequirement.purchasePurpose.value || '尚未提供',
                    quote: selectedBuyer.currentRequirement.purchasePurpose.sourceQuote,
                    conf: selectedBuyer.currentRequirement.purchasePurpose.confidence,
                  },
                  {
                    label: '希望區域',
                    val:
                      selectedBuyer.currentRequirement.preferredRegions.value.length > 0
                        ? selectedBuyer.currentRequirement.preferredRegions.value.join('、')
                        : '尚未提供',
                    quote: selectedBuyer.currentRequirement.preferredRegions.sourceQuote,
                    conf: selectedBuyer.currentRequirement.preferredRegions.confidence,
                  },
                  {
                    label: '總價預算（萬元）',
                    val:
                      selectedBuyer.currentRequirement.budget.maxWan !== null
                        ? `${selectedBuyer.currentRequirement.budget.minWan ?? 0} ~ ${
                            selectedBuyer.currentRequirement.budget.maxWan
                          } 萬元（${
                            selectedBuyer.currentRequirement.budget.includesParking === 'yes'
                              ? '含車位'
                              : selectedBuyer.currentRequirement.budget.includesParking === 'no'
                              ? '不含車位'
                              : '未指定是否含車位'
                          }）`
                        : '尚未提供（待向客戶確認）',
                    quote: selectedBuyer.currentRequirement.budget.sourceQuote,
                    conf: selectedBuyer.currentRequirement.budget.confidence,
                  },
                  {
                    label: '房型與房間數',
                    val: `必要底線：${
                      selectedBuyer.currentRequirement.roomsAndType.minRooms ?? '未指定'
                    } 房｜理想偏好：${selectedBuyer.currentRequirement.roomsAndType.preferredRooms ?? '未指定'} 房`,
                    quote: selectedBuyer.currentRequirement.roomsAndType.sourceQuote,
                    conf: selectedBuyer.currentRequirement.roomsAndType.confidence,
                  },
                  {
                    label: '電梯需求',
                    val:
                      selectedBuyer.currentRequirement.elevator.needElevator === 'required'
                        ? '一定要有電梯（必要條件）'
                        : selectedBuyer.currentRequirement.elevator.needElevator === 'preferred'
                        ? '希望有電梯（偏好條件）'
                        : '尚未提供',
                    quote: selectedBuyer.currentRequirement.elevator.sourceQuote,
                    conf: selectedBuyer.currentRequirement.elevator.confidence,
                  },
                  {
                    label: '車位需求',
                    val:
                      selectedBuyer.currentRequirement.parking.needParking === 'required'
                        ? `必須有車位（${(selectedBuyer.currentRequirement.parking.parkingTypes || []).join('、') || '型式不限'}）`
                        : selectedBuyer.currentRequirement.parking.needParking === 'preferred'
                        ? '偏好有車位'
                        : '尚未提供',
                    quote: selectedBuyer.currentRequirement.parking.sourceQuote,
                    conf: selectedBuyer.currentRequirement.parking.confidence,
                  },
                  {
                    label: '通勤地點',
                    val: selectedBuyer.currentRequirement.commuteTarget.value || '尚未提供',
                    quote: selectedBuyer.currentRequirement.commuteTarget.sourceQuote,
                    conf: selectedBuyer.currentRequirement.commuteTarget.confidence,
                  },
                  {
                    label: '學區需求',
                    val: selectedBuyer.currentRequirement.schoolDistrict.value || '尚未指定特定學區',
                    quote: selectedBuyer.currentRequirement.schoolDistrict.sourceQuote,
                    conf: selectedBuyer.currentRequirement.schoolDistrict.confidence,
                  },
                  {
                    label: '家庭成員與生活需求',
                    val: selectedBuyer.currentRequirement.familyAndLifestyle.value || '尚未提供',
                    quote: selectedBuyer.currentRequirement.familyAndLifestyle.sourceQuote,
                    conf: selectedBuyer.currentRequirement.familyAndLifestyle.confidence,
                  },
                  {
                    label: '預計購屋時間',
                    val: selectedBuyer.currentRequirement.timeline.value || '尚未提供',
                    quote: selectedBuyer.currentRequirement.timeline.sourceQuote,
                    conf: selectedBuyer.currentRequirement.timeline.confidence,
                  },
                ].map((row, i) => (
                  <div key={i} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">{row.label}</span>
                      <span className="text-[11px] text-slate-500">{formatConfidenceLabel(row.conf)}</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{row.val}</div>
                    {row.quote && <div className="text-[11px] text-slate-500">原句：「{row.quote}」</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSubTab === 'history' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-cyan-700" />
                  <span>語音／文字接待紀錄（含原始轉寫、AI 草稿與確認結果）</span>
                </h3>
                {intakeHistory.length === 0 ? (
                  <p className="text-xs text-slate-500">尚無接待紀錄</p>
                ) : (
                  <div className="space-y-2.5">
                    {intakeHistory.map((s) => (
                      <div key={s.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-slate-500 font-mono tabular-nums">
                          <span>紀錄時間：{formatTaipeiTime(s.createdAt)}</span>
                          <span>
                            模式：
                            {s.recordingConsentType === 'client_consent_recorded'
                              ? '客戶同意錄音'
                              : s.recordingConsentType === 'agent_summary'
                              ? '業務口述摘要'
                              : '文字輸入'}
                          </span>
                        </div>
                        <div className="text-slate-800 font-medium">轉寫原話：「{s.rawTranscript}」</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">歷次配案快照紀錄 (matchRuns)</h3>
                {matchRuns.length === 0 ? (
                  <p className="text-xs text-slate-500">尚無配案快照紀錄</p>
                ) : (
                  <div className="space-y-2">
                    {matchRuns.map((run) => (
                      <div
                        key={run.id}
                        className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-800">
                            {run.isPreliminary ? '初步配案快照' : '正式配案快照'} — 符合 {run.matchedResults.length} 間 /
                            共評估 {run.evaluatedCount} 間
                          </div>
                          <div className="text-slate-500 font-mono tabular-nums mt-0.5">
                            執行時間：{formatTaipeiTime(run.createdAt)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMatchRun(run);
                            setActiveSubTab('match');
                          }}
                          className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          檢視此快照
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'followup' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      【{selectedBuyer.name}】持續追蹤紀錄時間軸
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      紀錄電話訪談、LINE溝通、拜訪面談之客戶反饋、態度重點與下次約定時間 (Asia/Taipei)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {onOpenAssistantForBuyer && (
                      <button
                        type="button"
                        onClick={() => onOpenAssistantForBuyer(selectedBuyer.id)}
                        className="min-h-[40px] px-3.5 py-1.5 bg-gradient-to-r from-slate-900 to-indigo-950 hover:from-slate-800 hover:to-indigo-900 text-cyan-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>交代助理記錄</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowAddFollowUpModal(true)}
                      className="min-h-[40px] px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>新增追蹤紀錄</span>
                    </button>
                  </div>
                </div>

                {followUps.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <p className="text-xs font-bold text-slate-700">目前尚無此客戶的追蹤訪談紀錄</p>
                    <p className="text-[11px] text-slate-500">
                      點擊上方「新增追蹤紀錄」手動記錄，或使用「交代助理記錄」以文字交代通話重點。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {followUps.map((fu) => (
                      <div
                        key={fu.id}
                        className="p-4 bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2.5 transition"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                                fu.channel === 'phone'
                                  ? 'bg-blue-100 text-blue-800'
                                  : fu.channel === 'line'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : fu.channel === 'meeting'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-slate-200 text-slate-800'
                              }`}
                            >
                              {fu.channel === 'phone' && <Phone className="w-3 h-3" />}
                              {fu.channel === 'line' && <MessageSquare className="w-3 h-3" />}
                              {fu.channel === 'meeting' && <User className="w-3 h-3" />}
                              <span>
                                {fu.channel === 'phone'
                                  ? '電話聯繫'
                                  : fu.channel === 'line'
                                  ? 'LINE 溝通'
                                  : fu.channel === 'meeting'
                                  ? '當面拜訪'
                                  : '其他追蹤'}
                              </span>
                            </span>
                            <span className="text-slate-500 font-mono text-[11px]">
                              {formatTaipeiTime(fu.occurredAt)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteFollowUp(fu.id)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="刪除此紀錄"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          <div className="text-slate-900 font-semibold leading-relaxed">
                            <span className="text-slate-500 mr-1.5">客戶反饋與態度：</span>
                            {fu.clientFeedback}
                          </div>

                          {fu.agentObservations && (
                            <div className="text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 text-[11px]">
                              <span className="font-bold text-slate-800 mr-1">業務觀察：</span>
                              {fu.agentObservations}
                            </div>
                          )}

                          {fu.agreedNextSteps && (
                            <div className="text-indigo-900 bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-200 text-[11px]">
                              <span className="font-bold mr-1">約定下次行動：</span>
                              {fu.agreedNextSteps}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Manual Add FollowUp Modal */}
      {showAddFollowUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-bold text-base text-slate-900">
                  新增追蹤紀錄【{selectedBuyer?.name}】
                </h4>
                <p className="text-xs text-slate-500">記錄通話或訪談反饋，建立追蹤歷史時間軸</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFollowUpModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualFollowUp} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">追蹤方式：</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['phone', 'line', 'meeting', 'other'] as const).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setFuChannel(ch)}
                      className={`py-2 rounded-xl border font-bold text-center transition ${
                        fuChannel === ch
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {ch === 'phone' ? '電話' : ch === 'line' ? 'LINE' : ch === 'meeting' ? '當面' : '其他'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  客戶反饋內容與最新態度 <span className="text-rose-600">*</span>：
                </label>
                <textarea
                  required
                  rows={3}
                  value={fuFeedback}
                  onChange={(e) => setFuFeedback(e.target.value)}
                  placeholder="如：先生看照片後很中意四房主臥空間，但價格希望能談在4050萬內..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-cyan-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">業務觀察與評估重點（選填）：</label>
                <input
                  type="text"
                  value={fuObservations}
                  onChange={(e) => setFuObservations(e.target.value)}
                  placeholder="如：買方積極度高，可向屋主探底爭取收斡旋機會"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">約定下次行動與事項（選填）：</label>
                <input
                  type="text"
                  value={fuNextSteps}
                  onChange={(e) => setFuNextSteps(e.target.value)}
                  placeholder="如：明天下午兩點前回報屋主降價誠意"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddFollowUpModal(false)}
                  className="min-h-[42px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={fuSaving || !fuFeedback.trim()}
                  className="min-h-[42px] px-5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl shadow-xs"
                >
                  {fuSaving ? '儲存中...' : '確認存入資料庫'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
