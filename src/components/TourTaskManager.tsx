import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare,
  Square,
  Clock,
  AlertCircle,
  Plus,
  Trash2,
  Calendar,
  User,
  Building,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { TourTaskRecord } from '../types';
import { getAuthHeaders, formatTaipeiTime } from '../utils';

interface TourTaskManagerProps {
  token: string | null;
  useSandbox: boolean;
  onRefreshStats?: () => void;
}

export function TourTaskManager({ token, useSandbox, onRefreshStats }: TourTaskManagerProps) {
  const [tasks, setTasks] = useState<TourTaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('pending');
  const [filterPriority, setFilterPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [searchKeyword, setSearchKeyword] = useState('');

  // New task form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBuyerName, setNewBuyerName] = useState('');
  const [newPropertyTitle, setNewPropertyTitle] = useState('');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('high');
  const [newDueNote, setNewDueNote] = useState('');
  const [newDetails, setNewDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tour-tasks', {
        headers: getAuthHeaders(token, useSandbox),
      });
      const data = await res.json();
      if (res.ok) {
        setTasks(data.tasks || []);
      } else {
        setError(data.error || '讀取待辦事項失敗');
      }
    } catch {
      setError('網路連線異常，無法取得待辦事項');
    } finally {
      setLoading(false);
    }
  }, [token, useSandbox]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleToggleTask = async (task: TourTaskRecord) => {
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
        onRefreshStats?.();
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('確定要刪除這筆待辦事項嗎？')) return;
    try {
      const res = await fetch(`/api/tour-tasks/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token, useSandbox),
      });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== id));
        onRefreshStats?.();
      }
    } catch {
      // ignore
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/tour-tasks', {
        method: 'POST',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({
          title: newTitle.trim(),
          buyerName: newBuyerName.trim() || '客戶追蹤',
          propertyTitle: newPropertyTitle.trim() || undefined,
          priority: newPriority,
          dueNote: newDueNote.trim() || undefined,
          details: newDetails.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.task) {
        setTasks((prev) => [data.task, ...prev]);
        setNewTitle('');
        setNewBuyerName('');
        setNewPropertyTitle('');
        setNewDueNote('');
        setNewDetails('');
        setShowAddForm(false);
        onRefreshStats?.();
      } else {
        alert(data.error || '新增失敗');
      }
    } catch {
      alert('網路連線失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(kw);
      const matchBuyer = t.buyerName.toLowerCase().includes(kw);
      const matchProp = (t.propertyTitle || '').toLowerCase().includes(kw);
      if (!matchTitle && !matchBuyer && !matchProp) return false;
    }
    return true;
  });

  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const highPriorityCount = tasks.filter((t) => t.status === 'pending' && t.priority === 'high').length;

  return (
    <div className="space-y-4 pb-20">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">帶看追蹤待辦事項</h2>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                {pendingCount} 件待辦
              </span>
            )}
            {highPriorityCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                {highPriorityCount} 件緊急
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            彙整各次帶看現場產生的客戶疑問、屋主議價探詢與管委會查證事項
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-xs"
        >
          <Plus className="w-4 h-4" />
          {showAddForm ? '收合表單' : '新增追蹤事項'}
        </button>
      </div>

      {/* Add Task Form Modal / Accordion */}
      {showAddForm && (
        <form onSubmit={handleCreateTask} className="bg-slate-50 p-4 rounded-xl border border-blue-200 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-800">手動建立追蹤事項</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                待辦事項標題 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="例如：查問惠友B1車位休旅車限高標示"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">優先等級</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as any)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="high">🔴 高優先（急迫/成交關鍵）</option>
                <option value="medium">🟡 中優先（正常進度）</option>
                <option value="low">🟢 低優先（備忘留存）</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">關聯客戶</label>
              <input
                type="text"
                placeholder="例如：林小姐（或友店合作買方）"
                value={newBuyerName}
                onChange={(e) => setNewBuyerName(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">關聯物件名稱</label>
              <input
                type="text"
                placeholder="例如：惠友景觀大三房平車"
                value={newPropertyTitle}
                onChange={(e) => setNewPropertyTitle(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">預計時限備註</label>
              <input
                type="text"
                placeholder="例如：明天中午前回報買方"
                value={newDueNote}
                onChange={(e) => setNewDueNote(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">補充說明或查證細節</label>
              <input
                type="text"
                placeholder="例如：先生特別重視車頂箱高度，需請管委會量測入口樑下淨高"
                value={newDetails}
                onChange={(e) => setNewDetails(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newTitle.trim()}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {isSubmitting ? '儲存中...' : '確認新增'}
            </button>
          </div>
        </form>
      )}

      {/* Filter and search bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-700">狀態：</span>
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                filterStatus === 'pending' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              未完成 ({pendingCount})
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                filterStatus === 'completed' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              已完成 ({tasks.length - pendingCount})
            </button>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                filterStatus === 'all' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              全部 ({tasks.length})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as any)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 outline-none"
          >
            <option value="all">所有優先級</option>
            <option value="high">僅高優先</option>
            <option value="medium">中優先</option>
            <option value="low">低優先</option>
          </select>

          <input
            type="text"
            placeholder="搜尋事項/客戶/物件..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="p-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 outline-none w-36 sm:w-48"
          />
        </div>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mb-2"></div>
          <p className="text-xs text-slate-500">載入待辦事項中...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-dashed border-slate-200">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-800">
            {filterStatus === 'pending' ? '目前沒有待處理事項！' : '找不到符合條件的事項'}
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            在帶看結束時點擊「結束帶看彙整」，AI 會自動根據客戶現場提問產生查證與追蹤待辦；您也可以點擊上方按鈕手動新增。
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => {
            const isDone = task.status === 'completed';
            const priorityBadge =
              task.priority === 'high' ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                  高優先
                </span>
              ) : task.priority === 'medium' ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  中優先
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  低優先
                </span>
              );

            return (
              <div
                key={task.id}
                className={`p-3.5 rounded-xl border transition shadow-2xs ${
                  isDone
                    ? 'bg-slate-50 border-slate-200 opacity-75'
                    : 'bg-white border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggleTask(task)}
                    className="mt-0.5 text-slate-400 hover:text-blue-600 transition flex-shrink-0"
                    title={isDone ? '標記為未完成' : '標記為已完成'}
                  >
                    {isDone ? (
                      <CheckSquare className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400 hover:text-blue-600" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {priorityBadge}
                      <span className={`text-sm font-semibold ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {task.title}
                      </span>
                    </div>

                    {task.details && (
                      <p className="text-xs text-slate-600 mb-2 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {task.details}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      {task.buyerName && (
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          {task.buyerName}
                        </span>
                      )}
                      {task.propertyTitle && (
                        <span className="inline-flex items-center gap-1 truncate max-w-xs">
                          <Building className="w-3 h-3 text-slate-400" />
                          {task.propertyTitle}
                        </span>
                      )}
                      {task.dueNote && (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                          <Clock className="w-3 h-3" />
                          時限：{task.dueNote}
                        </span>
                      )}
                      {task.completedAt && (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3" />
                          完成於 {formatTaipeiTime(task.completedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="text-slate-300 hover:text-rose-600 transition p-1"
                    title="刪除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
