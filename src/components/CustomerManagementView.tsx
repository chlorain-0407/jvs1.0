import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  Phone,
  Search,
  Plus,
  ArrowRight,
  Clock,
  Sparkles,
  Edit3,
  Calendar,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  History,
  FileText,
  ChevronDown,
  ChevronUp,
  Tag,
  Save,
  Send,
  Eye,
  Trash2,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import {
  BuyerRecord,
  CustomerNoteRecord,
  CustomerNoteSource,
  CustomerAiSuggestionRecord,
  BuyerRequirementDiffItem,
  TourRecord,
} from '../types';
import { getAuthHeaders, formatTaipeiTime, formatConfidenceLabel } from '../utils';

interface CustomerManagementViewProps {
  token: string | null;
  useSandbox: boolean;
  buyers: BuyerRecord[];
  initialBuyerId: string | null;
  onRefreshBuyers: () => void;
  onNavigateToMatching: (buyerId: string) => void;
  onStartVoiceIntake: () => void;
  onOpenAssistantForBuyer?: (buyerId: string) => void;
  onStartLineAnalysisForBuyer?: (buyerId: string) => void;
}

export const CustomerManagementView: React.FC<CustomerManagementViewProps> = ({
  token,
  useSandbox,
  buyers,
  initialBuyerId,
  onRefreshBuyers,
  onNavigateToMatching,
  onStartVoiceIntake,
  onOpenAssistantForBuyer,
  onStartLineAnalysisForBuyer,
}) => {
  // Navigation & Selected Customer State
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(initialBuyerId || null);
  const [activeTab, setActiveTab] = useState<'info' | 'notes' | 'ai' | 'timeline'>('info');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');

  // Manual Customer Creation Modal State
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustBudget, setNewCustBudget] = useState('');
  const [newCustRooms, setNewCustRooms] = useState('3');
  const [newCustNotes, setNewCustNotes] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [createCustomerError, setCreateCustomerError] = useState<string | null>(null);

  // Active Buyer Details & Associated State
  const [currentBuyer, setCurrentBuyer] = useState<BuyerRecord | null>(null);
  const [notes, setNotes] = useState<CustomerNoteRecord[]>([]);
  const [aiSuggestion, setAiSuggestion] = useState<CustomerAiSuggestionRecord | null>(null);
  const [hasNewAiData, setHasNewAiData] = useState(false);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [buyerTours, setBuyerTours] = useState<TourRecord[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Note Input Form State
  const [noteContent, setNoteContent] = useState('');
  const [noteSource, setNoteSource] = useState<CustomerNoteSource>('general');
  const [noteRelatedTourId, setNoteRelatedTourId] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteSaveStatus, setNoteSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [noteErrorMessage, setNoteErrorMessage] = useState<string | null>(null);

  // Note Inline Editing State
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');
  const [editNoteSource, setEditNoteSource] = useState<CustomerNoteSource>('general');
  const [isUpdatingNote, setIsUpdatingNote] = useState(false);

  // Unsaved Note Guard State
  const [pendingBuyerIdChange, setPendingBuyerIdChange] = useState<string | null>(null);
  const [showUnsavedNoteModal, setShowUnsavedNoteModal] = useState(false);

  // Requirement Diff Modal State
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffItems, setDiffItems] = useState<BuyerRequirementDiffItem[]>([]);
  const [isParsingDiff, setIsParsingDiff] = useState(false);
  const [isApplyingDiff, setIsApplyingDiff] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [diffSuccessMsg, setDiffSuccessMsg] = useState<string | null>(null);

  // AI Suggestions Generation State
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Task creation from AI action
  const [convertingTaskTitle, setConvertingTaskTitle] = useState<string | null>(null);
  const [taskConvertedNotice, setTaskConvertedNotice] = useState<string | null>(null);

  // Phone quick edit
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editPhoneValue, setEditPhoneValue] = useState('');

  // Expanded note versions
  const [expandedNoteVersions, setExpandedNoteVersions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (initialBuyerId) {
      setSelectedBuyerId(initialBuyerId);
    }
  }, [initialBuyerId]);

  useEffect(() => {
    if (selectedBuyerId) {
      fetchCustomerDetails(selectedBuyerId);
    } else {
      setCurrentBuyer(null);
      setNotes([]);
      setAiSuggestion(null);
      setTimeline([]);
    }
  }, [selectedBuyerId, token, useSandbox]);

  const fetchCustomerDetails = async (bId: string) => {
    setIsLoadingDetails(true);
    try {
      const [buyerRes, notesRes, aiRes, timelineRes, toursRes] = await Promise.all([
        fetch(`/api/buyers/${bId}`, { headers: getAuthHeaders(token, useSandbox) }),
        fetch(`/api/buyers/${bId}/notes`, { headers: getAuthHeaders(token, useSandbox) }),
        fetch(`/api/buyers/${bId}/ai-suggestions`, { headers: getAuthHeaders(token, useSandbox) }),
        fetch(`/api/buyers/${bId}/timeline`, { headers: getAuthHeaders(token, useSandbox) }),
        fetch(`/api/tours`, { headers: getAuthHeaders(token, useSandbox) }),
      ]);

      if (buyerRes.ok) {
        const bData = await buyerRes.json();
        setCurrentBuyer(bData.buyer);
        setEditPhoneValue(bData.buyer.contactPhone || '');
      }

      if (notesRes.ok) {
        const nData = await notesRes.json();
        setNotes(nData.notes || []);
      }

      if (aiRes.ok) {
        const aData = await aiRes.json();
        setAiSuggestion(aData.suggestion || null);
        setHasNewAiData(Boolean(aData.hasNewData));
      }

      if (timelineRes.ok) {
        const tData = await timelineRes.json();
        setTimeline(tData.timeline || []);
      }

      if (toursRes.ok) {
        const tourData = await toursRes.json();
        const toursList = (tourData.tours || []).filter((t: TourRecord) => t.buyerId === bId);
        setBuyerTours(toursList);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Safe buyer change guard if note input has content
  const requestSelectBuyer = (targetBuyerId: string | null) => {
    if (noteContent.trim()) {
      setPendingBuyerIdChange(targetBuyerId);
      setShowUnsavedNoteModal(true);
    } else {
      setSelectedBuyerId(targetBuyerId);
    }
  };

  // Filtered customer list
  const filteredBuyers = useMemo(() => {
    if (!searchQuery.trim()) return buyers;
    const q = searchQuery.trim().toLowerCase();
    return buyers.filter((b) => {
      const nameMatch = b.name.toLowerCase().includes(q);
      const phoneMatch = b.contactPhone && b.contactPhone.toLowerCase().includes(q);
      const regionMatch = b.currentRequirement?.preferredRegions?.value?.some((r) =>
        r.toLowerCase().includes(q)
      );
      return nameMatch || phoneMatch || regionMatch;
    });
  }, [buyers, searchQuery]);

  // Handle Note Save
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBuyer || !noteContent.trim() || isSavingNote) return;

    setIsSavingNote(true);
    setNoteSaveStatus('idle');
    setNoteErrorMessage(null);

    try {
      const res = await fetch(`/api/buyers/${currentBuyer.id}/notes`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(token, useSandbox),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: noteContent.trim(),
          source: noteSource,
          relatedTourId: noteRelatedTourId || undefined,
          relatedTourTitle: buyerTours.find((t) => t.id === noteRelatedTourId)
            ? `帶看（${buyerTours.find((t) => t.id === noteRelatedTourId)?.properties.map((p) => p.title).join('、')}）`
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setNoteSaveStatus('error');
        setNoteErrorMessage(data.error || '儲存備註失敗，請稍後重試。');
        return;
      }

      setNoteSaveStatus('success');
      setNoteContent('');
      setNoteRelatedTourId('');
      setNotes((prev) => [data.note, ...prev.filter((n) => n.id !== data.note.id)]);
      setHasNewAiData(true);
      onRefreshBuyers();

      setTimeout(() => {
        setNoteSaveStatus('idle');
      }, 3000);
    } catch (err: any) {
      setNoteSaveStatus('error');
      setNoteErrorMessage(`網路連線異常（${err?.message || '未知錯誤'}），輸入內容已保留。`);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Handle Note Update
  const handleUpdateNote = async (noteId: string) => {
    if (!editNoteContent.trim() || isUpdatingNote) return;
    setIsUpdatingNote(true);
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(token, useSandbox),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editNoteContent.trim(),
          source: editNoteSource,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotes((prev) => prev.map((n) => (n.id === noteId ? data.note : n)));
        setEditingNoteId(null);
        setHasNewAiData(true);
      }
    } catch {
      // ignore
    } finally {
      setIsUpdatingNote(false);
    }
  };

  // Handle Soft-Delete Note
  const handleDeleteNote = async (noteId: string) => {
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token, useSandbox),
      });
      const data = await res.json();
      if (res.ok) {
        setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, isDeleted: true } : n)));
      }
    } catch {
      // ignore
    }
  };

  // Handle Restore Note
  const handleRestoreNote = async (noteId: string) => {
    try {
      const res = await fetch(`/api/notes/${noteId}/restore`, {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
      });
      const data = await res.json();
      if (res.ok) {
        setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, isDeleted: false } : n)));
      }
    } catch {
      // ignore
    }
  };

  // Parse Requirement Diff
  const handleOpenRequirementDiff = async (noteId?: string) => {
    if (!currentBuyer) return;
    setIsParsingDiff(true);
    setDiffError(null);
    setDiffSuccessMsg(null);
    setShowDiffModal(true);

    try {
      const res = await fetch(`/api/buyers/${currentBuyer.id}/parse-requirement-diff`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(token, useSandbox),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ noteId }),
      });
      const data = await res.json();
      if (res.ok) {
        setDiffItems(data.diffItems || []);
      } else {
        setDiffError(data.error || '分析備註變更失敗');
      }
    } catch (err: any) {
      setDiffError(err?.message || '網路異常無法分析');
    } finally {
      setIsParsingDiff(false);
    }
  };

  // Apply Requirement Diff
  const handleApplyRequirementDiff = async () => {
    if (!currentBuyer || isApplyingDiff) return;
    const acceptedItems = diffItems.filter((d) => d.accepted);
    if (acceptedItems.length === 0) {
      setDiffError('請至少勾選一項欲套用之變更');
      return;
    }

    setIsApplyingDiff(true);
    setDiffError(null);
    try {
      const res = await fetch(`/api/buyers/${currentBuyer.id}/apply-requirement-diff`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(token, useSandbox),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ diffItems: acceptedItems }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentBuyer(data.buyer);
        setDiffSuccessMsg(data.message || '已成功套用需求變更！');
        onRefreshBuyers();
        setTimeout(() => {
          setShowDiffModal(false);
        }, 1800);
      } else {
        setDiffError(data.error || '套用需求變更失敗');
      }
    } catch (err: any) {
      setDiffError(err?.message || '套用時網路異常');
    } finally {
      setIsApplyingDiff(false);
    }
  };

  // Generate / Refresh AI Suggestions
  const handleGenerateAiSuggestions = async () => {
    if (!currentBuyer || isGeneratingAi) return;
    setIsGeneratingAi(true);
    setAiError(null);

    try {
      const res = await fetch(`/api/buyers/${currentBuyer.id}/ai-suggestions/generate`, {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
      });
      const data = await res.json();
      if (res.ok) {
        setAiSuggestion(data.suggestion);
        setHasNewAiData(false);
      } else {
        setAiError(data.error || 'AI 建議生成失敗，請稍後重試。');
      }
    } catch (err: any) {
      setAiError(err?.message || '連線逾時，AI 服務暫不可用。');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Convert Action into Tour Task
  const handleConvertActionToTask = async (action: any) => {
    if (!currentBuyer) return;
    setConvertingTaskTitle(action.title);
    setTaskConvertedNotice(null);
    try {
      const res = await fetch('/api/tour-tasks', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(token, useSandbox),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buyerId: currentBuyer.id,
          buyerName: currentBuyer.name,
          title: action.draftTaskTitle || action.title,
          details: `由 AI 客戶服務建議轉入：${action.detail}`,
          priority: 'medium',
        }),
      });
      if (res.ok) {
        setTaskConvertedNotice(`已將「${action.title}」成功建立為待辦事項！`);
        setTimeout(() => setTaskConvertedNotice(null), 3000);
      }
    } catch {
      // ignore
    } finally {
      setConvertingTaskTitle(null);
    }
  };

  // Update Contact Phone
  const handleSavePhone = async () => {
    if (!currentBuyer) return;
    try {
      const res = await fetch(`/api/buyers/${currentBuyer.id}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(token, useSandbox),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactPhone: editPhoneValue.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentBuyer(data.buyer);
        setIsEditingPhone(false);
        onRefreshBuyers();
      }
    } catch {
      // ignore
    }
  };

  // Quick Manual Create Customer
  const handleQuickCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || isCreatingCustomer) return;
    setIsCreatingCustomer(true);
    setCreateCustomerError(null);

    try {
      const res = await fetch('/api/buyers', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(token, useSandbox),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newCustName.trim(),
          contactPhone: newCustPhone.trim(),
          notes: newCustNotes.trim(),
          currentRequirement: {
            buyerName: { value: newCustName.trim(), sourceQuote: '手動建檔', confidence: 'explicit' },
            contactPhone: { value: newCustPhone.trim(), sourceQuote: '手動建檔', confidence: 'explicit' },
            purchasePurpose: { value: '自住', sourceQuote: '手動建檔', confidence: 'explicit' },
            preferredRegions: { value: ['新竹縣竹北市'], sourceQuote: '手動建檔', confidence: 'explicit' },
            budget: {
              minWan: null,
              maxWan: newCustBudget ? parseInt(newCustBudget, 10) : 2000,
              includesParking: 'yes',
              unit: '萬元',
              sourceQuote: '手動建檔',
              confidence: 'explicit',
            },
            roomsAndType: {
              minRooms: parseInt(newCustRooms, 10) || 3,
              preferredRooms: parseInt(newCustRooms, 10) || 3,
              propertyTypes: ['大樓'],
              sourceQuote: '手動建檔',
              confidence: 'explicit',
            },
            parking: { needParking: 'required', parkingTypes: ['坡道平面'], minSpaces: 1, sourceQuote: '手動建檔', confidence: 'explicit' },
            elevator: { needElevator: 'required', sourceQuote: '手動建檔', confidence: 'explicit' },
            propertyAge: { maxAgeYears: 15, conditionType: 'preferred', sourceQuote: '手動建檔', confidence: 'explicit' },
            commuteTarget: { value: '竹北生活圈', sourceQuote: '手動建檔', confidence: 'explicit' },
            schoolDistrict: { value: '', sourceQuote: '', confidence: 'missing' },
            familyAndLifestyle: { value: newCustNotes.trim() || '自住家庭', sourceQuote: '手動建檔', confidence: 'explicit' },
            timeline: { value: '三個月內', sourceQuote: '手動建檔', confidence: 'explicit' },
            mustHaves: [],
            niceToHaves: [],
            dealBreakers: [],
            followUpQuestions: [],
            ambiguityAlerts: [],
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateCustomerError(data.error || '建立客戶失敗');
        return;
      }

      setShowAddCustomerModal(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustBudget('');
      setNewCustNotes('');
      onRefreshBuyers();
      setSelectedBuyerId(data.buyer.id);
    } catch (err: any) {
      setCreateCustomerError(err?.message || '連線錯誤');
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const getSourceBadge = (source: CustomerNoteSource) => {
    switch (source) {
      case 'client_quote':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            客戶原話
          </span>
        );
      case 'agent_observation':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            業務觀察（非明確要求）
          </span>
        );
      case 'phone':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
            電話紀錄
          </span>
        );
      case 'line':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
            LINE 補充
          </span>
        );
      case 'tour':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
            帶看補充
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            一般備註
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* SECTION 1: HEADER & ACTION ENTRY */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">客戶管理</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200">
              共 {buyers.length} 位客戶
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            日常查看客戶資料、時間軸備註、追蹤紀錄與 AI 建議；需要找物件時再進配案中心。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onStartVoiceIntake}
            className="min-h-[44px] px-4 py-2 bg-gradient-to-r from-teal-700 to-cyan-800 hover:from-teal-600 hover:to-cyan-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-cyan-300" />
            <span>新增接待（需求整理）</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddCustomerModal(true)}
            className="min-h-[44px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>手動建檔客戶</span>
          </button>
        </div>
      </div>

      {/* DETAIL OR LIST VIEW */}
      {!selectedBuyerId || !currentBuyer ? (
        /* ==================== CUSTOMER LIST VIEW ==================== */
        <div className="space-y-4">
          {/* Search bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="以客戶姓名／稱呼或電話號碼搜尋..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm outline-none text-slate-800 placeholder-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                清除
              </button>
            )}
          </div>

          {filteredBuyers.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
              <User className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-base font-bold text-slate-800">
                {searchQuery ? '找不到符合搜尋條件的客戶' : '目前尚無經紀人客戶資料'}
              </p>
              <p className="text-xs text-slate-500">
                可點擊上方「手動建檔客戶」或「新增接待（需求整理）」建立首位買方。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBuyers.map((b) => {
                const req = b.currentRequirement;
                const budgetText = req.budget.maxWan !== null
                  ? `${req.budget.maxWan} 萬 (${req.budget.includesParking === 'yes' ? '含車位' : req.budget.includesParking === 'no' ? '不含車位' : '車位待定'})`
                  : '尚未提供預算';
                const roomText = req.roomsAndType.minRooms !== null ? `${req.roomsAndType.minRooms} 房以上` : '房數尚未指定';
                const regionText = (req.preferredRegions?.value || []).length > 0 ? (req.preferredRegions?.value || []).join('、') : '區域尚未指定';

                return (
                  <div
                    key={b.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-slate-300 shadow-xs flex flex-col justify-between space-y-4 transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                            <User className="w-4 h-4 text-cyan-700 shrink-0" />
                            <span>{b.name}</span>
                          </h3>
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{b.contactPhone || '尚未提供電話'}</span>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {b.requirementVersion ? `需求 v${b.requirementVersion}` : '已建檔'}
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-700 border border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">預算：</span>
                          <span className="font-bold text-slate-900 font-mono tabular-nums">{budgetText}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">房數：</span>
                          <span className="font-semibold">{roomText}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">區域：</span>
                          <span className="font-semibold truncate max-w-[150px]">{regionText}</span>
                        </div>
                      </div>

                      {/* Note Count & Latest Note Preview */}
                      <div className="text-xs text-slate-600 bg-cyan-50/50 p-2.5 rounded-xl border border-cyan-100/60 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-cyan-900">
                          <span>備註紀錄 ({b.noteCount ?? 0} 筆)</span>
                          {b.latestNoteTime && (
                            <span className="text-slate-400 font-normal">
                              {formatTaipeiTime(b.latestNoteTime)}
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-[11px] text-slate-600">
                          {b.latestNoteSummary || '尚無追加備註'}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBuyerId(b.id);
                          setActiveTab('notes');
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        + 備註
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onNavigateToMatching(b.id)}
                          className="px-3 py-1.5 bg-white hover:bg-cyan-50 text-cyan-800 border border-cyan-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          前往配案
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBuyerId(b.id);
                            setActiveTab('info');
                          }}
                          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          查看客戶
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ==================== CUSTOMER DETAIL VIEW ==================== */
        <div className="space-y-5">
          {/* Detail Header */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => requestSelectBuyer(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  ← 返回客戶列表
                </button>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <span>{currentBuyer.name}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      需求版本 v{currentBuyer.requirementVersion || 1}
                    </span>
                  </h2>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                    <div className="flex items-center gap-1 font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {isEditingPhone ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editPhoneValue}
                            onChange={(e) => setEditPhoneValue(e.target.value)}
                            className="px-1.5 py-0.5 border border-cyan-400 rounded text-xs outline-none"
                            placeholder="電話號碼"
                          />
                          <button
                            type="button"
                            onClick={handleSavePhone}
                            className="px-2 py-0.5 bg-cyan-600 text-white rounded text-[11px] font-bold"
                          >
                            儲存
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingPhone(false)}
                            className="px-1.5 py-0.5 text-slate-400 text-[11px]"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <span className="flex items-center gap-1">
                          {currentBuyer.contactPhone || '尚未提供電話'}
                          <button
                            type="button"
                            onClick={() => setIsEditingPhone(true)}
                            className="text-cyan-700 hover:underline text-[11px]"
                          >
                            修改電話
                          </button>
                        </span>
                      )}
                    </div>
                    <span>·</span>
                    <span className="font-mono tabular-nums">
                      建檔時間：{formatTaipeiTime(currentBuyer.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Secondary Go To Matching */}
              <div className="flex items-center gap-2 flex-wrap">
                {onOpenAssistantForBuyer && (
                  <button
                    type="button"
                    onClick={() => onOpenAssistantForBuyer(currentBuyer.id)}
                    className="min-h-[40px] px-3.5 py-2 bg-gradient-to-r from-slate-900 to-indigo-950 text-cyan-300 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>問助理</span>
                  </button>
                )}

                {onStartLineAnalysisForBuyer && (
                  <button
                    type="button"
                    onClick={() => onStartLineAnalysisForBuyer(currentBuyer.id)}
                    className="min-h-[40px] px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>分析 LINE 對話</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onNavigateToMatching(currentBuyer.id)}
                  className="min-h-[40px] px-4 py-2 bg-white hover:bg-cyan-50 text-cyan-900 border border-cyan-400 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <span>前往配案中心</span>
                  <ArrowRight className="w-4 h-4 text-cyan-600" />
                </button>
              </div>
            </div>

            {/* Missing Critical Data Alert */}
            {currentBuyer.missingCriticalFields && currentBuyer.missingCriticalFields.length > 0 && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">尚缺關鍵條件：</span>
                  {currentBuyer.missingCriticalFields.join('、')}。
                  <span className="text-amber-800 ml-1">
                    可在下方「客戶資料與需求」手動補充，或於「客戶備註」記錄後整理為需求變更建議。
                  </span>
                </div>
              </div>
            )}

            {/* Four Tabs Navigation */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('info')}
                className={`px-4 py-2 text-xs font-bold rounded-lg min-h-[38px] transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'info' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. 客戶資料與需求
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('notes')}
                className={`px-4 py-2 text-xs font-bold rounded-lg min-h-[38px] transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'notes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>2. 客戶備註</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-100 text-cyan-900">
                  {notes.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ai')}
                className={`px-4 py-2 text-xs font-bold rounded-lg min-h-[38px] transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'ai' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>3. AI建議</span>
                {hasNewAiData && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="有新資料建議更新" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`px-4 py-2 text-xs font-bold rounded-lg min-h-[38px] transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'timeline' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>4. 追蹤紀錄</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                  {timeline.length}
                </span>
              </button>
            </div>
          </div>

          {/* TAB 1: CUSTOMER INFO & STRUCTURED REQUIREMENTS */}
          {activeTab === 'info' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900">已確認購屋需求資料</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    結構化條件核對 · 需求版本 v{currentBuyer.requirementVersion || 1} · 最後更新：
                    {formatTaipeiTime(currentBuyer.requirementUpdatedAt || currentBuyer.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenRequirementDiff()}
                    className="min-h-[36px] px-3.5 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-300 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                    <span>整理備註為需求變更建議</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {[
                  {
                    label: '總價預算上限（萬元）',
                    val: currentBuyer.currentRequirement.budget.maxWan !== null
                      ? `${currentBuyer.currentRequirement.budget.minWan ?? 0} ~ ${currentBuyer.currentRequirement.budget.maxWan} 萬元（${
                          currentBuyer.currentRequirement.budget.includesParking === 'yes'
                            ? '含車位'
                            : currentBuyer.currentRequirement.budget.includesParking === 'no'
                            ? '不含車位'
                            : '未指定是否含車位'
                        }）`
                      : '尚未提供',
                    quote: currentBuyer.currentRequirement.budget.sourceQuote,
                    conf: currentBuyer.currentRequirement.budget.confidence,
                  },
                  {
                    label: '房型與房間數',
                    val: `必要底線：${currentBuyer.currentRequirement.roomsAndType.minRooms ?? '未指定'} 房 · 理想偏好：${
                      currentBuyer.currentRequirement.roomsAndType.preferredRooms ?? '未指定'
                    } 房`,
                    quote: currentBuyer.currentRequirement.roomsAndType.sourceQuote,
                    conf: currentBuyer.currentRequirement.roomsAndType.confidence,
                  },
                  {
                    label: '車位需求與型式',
                    val: currentBuyer.currentRequirement.parking.needParking === 'required'
                      ? `必備車位（${(currentBuyer.currentRequirement.parking.parkingTypes || []).join('、') || '型式不限'}）`
                      : currentBuyer.currentRequirement.parking.needParking === 'preferred'
                      ? '偏好車位'
                      : '尚未提供',
                    quote: currentBuyer.currentRequirement.parking.sourceQuote,
                    conf: currentBuyer.currentRequirement.parking.confidence,
                  },
                  {
                    label: '電梯需求',
                    val: currentBuyer.currentRequirement.elevator.needElevator === 'required'
                      ? '一定要有電梯（必要條件）'
                      : currentBuyer.currentRequirement.elevator.needElevator === 'preferred'
                      ? '偏好電梯'
                      : '尚未提供',
                    quote: currentBuyer.currentRequirement.elevator.sourceQuote,
                    conf: currentBuyer.currentRequirement.elevator.confidence,
                  },
                  {
                    label: '希望區域',
                    val: (currentBuyer.currentRequirement.preferredRegions?.value || []).length > 0
                      ? (currentBuyer.currentRequirement.preferredRegions?.value || []).join('、')
                      : '尚未提供',
                    quote: currentBuyer.currentRequirement.preferredRegions.sourceQuote,
                    conf: currentBuyer.currentRequirement.preferredRegions.confidence,
                  },
                  {
                    label: '屋齡限制',
                    val: currentBuyer.currentRequirement.propertyAge.maxAgeYears !== null
                      ? `${currentBuyer.currentRequirement.propertyAge.maxAgeYears} 年內`
                      : '尚未提供',
                    quote: currentBuyer.currentRequirement.propertyAge.sourceQuote,
                    conf: currentBuyer.currentRequirement.propertyAge.confidence,
                  },
                  {
                    label: '購屋目的',
                    val: currentBuyer.currentRequirement.purchasePurpose.value || '尚未提供',
                    quote: currentBuyer.currentRequirement.purchasePurpose.sourceQuote,
                    conf: currentBuyer.currentRequirement.purchasePurpose.confidence,
                  },
                  {
                    label: '通勤目標',
                    val: currentBuyer.currentRequirement.commuteTarget.value || '尚未提供',
                    quote: currentBuyer.currentRequirement.commuteTarget.sourceQuote,
                    conf: currentBuyer.currentRequirement.commuteTarget.confidence,
                  },
                  {
                    label: '家庭成員與生活型態',
                    val: currentBuyer.currentRequirement.familyAndLifestyle.value || '尚未提供',
                    quote: currentBuyer.currentRequirement.familyAndLifestyle.sourceQuote,
                    conf: currentBuyer.currentRequirement.familyAndLifestyle.confidence,
                  },
                  {
                    label: '預計購屋時間',
                    val: currentBuyer.currentRequirement.timeline.value || '尚未提供',
                    quote: currentBuyer.currentRequirement.timeline.sourceQuote,
                    conf: currentBuyer.currentRequirement.timeline.confidence,
                  },
                ].map((row, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">{row.label}</span>
                      <span className="text-[11px] text-slate-500">{formatConfidenceLabel(row.conf)}</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">{row.val}</div>
                    {row.quote && (
                      <div className="text-[11px] text-slate-500">
                        來源依據：「{row.quote}」
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Deal Breakers & Must Haves */}
              {currentBuyer.currentRequirement.dealBreakers && currentBuyer.currentRequirement.dealBreakers.length > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1.5">
                  <div className="font-bold text-rose-900 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>排除條件（絕對不考慮）</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-rose-800">
                    {currentBuyer.currentRequirement.dealBreakers.map((db) => (
                      <li key={db.id}>
                        {db.description} {db.sourceQuote ? `（來源：「${db.sourceQuote}」）` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CUSTOMER NOTES (CORE FEATURE) */}
          {activeTab === 'notes' && (
            <div className="space-y-6">
              {/* Note Input Box */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4 text-cyan-700" />
                    <span>新增客戶時間軸備註</span>
                  </h3>
                  <span className="text-xs text-slate-400">
                    支援多行文字與手機語音轉文字（不錄音、不上傳音訊）
                  </span>
                </div>

                <form onSubmit={handleSaveNote} className="space-y-3">
                  <textarea
                    rows={4}
                    placeholder="輸入客戶最新通話內容、原話紀錄、業務觀察或現場補充...（例：客戶剛說含車位最多1500萬，不考慮機械車位）"
                    value={noteContent}
                    onChange={(e) => {
                      setNoteContent(e.target.value);
                      if (noteSaveStatus !== 'idle') setNoteSaveStatus('idle');
                    }}
                    className="w-full p-3.5 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 leading-relaxed"
                  />

                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-slate-500 font-semibold">來源類別：</span>
                      {[
                        { key: 'general', label: '一般備註' },
                        { key: 'client_quote', label: '客戶原話' },
                        { key: 'phone', label: '電話紀錄' },
                        { key: 'line', label: 'LINE補充' },
                        { key: 'tour', label: '帶看補充' },
                        { key: 'agent_observation', label: '業務觀察' },
                      ].map((src) => (
                        <button
                          key={src.key}
                          type="button"
                          onClick={() => setNoteSource(src.key as CustomerNoteSource)}
                          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                            noteSource === src.key
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {src.label}
                        </button>
                      ))}

                      {buyerTours.length > 0 && (
                        <select
                          value={noteRelatedTourId}
                          onChange={(e) => setNoteRelatedTourId(e.target.value)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs"
                        >
                          <option value="">關聯帶看紀錄（選填）</option>
                          {buyerTours.map((t) => (
                            <option key={t.id} value={t.id}>
                              {formatTaipeiTime(t.startedAt)} - {t.properties.map((p) => p.title).join('、')}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {noteSaveStatus === 'success' && (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          已成功保存
                        </span>
                      )}
                      {noteSaveStatus === 'error' && (
                        <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {noteErrorMessage || '保存失敗'}
                        </span>
                      )}

                      <button
                        type="submit"
                        disabled={!noteContent.trim() || isSavingNote}
                        className="min-h-[40px] px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>{isSavingNote ? '儲存中...' : '確認保存備註'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Note Timeline List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>備註歷史時間軸</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      共 {notes.length} 筆
                    </span>
                  </h4>
                  <span className="text-xs text-slate-400">依新到舊排列 · 每筆獨立儲存不覆蓋</span>
                </div>

                {notes.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-xs text-slate-500">
                    尚無備註紀錄，請在上方新增第一筆備註。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note) => {
                      const isDeleted = note.isDeleted;
                      const isEditing = editingNoteId === note.id;

                      return (
                        <div
                          key={note.id}
                          className={`bg-white rounded-2xl p-5 border transition-all ${
                            isDeleted
                              ? 'border-slate-200 bg-slate-50/70 opacity-60'
                              : 'border-slate-200 hover:border-slate-300 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-100">
                            <div className="flex items-center gap-2 flex-wrap">
                              {getSourceBadge(note.source)}
                              <span className="text-xs font-bold text-slate-900">{note.authorName}</span>
                              <span className="text-xs text-slate-400 font-mono tabular-nums">
                                {formatTaipeiTime(note.createdAt)}
                              </span>
                              {note.version > 1 && (
                                <span className="text-[11px] text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">
                                  修訂版 v{note.version}（更新於 {formatTaipeiTime(note.updatedAt)}）
                                </span>
                              )}
                              {isDeleted && (
                                <span className="text-[11px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                  已軟刪除
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {!isDeleted && !isEditing && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRequirementDiff(note.id)}
                                    className="px-2.5 py-1 text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                                    title="分析此筆備註是否有條件變更"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>整理為需求變更建議</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingNoteId(note.id);
                                      setEditNoteContent(note.content);
                                      setEditNoteSource(note.source);
                                    }}
                                    className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg text-xs"
                                    title="編輯備註"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteNote(note.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg text-xs"
                                    title="軟刪除備註"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              {isDeleted && (
                                <button
                                  type="button"
                                  onClick={() => handleRestoreNote(note.id)}
                                  className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>復原此備註</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Content or Edit Form */}
                          {isEditing ? (
                            <div className="pt-3 space-y-3">
                              <textarea
                                rows={3}
                                value={editNoteContent}
                                onChange={(e) => setEditNoteContent(e.target.value)}
                                className="w-full p-3 border border-cyan-400 rounded-xl text-xs text-slate-900 focus:outline-none"
                              />
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-xs">
                                  <span className="text-slate-500">來源：</span>
                                  {(['general', 'client_quote', 'phone', 'line', 'tour', 'agent_observation'] as CustomerNoteSource[]).map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={() => setEditNoteSource(s)}
                                      className={`px-2 py-0.5 rounded text-[11px] ${
                                        editNoteSource === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      {s}
                                    </button>
                                  ))}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingNoteId(null)}
                                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs"
                                  >
                                    取消
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateNote(note.id)}
                                    disabled={isUpdatingNote}
                                    className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold"
                                  >
                                    {isUpdatingNote ? '保存中...' : '確認修改'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="pt-3">
                              <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                                {note.content}
                              </p>

                              {note.relatedTourTitle && (
                                <div className="mt-2 text-[11px] text-purple-700 bg-purple-50 px-2 py-1 rounded inline-block">
                                  關聯帶看：{note.relatedTourTitle}
                                </div>
                              )}

                              {/* Version History Toggle */}
                              {note.versionHistory && note.versionHistory.length > 0 && (
                                <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedNoteVersions((prev) => ({
                                        ...prev,
                                        [note.id]: !prev[note.id],
                                      }))
                                    }
                                    className="text-slate-500 hover:text-slate-700 flex items-center gap-1 font-semibold cursor-pointer"
                                  >
                                    <History className="w-3.5 h-3.5" />
                                    <span>
                                      查看 {note.versionHistory.length} 次歷史修訂紀錄
                                    </span>
                                    {expandedNoteVersions[note.id] ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  {expandedNoteVersions[note.id] && (
                                    <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-slate-200 text-slate-600">
                                      {note.versionHistory.map((vh, vIdx) => (
                                        <div key={vIdx} className="space-y-0.5">
                                          <div className="text-[10px] text-slate-400 font-mono">
                                            修訂時間：{formatTaipeiTime(vh.updatedAt)}（修訂人：{vh.updatedBy}）
                                          </div>
                                          <div className="p-2 bg-slate-50 rounded border border-slate-100 text-[11px]">
                                            {vh.content}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: AI SUGGESTIONS (CUSTOMER SERVICE & FOLLOW-UP) */}
          {activeTab === 'ai' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-cyan-600" />
                      <span>AI 客戶服務與追蹤建議</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      針對缺漏條件、衝突提醒與服務溝通提出建議 · 點擊按鈕才呼叫 AI
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateAiSuggestions}
                    disabled={isGeneratingAi}
                    className="min-h-[40px] px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isGeneratingAi ? '正在生成建議...' : aiSuggestion ? '更新 AI 建議' : '產生 AI 建議'}</span>
                  </button>
                </div>

                {hasNewAiData && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                    <span className="font-semibold">
                      偵測到客戶資料或備註已有新異動，建議點擊右上方「更新 AI 建議」重新取得最新分析。
                    </span>
                  </div>
                )}

                {aiError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                    <div className="font-bold">生成失敗：</div>
                    <p>{aiError}</p>
                  </div>
                )}

                {taskConvertedNotice && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-bold">
                    {taskConvertedNotice}
                  </div>
                )}
              </div>

              {!aiSuggestion ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 space-y-3">
                  <Sparkles className="w-8 h-8 text-cyan-600 mx-auto opacity-75" />
                  <p className="text-base font-bold text-slate-800">尚未產生 AI 服務與溝通建議</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    AI 將依據已確認條件、備註原話與歷史帶看紀錄，為您梳理待追問缺漏、衝突與後續行動。
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateAiSuggestions}
                    disabled={isGeneratingAi}
                    className="mx-auto min-h-[40px] px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    {isGeneratingAi ? '分析中...' : '立即產生 AI 建議'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-xs text-slate-400 font-mono text-right">
                    建議生成時間：{formatTaipeiTime(aiSuggestion.generatedAt)}
                  </div>

                  {/* 1. Missing Items & Conflicts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Missing Items */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4 text-amber-600" />
                        <span>需求缺漏與待追問事項</span>
                      </h4>
                      {aiSuggestion.missingRequirements.length === 0 ? (
                        <p className="text-xs text-slate-400">目前主要需求條件皆已齊全</p>
                      ) : (
                        <div className="space-y-2">
                          {aiSuggestion.missingRequirements.map((m, idx) => (
                            <div key={idx} className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/60 text-xs space-y-1">
                              <div className="font-bold text-amber-950">{m.item}</div>
                              <p className="text-amber-900">{m.reason}</p>
                              {m.sourceQuoteOrBasis && (
                                <div className="text-[11px] text-amber-700">依據：{m.sourceQuoteOrBasis}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Conflicts */}
                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>需求衝突與矛盾提示</span>
                      </h4>
                      {aiSuggestion.conflicts.length === 0 ? (
                        <p className="text-xs text-slate-400">目前無明顯矛盾條件</p>
                      ) : (
                        <div className="space-y-2">
                          {aiSuggestion.conflicts.map((c, idx) => (
                            <div key={idx} className="p-3 bg-rose-50/70 rounded-xl border border-rose-200/60 text-xs space-y-1">
                              <div className="font-bold text-rose-950">{c.field}</div>
                              <p className="text-rose-900">{c.description}</p>
                              {c.sourceQuoteOrBasis && (
                                <div className="text-[11px] text-rose-700">依據：{c.sourceQuoteOrBasis}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Action Suggestions (Convertible to tasks) */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <ArrowRight className="w-4 h-4 text-cyan-700" />
                      <span>建議後續行動（可一鍵建立待辦事項）</span>
                    </h4>
                    {aiSuggestion.actionSuggestions.length === 0 ? (
                      <p className="text-xs text-slate-400">目前尚無特定行動建議</p>
                    ) : (
                      <div className="space-y-2.5">
                        {aiSuggestion.actionSuggestions.map((act, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1">
                              <div className="font-bold text-slate-900">{act.title}</div>
                              <p className="text-slate-600 leading-relaxed">{act.detail}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleConvertActionToTask(act)}
                              disabled={convertingTaskTitle === act.title}
                              className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg font-bold shrink-0 text-xs cursor-pointer disabled:opacity-50"
                            >
                              {convertingTaskTitle === act.title ? '建立中...' : '+ 轉為待辦'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. Communication Tips */}
                  {aiSuggestion.communicationTips.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2 text-xs">
                      <h4 className="font-bold text-slate-900">經紀人服務與溝通叮嚀</h4>
                      <ul className="list-disc pl-5 space-y-1 text-slate-700">
                        {aiSuggestion.communicationTips.map((tip, idx) => (
                          <li key={idx}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TRACKING TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-cyan-700" />
                  <span>客戶互動追蹤時間軸</span>
                </h3>
                <span className="text-xs text-slate-400">
                  接待、實地帶看、電話追蹤與待辦事項
                </span>
              </div>

              {timeline.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">目前尚無互動紀錄</p>
              ) : (
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200">
                  {timeline.map((item, idx) => (
                    <div key={idx} className="relative pl-8 text-xs space-y-1">
                      <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-cyan-700 border-2 border-white" />
                      <div className="flex items-center justify-between flex-wrap text-slate-500 font-mono">
                        <span className="font-bold text-slate-900 text-xs">{item.title}</span>
                        <span>{formatTaipeiTime(item.timestamp)}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-700">
                        {item.summary}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: REQUIREMENT DIFF MODAL (整理為需求變更建議) */}
      {showDiffModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-600" />
                  <span>整理備註為購屋需求變更建議</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  逐項勾選欲變更項目，確認後才更新結構化需求；舊有配案結果將標記為需重新配案。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDiffModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isParsingDiff ? (
              <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                <Sparkles className="w-6 h-6 text-cyan-600 mx-auto animate-spin" />
                <p className="font-bold">正在比對客戶備註與目前需求差異...</p>
              </div>
            ) : diffItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="font-bold text-slate-800">未在備註中偵測到具體的購屋條件變更</p>
                <p>純業務觀察或日常閒聊不會轉為硬性必要條件。</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                        <th className="p-2.5 font-bold">採用</th>
                        <th className="p-2.5 font-bold">欄位</th>
                        <th className="p-2.5 font-bold">原值</th>
                        <th className="p-2.5 font-bold">建議新值</th>
                        <th className="p-2.5 font-bold">來源原句</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {diffItems.map((item, idx) => (
                        <tr key={idx} className={item.accepted ? 'bg-cyan-50/30' : 'bg-white'}>
                          <td className="p-2.5">
                            <input
                              type="checkbox"
                              checked={item.accepted}
                              onChange={(e) => {
                                const next = [...diffItems];
                                next[idx].accepted = e.target.checked;
                                setDiffItems(next);
                              }}
                              className="w-4 h-4 rounded text-cyan-700"
                            />
                          </td>
                          <td className="p-2.5 font-bold text-slate-900">{item.fieldLabel}</td>
                          <td className="p-2.5 text-slate-500">{item.currentValueDisplay}</td>
                          <td className="p-2.5 font-bold text-cyan-900">{item.proposedValueDisplay}</td>
                          <td className="p-2.5 text-[11px] text-slate-500 max-w-[180px] truncate" title={item.sourceQuote}>
                            {item.sourceQuote}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {diffError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
                    {diffError}
                  </div>
                )}
                {diffSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
                    {diffSuccessMsg}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowDiffModal(false)}
                    className="min-h-[40px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyRequirementDiff}
                    disabled={isApplyingDiff}
                    className="min-h-[40px] px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isApplyingDiff ? '套用中...' : '確認更新購屋需求'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: UNSAVED NOTE PROMPT */}
      {showUnsavedNoteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 border border-slate-200 shadow-xl">
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>有未保存的備註文字</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              您輸入的備註內容尚未保存，切換客戶或切頁將會遺失內容。請問要放棄還是返回保存？
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setNoteContent('');
                  setShowUnsavedNoteModal(false);
                  setSelectedBuyerId(pendingBuyerIdChange);
                  setPendingBuyerIdChange(null);
                }}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold"
              >
                放棄未存備註
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedNoteModal(false);
                  setPendingBuyerIdChange(null);
                }}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold"
              >
                返回儲存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MANUAL ADD CUSTOMER */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">手動建立客戶資料</h3>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateCustomer} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  客戶姓名／稱呼 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="如：林先生、張小姐"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">聯絡電話</label>
                <input
                  type="text"
                  placeholder="如：0912-345-678"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">總價預算上限（萬元）</label>
                  <input
                    type="number"
                    placeholder="如：2000"
                    value={newCustBudget}
                    onChange={(e) => setNewCustBudget(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">房間數底線</label>
                  <select
                    value={newCustRooms}
                    onChange={(e) => setNewCustRooms(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="1">1 房</option>
                    <option value="2">2 房</option>
                    <option value="3">3 房</option>
                    <option value="4">4 房以上</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">初次建檔備註（選填）</label>
                <textarea
                  rows={2}
                  placeholder="如：目前夫妻住新竹，換屋竹北自住"
                  value={newCustNotes}
                  onChange={(e) => setNewCustNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {createCustomerError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold">
                  {createCustomerError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!newCustName.trim() || isCreatingCustomer}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold disabled:opacity-50"
                >
                  {isCreatingCustomer ? '建立中...' : '確認建立客戶'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
