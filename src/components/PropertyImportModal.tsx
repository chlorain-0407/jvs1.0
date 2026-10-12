import React, { useState } from 'react';
import {
  Globe,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Building,
  UserCheck,
  ShieldAlert,
  ExternalLink,
  Layers,
  HelpCircle,
  Clock,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  PropertyDraftExtracted,
  DuplicateCheckResult,
  CaseOwnership,
  ExternalCooperationStatus,
} from '../types';
import { getAuthHeaders } from '../utils';

interface PropertyImportModalProps {
  token: string | null;
  useSandbox: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ModalStep = 'source' | 'preview' | 'draft' | 'duplicate';

export const PropertyImportModal: React.FC<PropertyImportModalProps> = ({
  token,
  useSandbox,
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Step state
  const [step, setStep] = useState<ModalStep>('source');
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url');

  // Source inputs
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [customSiteName, setCustomSiteName] = useState('');
  const [customItemNumber, setCustomItemNumber] = useState('');

  // Loading & error states
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [canPasteTextFallback, setCanPasteTextFallback] = useState(false);

  // Fetched preview before AI parse
  const [fetchedPreview, setFetchedPreview] = useState<{
    url: string;
    siteName: string;
    itemNumber: string;
    title: string;
    textSnippet: string;
    fetchedAt: string;
    structuredData?: any[];
  } | null>(null);

  // Draft state
  const [draft, setDraft] = useState<PropertyDraftExtracted | null>(null);

  // Case Ownership state (MANDATORY: Defaults to null)
  const [caseOwnership, setCaseOwnership] = useState<CaseOwnership | null>(null);

  // Self Case fields
  const [internalCaseCode, setInternalCaseCode] = useState('');
  const [listingStatus, setListingStatus] = useState('一般委託');
  const [listingPeriod, setListingPeriod] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // External Case fields
  const [externalAgency, setExternalAgency] = useState('');
  const [externalStore, setExternalStore] = useState('');
  const [externalAgent, setExternalAgent] = useState('');
  const [externalContact, setExternalContact] = useState('');
  const [cooperationStatus, setCooperationStatus] = useState<ExternalCooperationStatus>('unconfirmed');
  const [cooperationNotes, setCooperationNotes] = useState('');
  const [cooperationConfirmedDate, setCooperationConfirmedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Collapsible detailed field groups
  const [showLocationDetails, setShowLocationDetails] = useState(false);
  const [showFloorAgeDetails, setShowFloorAgeDetails] = useState(false);

  // Duplicate Resolution State
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const resetAll = () => {
    setStep('source');
    setInputMode('url');
    setUrlInput('');
    setTextInput('');
    setCustomSiteName('');
    setCustomItemNumber('');
    setIsFetchingUrl(false);
    setIsParsing(false);
    setFetchError(null);
    setCanPasteTextFallback(false);
    setFetchedPreview(null);
    setDraft(null);
    setCaseOwnership(null);
    setInternalCaseCode('');
    setListingStatus('一般委託');
    setListingPeriod('');
    setInternalNotes('');
    setExternalAgency('');
    setExternalStore('');
    setExternalAgent('');
    setExternalContact('');
    setCooperationStatus('unconfirmed');
    setCooperationNotes('');
    setCooperationConfirmedDate(new Date().toISOString().slice(0, 10));
    setDuplicateResult(null);
    setIdempotencyKey('');
    setIsSubmitting(false);
    setSubmitError(null);
    setFieldErrors({});
    setShowLocationDetails(false);
    setShowFloorAgeDetails(false);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  // 1. Fetch URL Only
  const handleFetchUrlOnly = async () => {
    if (!urlInput.trim()) {
      setFetchError('請輸入公開物件網址');
      return;
    }
    setIsFetchingUrl(true);
    setFetchError(null);
    setCanPasteTextFallback(false);

    try {
      const res = await fetch('/api/properties/fetch-url', {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFetchError(data.error || '無法讀取網址內容');
        setCanPasteTextFallback(true);
        setIsFetchingUrl(false);
        return;
      }

      setFetchedPreview(data);
      setStep('preview');
    } catch (err: any) {
      setFetchError(`網頁連線或爬取失敗（${err?.message || '未知錯誤'}），請改用手動貼上文字。`);
      setCanPasteTextFallback(true);
    } finally {
      setIsFetchingUrl(false);
    }
  };

  // 2. Parse Snippet to Draft
  const parseSnippetToDraft = async (
    textToParse: string,
    meta: {
      sourceUrl?: string;
      sourceSiteName?: string;
      sourceItemNumber?: string;
      structuredData?: any[];
    }
  ) => {
    if (!textToParse.trim()) {
      setFetchError('無可整理之內容文字');
      return;
    }
    setIsParsing(true);
    setFetchError(null);

    try {
      const res = await fetch('/api/properties/parse', {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({
          rawText: textToParse,
          sourceUrl: meta.sourceUrl,
          sourceSiteName: meta.sourceSiteName,
          sourceItemNumber: meta.sourceItemNumber,
          structuredData: meta.structuredData,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFetchError(data.error || '資料整理失敗');
        setIsParsing(false);
        return;
      }

      const extracted: PropertyDraftExtracted = data.draft;
      setDraft(extracted);
      setExternalAgency(extracted.externalAgency || '');
      setExternalContact(extracted.externalContact || '');
      setIdempotencyKey(`imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
      setStep('draft');
    } catch (err: any) {
      setFetchError(`整理處理異常：${err?.message || '未知錯誤'}`);
    } finally {
      setIsParsing(false);
      setIsFetchingUrl(false);
    }
  };

  // 3. Handle text paste submit
  const handleParseText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) {
      setFetchError('請貼上物件介紹文字');
      return;
    }
    await parseSnippetToDraft(textInput, {
      sourceUrl: urlInput.trim() || undefined,
      sourceSiteName: customSiteName.trim() || undefined,
      sourceItemNumber: customItemNumber.trim() || undefined,
    });
  };

  // 4. Validate mandatory fields
  const validateDraftFields = (): boolean => {
    const errors: Record<string, string> = {};

    if (!caseOwnership) {
      errors.caseOwnership = '請選擇案件歸屬（自有或他人）';
    }
    if (!draft?.title?.trim()) {
      errors.title = '物件名稱為必填項目';
    }
    if (!draft?.city?.trim() || !draft?.district?.trim()) {
      errors.cityDistrict = '縣市與行政區為必填項目';
    }
    if (draft?.totalPriceWan === null || draft?.totalPriceWan === undefined || isNaN(draft.totalPriceWan) || draft.totalPriceWan <= 0) {
      errors.totalPriceWan = '請填寫大於 0 之開價總價（單位：萬元）';
    }
    if (draft?.buildingAreaPing === null || draft?.buildingAreaPing === undefined || isNaN(draft.buildingAreaPing) || draft.buildingAreaPing <= 0) {
      errors.buildingAreaPing = '請填寫大於 0 之權狀總建物坪數';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 5. Pre-check Duplicate before confirm
  const handleCheckDuplicateAndSave = async (forceMode?: 'create_new' | 'update_existing') => {
    if (!draft) return;

    if (!validateDraftFields()) {
      setSubmitError('請檢查並填寫必填欄位。');
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    if (forceMode) {
      await executeSave(forceMode, duplicateResult?.matchedProperty?.id);
      return;
    }

    try {
      const dupRes = await fetch('/api/properties/check-duplicate', {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({ draft }),
      });
      const dupData: DuplicateCheckResult = await dupRes.json();

      if (dupData.isDuplicate && dupData.matchedProperty) {
        setDuplicateResult(dupData);
        setStep('duplicate');
        setIsSubmitting(false);
        return;
      }

      await executeSave('create_new');
    } catch (err: any) {
      setSubmitError(`檢查重複失敗：${err?.message || '網路異常'}`);
      setIsSubmitting(false);
    }
  };

  // 6. Execute Save
  const executeSave = async (mode: 'create_new' | 'update_existing', targetPropertyId?: string) => {
    if (!draft || !caseOwnership) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        idempotencyKey,
        mode,
        targetPropertyId,
        draft,
        caseOwnership,
        internalCaseCode: caseOwnership === 'self' ? internalCaseCode : undefined,
        listingStatus: caseOwnership === 'self' ? listingStatus : undefined,
        listingPeriod: caseOwnership === 'self' ? listingPeriod : undefined,
        internalNotes: caseOwnership === 'self' ? internalNotes : undefined,
        externalAgency: caseOwnership === 'external' ? (externalAgency || draft.externalAgency) : undefined,
        externalStore: caseOwnership === 'external' ? externalStore : undefined,
        externalAgent: caseOwnership === 'external' ? externalAgent : undefined,
        externalContact: caseOwnership === 'external' ? (externalContact || draft.externalContact) : undefined,
        cooperationStatus: caseOwnership === 'external' ? cooperationStatus : undefined,
        cooperationNotes: caseOwnership === 'external' ? cooperationNotes : undefined,
        cooperationConfirmedDate: caseOwnership === 'external' ? cooperationConfirmedDate : undefined,
      };

      const res = await fetch('/api/properties/import-confirm', {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || '匯入確認儲存失敗');
        setIsSubmitting(false);
        return;
      }

      onSuccess();
      handleClose();
    } catch (err: any) {
      setSubmitError(`建檔異常：${err?.message || '網路連線失敗'}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">匯入公開物件與案件歸屬</h2>
              <p className="text-xs text-slate-400">
                缺漏欄位可留空，確認建檔前草稿不參與配案
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* STEP 1: SOURCE INPUT */}
          {step === 'source' && (
            <div className="space-y-5">
              <div className="flex border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setInputMode('url')}
                  className={`py-3 px-5 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer ${
                    inputMode === 'url'
                      ? 'border-teal-600 text-teal-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  輸入公開網址
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('text')}
                  className={`py-3 px-5 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer ${
                    inputMode === 'text'
                      ? 'border-teal-600 text-teal-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  貼上物件文字
                </button>
              </div>

              {inputMode === 'url' ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">公開物件頁面網址 *</label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://sale.591.com.tw/home/house/detail/2/..."
                        className="flex-1 min-h-[44px] px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        type="button"
                        disabled={isFetchingUrl || !urlInput.trim()}
                        onClick={handleFetchUrlOnly}
                        className="min-h-[44px] px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Globe className="w-4 h-4 text-teal-400" />
                        <span>{isFetchingUrl ? '讀取網址中...' : '讀取內容'}</span>
                      </button>
                    </div>
                  </div>

                  {canPasteTextFallback && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                      <span>網址無法直接讀取時，建議切換至「貼上物件文字」直接處理。</span>
                      <button
                        type="button"
                        onClick={() => setInputMode('text')}
                        className="px-3 py-1 bg-amber-600 text-white rounded-lg font-bold"
                      >
                        切換貼上文字
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleParseText} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">物件詳細介紹或公開內文 *</label>
                    <textarea
                      rows={6}
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="貼上房屋總價、格局、坪數、車位與地址等詳細文字..."
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isParsing || !textInput.trim()}
                      className="min-h-[44px] px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4 text-teal-400" />
                      <span>{isParsing ? '整理為草稿中...' : '進行整理'}</span>
                    </button>
                  </div>
                </form>
              )}

              {fetchError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{fetchError}</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: PREVIEW FETCHED TEXT */}
          {step === 'preview' && fetchedPreview && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 text-xs">
                <span className="font-bold text-slate-700">擷取標題：{fetchedPreview.title}</span>
                <p className="text-slate-500 truncate">來源網址：{fetchedPreview.url}</p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed text-slate-700">
                {fetchedPreview.textSnippet}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep('source')}
                  className="min-h-[44px] px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>返回重新輸入</span>
                </button>
                <button
                  type="button"
                  disabled={isParsing}
                  onClick={() =>
                    parseSnippetToDraft(fetchedPreview.textSnippet, {
                      sourceUrl: fetchedPreview.url,
                      sourceSiteName: fetchedPreview.siteName,
                      sourceItemNumber: fetchedPreview.itemNumber,
                      structuredData: fetchedPreview.structuredData,
                    })
                  }
                  className="min-h-[44px] px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-teal-400" />
                  <span>{isParsing ? '整理中...' : '確認無誤，整理為草稿'}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PRIORITIZED EDITABLE DRAFT */}
          {step === 'draft' && draft && (
            <div className="space-y-5">
              {/* Draft Banner */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                <span className="font-semibold">草稿未正式確認建檔前，不參與買方配案。缺漏欄位可留空。</span>
                <span className="text-[11px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded">可自由校對</span>
              </div>

              {/* 1. MANDATORY CASE OWNERSHIP */}
              <div className="bg-slate-50 border-2 border-slate-900 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>1. 案件歸屬確認（必選項目）*</span>
                      {!caseOwnership && (
                        <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">
                          未選擇不可建檔
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">區分您本人的受託案件或外部同業公開物件。</p>
                  </div>
                </div>

                {fieldErrors.caseOwnership && (
                  <p className="text-xs font-bold text-rose-600">{fieldErrors.caseOwnership}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCaseOwnership('self');
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.caseOwnership;
                        return next;
                      });
                    }}
                    className={`p-3.5 rounded-xl border-2 text-left transition flex items-start gap-3 cursor-pointer ${
                      caseOwnership === 'self'
                        ? 'border-teal-700 bg-teal-50/70 text-slate-950 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                        caseOwnership === 'self' ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300'
                      }`}
                    >
                      {caseOwnership === 'self' && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div>
                      <div className="font-bold text-xs sm:text-sm">自有案件</div>
                      <p className="text-[11px] text-slate-500 mt-0.5">本公司或您本人受託之物件。</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCaseOwnership('external');
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.caseOwnership;
                        return next;
                      });
                    }}
                    className={`p-3.5 rounded-xl border-2 text-left transition flex items-start gap-3 cursor-pointer ${
                      caseOwnership === 'external'
                        ? 'border-amber-600 bg-amber-50/70 text-slate-950 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                        caseOwnership === 'external' ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-300'
                      }`}
                    >
                      {caseOwnership === 'external' && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div>
                      <div className="font-bold text-xs sm:text-sm">他人案件</div>
                      <p className="text-[11px] text-slate-500 mt-0.5">外部同業、友店或網路公開物件。</p>
                    </div>
                  </button>
                </div>

                {/* Conditional Fields: Only show External Cooperation when "他人案件" is selected */}
                {caseOwnership === 'external' && (
                  <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-in fade-in">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">來源同業／品牌</label>
                      <input
                        type="text"
                        value={externalAgency}
                        onChange={(e) => setExternalAgency(e.target.value)}
                        placeholder="如：永慶房屋、信義房屋"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">承辦人／門店</label>
                      <input
                        type="text"
                        value={externalAgent}
                        onChange={(e) => setExternalAgent(e.target.value)}
                        placeholder="如：陳專員"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">公開聯絡方式</label>
                      <input
                        type="text"
                        value={externalContact}
                        onChange={(e) => setExternalContact(e.target.value)}
                        placeholder="0912-345-678"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">合作狀態（預設未確認）</label>
                      <select
                        value={cooperationStatus}
                        onChange={(e) => setCooperationStatus(e.target.value as ExternalCooperationStatus)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold"
                      >
                        <option value="unconfirmed">未確認（提醒需先確認）</option>
                        <option value="available">可合作（已確認合作條件）</option>
                        <option value="negotiating">待洽談（條件洽談中）</option>
                        <option value="unavailable">不可合作（拒絕配件）</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">合作條件備註</label>
                      <input
                        type="text"
                        value={cooperationNotes}
                        onChange={(e) => setCooperationNotes(e.target.value)}
                        placeholder="如：需提前一天預約看屋"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>
                )}

                {/* Conditional Fields: Only show Self Listing fields when "自有案件" is selected */}
                {caseOwnership === 'self' && (
                  <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-in fade-in">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">內部案件編號（選填）</label>
                      <input
                        type="text"
                        value={internalCaseCode}
                        onChange={(e) => setInternalCaseCode(e.target.value)}
                        placeholder="如：A-2026-001"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">委託狀態（選填）</label>
                      <select
                        value={listingStatus}
                        onChange={(e) => setListingStatus(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                      >
                        <option value="一般委託">一般委託</option>
                        <option value="專任委託">專任委託</option>
                        <option value="開發中委託">開發中委託</option>
                        <option value="過期待續約">過期待續約</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">內部備註（選填）</label>
                      <input
                        type="text"
                        value={internalNotes}
                        onChange={(e) => setInternalNotes(e.target.value)}
                        placeholder="鑰匙放店內，看屋需提前通知"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. PRICE & PARKING */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
                <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                  2. 價格與車位（主要條件）
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">開價總價（萬元）*</label>
                    <input
                      type="number"
                      value={draft.totalPriceWan ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        setDraft({ ...draft, totalPriceWan: val });
                        if (val && val > 0) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.totalPriceWan;
                            return next;
                          });
                        }
                      }}
                      className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono tabular-nums font-bold text-sm"
                    />
                    {fieldErrors.totalPriceWan && (
                      <p className="text-[11px] font-bold text-rose-600 mt-1">{fieldErrors.totalPriceWan}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">總價是否含車位</label>
                    <select
                      value={draft.priceIncludesParking}
                      onChange={(e) => setDraft({ ...draft, priceIncludesParking: e.target.value as any })}
                      className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    >
                      <option value="yes">總價已含車位</option>
                      <option value="separate">車位價格另計</option>
                      <option value="no">無車位／不含車位</option>
                      <option value="unknown">尚未明確標明</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">車位型式</label>
                    <select
                      value={draft.parkingType}
                      onChange={(e) => setDraft({ ...draft, parkingType: e.target.value as any })}
                      className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    >
                      <option value="坡道平面">坡道平面</option>
                      <option value="坡道機械">坡道機械</option>
                      <option value="升降平面">升降平面</option>
                      <option value="升降機械">升降機械</option>
                      <option value="無車位">無車位</option>
                      <option value="待確認">待確認</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3. LAYOUT & PING */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
                <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                  3. 現況格局與坪數（缺漏可留空）
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">權狀總建物坪數（坪）*</label>
                    <input
                      type="number"
                      step="0.01"
                      value={draft.buildingAreaPing ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        setDraft({ ...draft, buildingAreaPing: val });
                        if (val && val > 0) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.buildingAreaPing;
                            return next;
                          });
                        }
                      }}
                      className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono tabular-nums font-bold"
                    />
                    {fieldErrors.buildingAreaPing && (
                      <p className="text-[11px] font-bold text-rose-600 mt-1">{fieldErrors.buildingAreaPing}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">主建物室內實坪（坪，可空）</label>
                    <input
                      type="number"
                      step="0.01"
                      value={draft.mainBuildingAreaPing ?? ''}
                      onChange={(e) => setDraft({ ...draft, mainBuildingAreaPing: e.target.value === '' ? null : Number(e.target.value) })}
                      placeholder="室內實坪"
                      className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">格局房數（房）</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <input
                        type="number"
                        value={draft.rooms ?? ''}
                        onChange={(e) => setDraft({ ...draft, rooms: e.target.value === '' ? null : Number(e.target.value) })}
                        placeholder="房"
                        className="w-full min-h-[44px] px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-center"
                      />
                      <input
                        type="number"
                        value={draft.livingRooms ?? ''}
                        onChange={(e) => setDraft({ ...draft, livingRooms: e.target.value === '' ? null : Number(e.target.value) })}
                        placeholder="廳"
                        className="w-full min-h-[44px] px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-center"
                      />
                      <input
                        type="number"
                        value={draft.bathrooms ?? ''}
                        onChange={(e) => setDraft({ ...draft, bathrooms: e.target.value === '' ? null : Number(e.target.value) })}
                        placeholder="衛"
                        className="w-full min-h-[44px] px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-center"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. TO VERIFY ITEMS & LIMITATIONS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
                <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                  4. 待確認事項與已知抗性
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">電梯設備現況</label>
                    <select
                      value={draft.hasElevator}
                      onChange={(e) => setDraft({ ...draft, hasElevator: e.target.value as any })}
                      className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                    >
                      <option value="yes">有電梯</option>
                      <option value="no">無電梯</option>
                      <option value="unknown">待確認</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">已知抗性與限制（如可隔三房現況）</label>
                    <input
                      type="text"
                      value={(draft.knownLimitations || []).join('、')}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          knownLimitations: e.target.value.split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
                        })
                      }
                      placeholder="以頓號分隔"
                      className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* 5. COLLAPSIBLE DETAILED FIELD GROUPS */}
              <div className="space-y-3 pt-1">
                {/* Location Details Group */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setShowLocationDetails(!showLocationDetails)}
                    className="w-full p-4 flex items-center justify-between text-left text-xs font-bold text-slate-800 bg-slate-50/70 hover:bg-slate-100 transition cursor-pointer"
                  >
                    <span>詳細物件地段與基本名稱（名稱*、縣市*、行政區*、地址等）</span>
                    {showLocationDetails ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>

                  {showLocationDetails && (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs border-t border-slate-100 animate-in fade-in">
                      <div className="sm:col-span-2">
                        <label className="block font-bold text-slate-700 mb-1">物件名稱 *</label>
                        <input
                          type="text"
                          value={draft.title}
                          onChange={(e) => {
                            setDraft({ ...draft, title: e.target.value });
                            if (e.target.value.trim()) {
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next.title;
                                return next;
                              });
                            }
                          }}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                        />
                        {fieldErrors.title && (
                          <p className="text-[11px] font-bold text-rose-600 mt-1">{fieldErrors.title}</p>
                        )}
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">用途分類</label>
                        <input
                          type="text"
                          value={draft.propertyUsage || ''}
                          onChange={(e) => setDraft({ ...draft, propertyUsage: e.target.value })}
                          placeholder="住家用"
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">縣市 *</label>
                        <input
                          type="text"
                          value={draft.city}
                          onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">行政區 *</label>
                        <input
                          type="text"
                          value={draft.district}
                          onChange={(e) => setDraft({ ...draft, district: e.target.value })}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">生活圈</label>
                        <input
                          type="text"
                          value={draft.neighborhood || ''}
                          onChange={(e) => setDraft({ ...draft, neighborhood: e.target.value })}
                          placeholder="高鐵特區"
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block font-bold text-slate-700 mb-1">詳細地址</label>
                        <input
                          type="text"
                          value={draft.address || ''}
                          onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                          placeholder="新竹縣竹北市文興路二段..."
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Floor & Age Details Group */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setShowFloorAgeDetails(!showFloorAgeDetails)}
                    className="w-full p-4 flex items-center justify-between text-left text-xs font-bold text-slate-800 bg-slate-50/70 hover:bg-slate-100 transition cursor-pointer"
                  >
                    <span>詳細樓層、屋齡與公設坪數（可選填展開）</span>
                    {showFloorAgeDetails ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </button>

                  {showFloorAgeDetails && (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs border-t border-slate-100 animate-in fade-in">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">所在樓層</label>
                        <input
                          type="number"
                          value={draft.floor ?? ''}
                          onChange={(e) => setDraft({ ...draft, floor: e.target.value === '' ? null : Number(e.target.value) })}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">總樓層</label>
                        <input
                          type="number"
                          value={draft.totalFloors ?? ''}
                          onChange={(e) => setDraft({ ...draft, totalFloors: e.target.value === '' ? null : Number(e.target.value) })}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">屋齡（年，可空）</label>
                        <input
                          type="number"
                          value={draft.ageYears ?? ''}
                          onChange={(e) => setDraft({ ...draft, ageYears: e.target.value === '' ? null : Number(e.target.value) })}
                          placeholder="屋齡待查"
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">附屬建物坪數（坪）</label>
                        <input
                          type="number"
                          step="0.01"
                          value={draft.auxiliaryBuildingAreaPing ?? ''}
                          onChange={(e) => setDraft({ ...draft, auxiliaryBuildingAreaPing: e.target.value === '' ? null : Number(e.target.value) })}
                          placeholder="陽台、雨遮"
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono tabular-nums"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">公設坪數（坪）</label>
                        <input
                          type="number"
                          step="0.01"
                          value={draft.publicFacilitiesAreaPing ?? ''}
                          onChange={(e) => setDraft({ ...draft, publicFacilitiesAreaPing: e.target.value === '' ? null : Number(e.target.value) })}
                          className="w-full min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono tabular-nums"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {submitError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep('source')}
                  className="min-h-[44px] px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>重新整理</span>
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    取消
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleCheckDuplicateAndSave()}
                    className="min-h-[44px] px-6 py-2 text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition bg-slate-900 hover:bg-slate-800 text-white cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4 text-teal-400" />
                    <span>{isSubmitting ? '檢查並儲存中...' : '檢查重複並確認建檔'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: DUPLICATE RESOLUTION DIALOG */}
          {step === 'duplicate' && duplicateResult && duplicateResult.matchedProperty && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-1 text-xs text-amber-950">
                <div className="font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>偵測到與您名下既有物件重複，請選擇處理方式：</span>
                </div>
                <p className="text-amber-800">
                  既有物件：{duplicateResult.matchedProperty.title}（開價 {duplicateResult.matchedProperty.totalPriceWan} 萬）
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('draft')}
                  className="min-h-[44px] px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700"
                >
                  返回修改草稿
                </button>
                <button
                  type="button"
                  onClick={() => handleCheckDuplicateAndSave('update_existing')}
                  className="min-h-[44px] px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  覆蓋更新既有物件
                </button>
                <button
                  type="button"
                  onClick={() => handleCheckDuplicateAndSave('create_new')}
                  className="min-h-[44px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  仍作為新物件建立
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
