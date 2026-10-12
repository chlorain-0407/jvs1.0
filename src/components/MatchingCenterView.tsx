import React, { useState, useEffect, useMemo } from 'react';
import {
  SearchCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  User,
  Phone,
  Sparkles,
  Calendar,
  Clock,
  ArrowRight,
  ChevronRight,
  Filter,
  Building,
  RotateCcw,
  Check,
  ExternalLink,
  Search,
} from 'lucide-react';
import {
  BuyerRecord,
  MatchRunRecord,
  MatchEvaluationItem,
  PropertyRecord,
} from '../types';
import { getAuthHeaders, formatTaipeiTime } from '../utils';

interface MatchingCenterViewProps {
  token: string | null;
  useSandbox: boolean;
  buyers: BuyerRecord[];
  initialBuyerId: string | null;
  onNavigateToCustomer: (buyerId: string) => void;
  onStartTourForProperty?: (propertyId: string, buyerId: string) => void;
}

export const MatchingCenterView: React.FC<MatchingCenterViewProps> = ({
  token,
  useSandbox,
  buyers,
  initialBuyerId,
  onNavigateToCustomer,
  onStartTourForProperty,
}) => {
  // Selected Customer State
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>(
    initialBuyerId || (buyers[0]?.id ?? '')
  );
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Scope Settings
  const [includeExternal, setIncludeExternal] = useState(true);

  // Match State
  const [activeMatchRun, setActiveMatchRun] = useState<MatchRunRecord | null>(null);
  const [matchHistory, setMatchHistory] = useState<MatchRunRecord[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  // Selected Candidate for Detailed Drawer / Modal
  const [selectedCandidate, setSelectedCandidate] = useState<MatchEvaluationItem | null>(null);

  const selectedBuyer = useMemo(() => {
    return buyers.find((b) => b.id === selectedBuyerId) || null;
  }, [buyers, selectedBuyerId]);

  // Initial Sync from Prop
  useEffect(() => {
    if (initialBuyerId && initialBuyerId !== selectedBuyerId) {
      setSelectedBuyerId(initialBuyerId);
    }
  }, [initialBuyerId]);

  // When changing buyer, immediately clear previous buyer's result to avoid flashing wrong data
  useEffect(() => {
    setActiveMatchRun(null);
    setMatchHistory([]);
    setMatchError(null);
    setSelectedCandidate(null);

    if (selectedBuyerId) {
      fetchBuyerMatchRuns(selectedBuyerId);
    }
  }, [selectedBuyerId, token, useSandbox]);

  const fetchBuyerMatchRuns = async (bId: string) => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/match-runs?buyerId=${bId}`, {
        headers: getAuthHeaders(token, useSandbox),
      });
      if (res.ok) {
        const data = await res.json();
        const runs: MatchRunRecord[] = data.matchRuns || [];
        setMatchHistory(runs);
        setActiveMatchRun(runs[0] || null);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Run Match: ONLY called when user explicitly clicks "開始配案" or "重新配案"
  const handleRunMatch = async () => {
    if (!selectedBuyerId || isMatching) return;
    setIsMatching(true);
    setMatchError(null);

    try {
      const res = await fetch('/api/match/run', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(token, useSandbox),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buyerId: selectedBuyerId,
          includeExternal,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMatchError(data.error || '配案篩選失敗');
        return;
      }

      setActiveMatchRun(data.matchRun);
      setMatchHistory((prev) => [data.matchRun, ...prev.filter((r) => r.id !== data.matchRun.id)]);
    } catch (err: any) {
      setMatchError(err?.message || '網路連線異常，無法完成配案');
    } finally {
      setIsMatching(false);
    }
  };

  // Filtered Buyers for Customer Picker
  const filteredPickerBuyers = useMemo(() => {
    if (!customerSearchQuery.trim()) return buyers;
    const q = customerSearchQuery.trim().toLowerCase();
    return buyers.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.contactPhone && b.contactPhone.toLowerCase().includes(q))
    );
  }, [buyers, customerSearchQuery]);

  if (buyers.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 space-y-3">
        <Building className="w-10 h-10 text-slate-300 mx-auto" />
        <h2 className="text-base font-bold text-slate-800">目前尚無客戶資料可供配案</h2>
        <p className="text-xs text-slate-500">
          請先前往「客戶管理」建檔客戶與購屋需求後，再進入配案中心進行條件篩選。
        </p>
      </div>
    );
  }

  const curReq = selectedBuyer?.currentRequirement;
  const isRequirementOutdated = activeMatchRun?.isOutdated;

  return (
    <div className="space-y-6 pb-24">
      {/* HEADER */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">配案中心</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              規則式硬過濾 ➔ 偏好排序
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            針對指定客戶之結構化需求，對名下委託與合作案件執行嚴格篩選。非自動觸發，由您按鈕開始。
          </p>
        </div>

        {selectedBuyer && (
          <button
            type="button"
            onClick={() => onNavigateToCustomer(selectedBuyer.id)}
            className="min-h-[40px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <User className="w-4 h-4 text-slate-600" />
            <span>查看「{selectedBuyer.name}」客戶資料</span>
          </button>
        )}
      </div>

      {/* STEP 1: SELECT CUSTOMER */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-mono">
              1
            </span>
            <span>選擇配案客戶</span>
          </label>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="搜尋客戶姓名或電話..."
              value={customerSearchQuery}
              onChange={(e) => setCustomerSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none text-slate-800 focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Horizontal Buyer Buttons */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
          {filteredPickerBuyers.map((b) => {
            const isSelected = b.id === selectedBuyerId;
            const bReq = b.currentRequirement;
            const budgetLabel = bReq.budget.maxWan ? `${bReq.budget.maxWan}萬` : '預算未定';
            const roomLabel = bReq.roomsAndType.minRooms ? `${bReq.roomsAndType.minRooms}房` : '房數未定';

            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBuyerId(b.id)}
                className={`min-h-[52px] px-4 py-2.5 rounded-xl border text-left shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-cyan-400/40'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 opacity-75" />
                  <span>{b.name}</span>
                  <span className={`text-[10px] px-1 rounded ${isSelected ? 'bg-slate-800 text-cyan-300' : 'bg-slate-200 text-slate-600'}`}>
                    v{b.requirementVersion || 1}
                  </span>
                </div>
                <div className={`text-[11px] mt-0.5 font-mono ${isSelected ? 'text-cyan-300' : 'text-slate-500'}`}>
                  {budgetLabel} · {roomLabel}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedBuyer && curReq && (
        <>
          {/* STEP 2 & 3: REQUIREMENT SNAPSHOT & MATCH SETTINGS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Step 2: Requirement Snapshot */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-mono">
                    2
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    「{selectedBuyer.name}」已確認需求摘要（版本 v{selectedBuyer.requirementVersion || 1}）
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateToCustomer(selectedBuyer.id)}
                  className="text-xs text-cyan-700 hover:underline font-bold"
                >
                  前往補充需求 ➔
                </button>
              </div>

              {/* Warning if missing key info */}
              {selectedBuyer.missingCriticalFields && selectedBuyer.missingCriticalFields.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">缺關鍵條件：</span>
                    {(selectedBuyer.missingCriticalFields || []).join('、')}。
                    執行配案將作為初步篩選，不擅自推算未提供之預算。
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">總價預算上限</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {curReq.budget?.maxWan ? `${curReq.budget.maxWan} 萬元` : '未指定'}
                    <span className="text-[10px] text-slate-500 font-normal ml-1">
                      ({curReq.budget?.includesParking === 'yes' ? '含車位' : curReq.budget?.includesParking === 'no' ? '不含車位' : '未定'})
                    </span>
                  </span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">房間數需求</span>
                  <span className="font-bold text-slate-900">
                    {curReq.roomsAndType?.minRooms ? `${curReq.roomsAndType.minRooms} 房以上` : '未指定'}
                  </span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">車位需求</span>
                  <span className="font-bold text-slate-900 truncate block">
                    {curReq.parking?.needParking === 'required'
                      ? `必備 (${(curReq.parking.parkingTypes || []).join('、') || '型式不限'})`
                      : curReq.parking?.needParking === 'preferred'
                      ? '偏好車位'
                      : '未指定'}
                  </span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">電梯需求</span>
                  <span className="font-bold text-slate-900">
                    {curReq.elevator?.needElevator === 'required' ? '必須電梯' : '非必要'}
                  </span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">屋齡限制</span>
                  <span className="font-bold text-slate-900">
                    {curReq.propertyAge?.maxAgeYears ? `${curReq.propertyAge.maxAgeYears} 年內` : '未限制'}
                  </span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">希望區域</span>
                  <span className="font-bold text-slate-900 truncate block">
                    {(curReq.preferredRegions?.value || []).length > 0
                      ? (curReq.preferredRegions?.value || []).join('、')
                      : '未指定特定區域'}
                  </span>
                </div>
              </div>
            </div>

            {/* Step 3: Match Scope & Trigger Button */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-mono">
                    3
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">配案範圍與篩選設定</h3>
                </div>

                <div className="space-y-2.5 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100">
                    <input
                      type="checkbox"
                      checked={includeExternal}
                      onChange={(e) => setIncludeExternal(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-600"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">納入外部合作案件</span>
                      <span className="text-[11px] text-slate-500">
                        自動排除「不可合作」物件，優先保留可配案之友店委託
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Trigger Button */}
              <button
                type="button"
                onClick={handleRunMatch}
                disabled={isMatching}
                className="w-full min-h-[48px] py-3 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isMatching
                    ? '正在篩選名下物件...'
                    : activeMatchRun
                    ? '重新執行配案'
                    : '開始配案'}
                </span>
              </button>
            </div>
          </div>

          {matchError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold">
              {matchError}
            </div>
          )}

          {/* STEP 4: MATCH RESULTS */}
          <div className="space-y-4">
            {isLoadingHistory ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-xs text-slate-500">
                正在讀取該客戶之配案歷史...
              </div>
            ) : !activeMatchRun ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
                <SearchCheck className="w-10 h-10 text-cyan-700 mx-auto" />
                <h3 className="text-base font-bold text-slate-900">
                  尚未針對「{selectedBuyer.name}」執行配案
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  請點擊上方「開始配案」，系統將依客戶目前已確認之條件版本（v{selectedBuyer.requirementVersion || 1}），逐一檢驗符合與排除原因。
                </p>
                <button
                  type="button"
                  onClick={handleRunMatch}
                  disabled={isMatching}
                  className="min-h-[42px] px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  {isMatching ? '篩選中...' : '立即開始配案'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Result Summary Bar */}
                <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-cyan-300">
                        {activeMatchRun.isPreliminary ? '初步配案（未滿全部關鍵條件）' : '正式條件配案'}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-400 font-mono tabular-nums">
                        配案時間：{formatTaipeiTime(activeMatchRun.createdAt)}
                      </span>
                    </div>

                    <div className="text-slate-400 text-[11px] font-mono">
                      檢測物件：{activeMatchRun.evaluatedCount} 間
                    </div>
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="text-base font-bold">
                      符合必要條件共{' '}
                      <span className="text-cyan-400 text-lg font-mono">
                        {activeMatchRun.matchedResults.length}
                      </span>{' '}
                      間物件
                      {activeMatchRun.toVerifyCandidates && activeMatchRun.toVerifyCandidates.length > 0 && (
                        <span className="text-xs text-amber-300 font-normal ml-2">
                          （另有 {activeMatchRun.toVerifyCandidates.length} 間待確認條件）
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleRunMatch}
                      disabled={isMatching}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                    >
                      {isMatching ? '計算中...' : '重新執行配案'}
                    </button>
                  </div>
                </div>

                {/* Outdated Notice if Requirement was updated after this match run */}
                {isRequirementOutdated && (
                  <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3 text-xs text-amber-900">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                        <span className="font-bold">購屋需求已在配案後更新：</span>
                        目前客戶需求已更新為版本 v{selectedBuyer.requirementVersion || 1}，此配案結果為舊條件快照。
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunMatch}
                      disabled={isMatching}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      依新需求重新配案
                    </button>
                  </div>
                )}

                {/* Candidate Properties Cards */}
                {activeMatchRun.matchedResults.length === 0 ? (
                  <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 space-y-2">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                    <p className="text-base font-bold text-slate-800">目前尚無符合全部硬性條件之物件</p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      誠實回報：不捏造或擅自放寬必要條件。可至下方檢視被排除原因，或返回「客戶管理」與客戶商討預算與條件彈性。
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeMatchRun.matchedResults.map((item) => {
                      const prop = item.propertySnapshot;
                      return (
                        <div
                          key={item.propertyId}
                          className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-slate-300 shadow-xs space-y-3.5 flex flex-col justify-between"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[11px] font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                                  {prop.caseOwnership === 'external' ? '外部合作' : '自有委託'}
                                </span>
                                <h4 className="text-base font-bold text-slate-900 mt-1">
                                  {prop.title}
                                </h4>
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {prop.city} {prop.district} {prop.address}
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-base font-bold text-cyan-700 font-mono tabular-nums">
                                  {prop.totalPriceWan} 萬
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {prop.buildingAreaPing} 坪 · {prop.rooms} 房
                                </div>
                              </div>
                            </div>

                            {/* Matched Conditions */}
                            {item.matchedConditions.length > 0 && (
                              <div className="text-xs space-y-1 bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
                                <span className="font-bold text-emerald-900 block text-[11px]">
                                  符合條件：
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {item.matchedConditions.map((mc, mIdx) => (
                                    <span
                                      key={mIdx}
                                      className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[11px]"
                                    >
                                      ✓ {mc}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* AI Recommendation Reason */}
                            {item.aiRecommendationReason && (
                              <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                                <span className="font-bold text-slate-800">推薦分析：</span>
                                {item.aiRecommendationReason}
                              </p>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <span className="text-xs text-slate-400">
                              屋齡 {prop.ageYears ?? '未提供'} 年 · {prop.parkingType}
                            </span>

                            {onStartTourForProperty && (
                              <button
                                type="button"
                                onClick={() => onStartTourForProperty(prop.id, selectedBuyer.id)}
                                className="px-3.5 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                <span>安排帶看</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Rejected Summary Section */}
                {activeMatchRun.rejectedSummary && activeMatchRun.rejectedSummary.length > 0 && (
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                    <h4 className="text-xs font-bold text-slate-700">
                      未符合條件之排除案件明細（誠實列出）
                    </h4>
                    <div className="space-y-1.5 text-xs">
                      {activeMatchRun.rejectedSummary.map((rej, rIdx) => (
                        <div
                          key={rIdx}
                          className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-slate-600"
                        >
                          <span className="font-semibold text-slate-800">{rej.title}</span>
                          <span className="text-rose-600 text-[11px]">
                            {(rej.unmetMustHaves || []).join('；')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
