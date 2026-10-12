import React, { useState, useEffect } from 'react';
import {
  Compass,
  Play,
  Square,
  Sparkles,
  Building2,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  ChevronRight,
  ArrowRight,
  Copy,
  Check,
  Send,
  Edit3,
  Calendar,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  ListOrdered,
  MessageSquare,
  CheckSquare,
} from 'lucide-react';
import {
  TourRecord,
  TourPropertyItem,
  TourSegmentRecord,
  BuyerRecord,
  PropertyRecord,
  TimelineCategory,
  TimelineSpeaker,
  SourcedItem,
} from '../types';
import { getAuthHeaders, formatTaipeiTime } from '../utils';
import { UnifiedTextInputWorkbench } from './UnifiedTextInputWorkbench';

interface ShowingTourManagerProps {
  token: string | null;
  useSandbox: boolean;
  buyers: BuyerRecord[];
  properties: PropertyRecord[];
  onRefreshWorkspace?: () => void;
  onNavigateToTasks?: () => void;
  onNavigateToBuyer?: (buyerId: string) => void;
}

const CATEGORY_MAP: Record<TimelineCategory, { label: string; color: string; bg: string }> = {
  likes: { label: '👍 喜歡與優點', color: 'text-emerald-800 border-emerald-300', bg: 'bg-emerald-50' },
  dislikes: { label: '👎 不喜歡與抗性', color: 'text-rose-800 border-rose-300', bg: 'bg-rose-50' },
  client_questions: { label: '❓ 客戶提問', color: 'text-teal-800 border-teal-300', bg: 'bg-teal-50' },
  new_requirements: { label: '✨ 新增需求', color: 'text-indigo-800 border-indigo-300', bg: 'bg-indigo-50' },
  agent_observations: { label: '🔍 業務觀察', color: 'text-amber-900 border-amber-300', bg: 'bg-amber-50' },
  other: { label: '📝 其他紀錄', color: 'text-slate-800 border-slate-300', bg: 'bg-slate-50' },
};

const SPEAKER_MAP: Record<TimelineSpeaker, string> = {
  buyer: '買方本人',
  spouse: '配偶先生/太太',
  family: '隨行家人',
  agent: '業務自述',
  unknown: '屋主/陪同者',
};

// Sourced Quote Expandable Component
function SourcedQuoteViewer({
  text,
  sourceQuote,
  sourceSegmentId,
}: {
  text: string;
  sourceQuote?: string;
  sourceSegmentId?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-slate-800 text-xs sm:text-sm leading-relaxed">{text}</span>
        {sourceQuote && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] font-medium text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded shrink-0 transition cursor-pointer"
          >
            {expanded ? '收合原話' : '查看原話'}
          </button>
        )}
      </div>
      {expanded && sourceQuote && (
        <div className="p-2.5 rounded-lg bg-slate-100/80 border border-slate-200 text-xs text-slate-700 space-y-1 animate-in fade-in">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>現場原話紀錄：</span>
            {sourceSegmentId && <span className="font-mono text-[10px] text-slate-400">核對碼: {sourceSegmentId}</span>}
          </div>
          <p className="font-medium text-slate-800 italic">「{sourceQuote}」</p>
        </div>
      )}
    </div>
  );
}

