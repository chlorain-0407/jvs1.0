import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Users,
  Building2,
  LayoutDashboard,
  ShieldCheck,
  LogOut,
  AlertTriangle,
  Database,
  Sparkles,
  Clock,
  Lock,
  ChevronRight,
  UserPlus,
  Compass,
  CheckSquare,
  MessageSquare,
  Plus,
  Menu,
  X,
  Settings,
  ChevronLeft,
  CheckCircle2,
  Calendar,
  HelpCircle,
  FolderPlus,
  Layers,
  ArrowRight,
  RefreshCw,
  XCircle,
  Type,
  SearchCheck,
} from 'lucide-react';
import {
  UserAccount,
  BuyerRecord,
  PropertyRecord,
  IntakeSessionRecord,
  TourRecord,
  TourTaskRecord,
} from './types';
import { getAuthHeaders, formatTaipeiTime } from './utils';
import { VoiceIntakeWizard } from './components/VoiceIntakeWizard';
import { PropertyManager } from './components/PropertyManager';
import { PropertyImportModal } from './components/PropertyImportModal';
import { CustomerManagementView } from './components/CustomerManagementView';
import { MatchingCenterView } from './components/MatchingCenterView';
import { AdminUserPanel } from './components/AdminUserPanel';
import { IsolationVerifierModal } from './components/IsolationVerifierModal';
import { ShowingTourManager } from './components/ShowingTourManager';
import { TourTaskManager } from './components/TourTaskManager';
import { VoiceAssistantWorkbench } from './components/VoiceAssistantWorkbench';
import { LineConversationModal } from './components/LineConversationModal';

interface SystemStatus {
  mongodb: { configured: boolean; error: string | null; isActualMongo: boolean };
  gemini: { configured: boolean; modelName: string };
  googleAuth: { configured: boolean; clientId: string | null };
  timezone: string;
}

