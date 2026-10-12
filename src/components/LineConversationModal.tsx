import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  MessageSquare,
  Upload,
  ArrowUp,
  ArrowDown,
  Trash2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  User,
  Users,
  Building,
  RefreshCw,
  Clock,
  Calendar,
  Layers,
  HelpCircle,
  FileText,
  ShieldCheck,
  ArrowRight,
  Eye,
  Plus,
} from 'lucide-react';
import {
  BuyerRecord,
  ConversationImportRecord,
  ExtractedChatMessage,
  ConversationAnalysisDraft,
  ConversationTargetType,
  ConversationSpeakerRole,
  BuyerRequirementDiffItem,
} from '../types';
import { getAuthHeaders, formatTaipeiTime } from '../utils';

interface LineConversationModalProps {
  token: string | null;
  useSandbox: boolean;
  buyers: BuyerRecord[];
  initialBuyerId?: string | null;
  onClose: () => void;
  onRefreshWorkspace: () => void;
  onNavigateToBuyer?: (buyerId: string) => void;
}

interface UploadedImageItem {
  id: string;
  file: File;
  previewUrl: string;
  base64Data: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
}

export const LineConversationModal: React.FC<LineConversationModalProps> = ({
  token,
  useSandbox,
  buyers,
  initialBuyerId,
  onClose,
  onRefreshWorkspace,
  onNavigateToBuyer,
}) => {
  // Stepper: 1: 上傳與排序, 2: 逐字檢查與角色確認, 3: 分析結果與差異對照, 4: 完成整合
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Target Buyer Configuration
  const [targetType, setTargetType] = useState<ConversationTargetType>(() => {
    return initialBuyerId ? 'existing_buyer' : 'existing_buyer';
  });
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>(initialBuyerId || (buyers[0]?.id ?? ''));
  const [newBuyerDraftName, setNewBuyerDraftName] = useState('');
  const [newBuyerDraftPhone, setNewBuyerDraftPhone] = useState('');
  const [coopAgentName, setCoopAgentName] = useState('');
  const [coopAgencyStore, setCoopAgencyStore] = useState('');

  // Uploaded Images
  const [images, setImages] = useState<UploadedImageItem[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Step 2: Extracted Messages
  const [currentImportId, setCurrentImportId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ExtractedChatMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Step 3: Analysis Result & Diff Items
  const [analysisDraft, setAnalysisDraft] = useState<ConversationAnalysisDraft | null>(null);
  const [diffItems, setDiffItems] = useState<BuyerRequirementDiffItem[]>([]);
  const [copiedDraft, setCopiedDraft] = useState(false);

  // Step 4: Integration Options
  const [optSaveImport, setOptSaveImport] = useState(true);
  const [optSaveToBuyer, setOptSaveToBuyer] = useState(true);
  const [optSaveFollowUp, setOptSaveFollowUp] = useState(true);
  const [optCreateTasks, setOptCreateTasks] = useState(true);
  const [optRunMatching, setOptRunMatching] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [integrationResult, setIntegrationResult] = useState<any | null>(null);

  // Historical imports tab
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [historyImports, setHistoryImports] = useState<ConversationImportRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const selectedExistingBuyer = buyers.find((b) => b.id === selectedBuyerId) || null;

  useEffect(() => {
    if (initialBuyerId) {
      setSelectedBuyerId(initialBuyerId);
      setTargetType('existing_buyer');
    }
  }, [initialBuyerId]);

  // Clean object URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  // Fetch History Imports
  const loadHistoryImports = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/conversations', {
        headers: getAuthHeaders(token, useSandbox),
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryImports(data.imports || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  // Client-side downscaling while keeping text crisp
  const processImageFile = async (file: File): Promise<UploadedImageItem> => {
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validMimes.includes(file.type.toLowerCase())) {
      throw new Error(`不支援的檔案格式 (${file.name})，僅支援 JPG、PNG、WebP`);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`讀取檔案 ${file.name} 失敗`));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error(`無法解析影像 ${file.name}`));
        img.onload = () => {
          let { width, height } = img;
          const maxDim = 1920; // Maintain crisp text legibility
          let needScale = false;

          if (width > maxDim || height > maxDim) {
            needScale = true;
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Canvas context 初始化失敗'));
          }
          ctx.drawImage(img, 0, 0, width, height);

          const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const quality = outputMime === 'image/jpeg' ? 0.9 : undefined;
          const dataUrl = canvas.toDataURL(outputMime, quality);
          const base64Data = dataUrl.split(',')[1];
          const approxBytes = Math.round((base64Data.length * 3) / 4);

          if (approxBytes > 5 * 1024 * 1024) {
            return reject(new Error(`檔案 ${file.name} 縮小後仍超過 5 MB 限制，請先手動裁切無關畫面`));
          }

          const previewUrl = URL.createObjectURL(file);
          resolve({
            id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            file,
            previewUrl,
            base64Data,
            mimeType: outputMime,
            sizeBytes: approxBytes,
            width,
            height,
          });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (images.length + files.length > 5) {
      setUploadError('一次最多上傳 5 張截圖，請精簡或分批辨識');
      return;
    }
    setUploadError(null);

    try {
      const newItems: UploadedImageItem[] = [];
      for (const f of files) {
        const item = await processImageFile(f);
        newItems.push(item);
      }
      setImages((prev) => [...prev, ...newItems].slice(0, 5));
    } catch (err: any) {
      setUploadError(err.message || '檔案處理失敗');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    setImages((prev) => {
      const copy = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const item = prev.find((img) => img.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  };

  // Step 1 -> Step 2: Call Gemini to Extract Chat Text
  const handleRecognizeChat = async () => {
    if (images.length === 0) {
      setUploadError('請先選擇至少 1 張 LINE 截圖');
      return;
    }
    setUploadError(null);
    setIsRecognizing(true);

    try {
      const payload = {
        images: images.map((img) => ({
          mimeType: img.mimeType,
          base64Data: img.base64Data,
        })),
        targetType,
        buyerId: targetType === 'existing_buyer' ? selectedBuyerId : null,
        buyerName:
          targetType === 'existing_buyer'
            ? selectedExistingBuyer?.name
            : targetType === 'new_buyer'
            ? newBuyerDraftName || '新買方草稿'
            : coopAgentName || '合作買方客',
        coopAgency: targetType === 'coop_buyer' ? `${coopAgencyStore} ${coopAgentName}`.trim() : undefined,
      };

      const res = await fetch('/api/conversations/extract', {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '對話辨識失敗');
      }

      setCurrentImportId(data.importRecord.id);
      setMessages(data.messages || []);
      setCurrentStep(2);
    } catch (err: any) {
      setUploadError(err.message || '辨識過程發生異常，原圖片已保留，您可重試或更換圖片。');
    } finally {
      setIsRecognizing(false);
    }
  };

  // Step 2 Message Editing Handlers
  const handleUpdateMessageText = (id: string, newText: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: newText } : m)));
  };

  const handleUpdateSpeakerLabel = (id: string, newLabel: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, rawSpeakerLabel: newLabel } : m)));
  };

  const handleUpdateRole = (id: string, newRole: ConversationSpeakerRole) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, confirmedRole: newRole } : m)));
  };

  const handleUpdateTimestamp = (id: string, newTs: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, timestampStr: newTs } : m)));
  };

  const handleToggleIgnore = (id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, isIgnored: !m.isIgnored } : m)));
  };

  const handleDeleteMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const handleAddMessage = (afterIndex: number) => {
    const prevMsg = messages[afterIndex];
    const newMsg: ExtractedChatMessage = {
      id: `msg_custom_${Date.now()}`,
      imageIndex: prevMsg ? prevMsg.imageIndex : 1,
      orderInImage: prevMsg ? prevMsg.orderInImage + 1 : 1,
      rawSpeakerLabel: '手動新增發言者',
      candidateRole: 'buyer',
      confirmedRole: 'buyer',
      timestampStr: '未知',
      text: '',
      isAmbiguous: false,
      isSuspectedDuplicate: false,
      isIgnored: false,
    };
    setMessages((prev) => {
      const copy = [...prev];
      copy.splice(afterIndex + 1, 0, newMsg);
      return copy;
    });
  };

  // Step 2 -> Step 3: Analyze Requirements with Confirmed Text (No Images sent!)
  const handleAnalyzeRequirements = async () => {
    if (!currentImportId) return;
    const validMsgs = messages.filter((m) => !m.isIgnored && m.text.trim());
    if (validMsgs.length === 0) {
      setAnalyzeError('請至少保留一則有效的對話訊息');
      return;
    }

    setAnalyzeError(null);
    setIsAnalyzing(true);

    try {
      const payload = {
        importId: currentImportId,
        messages,
        buyerId: targetType === 'existing_buyer' ? selectedBuyerId : null,
        targetType,
        buyerName:
          targetType === 'existing_buyer'
            ? selectedExistingBuyer?.name
            : targetType === 'new_buyer'
            ? newBuyerDraftName || '新買方草稿'
            : coopAgentName || '合作買方客',
        coopAgency: targetType === 'coop_buyer' ? `${coopAgencyStore} ${coopAgentName}`.trim() : undefined,
      };

      const res = await fetch('/api/conversations/analyze', {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '需求分析失敗');
      }

      setAnalysisDraft(data.analysisDraft);
      setDiffItems(data.analysisDraft.diffItems || []);
      setCurrentStep(3);
    } catch (err: any) {
      setAnalyzeError(err.message || '分析過程發生異常，請重試');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Step 3 Diff Item Toggle
  const handleToggleDiffAccept = (fieldKey: string) => {
    setDiffItems((prev) =>
      prev.map((item) => (item.fieldKey === fieldKey ? { ...item, accepted: !item.accepted } : item))
    );
  };

  // Copy LINE draft message
  const handleCopyLineDraft = () => {
    if (!analysisDraft?.lineDraft?.messageText) return;
    navigator.clipboard.writeText(analysisDraft.lineDraft.messageText);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2500);
  };

  // Step 3 -> Step 4: Confirm and Integrate
  const handleConfirmAndIntegrate = async () => {
    if (!currentImportId) return;
    setIsConfirming(true);
    setConfirmError(null);

    const idempotencyKey = `confirm_${currentImportId}_${Date.now()}`;
    const buyerName =
      targetType === 'existing_buyer'
        ? selectedExistingBuyer?.name || '既有買方'
        : targetType === 'new_buyer'
        ? newBuyerDraftName || '新買方客'
        : coopAgentName || '合作買方客';

    try {
      const payload = {
        importId: currentImportId,
        idempotencyKey,
        actions: {
          saveImport: optSaveImport,
          saveToBuyer: optSaveToBuyer,
          buyerTargetType: targetType,
          buyerId: targetType === 'existing_buyer' ? selectedBuyerId : null,
          buyerName,
          contactPhone: targetType === 'new_buyer' ? newBuyerDraftPhone : undefined,
          coopAgency: targetType === 'coop_buyer' ? `${coopAgencyStore} ${coopAgentName}`.trim() : undefined,
          confirmedDiffItems: diffItems,
          saveFollowUp: optSaveFollowUp,
          followUpData: {
            clientFeedback: analysisDraft?.purchasePurpose?.sourceQuote || '客戶於 LINE 表達需求',
            agentObservations: analysisDraft?.suggestedFollowUpAction || '',
            agreedNextSteps: analysisDraft?.agreedNextSteps?.map((a) => a.item).join('；') || '',
            suggestedAction: analysisDraft?.suggestedFollowUpAction || '',
          },
          createTasks: optCreateTasks,
          tasks: (analysisDraft?.agreedNextSteps || []).map((step) => ({
            title: step.item,
            priority: 'high',
            dueNote: step.hasExactDate && step.dueDateStr ? step.dueDateStr : '待確認確切日期',
            details: `來源訊息：「${step.sourceQuote}」（依 LINE 對話約定）`,
          })),
          runMatching: optRunMatching,
        },
      };

      const res = await fetch('/api/conversations/confirm-and-integrate', {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '整合儲存失敗');
      }

      setIntegrationResult(data);
      setCurrentStep(4);
      onRefreshWorkspace();
    } catch (err: any) {
      setConfirmError(err.message || '儲存整合失敗，請重試');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">買方 LINE 對話截圖分析</h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                  Phase 4 智慧對話解析
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                依時間上傳對話截圖 ➔ 逐字文字與角色校正 ➔ 客觀需求提煉 ➔ 確認無誤整合存檔
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowHistoryDrawer(true);
                loadHistoryImports();
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>歷史分析紀錄</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="bg-slate-100 px-6 py-3 border-b border-slate-200 flex items-center justify-between text-xs font-semibold shrink-0">
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
            <div
              className={`flex items-center gap-1.5 ${
                currentStep === 1
                  ? 'text-cyan-700 font-bold'
                  : currentStep > 1
                  ? 'text-emerald-700'
                  : 'text-slate-400'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                  currentStep === 1
                    ? 'bg-cyan-600 text-white'
                    : currentStep > 1
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                1
              </span>
              <span>對象與截圖上傳</span>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />

            <div
              className={`flex items-center gap-1.5 ${
                currentStep === 2
                  ? 'text-cyan-700 font-bold'
                  : currentStep > 2
                  ? 'text-emerald-700'
                  : 'text-slate-400'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                  currentStep === 2
                    ? 'bg-cyan-600 text-white'
                    : currentStep > 2
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                2
              </span>
              <span>文字檢查與角色確認</span>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />

            <div
              className={`flex items-center gap-1.5 ${
                currentStep === 3
                  ? 'text-cyan-700 font-bold'
                  : currentStep > 3
                  ? 'text-emerald-700'
                  : 'text-slate-400'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                  currentStep === 3
                    ? 'bg-cyan-600 text-white'
                    : currentStep > 3
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                3
              </span>
              <span>需求分析與差異對照</span>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />

            <div
              className={`flex items-center gap-1.5 ${
                currentStep === 4 ? 'text-emerald-700 font-bold' : 'text-slate-400'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                  currentStep === 4 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                4
              </span>
              <span>確認整合存入系統</span>
            </div>
          </div>

          <div className="hidden sm:block text-[11px] text-slate-500 font-normal">
            無暫存・不存原圖・人工覆核原則
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: 對象與截圖上傳 */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Privacy Warning Banner */}
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-950 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold">個資遮蔽與系統暫存安全宣告：</span>
                  <p className="text-amber-900 leading-relaxed">
                    上傳前請確認已遮蔽無關之個資（如身分證字號、非必要電話），僅提供您有權處理的客戶對話。
                    本系統採用<strong>「辨識完成即清除伺服器暫存」</strong>之隱私架構，<strong>絕不在 MongoDB 保存圖片檔案、Base64 或公開圖片網址</strong>，原圖未保存時來源僅標示圖片序號與文字。第三方 API 傳輸處理受 Google 服務條款保證。
                  </p>
                </div>
              </div>

              {/* 1. Target Buyer Selection */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-cyan-700" />
                    <span>選擇分析對象</span>
                  </div>
                  {initialBuyerId && (
                    <span className="text-[11px] bg-cyan-100 text-cyan-800 font-semibold px-2 py-0.5 rounded-full">
                      已由買方詳情頁預選
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTargetType('existing_buyer')}
                    className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${
                      targetType === 'existing_buyer'
                        ? 'bg-white border-cyan-600 ring-2 ring-cyan-500/20 shadow-xs'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        targetType === 'existing_buyer' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">選擇既有買方</div>
                      <div className="text-[10px] text-slate-500">更新現有需求與對照差異</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('new_buyer')}
                    className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${
                      targetType === 'new_buyer'
                        ? 'bg-white border-cyan-600 ring-2 ring-cyan-500/20 shadow-xs'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        targetType === 'new_buyer' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">建立新買方草稿</div>
                      <div className="text-[10px] text-slate-500">對話確認後建立正式客戶</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('coop_buyer')}
                    className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${
                      targetType === 'coop_buyer'
                        ? 'bg-white border-cyan-600 ring-2 ring-cyan-500/20 shadow-xs'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        targetType === 'coop_buyer' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">合作買方（友店客）</div>
                      <div className="text-[10px] text-slate-500">僅記錄稱呼，不強制建檔</div>
                    </div>
                  </button>
                </div>

                {targetType === 'existing_buyer' && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-semibold text-slate-700">選擇既有買方客戶：</label>
                    <select
                      value={selectedBuyerId}
                      onChange={(e) => setSelectedBuyerId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                    >
                      {buyers.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}（預算：{b.currentRequirement.budget.maxWan ? `${b.currentRequirement.budget.maxWan} 萬` : '未提供'} · 區域：{b.currentRequirement.preferredRegions.value.join('、') || '未填'}）
                        </option>
                      ))}
                    </select>
                    {selectedExistingBuyer && (
                      <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                        <div>
                          <strong>目前操作對象：</strong> {selectedExistingBuyer.name}
                          <span className="text-slate-400 mx-1.5">|</span>
                          電話：{selectedExistingBuyer.contactPhone || '尚未建立'}
                        </div>
                        <div className="text-cyan-700 font-medium">分析後將逐項對照現有需求</div>
                      </div>
                    )}
                  </div>
                )}

                {targetType === 'new_buyer' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-xs font-semibold text-slate-700">新買方稱呼／姓名：</label>
                      <input
                        type="text"
                        placeholder="例如：張先生（竹科工程師）"
                        value={newBuyerDraftName}
                        onChange={(e) => setNewBuyerDraftName(e.target.value)}
                        className="w-full mt-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700">聯絡電話（選填）：</label>
                      <input
                        type="text"
                        placeholder="例如：0912-345-678"
                        value={newBuyerDraftPhone}
                        onChange={(e) => setNewBuyerDraftPhone(e.target.value)}
                        className="w-full mt-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                )}

                {targetType === 'coop_buyer' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-xs font-semibold text-slate-700">買方稱呼（不強迫建正式買方）：</label>
                      <input
                        type="text"
                        placeholder="例如：永慶小李帶的陳太太"
                        value={coopAgentName}
                        onChange={(e) => setCoopAgentName(e.target.value)}
                        className="w-full mt-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700">合作來源／友店品牌：</label>
                      <input
                        type="text"
                        placeholder="例如：永慶不動產竹北文興加盟店"
                        value={coopAgencyStore}
                        onChange={(e) => setCoopAgencyStore(e.target.value)}
                        className="w-full mt-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Image Upload and Reorder Zone */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">上傳 LINE 對話截圖</h3>
                    <p className="text-xs text-slate-500">
                      支援 JPG、PNG、WebP，最多 5 張，單張上限 5 MB。選檔與排序不呼叫 AI。
                    </p>
                  </div>
                  <div className="text-xs font-medium text-slate-600">
                    已選取 <span className="font-bold text-cyan-700">{images.length}</span> / 5 張
                  </div>
                </div>

                {/* Upload Button Box */}
                {images.length < 5 && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-cyan-500 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50/50 hover:bg-cyan-50/20 group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handleFilesSelected}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center group-hover:scale-105 transition">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-bold text-slate-800">
                        點擊選取或拖曳圖片至此（支援多選，最多 5 張）
                      </div>
                      <div className="text-[11px] text-slate-500">
                        前處理將自動等比例縮放以維持字體清晰度，避免過度破壞性壓縮
                      </div>
                    </div>
                  </div>
                )}

                {uploadError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Images Reordering List */}
                {images.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-cyan-700" />
                      <span>請確認圖片先後順序（重要：請依對話時間由舊到新由上往下排列）：</span>
                    </div>

                    <div className="space-y-2">
                      {images.map((img, idx) => (
                        <div
                          key={img.id}
                          className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                              <img
                                src={img.previewUrl}
                                alt={`截圖 ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                圖片 #{idx + 1}：{img.file.name}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                大小：{(img.sizeBytes / 1024).toFixed(1)} KB · 尺寸：
                                {img.width}x{img.height} · 格式：{img.mimeType.split('/')[1].toUpperCase()}
                              </div>
                              <div className="text-[10px] text-cyan-700 font-semibold mt-0.5">
                                {idx === 0 ? '【最先開始發言之畫面】' : idx === images.length - 1 ? '【最新發言畫面】' : `中繼對話第 ${idx + 1} 張`}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveImage(idx, 'up')}
                              disabled={idx === 0}
                              title="往上移（對話更早）"
                              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-slate-100 text-slate-700 flex items-center justify-center transition"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveImage(idx, 'down')}
                              disabled={idx === images.length - 1}
                              title="往下移（對話更晚）"
                              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-slate-100 text-slate-700 flex items-center justify-center transition"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeImage(img.id)}
                              title="移除此張截圖"
                              className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition ml-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons Step 1 */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
                >
                  取消
                </button>

                <button
                  type="button"
                  onClick={handleRecognizeChat}
                  disabled={images.length === 0 || isRecognizing}
                  className="min-h-[44px] px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-200 disabled:text-slate-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs transition"
                >
                  {isRecognizing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>正在逐字辨識截圖文字與重疊氣泡...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>開始辨識對話文字 (呼叫 Gemini Multimodal)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: 逐字檢查與角色確認 */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-4 text-xs text-blue-950 flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold">第一步：對話文字校對與角色確認（尚未更新需求）：</span>
                  <p className="text-blue-900 leading-relaxed">
                    請仔細檢查文字內容（特別是<strong>金額、人名、地址與否定詞</strong>）。
                    發言者角色不能單憑氣泡位置或顏色判定，請依對話內容<strong>手動確認角色</strong>。
                    若有跨圖滾動重疊訊息，系統已標註為「疑似重複」，您可以選擇略過重複訊息。
                  </p>
                </div>
              </div>

              {analyzeError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{analyzeError}</span>
                </div>
              )}

              {/* Messages List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>辨識出 {messages.length} 則訊息：</span>
                  <button
                    type="button"
                    onClick={() => handleAddMessage(messages.length - 1)}
                    className="text-xs text-cyan-700 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>手動補增一則漏網訊息</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {messages.map((msg, idx) => (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-2xl border transition space-y-2.5 ${
                        msg.isIgnored
                          ? 'bg-slate-100/60 border-slate-200 opacity-60'
                          : msg.isSuspectedDuplicate
                          ? 'bg-amber-50/70 border-amber-300'
                          : msg.isAmbiguous
                          ? 'bg-purple-50/60 border-purple-200'
                          : 'bg-white border-slate-200 shadow-2xs'
                      }`}
                    >
                      {/* Message Meta Row */}
                      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-900 text-white">
                            #{idx + 1}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                            來源圖片 #{msg.imageIndex}
                          </span>
                          {msg.isSuspectedDuplicate && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-200 text-amber-900 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>疑似跨圖重疊訊息（{msg.duplicateReason || '文字高度吻合'}）</span>
                            </span>
                          )}
                          {msg.isAmbiguous && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-200 text-purple-900">
                              ⚠️ 畫面疑義：{msg.ambiguityReason || '邊緣裁切或模糊'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleIgnore(msg.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                              msg.isIgnored
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {msg.isIgnored ? '已略過（點此恢復）' : '略過此則'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="刪除此則"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Role & Speaker & Timestamp Controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                            確認發言者角色：
                          </label>
                          <select
                            value={msg.confirmedRole}
                            onChange={(e) => handleUpdateRole(msg.id, e.target.value as any)}
                            disabled={msg.isIgnored}
                            className={`w-full rounded-xl px-2.5 py-1.5 text-xs font-bold border transition ${
                              msg.confirmedRole === 'buyer'
                                ? 'bg-cyan-50 border-cyan-400 text-cyan-950'
                                : msg.confirmedRole === 'agent'
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                                : msg.confirmedRole === 'family'
                                ? 'bg-purple-50 border-purple-400 text-purple-950'
                                : 'bg-slate-50 border-slate-300 text-slate-700'
                            }`}
                          >
                            <option value="buyer">買方本人 (buyer)</option>
                            <option value="agent">業務經紀人 (agent)</option>
                            <option value="family">買方家人／配偶 (family)</option>
                            <option value="other">其他成員／未知 (other)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                            畫面名稱標示：
                          </label>
                          <input
                            type="text"
                            value={msg.rawSpeakerLabel}
                            onChange={(e) => handleUpdateSpeakerLabel(msg.id, e.target.value)}
                            disabled={msg.isIgnored}
                            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800"
                            placeholder="如：陳先生、自己"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                            對話時間戳記：
                          </label>
                          <input
                            type="text"
                            value={msg.timestampStr}
                            onChange={(e) => handleUpdateTimestamp(msg.id, e.target.value)}
                            disabled={msg.isIgnored}
                            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800"
                            placeholder="如：下午 2:15 或 未知"
                          />
                        </div>
                      </div>

                      {/* Message Content Edit */}
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                          訊息文字（可手動更正同音字、預算數字與否定詞）：
                        </label>
                        <textarea
                          rows={2}
                          value={msg.text}
                          onChange={(e) => handleUpdateMessageText(msg.id, e.target.value)}
                          disabled={msg.isIgnored}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 font-sans"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons Step 2 */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
                >
                  ← 返回截圖上傳與排序
                </button>

                <button
                  type="button"
                  onClick={handleAnalyzeRequirements}
                  disabled={isAnalyzing}
                  className="min-h-[44px] px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-200 disabled:text-slate-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs transition"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>正在依校對文字分析買方需求（純文字分析，不耗圖片配額）...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>確認文字無誤，開始分析買方需求 →</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: 需求分析與差異對照 */}
          {currentStep === 3 && analysisDraft && (
            <div className="space-y-6">
              {/* Diff Comparison Table if existing buyer */}
              {diffItems.length > 0 && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      <span>與既有買方需求對照差異（請逐項勾選是否接受更新）：</span>
                    </div>
                    <span className="text-[11px] text-amber-800">
                      未勾選之項目絕不覆蓋；空值不清除既有欄位
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-amber-200 text-amber-900 font-bold">
                          <th className="py-2 px-2.5">欄位項目</th>
                          <th className="py-2 px-2.5">系統既有數值</th>
                          <th className="py-2 px-2.5">對話分析建議值</th>
                          <th className="py-2 px-2.5">來源訊息與變更順序</th>
                          <th className="py-2 px-2.5 text-center">接受更新</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100">
                        {diffItems.map((item) => (
                          <tr key={item.fieldKey} className="hover:bg-amber-100/40">
                            <td className="py-2.5 px-2.5 font-bold text-slate-800">{item.fieldLabel}</td>
                            <td className="py-2.5 px-2.5 text-slate-500 line-through">
                              {item.currentValueDisplay}
                            </td>
                            <td className="py-2.5 px-2.5 font-bold text-cyan-900">
                              {item.proposedValueDisplay}
                            </td>
                            <td className="py-2.5 px-2.5 text-slate-600 max-w-xs">
                              <div>原話：「{item.sourceQuote}」</div>
                              {item.changeNote && (
                                <div className="text-[10px] text-amber-800 font-semibold mt-0.5">
                                  說明：{item.changeNote}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={item.accepted}
                                onChange={() => handleToggleDiffAccept(item.fieldKey)}
                                className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Analysis Summary Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. 購屋目的與預算 */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                    <span>購屋目的與總價預算</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded">
                      客觀推論
                    </span>
                  </div>
                  <div className="text-xs space-y-1">
                    <div>
                      <strong className="text-slate-700">購屋目的：</strong>
                      <span className="font-semibold text-slate-900">
                        {analysisDraft.purchasePurpose?.value || '自住'}
                      </span>
                      <span className="text-[11px] text-slate-500 ml-1.5">
                        （原話：「{analysisDraft.purchasePurpose?.sourceQuote || '—'}」）
                      </span>
                    </div>
                    <div>
                      <strong className="text-slate-700">總價預算：</strong>
                      <span className="font-bold text-cyan-800 text-sm">
                        {analysisDraft.budget?.maxWan ? `${analysisDraft.budget.maxWan} 萬元` : '未明確提供'}
                      </span>
                      <span className="text-[11px] text-slate-500 ml-1">
                        （{analysisDraft.budget?.includesParking === 'yes' ? '含車位' : analysisDraft.budget?.includesParking === 'no' ? '不含車位' : '是否含車位未明'}）
                      </span>
                    </div>
                    {analysisDraft.budget?.changeSequence && (
                      <div className="p-2 bg-amber-50 rounded-lg text-[11px] text-amber-900 border border-amber-200">
                        <strong>預算變更記錄：</strong> {analysisDraft.budget.changeSequence}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. 區域與房型 */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                    <span>希望區域與格局房數</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded">
                      客觀推論
                    </span>
                  </div>
                  <div className="text-xs space-y-1">
                    <div>
                      <strong className="text-slate-700">鎖定區域：</strong>
                      <span className="font-semibold text-slate-900">
                        {analysisDraft.preferredRegions?.regions?.join('、') || '尚未明確指定'}
                      </span>
                      <span className="text-[11px] text-slate-500 ml-1.5">
                        （原話：「{analysisDraft.preferredRegions?.sourceQuote || '—'}」）
                      </span>
                    </div>
                    <div>
                      <strong className="text-slate-700">房數與房型：</strong>
                      <span className="font-semibold text-slate-900">
                        {analysisDraft.roomsAndType?.minRooms ? `${analysisDraft.roomsAndType.minRooms} 房起` : '未指定房數'}
                        {analysisDraft.roomsAndType?.propertyTypes?.length ? ` · ${analysisDraft.roomsAndType.propertyTypes.join('/')}` : ''}
                      </span>
                    </div>
                    {analysisDraft.roomsAndType?.isPreferenceOnly && (
                      <div className="p-2 bg-blue-50 rounded-lg text-[11px] text-blue-900 border border-blue-200">
                        <strong>規則保護：</strong> 業務推薦四房而買方僅回考慮 ➔ 僅列為偏好，不強硬變更為必要條件。
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. 通勤、學區與時程 */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                    <span>通勤目標、學區與購屋時程</span>
                  </div>
                  <div className="text-xs space-y-1">
                    <div>
                      <strong className="text-slate-700">通勤目標：</strong>
                      <span>{analysisDraft.commuteAndFamily?.commuteTarget || '未特別提及'}</span>
                    </div>
                    <div>
                      <strong className="text-slate-700">學區/生活：</strong>
                      <span>{analysisDraft.commuteAndFamily?.schoolDistrict || analysisDraft.commuteAndFamily?.familyAndLifestyle || '未提及'}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        * 學區資格依法受戶政與管制規範，僅作對話紀錄，未查證。
                      </span>
                    </div>
                    <div>
                      <strong className="text-slate-700">購屋時程：</strong>
                      <span className="font-semibold text-slate-900">
                        {analysisDraft.timeline?.value || '未定'}
                      </span>
                      {!analysisDraft.timeline?.isDateConfirmed && (
                        <span className="text-[10px] text-amber-700 font-bold ml-1.5">
                          ⚠️「明天」缺少年月日，標記為待確認，未自創時程
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. 約定事項與待追問 */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                    <span>明確約定事項與待追問問題</span>
                  </div>
                  <div className="text-xs space-y-1.5">
                    {analysisDraft.agreedNextSteps?.length > 0 ? (
                      analysisDraft.agreedNextSteps.map((step, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-emerald-900 bg-emerald-50 p-1.5 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">{step.item}</span>
                            <span className="text-[11px] text-emerald-700 ml-1">
                              ({step.hasExactDate ? step.dueDateStr : '待確認確切日期'})
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-400">對話中尚無明確約定</span>
                    )}

                    {analysisDraft.followUpQuestions?.length > 0 && (
                      <div className="text-[11px] text-slate-600 pt-1">
                        <strong>尚待追問：</strong> {analysisDraft.followUpQuestions.join('；')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* LINE Draft Message Box */}
              {analysisDraft.lineDraft && (
                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-4.5 space-y-2.5 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-300">
                          AI 擬定 LINE 回覆草稿（情境：{analysisDraft.lineDraft.scenario}）
                        </div>
                        <div className="text-[10px] text-slate-400">
                          依買方原話擬定，草稿僅供複製編輯，複製不代表已發送 LINE 訊息
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyLineDraft}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shrink-0"
                    >
                      {copiedDraft ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>已複製草稿</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>複製草稿</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-3 bg-slate-800/80 rounded-xl text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans border border-slate-700/80">
                    {analysisDraft.lineDraft.messageText}
                  </div>
                </div>
              )}

              {/* Step 4 Checkboxes */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-900">
                  請勾選本次分析確認後欲寫入系統之操作：
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={optSaveImport}
                      onChange={(e) => setOptSaveImport(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-slate-900">保存本次對話與分析紀錄</div>
                      <div className="text-[10px] text-slate-500">供日後隨時調閱校對文字與分析推論</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={optSaveToBuyer}
                      onChange={(e) => setOptSaveToBuyer(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-slate-900">
                        {targetType === 'coop_buyer'
                          ? '合作買方保存（不建立正式買方）'
                          : targetType === 'existing_buyer'
                          ? '更新既有買方正式需求'
                          : '建立新買方客戶檔案'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {targetType === 'coop_buyer'
                          ? '僅記錄稱呼與合作店來源，不建立買方紀錄'
                          : '僅寫入確認勾選項目，空值不覆蓋已有內容'}
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={optSaveFollowUp}
                      onChange={(e) => setOptSaveFollowUp(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-slate-900">新增追蹤紀錄時間軸</div>
                      <div className="text-[10px] text-slate-500">自動記入 LINE 管道追蹤回饋與觀察事項</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={optCreateTasks}
                      onChange={(e) => setOptCreateTasks(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-slate-900">建立約定事項與待辦</div>
                      <div className="text-[10px] text-slate-500">若有約定看屋自動轉入待辦追蹤</div>
                    </div>
                  </label>
                </div>
              </div>

              {confirmError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{confirmError}</span>
                </div>
              )}

              {/* Action Buttons Step 3 */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
                >
                  ← 返回修改文字或角色
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAndIntegrate}
                  disabled={isConfirming}
                  className="min-h-[44px] px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs transition"
                >
                  {isConfirming ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>正在整合存入系統...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>確認並存入系統 (防重複機制保護)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: 完成整合 */}
          {currentStep === 4 && (
            <div className="text-center py-8 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">LINE 對話分析已成功確認存檔！</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                  校對文字、客觀分析推論與後續約定事項已完整寫入資料庫。伺服器暫存圖片已完全清除，未保存任何影像或 Base64 檔案。
                </p>
              </div>

              {integrationResult?.appliedActions && (
                <div className="max-w-md mx-auto bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-1.5 text-left">
                  <div className="font-bold text-slate-900 mb-1">本次執行成果摘要：</div>
                  {integrationResult.appliedActions.updatedBuyerId && (
                    <div className="text-emerald-700">✓ 已更新既有買方正式需求（未勾選或空值項目未改動）</div>
                  )}
                  {integrationResult.appliedActions.createdBuyerId && (
                    <div className="text-emerald-700">✓ 已成功建立新買方客戶正式建檔</div>
                  )}
                  {integrationResult.appliedActions.savedFollowUpId && (
                    <div className="text-blue-700">✓ 已記錄一筆 LINE 互動追蹤紀錄</div>
                  )}
                  {integrationResult.appliedActions.createdTaskIds?.length > 0 && (
                    <div className="text-purple-700">
                      ✓ 已建立 {integrationResult.appliedActions.createdTaskIds.length} 項約定待辦事項
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
                >
                  關閉視窗
                </button>

                {integrationResult?.targetBuyer?.id && onNavigateToBuyer && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateToBuyer(integrationResult.targetBuyer.id);
                      onClose();
                    }}
                    className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
                  >
                    <span>前往客戶詳情與開始配案 →</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* History Drawer Modal / Slide-over */}
        {showHistoryDrawer && (
          <div className="fixed inset-0 z-60 bg-black/50 flex justify-end">
            <div className="bg-white w-full max-w-md h-full p-5 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-700" />
                  <span className="text-sm font-bold text-slate-900">歷史對話分析紀錄</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryDrawer(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-3">
                {loadingHistory ? (
                  <div className="text-center py-8 text-xs text-slate-400">載入歷史紀錄中...</div>
                ) : historyImports.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">目前尚無歷史分析紀錄</div>
                ) : (
                  historyImports.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs space-y-1.5 transition cursor-pointer"
                      onClick={() => {
                        setCurrentImportId(rec.id);
                        setMessages(rec.messages || []);
                        if (rec.analysisDraft) {
                          setAnalysisDraft(rec.analysisDraft);
                          setDiffItems(rec.analysisDraft.diffItems || []);
                          setCurrentStep(3);
                        } else {
                          setCurrentStep(2);
                        }
                        setShowHistoryDrawer(false);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{rec.buyerName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {formatTaipeiTime(rec.createdAt)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        狀態：
                        <span
                          className={`font-semibold ml-1 ${
                            rec.status === 'confirmed'
                              ? 'text-emerald-700'
                              : rec.status === 'analyzed'
                              ? 'text-cyan-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {rec.status === 'confirmed' ? '已確認整合' : rec.status === 'analyzed' ? '已分析需求' : '文字辨識中'}
                        </span>
                        <span className="mx-1.5 text-slate-300">|</span>
                        截圖 {rec.imageCount} 張 · 訊息 {rec.messages?.length || 0} 則
                      </div>
                      {rec.analysisDraft?.budget?.maxWan && (
                        <div className="text-[10px] text-slate-500 truncate">
                          分析預算：{rec.analysisDraft.budget.maxWan} 萬 · 目的：{rec.analysisDraft.purchasePurpose?.value}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
