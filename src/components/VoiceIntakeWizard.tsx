import React, { useState } from 'react';
import {
  FileText,
  AlertTriangle,
  UserPlus,
  UserCheck,
  ArrowRight,
  Plus,
  Trash2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Save,
  Sparkles,
  HelpCircle,
  Clock,
  Mic,
  RotateCcw,
} from 'lucide-react';
import {
  BuyerRecord,
  BuyerRequirement,
  ConfidenceStatus,
  IntakeSessionRecord,
  ConditionItem,
} from '../types';
import { formatConfidenceLabel, getAuthHeaders } from '../utils';
import { UnifiedTextInputWorkbench, TextInputMethod } from './UnifiedTextInputWorkbench';

interface VoiceIntakeWizardProps {
  token: string | null;
  useSandbox: boolean;
  buyers: BuyerRecord[];
  preselectedBuyerId?: string | null;
  onConfirmedAndSaved: (buyer: BuyerRecord, session: IntakeSessionRecord, goToMatch: boolean) => void;
  onCancel: () => void;
}

const DEMO_SCENARIOS = [
  {
    id: 'case1',
    title: '情境 1：竹科鄭先生（驗證不從年薪推算預算、追問學區與時間）',
    text: '鄭先生從台北搬到新竹，在竹科上班，年薪約三百萬，太太沒有上班，有一個小一孩子，希望高鐵附近三房車位。',
  },
  {
    id: 'case2',
    title: '情境 2：三房與四房偏好區分（驗證四房列偏好、電梯列必要）',
    text: '三房就可以，最好四房，但一定要有電梯。',
  },
  {
    id: 'case7',
    title: '情境 7：既有客戶需求變更（建議搭配「林小姐」測試差異比對）',
    text: '林小姐今天補充說，最好有四房空間比較夠，預算看能不能調整到 3600 萬以內，不過原本一定要有電梯跟坡道平面車位的條件不變。',
  },
];