export function App() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [useSandbox, setUseSandbox] = useState<boolean>(() => {
    return localStorage.getItem('jarvis_use_sandbox') === 'true';
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('jarvis_session_token'));
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<UserAccount[]>([]);
  const [authLoading, setAuthLoading] = useState(true);

  // Desktop navigation items: 工作台、客戶管理、配案中心、物件、帶看、待辦
  const [activeTab, setActiveTab] = useState<'home' | 'buyers' | 'matching' | 'properties' | 'tours' | 'tasks' | 'intake' | 'admin'>('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const [selectedBuyerIdForView, setSelectedBuyerIdForView] = useState<string | null>(null);
  const [autoRunMatchOnBuyerView, setAutoRunMatchOnBuyerView] = useState<boolean>(false);
  const [preselectedBuyerForIntake, setPreselectedBuyerForIntake] = useState<string | null>(null);

  const [buyers, setBuyers] = useState<BuyerRecord[]>([]);
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [recentSessions, setRecentSessions] = useState<IntakeSessionRecord[]>([]);
  const [tours, setTours] = useState<TourRecord[]>([]);
  const [tasks, setTasks] = useState<TourTaskRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [newRegName, setNewRegName] = useState('');
  const [newRegEmail, setNewRegEmail] = useState('');

  // Modals & Panels
  const [showIsolationModal, setShowIsolationModal] = useState(false);
  const [showAssistantModal, setShowAssistantModal] = useState(false);
  const [assistantActiveBuyerId, setAssistantActiveBuyerId] = useState<string | null>(null);
  const [assistantActivePropertyId, setAssistantActivePropertyId] = useState<string | null>(null);
  const [showLineModal, setShowLineModal] = useState(false);
  const [lineModalBuyerId, setLineModalBuyerId] = useState<string | null>(null);
  const [showPropertyImportModal, setShowPropertyImportModal] = useState(false);

  // Mobile More & Quick Add
  const [showQuickCreateModal, setShowQuickCreateModal] = useState(false);
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [appFormName, setAppFormName] = useState('');
  const [appFormCompany, setAppFormCompany] = useState('');
  const [applicationError, setApplicationError] = useState<string | null>(null);
  const [isEditingApplication, setIsEditingApplication] = useState(false);

  // Authentication UI state (Login / Register Tabs & Modals)
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Registration form state
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regContactEmail, setRegContactEmail] = useState('');
  const [regContactPhone, setRegContactPhone] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Forgot Password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotContact, setForgotContact] = useState('');
  const [forgotReason, setForgotReason] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Font Size state: 'sm' (小) | 'md' (標準) | 'lg' (大) | 'xl' (特大)
  const [textSize, setTextSize] = useState<'sm' | 'md' | 'lg' | 'xl'>(() => {
    const saved = localStorage.getItem('jarvis_text_size');
    return (saved === 'sm' || saved === 'md' || saved === 'lg' || saved === 'xl') ? saved : 'md';
  });

  const handleTextSizeChange = (newSize: 'sm' | 'md' | 'lg' | 'xl') => {
    setTextSize(newSize);
    localStorage.setItem('jarvis_text_size', newSize);
    document.documentElement.setAttribute('data-text-size', newSize);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-text-size', textSize);
  }, [textSize]);

  // Sync application form inputs with current user profile
  useEffect(() => {
    if (currentUser) {
      setAppFormName(currentUser.name || '');
      setAppFormCompany(currentUser.company || '');
    }
  }, [currentUser]);

  const toggleSandboxMode = (val: boolean) => {
    setUseSandbox(val);
    localStorage.setItem('jarvis_use_sandbox', String(val));
  };

  const fetchSystemAndAuth = useCallback(async () => {
    setAuthLoading(true);
    try {
      const [sysRes, meRes, demoRes] = await Promise.all([
        fetch('/api/system/status'),
        fetch('/api/auth/me', { headers: getAuthHeaders(token, useSandbox) }),
        fetch('/api/auth/demo-accounts', { headers: getAuthHeaders(token, useSandbox) }),
      ]);
      const sysData = await sysRes.json();
      setSystemStatus(sysData);

      if (sysData.mongodb?.configured && sysData.mongodb?.isActualMongo && localStorage.getItem('jarvis_use_sandbox') === null) {
        setUseSandbox(false);
      }

      const meData = await meRes.json();
      setCurrentUser(meData.user || null);

      const demoData = await demoRes.json();
      setDemoAccounts(demoData.accounts || []);
    } catch {
      // ignore initial error
    } finally {
      setAuthLoading(false);
    }
  }, [token, useSandbox]);

  useEffect(() => {
    fetchSystemAndAuth();
  }, [fetchSystemAndAuth]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || '帳號或密碼不正確');
        setLoginLoading(false);
        return;
      }
      localStorage.setItem('jarvis_session_token', data.token);
      setToken(data.token);
      setCurrentUser(data.user);
      setLoginPassword('');
    } catch {
      setLoginError('無法連線至伺服器，請檢查網路連線。');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    const normUser = regUsername.trim().toLowerCase();
    if (normUser.length < 4 || normUser.length > 32 || !/^[a-z0-9_.-]+$/.test(normUser)) {
      setRegError('帳號需為 4～32 個字元，僅限英文字母、數字、底線（_）、連字號（-）或句點（.）。');
      return;
    }

    const codePointLen = Array.from(regPassword).length;
    if (codePointLen < 8) {
      setRegError('密碼長度至少需為 8 個字元。');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError('密碼與確認密碼不相符，請重新確認。');
      return;
    }
    if (!regName.trim()) {
      setRegError('請填寫真實姓名。');
      return;
    }
    if (!regCompany.trim()) {
      setRegError('請填寫所屬店別或公司名稱。');
      return;
    }

    setRegLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: normUser,
          password: regPassword,
          confirmPassword: regConfirmPassword,
          name: regName.trim(),
          company: regCompany.trim(),
          contactEmail: regContactEmail.trim() || undefined,
          contactPhone: regContactPhone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegError(data.error || '註冊申請失敗');
        setRegLoading(false);
        return;
      }
      localStorage.setItem('jarvis_session_token', data.token);
      setToken(data.token);
      setCurrentUser(data.user);
      setRegPassword('');
      setRegConfirmPassword('');
    } catch {
      setRegError('無法連線至伺服器，請檢查網路連線。');
    } finally {
      setRegLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername.trim()) {
      setForgotError('請填寫欲重設之登入帳號。');
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: forgotUsername.trim(),
          contactInfo: forgotContact.trim() || undefined,
          reason: forgotReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotError(data.error || '提交失敗');
        setForgotLoading(false);
        return;
      }
      setForgotMsg(data.message || '重設申請已送出！');
    } catch {
      setForgotError('連線異常，請稍後重試。');
    } finally {
      setForgotLoading(false);
    }
  };

  const fetchWorkspaceData = useCallback(async () => {
    if (!currentUser || currentUser.status !== 'approved') return;
    setDataLoading(true);
    try {
      const headers = getAuthHeaders(token, useSandbox);
      const [bRes, pRes, sRes, tourRes, taskRes] = await Promise.all([
        fetch('/api/buyers', { headers }),
        fetch('/api/properties', { headers }),
        fetch('/api/intake-sessions', { headers }),
        fetch('/api/tours', { headers }),
        fetch('/api/tour-tasks', { headers }),
      ]);
      if (bRes.ok) {
        const bData = await bRes.json();
        setBuyers(bData.buyers || []);
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        setProperties(pData.properties || []);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        setRecentSessions(sData.sessions || []);
      }
      if (tourRes.ok) {
        const tData = await tourRes.json();
        setTours(tData.tours || []);
      }
      if (taskRes.ok) {
        const taskData = await taskRes.json();
        setTasks(taskData.tasks || []);
      }
    } catch {
      // ignore
    } finally {
      setDataLoading(false);
    }
  }, [currentUser, token, useSandbox]);

  useEffect(() => {
    fetchWorkspaceData();
  }, [fetchWorkspaceData]);

  // Handle task quick toggle complete from home
  const handleToggleTaskStatus = async (task: TourTaskRecord) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      const res = await fetch(`/api/tour-tasks/${task.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus, completedAt: nextStatus === 'completed' ? new Date().toISOString() : null } : t))
        );
      }
    } catch {
      // ignore
    }
  };

  const handleDemoAccountSwitch = async (userId: string) => {
    const res = await fetch('/api/auth/demo-switch', {
      method: 'POST',
      headers: getAuthHeaders(null, useSandbox),
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (res.ok && data.user) {
      localStorage.setItem('jarvis_session_token', data.token);
      setToken(data.token);
      setCurrentUser(data.user);
      setActiveTab('home');
      setShowSettingsModal(false);
    }
  };

  const handleCustomRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegEmail.trim()) return;
    const res = await fetch('/api/auth/demo-switch', {
      method: 'POST',
      headers: getAuthHeaders(null, useSandbox),
      body: JSON.stringify({ customEmail: newRegEmail, customName: newRegName }),
    });
    const data = await res.json();
    if (res.ok && data.user) {
      localStorage.setItem('jarvis_session_token', data.token);
      setToken(data.token);
      setCurrentUser(data.user);
    }
  };

  const handleApplyApplication = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!appFormName.trim()) {
      setApplicationError('請輸入您的姓名');
      return;
    }
    if (!appFormCompany.trim()) {
      setApplicationError('請輸入所屬店別或公司');
      return;
    }

    setSubmittingApplication(true);
    setApplicationError(null);
    try {
      const res = await fetch('/api/auth/apply', {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({
          name: appFormName.trim(),
          company: appFormCompany.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApplicationError(data.error || '提交申請失敗');
      } else if (data.user) {
        setCurrentUser(data.user);
        setIsEditingApplication(false);
      }
    } catch {
      setApplicationError('網路連線失敗，請稍後重試。');
    } finally {
      setSubmittingApplication(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    localStorage.removeItem('jarvis_session_token');
    setToken(null);
    setCurrentUser(null);
    setBuyers([]);
    setProperties([]);
    setRecentSessions([]);
    setTours([]);
    setTasks([]);
    setShowSettingsModal(false);
    setShowMobileMoreMenu(false);
    setShowQuickCreateModal(false);
  };

  // Today's Work Computations
  const todayDateStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const todayTours = useMemo(() => {
    return tours.filter((t) => {
      if (t.status === 'in_progress') return true;
      if (t.startedAt && t.startedAt.slice(0, 10) === todayDateStr) return true;
      return false;
    });
  }, [tours, todayDateStr]);

  // Notice requirement: "未填期限的待辦不算逾期"
  const dueTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status !== 'pending') return false;
      // Tasks with explicit due date/note or marked high priority
      if (t.dueNote && t.dueNote.trim() !== '') return true;
      if (t.priority === 'high') return true;
      return false;
    });
  }, [tasks]);

  // Unanswered questions collected from completed tours
  const unansweredQuestionsList = useMemo(() => {
    const list: Array<{ tourId: string; buyerName: string; question: string }> = [];
    tours.forEach((t) => {
      if (t.summaryReport?.unansweredQuestions) {
        t.summaryReport.unansweredQuestions.forEach((q) => {
          const qText = typeof q === 'string' ? q : (q as any)?.text;
          if (qText) {
            list.push({ tourId: t.id, buyerName: t.buyerName, question: qText });
          }
        });
      }
    });
    return list.slice(0, 5);
  }, [tours]);

  const ongoingTour = useMemo(() => tours.find((t) => t.status === 'in_progress'), [tours]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row antialiased">
      {/* =========================================================================
          DESKTOP SIDEBAR NAVIGATION (桌面簡潔側邊導覽)
          工作台、客戶與配案、物件、帶看、待辦。帳號與設定放底部。
      ========================================================================= */}
      {currentUser && currentUser.status === 'approved' && (
        <aside
          className={`hidden md:flex flex-col bg-slate-950 text-white border-r border-slate-800 transition-all duration-200 shrink-0 select-none ${
            isSidebarCollapsed ? 'w-18' : 'w-60'
          }`}
        >
          {/* Brand & Collapse Toggle */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
            {!isSidebarCollapsed && (
              <a
                href="#home"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('home');
                }}
                className="font-bold text-base tracking-tight text-white flex items-center gap-2 truncate"
              >
                <div className="w-7 h-7 rounded-lg bg-teal-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0">
                  房
                </div>
                <span className="truncate">房仲AI助理</span>
              </a>
            )}
            {isSidebarCollapsed && (
              <div className="w-8 h-8 rounded-lg bg-teal-500 text-slate-950 flex items-center justify-center font-bold text-sm mx-auto">
                房
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer ml-auto"
              title={isSidebarCollapsed ? '展開側欄' : '收合側欄'}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Primary Sales Nav Items */}
          <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
            {/* 1. 工作台 */}
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-3 transition cursor-pointer ${
                activeTab === 'home'
                  ? 'bg-teal-500/15 text-teal-300 font-bold'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
              title="工作台"
            >
              <LayoutDashboard className="w-4 h-4 shrink-0 text-teal-400" />
              {!isSidebarCollapsed && <span>工作台</span>}
            </button>

            {/* 2. 客戶管理 */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('buyers');
              }}
              className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-3 transition cursor-pointer ${
                activeTab === 'buyers'
                  ? 'bg-teal-500/15 text-teal-300 font-bold'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
              title="客戶管理"
            >
              <Users className="w-4 h-4 shrink-0 text-teal-400" />
              {!isSidebarCollapsed && (
                <div className="flex-1 flex items-center justify-between text-left">
                  <span>客戶管理</span>
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                    {buyers.length}
                  </span>
                </div>
              )}
            </button>

            {/* 3. 配案中心 */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('matching');
              }}
              className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-3 transition cursor-pointer ${
                activeTab === 'matching'
                  ? 'bg-teal-500/15 text-teal-300 font-bold'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
              title="配案中心"
            >
              <SearchCheck className="w-4 h-4 shrink-0 text-cyan-400" />
              {!isSidebarCollapsed && (
                <div className="flex-1 flex items-center justify-between text-left">
                  <span>配案中心</span>
                </div>
              )}
            </button>

            {/* 3. 物件 */}
            <button
              type="button"
              onClick={() => setActiveTab('properties')}
              className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-3 transition cursor-pointer ${
                activeTab === 'properties'
                  ? 'bg-teal-500/15 text-teal-300 font-bold'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
              title="物件"
            >
              <Building2 className="w-4 h-4 shrink-0 text-teal-400" />
              {!isSidebarCollapsed && (
                <div className="flex-1 flex items-center justify-between text-left">
                  <span>物件</span>
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                    {properties.length}
                  </span>
                </div>
              )}
            </button>

            {/* 4. 帶看 */}
            <button
              type="button"
              onClick={() => setActiveTab('tours')}
              className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-3 transition cursor-pointer ${
                activeTab === 'tours'
                  ? 'bg-teal-500/15 text-teal-300 font-bold'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
              title="帶看"
            >
              <Compass className="w-4 h-4 shrink-0 text-teal-400" />
              {!isSidebarCollapsed && (
                <div className="flex-1 flex items-center justify-between text-left">
                  <span>帶看</span>
                  {ongoingTour && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  )}
                </div>
              )}
            </button>

            {/* 5. 待辦 */}
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-3 transition cursor-pointer ${
                activeTab === 'tasks'
                  ? 'bg-teal-500/15 text-teal-300 font-bold'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
              title="待辦"
            >
              <CheckSquare className="w-4 h-4 shrink-0 text-teal-400" />
              {!isSidebarCollapsed && (
                <div className="flex-1 flex items-center justify-between text-left">
                  <span>待辦</span>
                  {tasks.filter((t) => t.status === 'pending').length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-slate-950 font-bold">
                      {tasks.filter((t) => t.status === 'pending').length}
                    </span>
                  )}
                </div>
              )}
            </button>
          </nav>

          {/* Desktop Sidebar Bottom: User & Settings */}
          <div className="p-3 border-t border-slate-800/80 space-y-2">
            {!isSidebarCollapsed && (
              <div className="px-2 py-1 text-xs text-slate-400">
                <div className="font-bold text-white truncate">{currentUser.name}</div>
                <div className="text-[11px] text-slate-400 truncate">{currentUser.email}</div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="w-full min-h-[40px] px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 flex items-center gap-2.5 transition cursor-pointer"
              title="帳號與設定"
            >
              <Settings className="w-4 h-4 text-slate-400 shrink-0" />
              {!isSidebarCollapsed && <span>帳號與設定</span>}
            </button>
          </div>
        </aside>
      )}

      {/* =========================================================================
          MAIN CONTENT WRAPPER
          桌面最大寬度約 1120–1280px，手機單欄
      ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar for Desktop & Mobile */}
        {currentUser && currentUser.status === 'approved' && (
          <header className="sticky top-0 z-20 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 md:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile App Title */}
              <div className="md:hidden flex items-center gap-2 font-bold text-slate-900 text-base">
                <div className="w-6 h-6 rounded-md bg-slate-900 text-teal-400 flex items-center justify-center text-xs font-bold">
                  房
                </div>
                <span>房仲AI助理</span>
              </div>

              {/* Desktop Section Breadcrumb / Title */}
              <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span className="font-bold text-slate-900 text-sm">
                  {activeTab === 'home' && '工作台'}
                  {activeTab === 'buyers' && '客戶管理'}
                  {activeTab === 'matching' && '配案中心'}
                  {activeTab === 'properties' && '物件管理'}
                  {activeTab === 'tours' && '帶看紀錄'}
                  {activeTab === 'tasks' && '待辦事項'}
                  {activeTab === 'intake' && '新增接待'}
                  {activeTab === 'admin' && '帳號核可管理'}
                </span>
                {ongoingTour && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    帶看進行中：{ongoingTour.buyerName}
                  </span>
                )}
              </div>
            </div>

            {/* Top Header Actions */}
            <div className="flex items-center gap-2">
              {/* Font Size Quick Adjuster */}
              <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200" title="調整字體大小">
                <span className="hidden lg:flex items-center gap-1 pl-2 pr-1 text-[11px] font-bold text-slate-500 select-none">
                  <Type className="w-3.5 h-3.5 text-slate-600" />
                  字體
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleTextSizeChange('sm')}
                    className={`h-7 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      textSize === 'sm'
                        ? 'bg-white text-teal-800 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="小字體 (90%)"
                  >
                    小
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTextSizeChange('md')}
                    className={`h-7 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      textSize === 'md'
                        ? 'bg-white text-teal-800 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="標準字體 (100%)"
                  >
                    標準
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTextSizeChange('lg')}
                    className={`h-7 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      textSize === 'lg'
                        ? 'bg-white text-teal-800 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="大字體 (112.5%)"
                  >
                    大
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTextSizeChange('xl')}
                    className={`h-7 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      textSize === 'xl'
                        ? 'bg-white text-teal-800 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="特大字體 (125%) - 方便長輩或外出戶外閱讀"
                  >
                    特大
                  </button>
                </div>
              </div>

              {/* Secondary entrance: Ask Assistant */}
              <button
                type="button"
                onClick={() => {
                  setAssistantActiveBuyerId(null);
                  setAssistantActivePropertyId(null);
                  setShowAssistantModal(true);
                }}
                className="min-h-[38px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                title="問助理／交代工作"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span className="hidden sm:inline">問助理／交代工作</span>
                <span className="sm:hidden">問助理</span>
              </button>

              {/* Distinct "+ 新增" Entrance Button */}
              <button
                type="button"
                onClick={() => setShowQuickCreateModal(true)}
                className="min-h-[38px] px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                title="新增接待、物件或帶看"
              >
                <Plus className="w-3.5 h-3.5 text-teal-400 stroke-[3]" />
                <span>新增</span>
              </button>
            </div>
          </header>
        )}

        {/* Database & Key Status Notice Banner */}
        {systemStatus && (!systemStatus.mongodb.configured || !systemStatus.gemini.configured) && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-950">
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  {!systemStatus.mongodb.configured ? (
                    useSandbox
                      ? '目前運行於內建測試沙盒模式（未設定 MONGODB_URI Secret，供離線完整操作驗收）。'
                      : '未連線 MongoDB 資料庫。'
                  ) : (
                    '已成功連線至您的 MongoDB 資料庫。'
                  )}
                  {!systemStatus.gemini.configured && (
                    <span className="ml-2 font-bold text-rose-700">⚠️ 尚未設定 GEMINI_API_KEY Secret。</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area (Max width ~1120-1280px on desktop, single column on mobile) */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-5 md:py-6">
          {authLoading ? (
            <div className="bg-white rounded-2xl p-10 text-center text-sm text-slate-500 border border-slate-200">
              正在驗證登入身分...
            </div>
          ) : !currentUser ? (
            /* Login Screen: Clean Centered Card according to Target Spec */
            <div className="max-w-md mx-auto py-8 px-2 space-y-6">
              <div className="bg-white rounded-3xl p-7 md:p-8 border border-slate-200 shadow-xl space-y-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-teal-500 text-slate-950 flex items-center justify-center font-bold text-lg mx-auto shadow-sm">
                  房
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">房仲AI助理</h1>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    專為獨立經紀人打造的行動工作台：接待、需求整理、配案、帶看紀錄與待辦追蹤。
                  </p>
                </div>

                {/* Authentication Tabs: Login vs Register */}
                <div className="flex border-b border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('login');
                      setLoginError(null);
                    }}
                    className={`flex-1 py-3 border-b-2 transition cursor-pointer ${
                      authTab === 'login'
                        ? 'border-teal-600 text-teal-800 bg-teal-50/40'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    帳號登入
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('register');
                      setRegError(null);
                    }}
                    className={`flex-1 py-3 border-b-2 transition cursor-pointer ${
                      authTab === 'register'
                        ? 'border-teal-600 text-teal-800 bg-teal-50/40'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    申請使用帳號
                  </button>
                </div>

                {authTab === 'login' ? (
                  /* Formal Username & Password Login Form */
                  <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        登入帳號
                      </label>
                      <input
                        type="text"
                        required
                        autoComplete="username"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        placeholder="請輸入帳號（例如 admin）"
                        className="w-full text-xs min-h-[42px] px-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          密碼
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setShowForgotModal(true);
                            setForgotUsername(loginUsername);
                            setForgotMsg(null);
                            setForgotError(null);
                          }}
                          className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold cursor-pointer"
                        >
                          忘記密碼？
                        </button>
                      </div>
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="請輸入密碼"
                        className="w-full text-xs min-h-[42px] px-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:outline-none"
                      />
                    </div>

                    {loginError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span>{loginError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="w-full min-h-[44px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                    >
                      {loginLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                      <span>登入工作台</span>
                    </button>

                    <p className="text-[11px] text-slate-400 text-center pt-1 leading-relaxed">
                      登入後由後端執行授權驗證；新帳號需經平台管理員審核核可後方能存取業務工作區。
                    </p>
                  </form>
                ) : (
                  /* Formal Registration Form: Self-register with Username & Password */
                  <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-left">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        自選帳號 <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        autoComplete="username"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="4～32 字元，英文、數字、底線、連字號、句點"
                        className="w-full text-xs min-h-[42px] px-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        不分大小寫，不可包含空白或特殊符號。
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          設定密碼 <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="password"
                          required
                          autoComplete="new-password"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="至少 8 個字元"
                          className="w-full text-xs min-h-[42px] px-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          確認密碼 <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="password"
                          required
                          autoComplete="new-password"
                          value={regConfirmPassword}
                          onChange={(e) => setRegConfirmPassword(e.target.value)}
                          placeholder="再次輸入密碼"
                          className="w-full text-xs min-h-[42px] px-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      密碼長度至少需 8 字元（支援貼上、密碼管理器、空白與符號，不強制特定字元組合）。
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          真實姓名 <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="例如：林宗憲"
                          className="w-full text-xs min-h-[42px] px-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          所屬店別／公司 <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={regCompany}
                          onChange={(e) => setRegCompany(e.target.value)}
                          placeholder="例如：信義房屋 竹北高鐵加盟店"
                          className="w-full text-xs min-h-[42px] px-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          聯絡信箱 <span className="text-slate-400 text-[10px]">（選填聯絡用）</span>
                        </label>
                        <input
                          type="email"
                          value={regContactEmail}
                          onChange={(e) => setRegContactEmail(e.target.value)}
                          placeholder="agent@example.com"
                          className="w-full text-xs min-h-[42px] px-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          聯絡電話 <span className="text-slate-400 text-[10px]">（選填）</span>
                        </label>
                        <input
                          type="tel"
                          value={regContactPhone}
                          onChange={(e) => setRegContactPhone(e.target.value)}
                          placeholder="0912-345-678"
                          className="w-full text-xs min-h-[42px] px-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {regError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span>{regError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={regLoading}
                      className="w-full min-h-[44px] bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                    >
                      {regLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                      <span>送出申請並建立帳號</span>
                    </button>

                    <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                      送出後帳號預設為「待核可 (pending)」，由管理員審核開通後即可進入專屬工作區。
                    </p>
                  </form>
                )}
              </div>
            </div>
          ) : currentUser.status === 'pending' ? (
            /* Pending Approval Screen */
            <div className="max-w-lg mx-auto bg-white rounded-3xl p-7 md:p-8 border border-slate-200 shadow-sm space-y-5 my-6 text-left">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-800">已登入，等待管理員核可</div>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">您的帳號目前審核中</h2>
                </div>
              </div>

              {/* Applicant Profile Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">申請人姓名：</span>
                  <span className="font-bold text-slate-900">{currentUser.name || '尚未填寫'}</span>
                </div>
                {currentUser.username && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">登入帳號：</span>
                    <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      {currentUser.username}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">聯絡信箱／身分：</span>
                  <span className="font-mono text-slate-800">{currentUser.contactEmail || currentUser.email}</span>
                </div>
                {currentUser.contactPhone && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">聯絡電話：</span>
                    <span className="font-mono text-slate-800">{currentUser.contactPhone}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">所屬店別／公司：</span>
                  <span className="font-bold text-slate-900">{currentUser.company || '尚未填寫'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">申請時間：</span>
                  <span className="text-slate-600 font-mono">
                    {formatTaipeiTime(currentUser.submittedAt || currentUser.createdAt)}
                  </span>
                </div>
              </div>

              {/* Form to submit or modify application data */}
              {(!currentUser.company || isEditingApplication) ? (
                <form onSubmit={handleApplyApplication} className="space-y-3 pt-1 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-800">
                    {isEditingApplication ? '修改申請資料' : '請填寫使用申請資訊'}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">真實姓名</label>
                    <input
                      type="text"
                      required
                      value={appFormName}
                      onChange={(e) => setAppFormName(e.target.value)}
                      placeholder="例如：陳大明"
                      className="w-full text-xs min-h-[42px] px-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">所屬店別或公司</label>
                    <input
                      type="text"
                      required
                      value={appFormCompany}
                      onChange={(e) => setAppFormCompany(e.target.value)}
                      placeholder="例如：永慶房屋 竹北高鐵加盟店"
                      className="w-full text-xs min-h-[42px] px-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  {applicationError && (
                    <div className="text-xs text-rose-700 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                      {applicationError}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={submittingApplication}
                      className="min-h-[42px] px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      {submittingApplication && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>提交使用申請</span>
                    </button>
                    {isEditingApplication && (
                      <button
                        type="button"
                        onClick={() => setIsEditingApplication(false)}
                        className="min-h-[42px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                      >
                        取消修改
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="text-xs text-slate-500 leading-relaxed">
                  管理員審核通過後，重新確認狀態即可直接進入您的專屬工作區。審核期間不開放正式業務功能資料預覽。
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center flex-wrap gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={fetchSystemAndAuth}
                  className="min-h-[42px] px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>重新確認狀態</span>
                </button>
                {currentUser.company && !isEditingApplication && (
                  <button
                    type="button"
                    onClick={() => setIsEditingApplication(true)}
                    className="min-h-[42px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    修改申請資料
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="min-h-[42px] px-4 py-2 text-rose-700 hover:bg-rose-50 border border-rose-200 text-xs font-bold rounded-xl transition cursor-pointer ml-auto"
                >
                  登出
                </button>
              </div>
            </div>
          ) : currentUser.status === 'rejected' ? (
            /* Rejected Application Screen */
            <div className="max-w-lg mx-auto bg-white rounded-3xl p-7 md:p-8 border border-slate-200 shadow-sm space-y-5 my-6 text-left">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-rose-800">本次申請未通過</div>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">申請審核結果說明</h2>
                </div>
              </div>

              {/* Public Reason Display */}
              <div className="bg-rose-50/60 border border-rose-200 p-4 rounded-2xl text-xs space-y-1">
                <div className="font-bold text-rose-900">審核未通過原因：</div>
                <p className="text-rose-800 leading-relaxed font-medium">
                  {currentUser.publicReason || '未提供詳細原因，請補正店別或聯絡平台管理員查證。'}
                </p>
              </div>

              {/* Re-submit Form */}
              <form onSubmit={handleApplyApplication} className="space-y-3 pt-1">
                <div className="text-xs font-bold text-slate-800">請修正申請資料後重新提交：</div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">姓名</label>
                  <input
                    type="text"
                    required
                    value={appFormName}
                    onChange={(e) => setAppFormName(e.target.value)}
                    className="w-full text-xs min-h-[42px] px-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">所屬店別或公司</label>
                  <input
                    type="text"
                    required
                    value={appFormCompany}
                    onChange={(e) => setAppFormCompany(e.target.value)}
                    className="w-full text-xs min-h-[42px] px-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">登入帳號（固定身分）</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={currentUser.username || currentUser.email}
                    className="w-full text-xs min-h-[42px] px-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 font-mono font-bold"
                  />
                </div>
                {applicationError && (
                  <div className="text-xs text-rose-700 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    {applicationError}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={submittingApplication}
                    className="min-h-[42px] px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {submittingApplication && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>重新提交使用申請</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="min-h-[42px] px-4 py-2 text-slate-600 hover:bg-slate-100 text-xs font-semibold rounded-xl cursor-pointer ml-auto"
                  >
                    登出
                  </button>
                </div>
              </form>
            </div>
          ) : currentUser.status === 'suspended' ? (
            /* Suspended Account Screen */
            <div className="max-w-lg mx-auto bg-white rounded-3xl p-7 md:p-8 border border-slate-200 shadow-sm space-y-5 my-6 text-left">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-rose-800">帳號已停用</div>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">您的帳號已被停用</h2>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">帳號姓名：</span>
                  <span className="font-bold text-slate-900">{currentUser.name}</span>
                </div>
                {currentUser.username && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">登入帳號：</span>
                    <span className="font-mono font-bold text-slate-800">{currentUser.username}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">聯絡信箱：</span>
                  <span className="font-mono text-slate-800">{currentUser.contactEmail || currentUser.email}</span>
                </div>
                {currentUser.contactPhone && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">聯絡電話：</span>
                    <span className="font-mono text-slate-800">{currentUser.contactPhone}</span>
                  </div>
                )}
                {currentUser.publicReason && (
                  <div className="pt-2 border-t border-slate-200/80">
                    <span className="font-bold text-slate-700 block mb-1">停用原因：</span>
                    <p className="text-slate-600 leading-relaxed">{currentUser.publicReason}</p>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                目前該帳號已暫停使用平台功能。若需恢復開通使用，請直接聯繫平台管理員進行審核與恢復。
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={fetchSystemAndAuth}
                  className="min-h-[42px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>重新確認狀態</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="min-h-[42px] px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  登出
                </button>
              </div>
            </div>
          ) : (
            /* Logged-In Approved Content */
            <>
              {/* =========================================================================
                  TAB: HOME / WORKBENCH ("二、工作台先呈現今日工作")
                  先顯示今日帶看、到期待辦、待回覆問題，沒有資料就用簡短空狀態，不展示示範統計。
                  未填期限的待辦不算逾期。常用操作放顯眼位置，客戶與物件總量放次要位置。
              ========================================================================= */}
              {activeTab === 'home' && (
                <div className="space-y-6 pb-28">
                  {/* Primary Section: 今日工作 (Today's Work First) */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                      <div>
                        <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                          今日工作焦點
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                          經紀人隨身工作台 ｜ 優先呈現即刻需處理的帶看、到期待辦與客戶待查問題
                        </p>
                      </div>

                      {/* Quick 3 Actions Bar */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => {
                            setPreselectedBuyerForIntake(null);
                            setActiveTab('intake');
                          }}
                          className="min-h-[40px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                        >
                          <UserPlus className="w-3.5 h-3.5 text-teal-400" />
                          <span>新增接待</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('tours')}
                          className="min-h-[40px] px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                        >
                          <Compass className="w-3.5 h-3.5" />
                          <span>開始帶看</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPropertyImportModal(true)}
                          className="min-h-[40px] px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Building2 className="w-3.5 h-3.5 text-slate-600" />
                          <span>新增物件</span>
                        </button>
                      </div>
                    </div>

                    {/* Grid: 1. 今日帶看 2. 到期待辦 3. 待回覆問題 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* 1. 今日帶看 */}
                      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <Compass className="w-4 h-4 text-teal-700" />
                            <h2 className="text-sm font-bold text-slate-900">今日帶看</h2>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {todayTours.length} 場
                          </span>
                        </div>

                        <div className="flex-1">
                          {todayTours.length === 0 ? (
                            <div className="py-6 text-center text-xs text-slate-400">
                              今日尚無排定帶看
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {todayTours.slice(0, 3).map((tour) => (
                                <div
                                  key={tour.id}
                                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-900 truncate">
                                      {tour.buyerName}
                                    </span>
                                    {tour.status === 'in_progress' ? (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-100 text-amber-800 font-bold">
                                        進行中
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-500">
                                        {formatTaipeiTime(tour.startedAt)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">
                                    {tour.properties.map((p) => p.title).join('、')}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveTab('tours')}
                          className="w-full pt-2 text-xs font-bold text-teal-700 hover:text-teal-900 text-left flex items-center justify-between cursor-pointer border-t border-slate-100"
                        >
                          <span>查看所有帶看行程</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* 2. 到期待辦 (未填期限的待辦不算逾期) */}
                      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <CheckSquare className="w-4 h-4 text-amber-700" />
                            <h2 className="text-sm font-bold text-slate-900">到期待辦</h2>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {dueTasks.length} 件
                          </span>
                        </div>

                        <div className="flex-1">
                          {dueTasks.length === 0 ? (
                            <div className="py-6 text-center text-xs text-slate-400">
                              暫無即將到期的待辦事項
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {dueTasks.slice(0, 3).map((task) => (
                                <div
                                  key={task.id}
                                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-start gap-2"
                                >
                                  <input
                                    type="checkbox"
                                    checked={task.status === 'completed'}
                                    onChange={() => handleToggleTaskStatus(task)}
                                    className="mt-0.5 rounded text-teal-600 cursor-pointer"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-slate-900 truncate">
                                      {task.title}
                                    </div>
                                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                      <span>{task.buyerName}</span>
                                      {task.dueNote && (
                                        <span className="text-amber-800 font-medium">
                                          期限：{task.dueNote}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveTab('tasks')}
                          className="w-full pt-2 text-xs font-bold text-teal-700 hover:text-teal-900 text-left flex items-center justify-between cursor-pointer border-t border-slate-100"
                        >
                          <span>查看所有待辦清單</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* 3. 待回覆問題 (Unanswered questions from tours) */}
                      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <HelpCircle className="w-4 h-4 text-teal-700" />
                            <h2 className="text-sm font-bold text-slate-900">待回覆問題</h2>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {unansweredQuestionsList.length} 題
                          </span>
                        </div>

                        <div className="flex-1">
                          {unansweredQuestionsList.length === 0 ? (
                            <div className="py-6 text-center text-xs text-slate-400">
                              無待回覆的客戶問題
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {unansweredQuestionsList.slice(0, 3).map((item, idx) => (
                                <div
                                  key={idx}
                                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                                >
                                  <div className="font-bold text-slate-800">{item.buyerName}</div>
                                  <div className="text-slate-600 line-clamp-2">「{item.question}」</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveTab('tours')}
                          className="w-full pt-2 text-xs font-bold text-teal-700 hover:text-teal-900 text-left flex items-center justify-between cursor-pointer border-t border-slate-100"
                        >
                          <span>前往帶看紀錄檢視</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Section: Assistant Entrance & Total Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    {/* Ask Assistant Secondary Card */}
                    <div className="md:col-span-2 bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-teal-300">
                          <Sparkles className="w-4 h-4" />
                          <span>問助理／交代工作</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed max-w-lg">
                          支援輸入或手機口述交代工作。若涉及資料寫入，系統會先呈現操作草稿與影響範圍供您核對，絕不擅自直接確認。
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAssistantActiveBuyerId(null);
                          setAssistantActivePropertyId(null);
                          setShowAssistantModal(true);
                        }}
                        className="min-h-[40px] px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shrink-0 transition cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>開啟助理對話</span>
                      </button>
                    </div>

                    {/* Secondary Data Totals (客戶與物件總量放次要位置，不用假統計) */}
                    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide border-b border-slate-100 pb-1.5">
                        資料總量概況
                      </h3>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between py-1">
                          <span className="text-slate-600">管理買方客戶</span>
                          <span className="font-bold text-slate-900 font-mono tabular-nums text-sm">
                            {buyers.length} 位
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-t border-slate-100">
                          <span className="text-slate-600">庫存物件總量</span>
                          <span className="font-bold text-slate-900 font-mono tabular-nums text-sm">
                            {properties.length} 筆
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-1 border-t border-slate-100 text-[11px] text-slate-500">
                          <span>有效上架物件</span>
                          <span className="font-mono tabular-nums">
                            {properties.filter((p) => p.status === 'active').length} 筆
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Intake Sessions List */}
                  <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-teal-700" />
                        <span>最近接待原話紀錄</span>
                      </h2>
                      <span className="text-xs text-slate-400">共 {recentSessions.length} 筆</span>
                    </div>

                    {recentSessions.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center">
                        尚無已完成的接待紀錄。點擊上方「新增接待」即可開始記錄。
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {recentSessions.slice(0, 4).map((s) => (
                          <div
                            key={s.id}
                            className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">
                                  {s.confirmedRequirement?.buyerName.value || '未命名客戶'}
                                </span>
                                <span className="text-slate-400 font-mono text-[11px]">
                                  {formatTaipeiTime(s.createdAt)}
                                </span>
                              </div>
                              <p className="text-slate-600 line-clamp-1">
                                原話：「{s.rawTranscript}」
                              </p>
                            </div>

                            {s.buyerId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBuyerIdForView(s.buyerId);
                                  setAutoRunMatchOnBuyerView(false);
                                  setActiveTab('buyers');
                                }}
                                className="min-h-[36px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold shrink-0 self-start sm:self-center transition cursor-pointer"
                              >
                                查看客戶
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* TAB: CUSTOMER MANAGEMENT (客戶管理) */}
              {activeTab === 'buyers' && (
                <CustomerManagementView
                  token={token}
                  useSandbox={useSandbox}
                  buyers={buyers}
                  initialBuyerId={selectedBuyerIdForView}
                  onRefreshBuyers={fetchWorkspaceData}
                  onNavigateToMatching={(bId) => {
                    setSelectedBuyerIdForView(bId);
                    setActiveTab('matching');
                  }}
                  onStartVoiceIntake={() => {
                    setPreselectedBuyerForIntake(null);
                    setActiveTab('intake');
                  }}
                  onOpenAssistantForBuyer={(bId) => {
                    setAssistantActiveBuyerId(bId);
                    setAssistantActivePropertyId(null);
                    setShowAssistantModal(true);
                  }}
                  onStartLineAnalysisForBuyer={(bId) => {
                    setLineModalBuyerId(bId);
                    setShowLineModal(true);
                  }}
                />
              )}

              {/* TAB: MATCHING CENTER (配案中心) */}
              {activeTab === 'matching' && (
                <MatchingCenterView
                  token={token}
                  useSandbox={useSandbox}
                  buyers={buyers}
                  initialBuyerId={selectedBuyerIdForView}
                  onNavigateToCustomer={(bId) => {
                    setSelectedBuyerIdForView(bId);
                    setActiveTab('buyers');
                  }}
                  onStartTourForProperty={(pId, bId) => {
                    setSelectedBuyerIdForView(bId);
                    setActiveTab('tours');
                  }}
                />
              )}

              {/* TAB: PROPERTIES */}
              {activeTab === 'properties' && (
                <PropertyManager
                  token={token}
                  useSandbox={useSandbox}
                  properties={properties}
                  onRefresh={fetchWorkspaceData}
                  onOpenAssistantForProperty={(pId) => {
                    setAssistantActiveBuyerId(null);
                    setAssistantActivePropertyId(pId);
                    setShowAssistantModal(true);
                  }}
                />
              )}

              {/* TAB: TOURS */}
              {activeTab === 'tours' && (
                <ShowingTourManager
                  token={token}
                  useSandbox={useSandbox}
                  buyers={buyers}
                  properties={properties}
                  onRefreshWorkspace={fetchWorkspaceData}
                  onNavigateToTasks={() => setActiveTab('tasks')}
                  onNavigateToBuyer={(bId) => {
                    setSelectedBuyerIdForView(bId);
                    setActiveTab('buyers');
                  }}
                />
              )}

              {/* TAB: TASKS */}
              {activeTab === 'tasks' && (
                <TourTaskManager
                  token={token}
                  useSandbox={useSandbox}
                  onRefreshStats={fetchWorkspaceData}
                />
              )}

              {/* TAB: INTAKE */}
              {activeTab === 'intake' && (
                <VoiceIntakeWizard
                  token={token}
                  useSandbox={useSandbox}
                  buyers={buyers}
                  preselectedBuyerId={preselectedBuyerForIntake}
                  onConfirmedAndSaved={(buyer, _session, goToMatch) => {
                    fetchWorkspaceData();
                    setSelectedBuyerIdForView(buyer.id);
                    if (goToMatch) {
                      setActiveTab('matching');
                    } else {
                      setActiveTab('buyers');
                    }
                  }}
                  onCancel={() => setActiveTab('home')}
                />
              )}

              {/* TAB: ADMIN (Maintenance Zone) */}
              {activeTab === 'admin' && currentUser.role === 'admin' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <button
                      type="button"
                      onClick={() => setActiveTab('home')}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      ← 返回工作台
                    </button>
                    <span className="text-xs font-bold text-slate-700">管理員專用授權管理區</span>
                  </div>
                  <AdminUserPanel token={token} useSandbox={useSandbox} currentUser={currentUser} />
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* =========================================================================
          MOBILE BOTTOM NAVIGATION (手機底部導覽)
          工作台、客戶、帶看、待辦、更多；物件、設定及管理入口放更多。
      ========================================================================= */}
      {currentUser && currentUser.status === 'approved' && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-6 items-center h-16 px-0.5 safe-area-pb">
          {/* 1. 工作台 */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`min-h-[48px] flex flex-col items-center justify-center cursor-pointer ${
              activeTab === 'home' ? 'text-slate-950 font-bold' : 'text-slate-500'
            }`}
          >
            <LayoutDashboard className="w-4.5 h-4.5" />
            <span className="text-[10px] mt-0.5">工作台</span>
          </button>

          {/* 2. 客戶管理 */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('buyers');
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center cursor-pointer ${
              activeTab === 'buyers' ? 'text-slate-950 font-bold' : 'text-slate-500'
            }`}
          >
            <Users className="w-4.5 h-4.5" />
            <span className="text-[10px] mt-0.5">客戶</span>
          </button>

          {/* 3. 配案中心 */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('matching');
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center cursor-pointer ${
              activeTab === 'matching' ? 'text-cyan-700 font-bold' : 'text-slate-500'
            }`}
          >
            <SearchCheck className="w-4.5 h-4.5 text-cyan-600" />
            <span className="text-[10px] mt-0.5">配案</span>
          </button>

          {/* 4. 帶看 */}
          <button
            type="button"
            onClick={() => setActiveTab('tours')}
            className={`min-h-[48px] flex flex-col items-center justify-center relative cursor-pointer ${
              activeTab === 'tours' ? 'text-teal-700 font-bold' : 'text-slate-500'
            }`}
          >
            <Compass className="w-4.5 h-4.5" />
            <span className="text-[10px] mt-0.5">帶看</span>
            {ongoingTour && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute top-1.5 right-2"></span>
            )}
          </button>

          {/* 5. 待辦 */}
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`min-h-[48px] flex flex-col items-center justify-center relative cursor-pointer ${
              activeTab === 'tasks' ? 'text-amber-700 font-bold' : 'text-slate-500'
            }`}
          >
            <CheckSquare className="w-4.5 h-4.5" />
            <span className="text-[10px] mt-0.5">待辦</span>
            {tasks.filter((t) => t.status === 'pending').length > 0 && (
              <span className="px-1 py-0.2 rounded-full text-[9px] bg-amber-500 text-white font-bold absolute top-1 right-1">
                {tasks.filter((t) => t.status === 'pending').length}
              </span>
            )}
          </button>

          {/* 6. 更多 */}
          <button
            type="button"
            onClick={() => setShowMobileMoreMenu(true)}
            className="min-h-[48px] flex flex-col items-center justify-center text-slate-500 cursor-pointer"
          >
            <Menu className="w-4.5 h-4.5" />
            <span className="text-[10px] mt-0.5">更多</span>
          </button>
        </nav>
      )}

      {/* =========================================================================
          QUICK ADD MODAL (容易辨識的新增入口：可選接待、物件、帶看)
          畫面避免多個漂浮按鈕遮住表單
      ========================================================================= */}
      {showQuickCreateModal && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-bold text-slate-900">快速新增項目</h3>
              <button
                type="button"
                onClick={() => setShowQuickCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowQuickCreateModal(false);
                  setPreselectedBuyerForIntake(null);
                  setActiveTab('intake');
                }}
                className="w-full min-h-[56px] p-3.5 rounded-2xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 text-left flex items-center gap-3 transition cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-teal-400 flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900">新增客戶接待</div>
                  <div className="text-[11px] text-slate-500">語音或文字記錄原話並整理需求</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowQuickCreateModal(false);
                  setShowPropertyImportModal(true);
                }}
                className="w-full min-h-[56px] p-3.5 rounded-2xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 text-left flex items-center gap-3 transition cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-teal-400 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900">新增物件</div>
                  <div className="text-[11px] text-slate-500">公開網址或介紹文字匯入物件庫存</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowQuickCreateModal(false);
                  setActiveTab('tours');
                }}
                className="w-full min-h-[56px] p-3.5 rounded-2xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 text-left flex items-center gap-3 transition cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-teal-400 flex items-center justify-center shrink-0">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900">開始現場帶看</div>
                  <div className="text-[11px] text-slate-500">排定帶看物件並開啟即時語音紀錄</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MOBILE MORE MENU (手機「更多」選單)
          包含物件、設定及管理入口
      ========================================================================= */}
      {showMobileMoreMenu && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl safe-area-pb">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-bold text-slate-900">更多功能與設定</h3>
              <button
                type="button"
                onClick={() => setShowMobileMoreMenu(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowMobileMoreMenu(false);
                  setActiveTab('matching');
                }}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl hover:bg-slate-100 flex items-center gap-3 text-left font-bold text-slate-800 cursor-pointer"
              >
                <SearchCheck className="w-4 h-4 text-cyan-600" />
                <span>配案中心</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMoreMenu(false);
                  setActiveTab('properties');
                }}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl hover:bg-slate-100 flex items-center gap-3 text-left font-bold text-slate-800 cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-slate-600" />
                <span>物件管理 ({properties.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMoreMenu(false);
                  setLineModalBuyerId(null);
                  setShowLineModal(true);
                }}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl hover:bg-slate-100 flex items-center gap-3 text-left font-bold text-slate-800 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>分析 LINE 對話</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMoreMenu(false);
                  setShowSettingsModal(true);
                }}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl hover:bg-slate-100 flex items-center gap-3 text-left font-bold text-slate-800 cursor-pointer"
              >
                <Settings className="w-4 h-4 text-slate-600" />
                <span>帳號與系統設定</span>
              </button>

              {/* Mobile Quick Font Size Switcher */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-teal-600" />
                    介面字體大小
                  </span>
                  <span className="text-slate-400 font-normal">
                    {textSize === 'sm' && '小 (90%)'}
                    {textSize === 'md' && '標準 (100%)'}
                    {textSize === 'lg' && '大 (112.5%)'}
                    {textSize === 'xl' && '特大 (125%)'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleTextSizeChange('sm')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                      textSize === 'sm'
                        ? 'bg-teal-600 text-white border-teal-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    小
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTextSizeChange('md')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                      textSize === 'md'
                        ? 'bg-teal-600 text-white border-teal-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    標準
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTextSizeChange('lg')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                      textSize === 'lg'
                        ? 'bg-teal-600 text-white border-teal-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    大
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTextSizeChange('xl')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                      textSize === 'xl'
                        ? 'bg-teal-600 text-white border-teal-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    特大
                  </button>
                </div>
              </div>

              {currentUser && currentUser.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMoreMenu(false);
                    setActiveTab('admin');
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-amber-50 text-amber-900 hover:bg-amber-100 flex items-center gap-3 text-left font-bold cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>帳號核可管理（管理員）</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SETTINGS & AUTHENTICATION MODAL (帳號與設定維護專區)
          帳號核可、權限實測等維護工具移到既有授權管理區，不佔業務主導覽。
      ========================================================================= */}
      {showSettingsModal && currentUser && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-700" />
                <h3 className="text-base font-bold text-slate-900">帳號與授權管理設定</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Account Card */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <div className="text-slate-500 font-medium">目前登入經紀人帳號</div>
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-slate-900">{currentUser.name}</div>
                {currentUser.username && (
                  <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    帳號：{currentUser.username}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500">
                {currentUser.contactEmail || currentUser.email} ｜ 角色：{currentUser.role === 'admin' ? '系統管理員' : '房仲經紀人'}
              </div>
            </div>

            {/* Font Size Preferences Section */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Type className="w-4 h-4 text-teal-600" />
                  介面字體大小調整
                </span>
                <span className="text-[11px] text-slate-400">即時生效並自動儲存</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                可依照您的閱讀習慣或戶外帶看時的手機觀看需求調整系統顯示字級：
              </p>
              <div className="grid grid-cols-4 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleTextSizeChange('sm')}
                  className={`py-2 px-1 rounded-xl border text-center transition cursor-pointer ${
                    textSize === 'sm'
                      ? 'bg-teal-600 text-white font-bold border-teal-700 shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200 font-medium'
                  }`}
                >
                  <div className="text-xs">小字體</div>
                  <div className="text-[10px] opacity-80 mt-0.5">90%</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleTextSizeChange('md')}
                  className={`py-2 px-1 rounded-xl border text-center transition cursor-pointer ${
                    textSize === 'md'
                      ? 'bg-teal-600 text-white font-bold border-teal-700 shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200 font-medium'
                  }`}
                >
                  <div className="text-xs">標準</div>
                  <div className="text-[10px] opacity-80 mt-0.5">100%</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleTextSizeChange('lg')}
                  className={`py-2 px-1 rounded-xl border text-center transition cursor-pointer ${
                    textSize === 'lg'
                      ? 'bg-teal-600 text-white font-bold border-teal-700 shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200 font-medium'
                  }`}
                >
                  <div className="text-xs">大字體</div>
                  <div className="text-[10px] opacity-80 mt-0.5">112.5%</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleTextSizeChange('xl')}
                  className={`py-2 px-1 rounded-xl border text-center transition cursor-pointer ${
                    textSize === 'xl'
                      ? 'bg-teal-600 text-white font-bold border-teal-700 shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200 font-medium'
                  }`}
                >
                  <div className="text-xs">特大字體</div>
                  <div className="text-[10px] opacity-80 mt-0.5">125%</div>
                </button>
              </div>
            </div>

            {/* Maintenance & Auth Tools (Only here, off the main sales nav) */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="font-bold text-slate-700 block">授權管理與權限實測專區：</span>

              {currentUser.role === 'admin' ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsModal(false);
                    setActiveTab('admin');
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-400" />
                    <span>前往帳號核可管理（管理員面板）</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-500 text-[11px]">
                  帳號核可工具限管理員角色存取，一般經紀人帳號受後端權限驗證保護。
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowSettingsModal(false);
                  setShowIsolationModal(true);
                }}
                className="w-full min-h-[44px] px-3.5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl font-semibold flex items-center justify-between cursor-pointer"
              >
                <span>執行跨帳號資料權限隔離實測</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Switch Demo Identity */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="font-bold text-slate-700 block">切換測試身分（示範帳號）：</span>
              <div className="space-y-1.5">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleDemoAccountSwitch(acc.id)}
                    className={`w-full min-h-[40px] px-3 py-2 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                      acc.id === currentUser.id
                        ? 'border-teal-600 bg-teal-50 font-bold text-teal-950'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>{acc.name}</span>
                    {acc.id === currentUser.id && <span className="text-[11px] text-teal-700">目前身分</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Logout */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={handleLogout}
                className="min-h-[40px] px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>登出目前帳號</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Modals */}
      <PropertyImportModal
        token={token}
        useSandbox={useSandbox}
        isOpen={showPropertyImportModal}
        onClose={() => setShowPropertyImportModal(false)}
        onSuccess={() => {
          fetchWorkspaceData();
          setActiveTab('properties');
        }}
      />

      <VoiceAssistantWorkbench
        isOpen={showAssistantModal}
        onClose={() => setShowAssistantModal(false)}
        token={token}
        useSandbox={useSandbox}
        buyers={buyers}
        properties={properties}
        initialBuyerId={assistantActiveBuyerId}
        initialPropertyId={assistantActivePropertyId}
        onActionExecuted={() => {
          fetchWorkspaceData();
        }}
      />

      {showIsolationModal && currentUser && (
        <IsolationVerifierModal
          token={token}
          useSandbox={useSandbox}
          currentUser={currentUser}
          onClose={() => setShowIsolationModal(false)}
        />
      )}

      {showLineModal && (
        <LineConversationModal
          token={token}
          useSandbox={useSandbox}
          buyers={buyers}
          initialBuyerId={lineModalBuyerId}
          onClose={() => {
            setShowLineModal(false);
            setLineModalBuyerId(null);
          }}
          onRefreshWorkspace={fetchWorkspaceData}
          onNavigateToBuyer={(bId) => {
            setSelectedBuyerIdForView(bId);
            setActiveTab('buyers');
          }}
        />
      )}
    </div>
  );
}

export default App;
