import React, { useState } from 'react';
import { HelpCircle, AlertTriangle, Loader2 } from 'lucide-react';

export type TextInputMethod = 'text' | 'paste' | 'unknown';

interface UnifiedTextInputWorkbenchProps {
  value: string;
  onChange: (value: string, method?: TextInputMethod) => void;
  onSubmit: (action: 'submit' | 'reanalyze') => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  isLoading?: boolean;
  loadingLabel?: string;
  error?: string | null;
  onClearError?: () => void;
  canReanalyze?: boolean;
  onReanalyze?: () => void;
  placeholder?: string;
  minRows?: number;
  // Context hints
  buyerHint?: string | null;
  propertyHint?: string | null;
  secondaryAction?: React.ReactNode;
  hintDescription?: string;
}

export const UnifiedTextInputWorkbench: React.FC<UnifiedTextInputWorkbenchProps> = ({
  value,
  onChange,
  onSubmit,
  submitLabel = '整理送出',
  submitDisabled = false,
  isLoading = false,
  loadingLabel = 'AI 整理分析中...',
  error,
  onClearError,
  canReanalyze = false,
  onReanalyze,
  placeholder = '在此輸入或貼上內容...',
  minRows = 4,
  buyerHint,
  propertyHint,
  secondaryAction,
  hintDescription = '可使用手機鍵盤的麥克風輸入，送出前請確認姓名、金額與地址。',
}) => {
  const [showTipModal, setShowTipModal] = useState(false);
  const [lastInputMethod, setLastInputMethod] = useState<TextInputMethod>('text');

  const handlePaste = () => {
    setLastInputMethod('paste');
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    onChange(newVal, lastInputMethod);
    // Reset to 'text' after change
    if (lastInputMethod !== 'text') {
      setTimeout(() => setLastInputMethod('text'), 50);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-3">
      {/* Context Target Header */}
      {(buyerHint || propertyHint) && (
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100 text-xs">
          <span className="text-slate-400 font-medium">目前對象：</span>
          {buyerHint && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-50 border border-cyan-200/70 text-cyan-800 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
              買方：{buyerHint}
            </span>
          )}
          {propertyHint && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200/70 text-blue-800 font-semibold max-w-xs truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              物件：{propertyHint}
            </span>
          )}
        </div>
      )}

      {/* Primary Textarea Area */}
      <div className="relative">
        <textarea
          rows={minRows}
          value={value}
          onChange={handleChange}
          onPaste={handlePaste}
          disabled={isLoading}
          placeholder={placeholder}
          className="w-full p-3.5 text-sm leading-relaxed rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition resize-y font-sans placeholder:text-slate-400 disabled:bg-slate-100 disabled:opacity-75"
        />
        {value.length > 0 && (
          <div className="absolute right-3 bottom-3 text-[11px] font-mono text-slate-400 bg-white/90 px-1.5 py-0.5 rounded shadow-2xs border border-slate-100 pointer-events-none">
            {value.length} 字
          </div>
        )}
      </div>

      {/* Helpful Hint Bar */}
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 px-0.5">
        <p className="leading-snug flex items-center gap-1.5 text-slate-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
          <span>{hintDescription}</span>
        </p>
        <button
          type="button"
          onClick={() => setShowTipModal(true)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-slate-500 hover:text-blue-700 hover:bg-slate-100 transition shrink-0 font-medium cursor-pointer"
          title="手機語音輸入操作說明"
        >
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>輸入說明</span>
        </button>
      </div>

      {/* Error alert with clear */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-2 text-xs text-rose-800 animate-in fade-in">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
          {onClearError && (
            <button
              type="button"
              onClick={onClearError}
              className="text-rose-500 hover:text-rose-700 hover:underline font-bold shrink-0 ml-2"
            >
              清除
            </button>
          )}
        </div>
      )}

      {/* Bottom Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <div className="flex items-center gap-2">
          {secondaryAction}
          {canReanalyze && onReanalyze && (
            <button
              type="button"
              disabled={isLoading || !value.trim()}
              onClick={onReanalyze}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-40 cursor-pointer"
            >
              重新分析
            </button>
          )}
        </div>

        <button
          type="button"
          disabled={isLoading || submitDisabled || !value.trim()}
          onClick={() => onSubmit('submit')}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition shadow-2xs hover:shadow disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{loadingLabel}</span>
            </>
          ) : (
            <span>{submitLabel}</span>
          )}
        </button>
      </div>

      {/* Input Tip Modal */}
      {showTipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span>📱 手機鍵盤語音輸入操作說明</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowTipModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p className="font-semibold text-slate-800">
                本系統為保護客戶隱私與通話安全，不存取裝置麥克風與音訊檔案。如需口述輸入，可利用您手機鍵盤內建的語音輸入功能：
              </p>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 text-[11px]">
                    1
                  </span>
                  <span>點擊輸入框，喚起手機內建鍵盤（iOS 或 Android）。</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 text-[11px]">
                    2
                  </span>
                  <span>點選鍵盤右下角或空白鍵旁的<strong>「麥克風」</strong>圖示開始口述。</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 text-[11px]">
                    3
                  </span>
                  <span>口述完畢後，<strong>請先檢查文字（特別是客戶姓名、預算金額與物件地址）</strong>，確認無誤後再按送出。</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                💡 <strong>提示：</strong>鍵盤語音辨識為手機作業系統內建機制；送出後將由 AI 將整段文字整理為專業房仲草稿，供您二次審核再存檔。
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowTipModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
