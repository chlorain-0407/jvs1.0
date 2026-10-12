import React, { useState } from 'react';
import { Shield, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { UserAccount } from '../types';
import { getAuthHeaders } from '../utils';

interface IsolationVerifierModalProps {
  token: string | null;
  useSandbox: boolean;
  currentUser: UserAccount;
  onClose: () => void;
}

export const IsolationVerifierModal: React.FC<IsolationVerifierModalProps> = ({
  token,
  useSandbox,
  currentUser,
  onClose,
}) => {
  const [logs, setLogs] = useState<
    { action: string; status: number; passed: boolean; responseMessage: string }[]
  >([]);
  const [testing, setTesting] = useState(false);

  const targetOtherBuyerId = currentUser.id === 'user_agent_a' ? 'buyer_b_secret' : 'buyer_a_existing';
  const targetOtherPropId = currentUser.id === 'user_agent_a' ? 'prop_b_1' : 'prop_a_1';

  const runIsolationTests = async () => {
    setTesting(true);
    const results: { action: string; status: number; passed: boolean; responseMessage: string }[] = [];

    try {
      const r1 = await fetch(`/api/buyers/${targetOtherBuyerId}`, {
        headers: getAuthHeaders(token, useSandbox),
      });
      const d1 = await r1.json();
      results.push({
        action: `直接請求讀取其他業務客戶 (GET /api/buyers/${targetOtherBuyerId})`,
        status: r1.status,
        passed: r1.status === 403,
        responseMessage: d1.error || JSON.stringify(d1),
      });
    } catch (e: any) {
      results.push({ action: '讀取其他業務客戶', status: 500, passed: false, responseMessage: e.message });
    }

    try {
      const r2 = await fetch(`/api/properties/${targetOtherPropId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({ totalPriceWan: 999 }),
      });
      const d2 = await r2.json();
      results.push({
        action: `直接請求竄改其他業務物件總價 (PUT /api/properties/${targetOtherPropId})`,
        status: r2.status,
        passed: r2.status === 403,
        responseMessage: d2.error || JSON.stringify(d2),
      });
    } catch (e: any) {
      results.push({ action: '更新其他業務物件', status: 500, passed: false, responseMessage: e.message });
    }

    try {
      const r3 = await fetch(`/api/match/run`, {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({ buyerId: targetOtherBuyerId }),
      });
      const d3 = await r3.json();
      results.push({
        action: `直接請求對其他業務客戶執行配案 (POST /api/match/run)`,
        status: r3.status,
        passed: r3.status === 403,
        responseMessage: d3.error || JSON.stringify(d3),
      });
    } catch (e: any) {
      results.push({ action: '對其他業務客戶配案', status: 500, passed: false, responseMessage: e.message });
    }

    // Test Case 4: Non-admin trying to call Admin Decision API directly
    if (currentUser.role !== 'admin') {
      try {
        const r4 = await fetch(`/api/admin/users/${currentUser.id}/decision`, {
          method: 'POST',
          headers: getAuthHeaders(token, useSandbox),
          body: JSON.stringify({ action: 'approve' }),
        });
        const d4 = await r4.json();
        results.push({
          action: `一般業務直接呼叫管理審核 API (POST /api/admin/users/.../decision)`,
          status: r4.status,
          passed: r4.status === 403,
          responseMessage: d4.error || JSON.stringify(d4),
        });
      } catch (e: any) {
        results.push({ action: '呼叫管理審核 API', status: 500, passed: false, responseMessage: e.message });
      }
    }

    setLogs(results);
    setTesting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 border border-slate-200 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-700" />
            <h3 className="text-base font-bold text-slate-900">驗收測試 5：跨業務資料隔離與後端權限實測</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 px-2 py-1"
          >
            關閉
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          目前登入身分為：<strong className="text-slate-900">{currentUser.name}</strong>。
          點擊下方按鈕將由瀏覽器直接向後端發送跨帳號請求，驗證後端是否嚴格依據登入身分攔截（HTTP 403），而非僅靠前端隱藏。
        </p>

        <button
          type="button"
          onClick={runIsolationTests}
          disabled={testing}
          className="w-full min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2"
        >
          <Lock className="w-4 h-4 text-cyan-400" />
          <span>{testing ? '正在向後端發送跨帳號攔截測試...' : '立即執行跨帳號越權攔截實測'}</span>
        </button>

        {logs.length > 0 && (
          <div className="space-y-2.5 pt-2">
            {logs.map((log, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl border text-xs space-y-1 ${
                  log.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-900">{log.action}</span>
                  <span className="flex items-center gap-1 text-emerald-800 font-mono">
                    {log.passed ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>HTTP {log.status} 已攔截</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span>HTTP {log.status}</span>
                      </>
                    )}
                  </span>
                </div>
                <div className="text-slate-600">後端回應：{log.responseMessage}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