export function ShowingTourManager({
  token,
  useSandbox,
  buyers,
  properties,
  onRefreshWorkspace,
  onNavigateToTasks,
  onNavigateToBuyer,
}: ShowingTourManagerProps) {
  const [tours, setTours] = useState<TourRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTour, setActiveTour] = useState<TourRecord | null>(null);

  // View state: 'list' | 'create' | 'active_showing' | 'summary_review'
  const [viewState, setViewState] = useState<'list' | 'create' | 'active_showing' | 'summary_review'>('list');

  // Create Tour Form State
  const [tourType, setTourType] = useState<'registered_buyer' | 'coop_buyer'>('registered_buyer');
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>('');
  const [coopBuyerName, setCoopBuyerName] = useState('');
  const [coopAgentName, setCoopAgentName] = useState('');
  const [coopNotes, setCoopNotes] = useState('');

  // Selected properties for tour
  const [selectedTourProperties, setSelectedTourProperties] = useState<TourPropertyItem[]>([]);
  const [showAddExternalModal, setShowAddExternalModal] = useState(false);
  const [extTitle, setExtTitle] = useState('');
  const [extCityDistrict, setExtCityDistrict] = useState('新竹縣竹北市');
  const [extPriceWan, setExtPriceWan] = useState<number>(3000);
  const [extRoomsSummary, setExtRoomsSummary] = useState('3房2廳2衛 45坪');
  const [extSourceUrl, setExtSourceUrl] = useState('');
  const [extNotes, setExtNotes] = useState('');

  // Manual/Quick text input state in Active Tour
  const [manualInputText, setManualInputText] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<TimelineSpeaker>('buyer');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Segment Draft Review Modal
  const [pendingDraft, setPendingDraft] = useState<any | null>(null);

  // Elapsed showing time ticker
  const [elapsedTourSeconds, setElapsedTourSeconds] = useState(0);

  // Confirmation dialogs
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Expanded segment transcript state for timeline
  const [expandedSegmentIds, setExpandedSegmentIds] = useState<Record<string, boolean>>({});

  const toggleSegmentExpand = (segId: string) => {
    setExpandedSegmentIds((prev) => ({ ...prev, [segId]: !prev[segId] }));
  };

  const fetchTours = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tours', {
        headers: getAuthHeaders(token, useSandbox),
      });
      const data = await res.json();
      if (res.ok) {
        setTours(data.tours || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTours();
  }, [token, useSandbox]);

  // Live timer for active tour
  useEffect(() => {
    if (activeTour && activeTour.status === 'in_progress') {
      const calculateElapsed = () => {
        const start = new Date(activeTour.startedAt).getTime();
        const now = Date.now();
        setElapsedTourSeconds(Math.max(0, Math.floor((now - start) / 1000)));
      };
      calculateElapsed();
      const interval = setInterval(calculateElapsed, 1000);
      return () => clearInterval(interval);
    }
  }, [activeTour]);

  const formatTimerDisplay = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (hrs > 0) {
      return `${hrs}小時 ${mins}分 ${s}秒`;
    }
    return `${mins}分 ${s}秒`;
  };

  // Handle Switch Property in Tour
  const handleSwitchActiveProperty = async (propId: string) => {
    if (!activeTour) return;
    try {
      const res = await fetch(`/api/tours/${activeTour.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({ activePropertyId: propId }),
      });
      const data = await res.json();
      if (res.ok && data.tour) {
        setActiveTour(data.tour);
        setTours((prev) => prev.map((t) => (t.id === data.tour.id ? data.tour : t)));
      }
    } catch {
      // ignore
    }
  };

  // Analyze segment text
  const handleAnalyzeSegment = async (customText?: string) => {
    if (!activeTour) return;
    const currentProp = activeTour.properties.find((p) => p.id === activeTour.activePropertyId) || activeTour.properties[0];
    const textToSend = customText !== undefined ? customText : manualInputText;

    if (!textToSend.trim()) {
      alert('請先輸入或以語音填入客戶談話內容');
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/tours/${activeTour.id}/segments/analyze`, {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({
          propertyId: currentProp.id,
          propertyTitle: currentProp.title,
          elapsedSeconds: elapsedTourSeconds,
          transcript: textToSend.trim(),
          speakerHint: selectedSpeaker,
        }),
      });

      const data = await res.json();
      if (res.ok && data.segmentDraft) {
        setPendingDraft(data.segmentDraft);
        setManualInputText('');
      } else {
        alert(data.error || '分析失敗');
      }
    } catch {
      alert('網路連線失敗，請稍後重試');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Confirm Save Pending Draft to Timeline
  const handleSaveDraftToTimeline = async () => {
    if (!activeTour || !pendingDraft) return;
    try {
      const res = await fetch(`/api/tours/${activeTour.id}/segments`, {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify(pendingDraft),
      });

      const data = await res.json();
      if (res.ok && data.tour) {
        setActiveTour(data.tour);
        setTours((prev) => prev.map((t) => (t.id === data.tour.id ? data.tour : t)));
        setPendingDraft(null);
      } else {
        alert(data.error || '儲存失敗');
      }
    } catch {
      alert('儲存時間軸失敗');
    }
  };

  // Delete segment
  const handleDeleteSegment = async (segmentId: string) => {
    if (!activeTour || !window.confirm('確定要刪除這筆片段紀錄嗎？')) return;
    try {
      const res = await fetch(`/api/tours/${activeTour.id}/segments/${segmentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token, useSandbox),
      });
      const data = await res.json();
      if (res.ok && data.tour) {
        setActiveTour(data.tour);
        setTours((prev) => prev.map((t) => (t.id === data.tour.id ? data.tour : t)));
      }
    } catch {
      // ignore
    }
  };

  // Finish tour and summarize
  const handleConfirmFinishTour = async () => {
    if (!activeTour) return;
    setShowFinishConfirm(false);
    setIsFinishing(true);

    try {
      const res = await fetch(`/api/tours/${activeTour.id}/finish-and-summarize`, {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
      });
      const data = await res.json();
      if (res.ok && data.tour) {
        setActiveTour(data.tour);
        setTours((prev) => prev.map((t) => (t.id === data.tour.id ? data.tour : t)));
        setViewState('summary_review');
        onRefreshWorkspace?.();
      } else {
        alert(data.error || '結束帶看彙整失敗');
      }
    } catch {
      alert('網路連線失敗');
    } finally {
      setIsFinishing(false);
    }
  };

  // Create Tour Submit
  const handleCreateTourSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTourProperties.length === 0) {
      alert('請至少加入一筆欲帶看的物件');
      return;
    }

    let buyerName = '';
    let targetBuyerId = null;

    if (tourType === 'registered_buyer') {
      const b = buyers.find((x) => x.id === selectedBuyerId);
      if (!b) {
        alert('請選擇既有客戶');
        return;
      }
      buyerName = b.name;
      targetBuyerId = b.id;
    } else {
      if (!coopBuyerName.trim()) {
        alert('請填寫合作買方稱呼');
        return;
      }
      buyerName = coopBuyerName.trim();
    }

    try {
      const res = await fetch('/api/tours', {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({
          tourType,
          buyerId: targetBuyerId,
          buyerName,
          coopAgentName: tourType === 'coop_buyer' ? coopAgentName : undefined,
          coopNotes: tourType === 'coop_buyer' ? coopNotes : undefined,
          properties: selectedTourProperties,
        }),
      });

      const data = await res.json();
      if (res.ok && data.tour) {
        setTours((prev) => [data.tour, ...prev]);
        setActiveTour(data.tour);
        setViewState('active_showing');
        setSelectedTourProperties([]);
        onRefreshWorkspace?.();
      } else {
        alert(data.error || '建立帶看失敗');
      }
    } catch {
      alert('網路連線失敗');
    }
  };

  // Add external property snapshot
  const handleAddExternalProperty = () => {
    if (!extTitle.trim()) {
      alert('請填寫物件名稱');
      return;
    }
    const newProp: TourPropertyItem = {
      id: `ext_prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      isExternalSnapshot: true,
      title: extTitle.trim(),
      cityDistrict: extCityDistrict.trim(),
      totalPriceWan: extPriceWan,
      roomsSummary: extRoomsSummary.trim(),
      sourceUrl: extSourceUrl.trim() || undefined,
      notes: extNotes.trim() || undefined,
      visitedOrder: selectedTourProperties.length + 1,
    };
    setSelectedTourProperties((prev) => [...prev, newProp]);
    setExtTitle('');
    setShowAddExternalModal(false);
  };

  // =========================================================================
  // VIEW: 1. Tours List
  // =========================================================================
  if (viewState === 'list') {
    const ongoingTours = tours.filter((t) => t.status === 'in_progress');

    return (
      <div className="space-y-5 pb-28">
        {/* Top Header */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div>
            <div className="text-xs font-bold text-teal-700">現場帶看紀錄中心</div>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">帶看行程與成果彙整</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              現場即時分段紀錄客戶反應，結束後自動產生物件喜好對照與追蹤待辦
            </p>
          </div>

          <button
            type="button"
            onClick={() => setViewState('create')}
            className="min-h-[44px] px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current text-teal-400" />
            <span>開始新帶看</span>
          </button>
        </div>

        {/* Ongoing Alert Card */}
        {ongoingTours.length > 0 && (
          <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 space-y-2.5 shadow-md">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>現場帶看正在進行中</span>
            </div>
            <div className="text-sm font-bold text-slate-100">
              買方：{ongoingTours[0].buyerName} ｜ 物件：
              {ongoingTours[0].properties.map((p) => p.title).join('、')}
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTour(ongoingTours[0]);
                setViewState('active_showing');
              }}
              className="min-h-[40px] px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>進入現場紀錄室</span>
            </button>
          </div>
        )}

        {/* History Tour List */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800">所有帶看歷史行程</h3>
            <span className="text-xs text-slate-400">共 {tours.length} 場</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">載入帶看紀錄中...</div>
          ) : tours.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              目前尚無帶看紀錄。點擊上方「開始新帶看」即可展開現場紀錄。
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {tours.map((t) => {
                const isOngoing = t.status === 'in_progress';

                return (
                  <div key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                          isOngoing
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {isOngoing ? '帶看進行中' : '帶看已結束'}
                        </span>
                        <span className="font-bold text-sm text-slate-900">{t.buyerName}</span>
                      </div>
                      <div className="text-slate-500">
                        {formatTaipeiTime(t.startedAt)} ｜ 參觀 {t.properties.length} 間：
                        {t.properties.map((p) => p.title).join('、')} ｜ {t.segments.length} 則時間軸反應
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isOngoing ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTour(t);
                            setViewState('active_showing');
                          }}
                          className="min-h-[38px] px-3.5 py-1.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition cursor-pointer"
                        >
                          繼續帶看紀錄
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTour(t);
                            setViewState('summary_review');
                          }}
                          className="min-h-[38px] px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-teal-600" />
                          <span>檢視帶看成果</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: 2. Create Tour Flow
  // =========================================================================
  if (viewState === 'create') {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-28">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setViewState('list')}
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
          >
            ← 返回清單
          </button>
          <span className="text-xs font-bold text-teal-700">建立帶看行程</span>
        </div>

        <form onSubmit={handleCreateTourSubmit} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">建立現場帶看行程</h2>
            <p className="text-xs text-slate-500 mt-0.5">選擇客戶並加入本次預計參觀之物件。</p>
          </div>

          {/* Buyer selection */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTourType('registered_buyer')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  tourType === 'registered_buyer'
                    ? 'border-slate-900 bg-slate-900 text-white font-bold'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs mb-0.5">正式客戶</div>
                <div className="text-[11px] opacity-80">結束後可同步更新需求表</div>
              </button>

              <button
                type="button"
                onClick={() => setTourType('coop_buyer')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  tourType === 'coop_buyer'
                    ? 'border-slate-900 bg-slate-900 text-white font-bold'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs mb-0.5">友店／合作買方</div>
                <div className="text-[11px] opacity-80">無需電話，保留同業隱私</div>
              </button>
            </div>

            {tourType === 'registered_buyer' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">選擇客戶 *</label>
                {buyers.length === 0 ? (
                  <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    目前尚未建立正式客戶，請先至接待建檔或切換至合作買方。
                  </p>
                ) : (
                  <select
                    value={selectedBuyerId}
                    onChange={(e) => setSelectedBuyerId(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                    required
                  >
                    <option value="">-- 請選擇既有買方 --</option>
                    {buyers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}（預算：{b.currentRequirement?.budget?.maxWan ? `${b.currentRequirement.budget.maxWan}萬` : '未定'}）
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">買方稱呼 *</label>
                  <input
                    type="text"
                    placeholder="如：陳先生、張小姐"
                    value={coopBuyerName}
                    onChange={(e) => setCoopBuyerName(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">合作業務 / 友店店名</label>
                  <input
                    type="text"
                    placeholder="如：永慶文興店 陳專員"
                    value={coopAgentName}
                    onChange={(e) => setCoopAgentName(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Properties selection */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">本次帶看物件清單 *</label>
              <button
                type="button"
                onClick={() => setShowAddExternalModal(true)}
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新增外部快照</span>
              </button>
            </div>

            <div className="flex gap-2">
              <select
                id="existing-prop-select"
                className="flex-1 min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800"
              >
                <option value="">-- 選擇庫存物件加入 --</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}（{p.totalPriceWan} 萬）
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const sel = document.getElementById('existing-prop-select') as HTMLSelectElement;
                  const propId = sel?.value;
                  if (!propId) return;
                  const p = properties.find((x) => x.id === propId);
                  if (p) {
                    if (selectedTourProperties.some((x) => x.id === p.id)) {
                      alert('該物件已在帶看清單中');
                      return;
                    }
                    setSelectedTourProperties((prev) => [
                      ...prev,
                      {
                        id: p.id,
                        isExternalSnapshot: false,
                        title: p.title,
                        cityDistrict: `${p.city}${p.district}`,
                        address: p.address,
                        totalPriceWan: p.totalPriceWan,
                        roomsSummary: `${p.rooms || 0}房 ${p.buildingAreaPing}坪`,
                        visitedOrder: prev.length + 1,
                      },
                    ]);
                  }
                }}
                className="min-h-[44px] px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                加入
              </button>
            </div>

            {/* Selected properties */}
            <div className="space-y-1.5">
              {selectedTourProperties.map((p, idx) => (
                <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono text-[11px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-900">{p.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTourProperties((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setViewState('list')}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={selectedTourProperties.length === 0}
              className="min-h-[44px] px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current text-teal-400" />
              <span>啟動現場帶看</span>
            </button>
          </div>
        </form>

        {/* Modal: External Snapshot */}
        {showAddExternalModal && (
          <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3 shadow-xl text-xs">
              <h3 className="text-sm font-bold text-slate-900">新增外部物件快照</h3>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">物件名稱 *</label>
                <input
                  type="text"
                  value={extTitle}
                  onChange={(e) => setExtTitle(e.target.value)}
                  placeholder="如：文興路景觀三房"
                  className="w-full min-h-[40px] px-3 py-1.5 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddExternalModal(false)}
                  className="px-3 py-1.5 text-slate-600"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleAddExternalProperty}
                  className="px-4 py-1.5 bg-slate-900 text-white font-bold rounded-xl"
                >
                  加入清單
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW: 3. Active Showing Mode (四、帶看現場)
  // =========================================================================
  if (viewState === 'active_showing' && activeTour) {
    const currentProperty =
      activeTour.properties.find((p) => p.id === activeTour.activePropertyId) || activeTour.properties[0];

    return (
      <div className="space-y-4 pb-32">
        {/* Sticky Top Bar: Buyer, Current Property, Tour Status */}
        <div className="sticky top-0 z-30 bg-slate-900 text-white rounded-2xl p-4 shadow-lg border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-emerald-400">現場帶看中</span>
              <span className="text-xs text-slate-400 font-mono">
                {formatTimerDisplay(elapsedTourSeconds)}
              </span>
            </div>

            {/* Secondary Action: Finish tour with confirmation */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewState('list')}
                className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 rounded-xl transition cursor-pointer"
              >
                暫離列表
              </button>
              <button
                type="button"
                onClick={() => setShowFinishConfirm(true)}
                disabled={isFinishing}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-rose-900/50 border border-slate-700 text-rose-300 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>結束並整理</span>
              </button>
            </div>
          </div>

          {/* Buyer & Active Property Display */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-slate-800 pt-2.5">
            <div>
              <span className="text-slate-400 text-[11px] block">客戶姓名：</span>
              <span className="text-sm font-bold text-white">{activeTour.buyerName}</span>
            </div>

            <div>
              <span className="text-slate-400 text-[11px] block">當前查看物件（點擊切換）：</span>
              <select
                value={currentProperty.id}
                onChange={(e) => handleSwitchActiveProperty(e.target.value)}
                className="w-full mt-0.5 bg-slate-800 text-teal-300 font-bold px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs focus:outline-none"
              >
                {activeTour.properties.map((p, idx) => (
                  <option key={p.id} value={p.id}>
                    第 {idx + 1} 間：{p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Add Record Workplace (先選說話者，再輸入文字或語音) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900">新增帶看紀錄片段</h3>
            <span className="text-[11px] text-slate-500">
              物件：{currentProperty.title}
            </span>
          </div>

          {/* 1. Choose Speaker FIRST */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">選擇說話者：</label>
            <div className="flex flex-wrap gap-1.5">
              {(['buyer', 'spouse', 'family', 'agent', 'unknown'] as TimelineSpeaker[]).map((spk) => (
                <button
                  key={spk}
                  type="button"
                  onClick={() => setSelectedSpeaker(spk)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    selectedSpeaker === spk
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {SPEAKER_MAP[spk]}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Text / Voice Input */}
          <UnifiedTextInputWorkbench
            value={manualInputText}
            onChange={(val) => setManualInputText(val)}
            onSubmit={() => handleAnalyzeSegment()}
            submitLabel="新增紀錄"
            loadingLabel="AI 分析分類中..."
            isLoading={isAnalyzing}
            minRows={3}
            placeholder="輸入或以手機語音口述客戶談話（例如：客廳採光很好，但希望次臥大一點；陽台能不能外推...）"
            propertyHint={currentProperty.title}
            buyerHint={activeTour.buyerName}
            hintDescription="文字與語音共用，輸入完成點擊「新增紀錄」。"
            secondaryAction={
              <button
                type="button"
                disabled={isAnalyzing || !manualInputText.trim()}
                onClick={() => {
                  const now = new Date();
                  const newSegDraft = {
                    propertyId: currentProperty.id,
                    propertyTitle: currentProperty.title,
                    elapsedSeconds: elapsedTourSeconds,
                    transcript: manualInputText.trim(),
                    editedTranscript: manualInputText.trim(),
                    summary: manualInputText.trim().slice(0, 40),
                    categories: ['other'] as TimelineCategory[],
                    speaker: selectedSpeaker,
                    speakerLabel: SPEAKER_MAP[selectedSpeaker],
                    recordedAtTaipei: now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
                  };
                  setPendingDraft(newSegDraft);
                  setManualInputText('');
                }}
                className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-40 cursor-pointer"
              >
                只存文字
              </button>
            }
          />
        </div>

        {/* Modal: Review Segment before writing to timeline */}
        {pendingDraft && (
          <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold text-slate-900">確認紀錄片段</h3>
                <span className="text-slate-500 font-medium">{pendingDraft.propertyTitle}</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">轉寫文字：</label>
                <textarea
                  value={pendingDraft.editedTranscript}
                  onChange={(e) => setPendingDraft({ ...pendingDraft, editedTranscript: e.target.value })}
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">重點摘要：</label>
                <input
                  type="text"
                  value={pendingDraft.summary}
                  onChange={(e) => setPendingDraft({ ...pendingDraft, summary: e.target.value })}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">分類標籤：</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['likes', 'dislikes', 'client_questions', 'new_requirements', 'agent_observations', 'other'] as TimelineCategory[]).map((cat) => {
                    const isSelected = (pendingDraft.categories || []).includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          const cur = pendingDraft.categories || [];
                          const next = isSelected ? cur.filter((c: string) => c !== cat) : [...cur, cat];
                          setPendingDraft({ ...pendingDraft, categories: next });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                          isSelected ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {CATEGORY_MAP[cat].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPendingDraft(null)}
                  className="min-h-[40px] px-3.5 py-2 text-slate-600 cursor-pointer"
                >
                  捨棄
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraftToTimeline}
                  className="min-h-[40px] px-5 py-2 bg-slate-900 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  確認保存至時間軸
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Timeline of Segments (時間軸：長文字視覺收合不截斷儲存資料) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900">時間軸現場紀錄</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              共 {activeTour.segments.length} 則
            </span>
          </div>

          {activeTour.segments.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              目前尚無紀錄片段。請於上方選擇說話者並輸入客戶回饋。
            </div>
          ) : (
            <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200 before:z-0">
              {activeTour.segments.map((seg) => {
                const isExpanded = expandedSegmentIds[seg.id] || false;

                return (
                  <div key={seg.id} className="relative z-10 pl-7 space-y-1">
                    <span className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-slate-900 ring-4 ring-white"></span>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                      {/* Top meta */}
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {seg.propertyTitle}
                          </span>
                          <span className="text-slate-500 font-mono text-[11px]">
                            +{Math.floor(seg.elapsedSeconds / 60)} 分鐘
                          </span>
                          <span className="font-semibold text-slate-700 bg-slate-200/70 px-1.5 py-0.5 rounded text-[11px]">
                            {seg.speakerLabel}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteSegment(seg.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="刪除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Categories with clear text */}
                      <div className="flex flex-wrap gap-1">
                        {seg.categories.map((cat) => {
                          const conf = CATEGORY_MAP[cat] || CATEGORY_MAP.other;
                          return (
                            <span key={cat} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${conf.color} ${conf.bg}`}>
                              {conf.label}
                            </span>
                          );
                        })}
                      </div>

                      {/* Short summary */}
                      <p className="font-bold text-slate-900 text-sm">{seg.summary}</p>

                      {/* Visual clamp for full speech without truncating underlying data */}
                      {seg.editedTranscript && (
                        <div className="pt-1 border-t border-slate-200/60">
                          <p className={`text-slate-700 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                            原話：「{seg.editedTranscript}」
                          </p>
                          {seg.editedTranscript.length > 50 && (
                            <button
                              type="button"
                              onClick={() => toggleSegmentExpand(seg.id)}
                              className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 mt-1 cursor-pointer"
                            >
                              {isExpanded ? '收合原話' : '展開完整原話'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal: Confirm End Tour */}
        {showFinishConfirm && (
          <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl text-xs">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>確定結束現場帶看並開始整理？</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                結束後將由 AI 依據所有時間軸紀錄整理物件喜好對照、追蹤待辦草稿與 LINE 感謝詞。
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFinishConfirm(false)}
                  className="min-h-[40px] px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold cursor-pointer"
                >
                  繼續帶看
                </button>
                <button
                  type="button"
                  onClick={handleConfirmFinishTour}
                  className="min-h-[40px] px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-xs"
                >
                  確認結束並整理
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW: 4. Summary & Debrief Mode (五、帶看成果頁)
  // =========================================================================
  if (viewState === 'summary_review' && activeTour) {
    return (
      <TourSummaryReviewPanel
        activeTour={activeTour}
        buyers={buyers}
        token={token}
        useSandbox={useSandbox}
        onTourUpdated={(updatedTour) => {
          setActiveTour(updatedTour);
          setTours((prev) => prev.map((t) => (t.id === updatedTour.id ? updatedTour : t)));
          onRefreshWorkspace?.();
        }}
        onBackToList={() => setViewState('list')}
        onNavigateToTasks={onNavigateToTasks}
      />
    );
  }

  return null;
}

// =========================================================================
// SUBCOMPONENT: TourSummaryReviewPanel with 4 accessible tabs
// =========================================================================
type DebriefTab = 'highlights' | 'tasks' | 'line' | 'requirement_updates';

interface TourSummaryReviewPanelProps {
  activeTour: TourRecord;
  buyers: BuyerRecord[];
  token: string | null;
  useSandbox: boolean;
  onTourUpdated: (updatedTour: TourRecord) => void;
  onBackToList: () => void;
  onNavigateToTasks?: () => void;
}

function TourSummaryReviewPanel({
  activeTour,
  buyers,
  token,
  useSandbox,
  onTourUpdated,
  onBackToList,
  onNavigateToTasks,
}: TourSummaryReviewPanelProps) {
  const report = activeTour.summaryReport;
  const [activeTab, setActiveTab] = useState<DebriefTab>('highlights');

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copiedLINE, setCopiedLINE] = useState(false);
  const [lineDraftText, setLineDraftText] = useState(report?.customerThankYouMessage || '');

  // Draft Tasks: DEFAULT NOT ALL SELECTED (預設不全選)
  const [draftTasks, setDraftTasks] = useState<
    Array<{
      title: string;
      priority: 'high' | 'medium' | 'low';
      dueNote: string;
      propertyTitle: string;
      sourceSegmentId?: string;
      sourceQuote?: string;
      selected: boolean;
    }>
  >([]);
  const [isSubmittingTasks, setIsSubmittingTasks] = useState(false);
  const [tasksSuccessMsg, setTasksSuccessMsg] = useState<string | null>(null);

  // Requirement updates state
  const [selectedMustHaves, setSelectedMustHaves] = useState<string[]>([]);
  const [selectedNiceHaves, setSelectedNiceHaves] = useState<string[]>([]);
  const [generalNoteText, setGeneralNoteText] = useState('');
  const [isUpdatingBuyerReq, setIsUpdatingBuyerReq] = useState(false);
  const [buyerReqSuccessMsg, setBuyerReqSuccessMsg] = useState<string | null>(null);

  // Unprovided items collapsible state
  const [showUnprovidedItems, setShowUnprovidedItems] = useState(false);
  const [showInternalLog, setShowInternalLog] = useState(false);

  useEffect(() => {
    if (report) {
      setLineDraftText(report.customerThankYouMessage || '');
      // Rule: Default unselected (selected: false)
      setDraftTasks(
        (report.suggestedTasks || []).map((t) => ({
          title: t.title,
          priority: (['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium') as 'high' | 'medium' | 'low',
          dueNote: t.dueNote || '',
          propertyTitle: t.propertyTitle || activeTour.properties[0]?.title || '',
          sourceSegmentId: t.sourceSegmentId,
          sourceQuote: t.sourceQuote,
          selected: false,
        }))
      );
      setSelectedMustHaves(
        (report.requirementUpdateDraft?.mustHavesToAdd || []).map((m) =>
          typeof m === 'string' ? m : m.text
        )
      );
      setSelectedNiceHaves(
        (report.requirementUpdateDraft?.niceToHavesToAdd || []).map((n) =>
          typeof n === 'string' ? n : n.text
        )
      );
      setGeneralNoteText(report.requirementUpdateDraft?.generalNote || '');
    }
  }, [report, activeTour]);

  const targetBuyer = activeTour.buyerId ? buyers.find((b) => b.id === activeTour.buyerId) : null;

  // Copy LINE text
  const handleCopyLINE = () => {
    navigator.clipboard.writeText(lineDraftText);
    setCopiedLINE(true);
    setTimeout(() => setCopiedLINE(false), 2000);
  };

  // Regenerate summary on demand
  const handleRegenerateSummary = async () => {
    setIsRegenerating(true);
    try {
      const res = await fetch(`/api/tours/${activeTour.id}/generate-summary`, {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
      });
      const data = await res.json();
      if (res.ok && data.tour) {
        onTourUpdated(data.tour);
      } else {
        alert(data.error || '重新整理草稿失敗，已保留上一版');
      }
    } catch {
      alert('連線失敗，請重試');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Confirm selected tasks
  const handleConfirmTasks = async () => {
    const selected = draftTasks.filter((t) => t.selected && t.title.trim());
    if (selected.length === 0) {
      alert('請先勾選欲建立的待辦事項');
      return;
    }

    setIsSubmittingTasks(true);
    try {
      const res = await fetch(`/api/tours/${activeTour.id}/confirm-tasks`, {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({
          tasks: selected.map((t) => ({
            title: t.title.trim(),
            priority: t.priority,
            dueNote: t.dueNote.trim() || undefined,
            propertyTitle: t.propertyTitle,
            sourceSegmentId: t.sourceSegmentId,
            sourceQuote: t.sourceQuote,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok && data.tour) {
        onTourUpdated(data.tour);
        setTasksSuccessMsg(`已成功建立 ${data.createdTasks?.length || selected.length} 項追蹤待辦！`);
      } else {
        alert(data.error || '建立待辦失敗');
      }
    } catch {
      alert('連線失敗');
    } finally {
      setIsSubmittingTasks(false);
    }
  };

  // Apply requirement update
  const handleApplyRequirementUpdate = async () => {
    if (!activeTour.buyerId) return;
    setIsUpdatingBuyerReq(true);
    try {
      const res = await fetch(`/api/tours/${activeTour.id}/apply-requirement-update`, {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({
          selectedMustHaves,
          selectedNiceToHaves: selectedNiceHaves,
          generalNote: generalNoteText.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.tour) {
        onTourUpdated(data.tour);
        setBuyerReqSuccessMsg(`已成功將所選條件同步更新至客戶需求卡！`);
      } else {
        alert(data.error || '同步需求更新失敗');
      }
    } catch {
      alert('連線失敗');
    } finally {
      setIsUpdatingBuyerReq(false);
    }
  };

  const selectedTasksCount = draftTasks.filter((t) => t.selected).length;

  const hasNewRequirements =
    (report?.requirementUpdateDraft?.mustHavesToAdd && report.requirementUpdateDraft.mustHavesToAdd.length > 0) ||
    (report?.requirementUpdateDraft?.niceToHavesToAdd && report.requirementUpdateDraft.niceToHavesToAdd.length > 0);

  return (
    <div className="space-y-5 pb-28">
      {/* Top Header & Status Separator */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <button
            type="button"
            onClick={onBackToList}
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer self-start"
          >
            ← 返回帶看列表
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRegenerateSummary}
              disabled={isRegenerating}
              className="min-h-[38px] px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>{isRegenerating ? '重新整理中...' : '重新整理草稿'}</span>
            </button>
          </div>
        </div>

        {/* Clear Separation of Tour Status vs Debrief Draft Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800">
                帶看已結束
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                成果草稿待確認
              </span>
              <span className="text-xs text-slate-400 font-mono">
                版本 {report?.sourceVersion || 1}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
              帶看成果：{activeTour.buyerName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              參觀物件：{activeTour.properties.map((p) => p.title).join('、')} ｜ 整理時間：
              {formatTaipeiTime(report?.generatedAt || activeTour.endedAt || activeTour.startedAt)}
            </p>
          </div>
        </div>

        {/* Basic rule concise prompt */}
        {report?.isRuleBased && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>本次採基本整理，部分內容需人工確認。已完整保留現場記錄與上一版結果。</span>
          </div>
        )}
      </div>

      {/* Four Accessible Tabs Navigation */}
      <div className="bg-slate-100 p-1.5 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('highlights')}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'highlights'
              ? 'bg-white text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 text-teal-600" />
          <span>物件重點反應</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'tasks'
              ? 'bg-white text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CheckSquare className="w-4 h-4 text-amber-600" />
          <span>待辦草稿 ({draftTasks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('line')}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'line'
              ? 'bg-white text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          <span>客戶回覆 LINE</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requirement_updates')}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'requirement_updates'
              ? 'bg-white text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span>需求變更對照</span>
        </button>
      </div>

      {/* TAB 1: HIGHLIGHTS (各物件喜歡、抗性、待查問題與下一步) */}
      {activeTab === 'highlights' && report && (
        <div className="space-y-4">
          <div className="space-y-3">
            {report.perPropertySummary.map((item, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono text-[11px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span>{item.propertyTitle}</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Likes */}
                  <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/80 space-y-1.5">
                    <span className="font-bold text-emerald-900 block">👍 喜歡與優點：</span>
                    {item.likes.length === 0 ? (
                      <p className="text-emerald-700/60">無特別提及</p>
                    ) : (
                      <div className="space-y-2">
                        {item.likes.map((l, i) => {
                          const isObj = typeof l === 'object' && l !== null;
                          return (
                            <SourcedQuoteViewer
                              key={i}
                              text={isObj ? l.text : l}
                              sourceQuote={isObj ? l.sourceQuote : undefined}
                              sourceSegmentId={isObj ? l.sourceSegmentId : undefined}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Dislikes */}
                  <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-200/80 space-y-1.5">
                    <span className="font-bold text-rose-900 block">👎 不喜歡與抗性：</span>
                    {item.dislikes.length === 0 ? (
                      <p className="text-rose-700/60">無顯著抗性</p>
                    ) : (
                      <div className="space-y-2">
                        {item.dislikes.map((d, i) => {
                          const isObj = typeof d === 'object' && d !== null;
                          return (
                            <SourcedQuoteViewer
                              key={i}
                              text={isObj ? d.text : d}
                              sourceQuote={isObj ? d.sourceQuote : undefined}
                              sourceSegmentId={isObj ? d.sourceSegmentId : undefined}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Client Questions & Observations */}
                <div className="space-y-2 text-xs pt-1">
                  {item.clientQuestions.length > 0 && (
                    <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 space-y-1.5">
                      <span className="font-bold text-teal-900 block">❓ 客戶提問（待查證）：</span>
                      <div className="space-y-2">
                        {item.clientQuestions.map((q, i) => {
                          const isObj = typeof q === 'object' && q !== null;
                          return (
                            <SourcedQuoteViewer
                              key={i}
                              text={isObj ? q.text : q}
                              sourceQuote={isObj ? q.sourceQuote : undefined}
                              sourceSegmentId={isObj ? q.sourceSegmentId : undefined}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {item.agentObservations.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
                      <span className="font-bold text-amber-900 block">🔍 現場業務觀察：</span>
                      <div className="space-y-2">
                        {item.agentObservations.map((o, i) => {
                          const isObj = typeof o === 'object' && o !== null;
                          return (
                            <SourcedQuoteViewer
                              key={i}
                              text={isObj ? o.text : o}
                              sourceQuote={isObj ? o.sourceQuote : undefined}
                              sourceSegmentId={isObj ? o.sourceSegmentId : undefined}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Unmentioned Items: Compact 1-line summary + collapsible list */}
          {report.unprovidedItems && report.unprovidedItems.length > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-semibold">
                  本次帶看未提及項目：共 {report.unprovidedItems.length} 項
                </span>
                <button
                  type="button"
                  onClick={() => setShowUnprovidedItems(!showUnprovidedItems)}
                  className="text-teal-700 font-bold hover:underline cursor-pointer"
                >
                  {showUnprovidedItems ? '收合清單' : '展開清單'}
                </button>
              </div>

              {showUnprovidedItems && (
                <ul className="list-disc pl-5 text-slate-500 space-y-0.5 pt-2 border-t border-slate-100 animate-in fade-in">
                  {report.unprovidedItems.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Internal Log: Collapsible Details */}
          {report.internalAgentSummary && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">內部業務日誌摘要</span>
                <button
                  type="button"
                  onClick={() => setShowInternalLog(!showInternalLog)}
                  className="text-slate-500 font-semibold hover:text-slate-800 cursor-pointer"
                >
                  {showInternalLog ? '收合日誌' : '展開檢視'}
                </button>
              </div>

              {showInternalLog && (
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap pt-2 border-t border-slate-100 animate-in fade-in">
                  {report.internalAgentSummary}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TASKS DRAFT (待辦草稿：預設不全選，顯示已選數量與已建立狀態) */}
      {activeTab === 'tasks' && report && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">建議追蹤待辦事項草稿</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                預設未全選，請逐項檢視並勾選欲建立之工作，確認後寫入待辦清單。
              </p>
            </div>
            {onNavigateToTasks && (
              <button
                type="button"
                onClick={onNavigateToTasks}
                className="text-xs font-bold text-teal-700 hover:underline self-start cursor-pointer"
              >
                前往全部待辦清單 →
              </button>
            )}
          </div>

          {tasksSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold">
              {tasksSuccessMsg}
            </div>
          )}

          {draftTasks.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">本次無建議之待辦草稿。</div>
          ) : (
            <div className="space-y-3">
              {draftTasks.map((task, i) => (
                <div
                  key={i}
                  className={`p-3.5 rounded-xl border text-xs space-y-2 transition ${
                    task.selected ? 'bg-amber-50/60 border-amber-300' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={task.selected}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setDraftTasks((prev) =>
                          prev.map((t, idx) => (idx === i ? { ...t, selected: val } : t))
                        );
                      }}
                      className="mt-1 rounded text-slate-900 cursor-pointer w-4 h-4"
                    />

                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={task.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraftTasks((prev) =>
                            prev.map((t, idx) => (idx === i ? { ...t, title: val } : t))
                          );
                        }}
                        className="w-full min-h-[38px] px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 text-xs sm:text-sm"
                        placeholder="待辦事項標題"
                      />

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={task.priority}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setDraftTasks((prev) =>
                              prev.map((t, idx) => (idx === i ? { ...t, priority: val } : t))
                            );
                          }}
                          className="min-h-[36px] px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                        >
                          <option value="high">高優先</option>
                          <option value="medium">中優先</option>
                          <option value="low">低優先</option>
                        </select>

                        <input
                          type="text"
                          value={task.dueNote}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftTasks((prev) =>
                              prev.map((t, idx) => (idx === i ? { ...t, dueNote: val } : t))
                            );
                          }}
                          className="min-h-[36px] px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs flex-1 min-w-[140px]"
                          placeholder="約定期限（未約定請留空）"
                        />
                      </div>

                      {task.sourceQuote && (
                        <div className="text-[11px] text-slate-500">來源依據：「{task.sourceQuote}」</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-700">
                  已選取 {selectedTasksCount} / {draftTasks.length} 項待辦
                </span>

                <button
                  type="button"
                  onClick={handleConfirmTasks}
                  disabled={isSubmittingTasks || selectedTasksCount === 0}
                  className="min-h-[44px] px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4 text-teal-400" />
                  <span>{isSubmittingTasks ? '建立中...' : `確認建立所選 (${selectedTasksCount}) 項待辦`}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LINE CLIENT REPLY (LINE草稿、編輯、複製；複製成功有提示，按鈕不暗示已傳送) */}
      {activeTab === 'line' && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">客戶感謝與回覆 LINE 草稿</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                中性陳述，不擅自承諾未確認事項。點擊可直接複製至剪貼簿貼至 LINE。
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyLINE}
              className="min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
            >
              {copiedLINE ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLINE ? '已複製至剪貼簿！' : '複製 LINE 草稿'}</span>
            </button>
          </div>

          <textarea
            rows={7}
            value={lineDraftText}
            onChange={(e) => setLineDraftText(e.target.value)}
            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 leading-relaxed font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="LINE 回覆文字內容..."
          />
        </div>
      )}

      {/* TAB 4: REQUIREMENT UPDATES (原值、建議新值、來源及逐項確認；無變更顯示「本次沒有新增需求」) */}
      {activeTab === 'requirement_updates' && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">客戶需求卡同步更新建議</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                僅在有明確依據時才提議更新。未勾選項目不會覆蓋客戶卡。
              </p>
            </div>

            {hasNewRequirements && targetBuyer && (
              <button
                type="button"
                onClick={handleApplyRequirementUpdate}
                disabled={isUpdatingBuyerReq}
                className="min-h-[44px] px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{isUpdatingBuyerReq ? '更新中...' : '同步至客戶需求卡'}</span>
              </button>
            )}
          </div>

          {buyerReqSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold">
              {buyerReqSuccessMsg}
            </div>
          )}

          {!hasNewRequirements ? (
            <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
              本次帶看沒有發現新增或變更之需求條件。
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Must haves diff */}
              {report?.requirementUpdateDraft?.mustHavesToAdd && report.requirementUpdateDraft.mustHavesToAdd.length > 0 && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-800 block">建議新增之必要條件 (mustHaves)：</span>
                  {report.requirementUpdateDraft.mustHavesToAdd.map((m, idx) => {
                    const desc = typeof m === 'string' ? m : m.text;
                    const quote = typeof m === 'object' && m !== null ? m.sourceQuote : '';
                    const isChecked = selectedMustHaves.includes(desc);

                    return (
                      <label key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedMustHaves((prev) => [...prev, desc]);
                            else setSelectedMustHaves((prev) => prev.filter((x) => x !== desc));
                          }}
                          className="mt-0.5 rounded text-indigo-600"
                        />
                        <div>
                          <span className="font-bold text-slate-900">{desc}</span>
                          {quote && <span className="block text-[11px] text-slate-500 mt-0.5">來源原句：「{quote}」</span>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Nice to haves diff */}
              {report?.requirementUpdateDraft?.niceToHavesToAdd && report.requirementUpdateDraft.niceToHavesToAdd.length > 0 && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-800 block">建議新增之偏好條件 (niceToHaves)：</span>
                  {report.requirementUpdateDraft.niceToHavesToAdd.map((n, idx) => {
                    const desc = typeof n === 'string' ? n : n.text;
                    const quote = typeof n === 'object' && n !== null ? n.sourceQuote : '';
                    const isChecked = selectedNiceHaves.includes(desc);

                    return (
                      <label key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedNiceHaves((prev) => [...prev, desc]);
                            else setSelectedNiceHaves((prev) => prev.filter((x) => x !== desc));
                          }}
                          className="mt-0.5 rounded text-indigo-600"
                        />
                        <div>
                          <span className="font-bold text-slate-900">{desc}</span>
                          {quote && <span className="block text-[11px] text-slate-500 mt-0.5">來源原句：「{quote}」</span>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">本次帶看備註：</label>
                <input
                  type="text"
                  value={generalNoteText}
                  onChange={(e) => setGeneralNoteText(e.target.value)}
                  placeholder="補充備註..."
                  className="w-full min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
