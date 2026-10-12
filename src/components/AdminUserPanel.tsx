import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserCheck,
  UserX,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  Lock,
  Building2,
  Calendar,
  X,
  AlertCircle,
  Key,
  Copy,
  Check,
} from 'lucide-react';
import { UserAccount, UserApprovalStatus, ApprovalAuditLogRecord } from '../types';
import { getAuthHeaders, formatTaipeiTime } from '../utils';

interface AdminUserPanelProps {
  token: string | null;
  useSandbox: boolean;
  currentUser: UserAccount;
}

type TabFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'suspended';

export const AdminUserPanel: React.FC<AdminUserPanelProps> = ({ token, useSandbox, currentUser }) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<TabFilter>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Decision Modal State
  const [decisionModal, setDecisionModal] = useState<{
    targetUser: UserAccount;
    action: 'approve' | 'reject' | 'suspend' | 'restore';
  } | null>(null);
  const [publicReason, setPublicReason] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // Audit Logs Modal
  const [showAuditLogsModal, setShowAuditLogsModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<ApprovalAuditLogRecord[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  // Password Reset Modal State
  const [resetModalUser, setResetModalUser] = useState<UserAccount | null>(null);
  const [customNewPassword, setCustomNewPassword] = useState('');
  const [generatedTempPassword, setGeneratedTempPassword] = useState<string | null>(null);
  const [submittingReset, setSubmittingReset] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: getAuthHeaders(token, useSandbox),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '無法讀取帳號清單');
        setLoading(false);
        return;
      }
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err?.message || '網路錯誤');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token, useSandbox, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const openDecisionModal = (targetUser: UserAccount, action: 'approve' | 'reject' | 'suspend' | 'restore') => {
    setDecisionModal({ targetUser, action });
    setPublicReason('');
    setInternalNote('');
    setDecisionError(null);
  };

  const handleExecuteDecision = async () => {
    if (!decisionModal) return;
    const { targetUser, action } = decisionModal;

    if ((action === 'reject' || action === 'suspend') && !publicReason.trim()) {
      setDecisionError(action === 'reject' ? '請填寫未通過的原因（供申請人檢視）。' : '請填寫停用原因。');
      return;
    }

    setSubmittingDecision(true);
    setDecisionError(null);

    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}/decision`, {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({
          action,
          publicReason: publicReason.trim() || undefined,
          internalNote: internalNote.trim() || undefined,
          currentVersion: targetUser.version,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDecisionError(data.error || '操作失敗');
        setSubmittingDecision(false);
        return;
      }

      setDecisionModal(null);
      setActionSuccess(`已成功完成帳號操作（對象：${targetUser.name}）`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchUsers();
    } catch {
      setDecisionError('連線至伺服器失敗，請檢查網路後重試。');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const openResetPasswordModal = (targetUser: UserAccount) => {
    setResetModalUser(targetUser);
    setCustomNewPassword('');
    setGeneratedTempPassword(null);
    setResetError(null);
    setCopiedPassword(false);
  };

  const handleResetPassword = async () => {
    if (!resetModalUser) return;
    setSubmittingReset(true);
    setResetError(null);
    try {
      const res = await fetch(`/api/admin/users/${resetModalUser.id}/reset-password`, {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({ newPassword: customNewPassword.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error || '重設密碼失敗');
        setSubmittingReset(false);
        return;
      }
      setGeneratedTempPassword(data.temporaryPassword);
      setActionSuccess(`已成功為 ${resetModalUser.name} 重設密碼！`);
      setTimeout(() => setActionSuccess(null), 5000);
      fetchUsers();
    } catch {
      setResetError('連線至伺服器失敗，請稍後重試。');
    } finally {
      setSubmittingReset(false);
    }
  };

  const fetchAuditLogs = async (userId?: string) => {
    setLoadingAuditLogs(true);
    try {
      const url = userId ? `/api/admin/approval-audit-logs?targetUserId=${userId}` : '/api/admin/approval-audit-logs';
      const res = await fetch(url, {
        headers: getAuthHeaders(token, useSandbox),
      });
      const data = await res.json();
      if (res.ok) {
        setAuditLogs(data.logs || []);
        setShowAuditLogsModal(true);
      }
    } catch {
      alert('無法取得審核紀錄');
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const isDemoAdmin = Boolean(currentUser.isDemoAccount);

  const getStatusBadge = (status: UserApprovalStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            已核可
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            待核可
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <XCircle className="w-3.5 h-3.5" />
            未通過
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <Lock className="w-3.5 h-3.5" />
            已停用
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 flex items-center justify-between flex-wrap gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs text-teal-700 font-bold">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>平台管理員控制中心</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-0.5">帳號管理與審核</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            管理業務帳號申請、審核狀態與停用。管理權限嚴格獨立，不具備調閱各別業務專員之私密客戶或物件權限。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchAuditLogs()}
            disabled={loadingAuditLogs}
            className="min-h-[44px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>核可操作日誌</span>
          </button>
          <button
            type="button"
            onClick={fetchUsers}
            className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>重新整理</span>
          </button>
        </div>
      </div>

      {/* Demo isolation notice */}
      {isDemoAdmin && (
        <div className="bg-cyan-50 border border-cyan-200 text-cyan-900 p-3.5 rounded-xl text-xs space-y-1">
          <span className="font-bold flex items-center gap-1.5 text-cyan-800">
            <ShieldCheck className="w-4 h-4 text-cyan-700" />
            示範管理員沙盒隔離模式
          </span>
          <p className="text-[11px] text-cyan-800 leading-relaxed">
            您目前以測試示範管理員身分檢視。依系統信任邊界規範，示範管理員僅限管理測試示範帳號，正式帳號已完整隔離保護。
          </p>
        </div>
      )}

      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'pending', label: '待核可' },
            { id: 'approved', label: '已核可' },
            { id: 'rejected', label: '未通過' },
            { id: 'suspended', label: '已停用' },
            { id: 'all', label: '全部帳號' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as TabFilter)}
              className={`min-h-[38px] px-4 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋姓名、Email 或店別／公司..."
              className="w-full min-h-[42px] pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="min-h-[42px] px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            搜尋
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                fetchUsers();
              }}
              className="min-h-[42px] px-3 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-200 transition cursor-pointer"
            >
              清除
            </button>
          )}
        </form>
      </div>

      {/* Users List / Cards */}
      {loading ? (
        <div className="bg-white rounded-2xl p-10 text-center text-xs text-slate-500 border border-slate-200">
          <RefreshCw className="w-5 h-5 text-slate-400 animate-spin mx-auto mb-2" />
          載入帳號清單中...
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center text-slate-500 border border-slate-200 space-y-1">
          <Filter className="w-6 h-6 text-slate-300 mx-auto mb-1" />
          <div className="text-sm font-bold text-slate-700">目前沒有符合條件的帳號</div>
          <p className="text-xs text-slate-400">可切換篩選標籤或清除關鍵字重新查詢。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const isProtectedSuperAdmin = u.email === 'chlorain@gmail.com' || u.id === 'user_owner_admin';
            const isSelf = u.id === currentUser.id;

            return (
              <div
                key={u.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-slate-300 transition"
              >
                {/* User Info Column */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {getStatusBadge(u.status)}
                    <span className="font-semibold text-slate-600">
                      {u.role === 'admin' ? '平台管理員 (platform_admin)' : '一般業務 (agent)'}
                    </span>
                    {u.isDemoAccount ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200">
                        示範測試帳號
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        正式認證帳號
                      </span>
                    )}
                    {isProtectedSuperAdmin && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        超級管理員（系統保護）
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-slate-900">{u.name}</span>
                    {u.username && (
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-lg">
                        帳號：{u.username}
                      </span>
                    )}
                    {u.company && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {u.company}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 font-mono flex items-center gap-3 flex-wrap">
                    <span>信箱：{u.contactEmail || u.email}</span>
                    {u.contactPhone && (
                      <>
                        <span className="text-slate-300">|</span>
                        <span>電話：{u.contactPhone}</span>
                      </>
                    )}
                    <span className="text-slate-300">|</span>
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <Calendar className="w-3 h-3" />
                      申請於：{formatTaipeiTime(u.submittedAt || u.createdAt)}
                    </span>
                    {u.reviewedAt && (
                      <>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-400">最近審核：{formatTaipeiTime(u.reviewedAt)}</span>
                      </>
                    )}
                  </div>

                  {/* Public Reason (If rejected or suspended) */}
                  {u.publicReason && (
                    <div className="mt-2 text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-xl space-y-0.5">
                      <span className="font-bold text-slate-700">公開原因說明：</span>
                      <p className="text-slate-600">{u.publicReason}</p>
                    </div>
                  )}

                  {/* Internal Admin Note (Only visible to admin) */}
                  {u.internalNote && (
                    <div className="mt-1 text-xs bg-amber-50/70 border border-amber-200/80 p-2.5 rounded-xl space-y-0.5">
                      <span className="font-bold text-amber-900">管理員內部備註（不對申請人公開）：</span>
                      <p className="text-amber-800">{u.internalNote}</p>
                    </div>
                  )}
                </div>

                {/* Operations Column */}
                <div className="flex items-center flex-wrap gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                  {/* Action 1: Pending -> Approve */}
                  {u.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => openDecisionModal(u, 'approve')}
                      className="min-h-[42px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>核可使用</span>
                    </button>
                  )}

                  {/* Action 2: Pending -> Reject */}
                  {u.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => openDecisionModal(u, 'reject')}
                      className="min-h-[42px] px-3.5 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>不予核可</span>
                    </button>
                  )}

                  {/* Action 3: Approved -> Suspend */}
                  {u.status === 'approved' && (
                    <button
                      type="button"
                      disabled={isProtectedSuperAdmin || isSelf}
                      onClick={() => openDecisionModal(u, 'suspend')}
                      className="min-h-[42px] px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title={
                        isProtectedSuperAdmin
                          ? '超級管理員受系統保護，不可停用'
                          : isSelf
                          ? '不可停用目前登入中的自己'
                          : '停用該帳號的平台使用權限'
                      }
                    >
                      <UserX className="w-4 h-4" />
                      <span>停用帳號</span>
                    </button>
                  )}

                  {/* Action 4: Suspended -> Restore */}
                  {u.status === 'suspended' && (
                    <button
                      type="button"
                      onClick={() => openDecisionModal(u, 'restore')}
                      className="min-h-[42px] px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>恢復使用</span>
                    </button>
                  )}

                  {/* Action 5: Reset Password */}
                  <button
                    type="button"
                    onClick={() => openResetPasswordModal(u)}
                    className="min-h-[42px] px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    title="為該帳號重設密碼"
                  >
                    <Key className="w-3.5 h-3.5 text-slate-500" />
                    <span>重設密碼</span>
                  </button>

                  {/* View History for this user */}
                  <button
                    type="button"
                    onClick={() => fetchAuditLogs(u.id)}
                    className="min-h-[42px] px-3 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-medium rounded-xl transition cursor-pointer"
                    title="檢視該帳號之歷次審核紀錄"
                  >
                    歷程
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Decision Confirmation Modal */}
      {decisionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    decisionModal.action === 'approve' || decisionModal.action === 'restore'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {decisionModal.action === 'approve' || decisionModal.action === 'restore' ? (
                    <UserCheck className="w-5 h-5" />
                  ) : (
                    <UserX className="w-5 h-5" />
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {decisionModal.action === 'approve' && '確認核可帳號開通'}
                  {decisionModal.action === 'reject' && '確認不予核可申請'}
                  {decisionModal.action === 'suspend' && '確認停用帳號使用權'}
                  {decisionModal.action === 'restore' && '確認恢復帳號使用'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDecisionModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Account Overview */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{decisionModal.targetUser.name}</span>
                <span className="text-slate-500 font-mono">{decisionModal.targetUser.email}</span>
              </div>
              <div className="text-slate-600">
                所屬店別：{decisionModal.targetUser.company || '尚未填寫'}
              </div>
              <div className="text-slate-500">
                目前狀態：{decisionModal.targetUser.status}
              </div>
            </div>

            {/* Impact Explanation */}
            <p className="text-xs text-slate-600 leading-relaxed">
              {decisionModal.action === 'approve' &&
                '核可後，該帳號將進入正式工作區，可開始建立其專屬的客戶、物件與帶看資料。核可一般申請僅開通業務資格，不會提升為管理員。'}
              {decisionModal.action === 'reject' &&
                '未通過後，該帳號登入後將僅能查閱您留下的公開原因，並可修正姓名與店別後重新提交。'}
              {decisionModal.action === 'suspend' &&
                '停用後，該帳號若正在使用中，下一次正式資料請求將立即被後端拒絕中斷，且前端將回到停用狀態提示頁。'}
              {decisionModal.action === 'restore' &&
                '恢復後，該帳號將重回已核可狀態，其原本建立之客戶與物件資料完好保留並可繼續操作。'}
            </p>

            {/* Reason Inputs (Required for reject & suspend) */}
            {(decisionModal.action === 'reject' || decisionModal.action === 'suspend') && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    公開原因說明 <span className="text-rose-600">*（申請人本人可見）</span>
                  </label>
                  <textarea
                    rows={3}
                    value={publicReason}
                    onChange={(e) => setPublicReason(e.target.value)}
                    placeholder="請明確填寫原因，例如：所屬店別未能查證、資料不齊全請補正..."
                    className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:border-rose-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    管理員內部備註 <span className="text-slate-500">（僅管理團隊內部留存，不向申請人公開）</span>
                  </label>
                  <input
                    type="text"
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    placeholder="內部查證紀錄、聯絡備註（選填）..."
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:border-slate-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {decisionError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-bold">
                {decisionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={submittingDecision}
                onClick={() => setDecisionModal(null)}
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={submittingDecision}
                onClick={handleExecuteDecision}
                className={`min-h-[42px] px-5 py-2 text-xs font-bold text-white rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                  decisionModal.action === 'approve' || decisionModal.action === 'restore'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                } disabled:opacity-50`}
              >
                {submittingDecision && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>確認送出</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">管理員密碼重設</h3>
              </div>
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Account Info */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{resetModalUser.name}</span>
                <span className="font-mono text-teal-700 font-bold">帳號：{resetModalUser.username || '無'}</span>
              </div>
              <div className="text-slate-500 font-mono">信箱：{resetModalUser.contactEmail || resetModalUser.email}</div>
              <div className="text-slate-500">所屬店別：{resetModalUser.company || '尚未填寫'}</div>
            </div>

            {generatedTempPassword ? (
              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                  <div className="text-xs font-bold flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>密碼已成功重設！請將下方臨時密碼提供給該業務：</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-emerald-200 font-mono text-sm font-bold text-slate-900 select-all">
                    <span>{generatedTempPassword}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedTempPassword);
                        setCopiedPassword(true);
                        setTimeout(() => setCopiedPassword(false), 2500);
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg flex items-center gap-1 cursor-pointer transition"
                    >
                      {copiedPassword ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPassword ? '已複製' : '複製'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    該業務可以使用其帳號 <strong>{resetModalUser.username}</strong> 與此密碼立即登入。
                  </p>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setResetModalUser(null)}
                    className="min-h-[42px] px-5 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    完成關閉
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    指定新密碼（留空則自動產生高強度臨時密碼）
                  </label>
                  <input
                    type="text"
                    value={customNewPassword}
                    onChange={(e) => setCustomNewPassword(e.target.value)}
                    placeholder="若自訂，長度至少需為 8 個字元..."
                    className="w-full text-xs min-h-[42px] px-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    若留空直接送出，系統將自動產生符合 OWASP 規範之安全臨時密碼並供您一鍵複製。
                  </p>
                </div>

                {resetError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-bold">
                    {resetError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={submittingReset}
                    onClick={() => setResetModalUser(null)}
                    className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={submittingReset}
                    onClick={handleResetPassword}
                    className="min-h-[42px] px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {submittingReset && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>執行重設密碼</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit Logs Modal */}
      {showAuditLogsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col p-6 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900">帳號審核操作歷程記錄</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditLogsModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {auditLogs.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">目前尚無操作紀錄</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{log.targetUserName}</span>
                        {log.targetUsername && (
                          <span className="text-teal-700 font-mono font-bold">(@{log.targetUsername})</span>
                        )}
                        <span className="text-slate-500 font-mono">({log.targetUserEmail})</span>
                      </div>
                      <span className="text-slate-400 font-mono tabular-nums">
                        {formatTaipeiTime(log.timestamp)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600 flex-wrap">
                      <span>操作：</span>
                      <span className="font-bold text-slate-900">
                        {log.action === 'approve' && '核可使用'}
                        {log.action === 'reject' && '不予核可'}
                        {log.action === 'suspend' && '停用帳號'}
                        {log.action === 'restore' && '恢復使用'}
                        {log.action === 'reset_password' && '重設密碼'}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span>狀態變更：{log.fromStatus} → {log.toStatus}</span>
                      <span className="text-slate-300">·</span>
                      <span>處理者：{log.operatorUserName}</span>
                    </div>

                    {log.publicReason && (
                      <div className="text-slate-700 bg-white p-2 rounded-lg border border-slate-200/80">
                        公開原因：{log.publicReason}
                      </div>
                    )}
                    {log.internalNote && (
                      <div className="text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                        內部備註：{log.internalNote}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAuditLogsModal(false)}
                className="min-h-[40px] px-5 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