export const VoiceIntakeWizard: React.FC<VoiceIntakeWizardProps> = ({
  token,
  useSandbox,
  buyers,
  preselectedBuyerId,
  onConfirmedAndSaved,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [targetMode, setTargetMode] = useState<'new' | 'existing'>(preselectedBuyerId ? 'existing' : 'new');
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>(preselectedBuyerId || (buyers[0]?.id ?? ''));

  const [textInput, setTextInput] = useState<string>('');
  const [inputMethod, setInputMethod] = useState<TextInputMethod>('text');

  // Realistic Processing Status
  const [processStatus, setProcessStatus] = useState<'idle' | 'recording' | 'transcribing' | 'analyzing' | 'completed' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [rawTranscript, setRawTranscript] = useState<string>('');
  const [aiDraft, setAiDraft] = useState<BuyerRequirement | null>(null);
  const [editableDraft, setEditableDraft] = useState<BuyerRequirement | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Collapsible section for client personal details
  const [showPersonalDetails, setShowPersonalDetails] = useState(false);

  const existingBuyer = targetMode === 'existing' ? buyers.find((b) => b.id === selectedBuyerId) || null : null;
  const [keepOriginalMustHaves, setKeepOriginalMustHaves] = useState<boolean>(true);
  const [fieldAdoptChoices, setFieldAdoptChoices] = useState<Record<string, 'new' | 'old'>>({
    budget: 'new',
    preferredRegions: 'new',
    roomsAndType: 'new',
    parking: 'new',
    elevator: 'new',
    propertyAge: 'new',
  });

  // Warn on leave when unsaved
  const handleSafeCancel = () => {
    if (textInput.trim() && !isSaving && currentStep !== 3) {
      if (!window.confirm('您有尚未保存的接待內容，確定要離開嗎？未保存的輸入內容將遺失。')) {
        return;
      }
    }
    onCancel();
  };

  // Path 1: AI Extract Requirements
  const handleAnalyzeSubmit = async () => {
    setAnalyzeError(null);
    if (!navigator.onLine) {
      setAnalyzeError('目前網路連線中斷，系統已完整保留您的輸入內容，請待網路恢復後重試。');
      setProcessStatus('error');
      return;
    }

    if (!textInput.trim()) {
      setAnalyzeError('請先輸入或語音填入客戶接待原話。');
      setProcessStatus('error');
      return;
    }

    setProcessStatus('analyzing');
    setStatusMessage('AI 正在依據原話整理結構化買方需求草稿...');
    try {
      const res = await fetch('/api/intake/analyze', {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({
          textInput: textInput.trim(),
          inputMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(data.error || '整理需求失敗，已保留您的原始文字，請重試。');
        setProcessStatus('error');
        return;
      }

      const draft: BuyerRequirement = data.draft;
      if (targetMode === 'existing' && existingBuyer && !draft.buyerName.value) {
        draft.buyerName = {
          value: existingBuyer.name,
          sourceQuote: '沿用既有客戶建檔名稱',
          confidence: 'explicit',
        };
      }
      if (targetMode === 'existing' && existingBuyer && !draft.contactPhone.value && existingBuyer.contactPhone) {
        draft.contactPhone = {
          value: existingBuyer.contactPhone,
          sourceQuote: '沿用既有客戶聯絡電話',
          confidence: 'explicit',
        };
      }

      setRawTranscript(data.transcript || textInput);
      setAiDraft(structuredClone(draft));
      setEditableDraft(structuredClone(draft));
      setIdempotencyKey(`idem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
      setProcessStatus('completed');
      setStatusMessage('需求草稿已整理完成，請進行檢查與校對。');
      setCurrentStep(2);
    } catch (err: any) {
      setAnalyzeError(`網路連線或分析異常（${err?.message || '連線中斷'}）。已保留輸入內容，請點擊重試。`);
      setProcessStatus('error');
    }
  };

  // Path 2: Save Raw Text Only (Direct without AI structuring)
  const handleSaveTextOnly = async () => {
    if (!textInput.trim()) {
      setAnalyzeError('請輸入接待原話內容後再保存。');
      return;
    }

    const defaultName = targetMode === 'existing' && existingBuyer
      ? existingBuyer.name
      : (textInput.slice(0, 12).trim() || '接待原話紀錄');

    const minimalReq: BuyerRequirement = {
      buyerName: {
        value: defaultName,
        sourceQuote: textInput.slice(0, 30),
        confidence: 'explicit',
      },
      contactPhone: {
        value: targetMode === 'existing' && existingBuyer ? existingBuyer.contactPhone : '',
        sourceQuote: '',
        confidence: 'missing',
      },
      purchasePurpose: { value: '', sourceQuote: '', confidence: 'missing' },
      preferredRegions: { value: [], sourceQuote: '', confidence: 'missing' },
      budget: { minWan: null, maxWan: null, includesParking: 'unspecified', unit: '萬元', sourceQuote: '', confidence: 'missing' },
      roomsAndType: { minRooms: null, preferredRooms: null, propertyTypes: [], sourceQuote: '', confidence: 'missing' },
      parking: { needParking: 'unspecified', parkingTypes: [], minSpaces: null, sourceQuote: '', confidence: 'missing' },
      elevator: { needElevator: 'unspecified', sourceQuote: '', confidence: 'missing' },
      propertyAge: { maxAgeYears: null, conditionType: 'unspecified', sourceQuote: '', confidence: 'missing' },
      commuteTarget: { value: '', sourceQuote: '', confidence: 'missing' },
      schoolDistrict: { value: '', sourceQuote: '', confidence: 'missing' },
      familyAndLifestyle: { value: '', sourceQuote: '', confidence: 'missing' },
      timeline: { value: '', sourceQuote: '', confidence: 'missing' },
      mustHaves: [],
      niceToHaves: [],
      dealBreakers: [],
      followUpQuestions: [],
      ambiguityAlerts: [],
    };

    setIsSaving(true);
    setSaveError(null);
    const textOnlyKey = `idem_text_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      const res = await fetch('/api/intake/confirm', {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({
          idempotencyKey: textOnlyKey,
          targetBuyerId: targetMode === 'existing' ? selectedBuyerId : null,
          recordingConsentType: 'text_input',
          rawTranscript: textInput.trim(),
          aiDraft: minimalReq,
          confirmedRequirement: minimalReq,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || '保存純文字紀錄失敗');
        setIsSaving(false);
        return;
      }

      onConfirmedAndSaved(data.buyer, data.session, false);
    } catch (err: any) {
      setSaveError(`儲存純文字失敗（${err?.message || '連線中斷'}），請重試。`);
      setIsSaving(false);
    }
  };

  const buildMergedRequirementForConfirm = (): BuyerRequirement | null => {
    if (!editableDraft) return null;
    const merged: BuyerRequirement = structuredClone(editableDraft);

    if (targetMode === 'existing' && existingBuyer) {
      const oldReq = existingBuyer.currentRequirement;

      if (fieldAdoptChoices.budget === 'old' || (merged.budget.maxWan === null && oldReq.budget.maxWan !== null)) {
        if (fieldAdoptChoices.budget === 'old') {
          merged.budget = structuredClone(oldReq.budget);
        }
      }
      if (fieldAdoptChoices.preferredRegions === 'old') {
        merged.preferredRegions = structuredClone(oldReq.preferredRegions);
      }
      if (fieldAdoptChoices.roomsAndType === 'old') {
        merged.roomsAndType = structuredClone(oldReq.roomsAndType);
      }
      if (fieldAdoptChoices.parking === 'old') {
        merged.parking = structuredClone(oldReq.parking);
      }
      if (fieldAdoptChoices.elevator === 'old') {
        merged.elevator = structuredClone(oldReq.elevator);
      }
      if (fieldAdoptChoices.propertyAge === 'old') {
        merged.propertyAge = structuredClone(oldReq.propertyAge);
      }

      if (keepOriginalMustHaves && oldReq.mustHaves && oldReq.mustHaves.length > 0) {
        const existingDescriptions = new Set(merged.mustHaves.map((m) => m.description));
        for (const oldMust of oldReq.mustHaves) {
          if (!existingDescriptions.has(oldMust.description)) {
            merged.mustHaves.push({
              ...oldMust,
              sourceQuote: oldMust.sourceQuote || '沿用客戶原需求卡之必要條件',
            });
          }
        }
      }
    }

    return merged;
  };

  const handleConfirmSave = async (goToMatchAfter: boolean) => {
    const finalRequirement = buildMergedRequirementForConfirm();
    if (!finalRequirement || !aiDraft) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/intake/confirm', {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({
          idempotencyKey,
          targetBuyerId: targetMode === 'existing' ? selectedBuyerId : null,
          recordingConsentType: 'text_input',
          rawTranscript,
          aiDraft,
          confirmedRequirement: finalRequirement,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || '儲存建檔失敗，請再試一次。');
        setIsSaving(false);
        return;
      }

      onConfirmedAndSaved(data.buyer, data.session, goToMatchAfter);
    } catch (err: any) {
      setSaveError(`儲存時發生網路異常（${err?.message || '未知錯誤'}），請重新點擊確認建檔。`);
    } finally {
      setIsSaving(false);
    }
  };

  const renderConfidenceTag = (conf: ConfidenceStatus) => {
    if (conf === 'explicit') {
      return <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">明確事實</span>;
    }
    if (conf === 'inferred' || conf === 'to_confirm') {
      return <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">AI建議待確認</span>;
    }
    return <span className="text-[11px] text-slate-400">尚未提供</span>;
  };

  const addConditionItem = (listKey: 'mustHaves' | 'niceToHaves' | 'dealBreakers') => {
    if (!editableDraft) return;
    const newItem: ConditionItem = {
      id: `manual_${Date.now()}`,
      category: '其他',
      description: '',
      sourceQuote: '業務手動補充確認',
      confidence: 'explicit',
    };
    setEditableDraft({
      ...editableDraft,
      [listKey]: [...editableDraft[listKey], newItem],
    });
  };

  const updateConditionItem = (
    listKey: 'mustHaves' | 'niceToHaves' | 'dealBreakers',
    idx: number,
    patch: Partial<ConditionItem>
  ) => {
    if (!editableDraft) return;
    const next = [...editableDraft[listKey]];
    next[idx] = { ...next[idx], ...patch };
    setEditableDraft({ ...editableDraft, [listKey]: next });
  };

  const removeConditionItem = (listKey: 'mustHaves' | 'niceToHaves' | 'dealBreakers', idx: number) => {
    if (!editableDraft) return;
    const next = editableDraft[listKey].filter((_, i) => i !== idx);
    setEditableDraft({ ...editableDraft, [listKey]: next });
  };

  return (
    <div className="space-y-5 pb-28">
      {/* 3-Step Flow Progress Header */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="text-xs font-bold text-teal-700">接待與需求整理流程</div>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              {currentStep === 1 ? '步驟一：輸入原話與選擇對象' : currentStep === 2 ? '步驟二：檢查與校對需求草稿' : '步驟三：確認建檔'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSafeCancel}
              className="min-h-[44px] px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
            >
              返回工作台
            </button>
          </div>
        </div>

        {/* Visual 3 Steps Bar */}
        <div className="grid grid-cols-3 gap-2 pt-3 text-xs">
          <div className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${
            currentStep === 1
              ? 'bg-slate-900 text-white border-slate-900 font-bold'
              : currentStep > 1
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200 font-semibold'
              : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}>
            <span className="w-5 h-5 rounded-full bg-white/20 text-center leading-5 text-[11px] shrink-0 font-mono">1</span>
            <span className="truncate">輸入原話</span>
          </div>

          <div className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${
            currentStep === 2
              ? 'bg-slate-900 text-white border-slate-900 font-bold'
              : currentStep > 2
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200 font-semibold'
              : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}>
            <span className="w-5 h-5 rounded-full bg-white/20 text-center leading-5 text-[11px] shrink-0 font-mono">2</span>
            <span className="truncate">檢查需求</span>
          </div>

          <div className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${
            currentStep === 3
              ? 'bg-slate-900 text-white border-slate-900 font-bold'
              : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}>
            <span className="w-5 h-5 rounded-full bg-white/20 text-center leading-5 text-[11px] shrink-0 font-mono">3</span>
            <span className="truncate">確認建檔</span>
          </div>
        </div>
      </div>

      {/* STEP 1: INPUT ORIGINAL TRANSCRIPT & CHOOSE TARGET */}
      {currentStep === 1 && (
        <div className="space-y-4">
          {/* Target Buyer Selector */}
          <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900">選擇接待建檔對象</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTargetMode('new')}
                className={`min-h-[44px] px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  targetMode === 'new'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>新增買方客戶</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetMode('existing');
                  if (!selectedBuyerId && buyers[0]) setSelectedBuyerId(buyers[0].id);
                }}
                disabled={buyers.length === 0}
                className={`min-h-[44px] px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  targetMode === 'existing'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 disabled:opacity-40'
                }`}
              >
                <UserCheck className="w-4 h-4 shrink-0" />
                <span>更新既有客戶 ({buyers.length})</span>
              </button>
            </div>

            {targetMode === 'existing' && buyers.length > 0 && (
              <div className="pt-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">選擇客戶：</label>
                <select
                  value={selectedBuyerId}
                  onChange={(e) => setSelectedBuyerId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {buyers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.contactPhone ? `(${b.contactPhone})` : ''} — 預算：
                      {b.currentRequirement.budget.maxWan ? `${b.currentRequirement.budget.maxWan} 萬元` : '未提供'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>

          {/* Quick Scenario Loading */}
          <div className="bg-slate-100/80 p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
            <span className="font-semibold text-slate-700">帶入示範情境原話：</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {DEMO_SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => {
                    setTextInput(sc.text);
                    setInputMethod('paste');
                    setAnalyzeError(null);
                    if (sc.id === 'case7') {
                      const lin = buyers.find((b) => b.name.includes('林小姐'));
                      if (lin) {
                        setTargetMode('existing');
                        setSelectedBuyerId(lin.id);
                      }
                    }
                  }}
                  className="min-h-[40px] p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-left text-xs font-medium text-slate-800 transition line-clamp-2"
                >
                  {sc.title}
                </button>
              ))}
            </div>
          </div>

          {/* Unified Input Workbench (Text & Voice shared) */}
          <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">輸入接待原話紀錄</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  文字與手機語音共用此輸入區，送出前請核對姓名與金額。
                </p>
              </div>
              {/* Real Processing Status Indicator */}
              {processStatus !== 'idle' && (
                <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  processStatus === 'analyzing'
                    ? 'bg-teal-50 text-teal-800 border border-teal-200 animate-pulse'
                    : processStatus === 'completed'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${processStatus === 'analyzing' ? 'bg-teal-500' : processStatus === 'completed' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  <span>{statusMessage || (processStatus === 'analyzing' ? '整理中...' : processStatus === 'completed' ? '整理完成' : '分析失敗')}</span>
                </div>
              )}
            </div>

            <UnifiedTextInputWorkbench
              value={textInput}
              onChange={(val, method) => {
                setTextInput(val);
                if (method) setInputMethod(method);
              }}
              onSubmit={() => handleAnalyzeSubmit()}
              submitLabel="整理需求"
              loadingLabel="AI 正在整理需求草稿..."
              isLoading={processStatus === 'analyzing'}
              error={analyzeError}
              onClearError={() => setAnalyzeError(null)}
              canReanalyze={false}
              buyerHint={existingBuyer ? `${existingBuyer.name}` : '新買方客戶'}
              placeholder="例如：鄭先生從台北搬到新竹，在竹科上班，年薪約三百萬，太太沒有上班，有一個小一孩子，希望高鐵附近三房車位..."
              hintDescription="文字與語音共用；送出前請確認姓名與金額。"
              minRows={5}
            />

            {/* Two Clear Paths: "只存文字" vs "整理需求" */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                可選擇直接存為未整理文字備忘，或由 AI 整理為結構化草稿。
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleSaveTextOnly}
                  disabled={isSaving || !textInput.trim() || processStatus === 'analyzing'}
                  className="min-h-[44px] px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="不經 AI 整理，直接將此段原話保存至客戶接待紀錄"
                >
                  <Save className="w-3.5 h-3.5 text-slate-500" />
                  <span>{isSaving ? '儲存中...' : '只存文字紀錄'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleAnalyzeSubmit}
                  disabled={processStatus === 'analyzing' || !textInput.trim()}
                  className="min-h-[44px] px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                  <span>{processStatus === 'analyzing' ? '整理需求中...' : '整理需求（下一步）'}</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* STEP 2: INSPECT REQUIREMENTS DRAFT */}
      {currentStep === 2 && editableDraft && (
        <section className="bg-white rounded-2xl p-4 sm:p-6 border-2 border-slate-900 space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="text-xs font-bold text-teal-700">檢查需求草稿</div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                請核對整理出的條件（未提及項目已留空，可直接修改）
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>重看原話</span>
              </button>
            </div>
          </div>

          {/* Raw text snippet preview */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
            <span className="font-bold text-slate-700">原始原話轉寫：</span>
            <p className="text-slate-800 font-sans leading-relaxed">「{rawTranscript}」</p>
          </div>

          {/* Ambiguity alerts if any */}
          {editableDraft.ambiguityAlerts && editableDraft.ambiguityAlerts.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 space-y-1.5 text-xs text-amber-900">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>語音同音或語意待確認提示：</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {editableDraft.ambiguityAlerts.map((alert, i) => (
                  <li key={i}>{alert}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Existing buyer diff comparison */}
          {targetMode === 'existing' && existingBuyer && (
            <div className="bg-slate-50 border border-slate-300 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">
                  既有客戶「{existingBuyer.name}」新舊條件比對
                </span>
                <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepOriginalMustHaves}
                    onChange={(e) => setKeepOriginalMustHaves(e.target.checked)}
                    className="rounded text-teal-600"
                  />
                  <span>保留既有必要條件</span>
                </label>
              </div>
            </div>
          )}

          {/* PRIORITY 1: Core Criteria (Budget, Region, Rooms, Elevator, Parking) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide border-b border-slate-100 pb-1">
              核心購屋條件（優先確認）
            </h4>

            {/* Budget & Parking inclusion */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">1. 總價預算（萬元）與是否含車位</span>
                {renderConfidenceTag(editableDraft.budget.confidence)}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">預算下限（萬元）</span>
                  <input
                    type="number"
                    value={editableDraft.budget.minWan ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : Number(e.target.value);
                      setEditableDraft({
                        ...editableDraft,
                        budget: { ...editableDraft.budget, minWan: val, confidence: val !== null ? 'explicit' : 'missing' },
                      });
                    }}
                    placeholder="未提供"
                    className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">預算上限（萬元，不可由年薪推算）</span>
                  <input
                    type="number"
                    value={editableDraft.budget.maxWan ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : Number(e.target.value);
                      setEditableDraft({
                        ...editableDraft,
                        budget: { ...editableDraft.budget, maxWan: val, confidence: val !== null ? 'explicit' : 'missing' },
                      });
                    }}
                    placeholder="尚未提供"
                    className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">總價是否含車位</span>
                  <select
                    value={editableDraft.budget.includesParking}
                    onChange={(e) =>
                      setEditableDraft({
                        ...editableDraft,
                        budget: {
                          ...editableDraft.budget,
                          includesParking: e.target.value as any,
                        },
                      })
                    }
                    className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm"
                  >
                    <option value="unspecified">未指定是否含車位</option>
                    <option value="yes">含車位總價</option>
                    <option value="no">不含車位</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Region & Rooms */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">2. 希望區域</span>
                  {renderConfidenceTag(editableDraft.preferredRegions.confidence)}
                </div>
                <input
                  type="text"
                  value={editableDraft.preferredRegions.value.join('、')}
                  onChange={(e) => {
                    const arr = e.target.value.split(/[、,，]/).map((s) => s.trim()).filter(Boolean);
                    setEditableDraft({
                      ...editableDraft,
                      preferredRegions: { ...editableDraft.preferredRegions, value: arr, confidence: arr.length > 0 ? 'explicit' : 'missing' },
                    });
                  }}
                  placeholder="例如：高鐵特區、竹北市"
                  className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">3. 房數（最少必要房數 / 偏好理想房數）</span>
                  {renderConfidenceTag(editableDraft.roomsAndType.confidence)}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={editableDraft.roomsAndType.minRooms ?? ''}
                    onChange={(e) =>
                      setEditableDraft({
                        ...editableDraft,
                        roomsAndType: {
                          ...editableDraft.roomsAndType,
                          minRooms: e.target.value === '' ? null : Number(e.target.value),
                        },
                      })
                    }
                    placeholder="最少房數（如 3）"
                    className="w-full min-h-[44px] px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono tabular-nums"
                  />
                  <input
                    type="number"
                    value={editableDraft.roomsAndType.preferredRooms ?? ''}
                    onChange={(e) =>
                      setEditableDraft({
                        ...editableDraft,
                        roomsAndType: {
                          ...editableDraft.roomsAndType,
                          preferredRooms: e.target.value === '' ? null : Number(e.target.value),
                        },
                      })
                    }
                    placeholder="理想房數（如 4）"
                    className="w-full min-h-[44px] px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* Elevator & Parking */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">4. 電梯需求</span>
                  {renderConfidenceTag(editableDraft.elevator.confidence)}
                </div>
                <select
                  value={editableDraft.elevator.needElevator}
                  onChange={(e) =>
                    setEditableDraft({
                      ...editableDraft,
                      elevator: { ...editableDraft.elevator, needElevator: e.target.value as any, confidence: 'explicit' },
                    })
                  }
                  className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm"
                >
                  <option value="unspecified">未提及</option>
                  <option value="required">一定要有電梯（必要）</option>
                  <option value="preferred">希望有電梯（偏好）</option>
                  <option value="not_needed">不需電梯</option>
                </select>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">5. 車位需求</span>
                  {renderConfidenceTag(editableDraft.parking.confidence)}
                </div>
                <select
                  value={editableDraft.parking.needParking}
                  onChange={(e) =>
                    setEditableDraft({
                      ...editableDraft,
                      parking: { ...editableDraft.parking, needParking: e.target.value as any, confidence: 'explicit' },
                    })
                  }
                  className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm"
                >
                  <option value="unspecified">未提及</option>
                  <option value="required">必須有車位（必要）</option>
                  <option value="preferred">希望有車位（偏好）</option>
                  <option value="not_needed">不需車位</option>
                </select>
              </div>
            </div>
          </div>

          {/* PRIORITY 2: Necessary, Preferred, Deal Breaker conditions */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide border-b border-slate-100 pb-1">
              必要／偏好／排除條件清單
            </h4>

            <div className="space-y-3">
              {(
                [
                  { key: 'mustHaves' as const, label: '必要條件（硬性排除條件）', tagColor: 'border-l-4 border-l-slate-900' },
                  { key: 'niceToHaves' as const, label: '偏好條件（加分排序條件）', tagColor: 'border-l-4 border-l-teal-600' },
                  { key: 'dealBreakers' as const, label: '排除條件（不接受抗性）', tagColor: 'border-l-4 border-l-rose-600' },
                ] as const
              ).map((sec) => (
                <div key={sec.key} className={`bg-slate-50 p-3.5 rounded-xl ${sec.tagColor} space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{sec.label}</span>
                    <button
                      type="button"
                      onClick={() => addConditionItem(sec.key)}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>新增項目</span>
                    </button>
                  </div>

                  {editableDraft[sec.key].length === 0 ? (
                    <p className="text-xs text-slate-400">目前未列出此類條件</p>
                  ) : (
                    <div className="space-y-1.5">
                      {editableDraft[sec.key].map((item, idx) => (
                        <div key={item.id || idx} className="bg-white p-2 rounded-lg border border-slate-200 flex items-center gap-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateConditionItem(sec.key, idx, { description: e.target.value })}
                            placeholder="輸入條件內容..."
                            className="flex-1 text-xs text-slate-800 bg-transparent border-none focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => removeConditionItem(sec.key, idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="刪除此條件"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* PRIORITY 3: Collapsible Section for Client Personal & Background Details */}
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowPersonalDetails(!showPersonalDetails)}
              className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700 transition cursor-pointer"
            >
              <span>詳細客戶聯絡與生活背景（電話、購屋目的、通勤、家庭、學區等）</span>
              {showPersonalDetails ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>

            {showPersonalDetails && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-200 text-xs animate-in fade-in">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">客戶姓名或稱呼</label>
                  <input
                    type="text"
                    value={editableDraft.buyerName.value}
                    onChange={(e) =>
                      setEditableDraft({
                        ...editableDraft,
                        buyerName: { ...editableDraft.buyerName, value: e.target.value, confidence: 'explicit' },
                      })
                    }
                    placeholder="如：鄭先生"
                    className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">聯絡電話（未提供可留空）</label>
                  <input
                    type="text"
                    value={editableDraft.contactPhone.value}
                    onChange={(e) =>
                      setEditableDraft({
                        ...editableDraft,
                        contactPhone: { ...editableDraft.contactPhone, value: e.target.value, confidence: e.target.value ? 'explicit' : 'missing' },
                      })
                    }
                    placeholder="留空待補"
                    className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">購屋目的</label>
                  <input
                    type="text"
                    value={editableDraft.purchasePurpose.value}
                    onChange={(e) =>
                      setEditableDraft({
                        ...editableDraft,
                        purchasePurpose: { ...editableDraft.purchasePurpose, value: e.target.value, confidence: e.target.value ? 'explicit' : 'missing' },
                      })
                    }
                    placeholder="如：自住換屋"
                    className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">通勤地點</label>
                  <input
                    type="text"
                    value={editableDraft.commuteTarget.value}
                    onChange={(e) =>
                      setEditableDraft({
                        ...editableDraft,
                        commuteTarget: { ...editableDraft.commuteTarget, value: e.target.value, confidence: e.target.value ? 'explicit' : 'missing' },
                      })
                    }
                    placeholder="如：竹科"
                    className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">學區需求</label>
                  <input
                    type="text"
                    value={editableDraft.schoolDistrict.value}
                    onChange={(e) =>
                      setEditableDraft({
                        ...editableDraft,
                        schoolDistrict: { ...editableDraft.schoolDistrict, value: e.target.value, confidence: e.target.value ? 'explicit' : 'missing' },
                      })
                    }
                    placeholder="尚未指定特定學校"
                    className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">家庭成員與生活背景</label>
                  <input
                    type="text"
                    value={editableDraft.familyAndLifestyle.value}
                    onChange={(e) =>
                      setEditableDraft({
                        ...editableDraft,
                        familyAndLifestyle: { ...editableDraft.familyAndLifestyle, value: e.target.value, confidence: e.target.value ? 'explicit' : 'missing' },
                      })
                    }
                    placeholder="如：夫妻＋1名學童"
                    className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Follow-up Questions Prompt */}
          {editableDraft.followUpQuestions.length > 0 && (
            <div className="bg-slate-900 text-white rounded-xl p-3.5 space-y-1 text-xs">
              <span className="font-bold text-teal-300">建議後續向客戶確認的問題：</span>
              <ul className="list-disc pl-5 space-y-0.5 text-slate-300">
                {editableDraft.followUpQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Bottom Confirmation Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="min-h-[44px] px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer w-full sm:w-auto"
            >
              返回修改原話
            </button>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleConfirmSave(false)}
                disabled={isSaving}
                className="min-h-[44px] flex-1 sm:flex-initial px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{isSaving ? '儲存中...' : '確認儲存客戶'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmSave(true)}
                disabled={isSaving}
                className="min-h-[44px] flex-1 sm:flex-initial px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>儲存後前往配案</span>
                <ArrowRight className="w-4 h-4 text-cyan-600" />
              </button>
            </div>
          </div>

          {saveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
              {saveError}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
