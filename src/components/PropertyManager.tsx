import React, { useState } from 'react';
import {
  Plus,
  Edit3,
  Power,
  ExternalLink,
  Check,
  X,
  Sparkles,
  Layers,
  Building,
  UserCheck,
  AlertTriangle,
  Clock,
  Trash2,
  Filter,
} from 'lucide-react';
import {
  PropertyRecord,
  CaseOwnership,
  ExternalCooperationStatus,
} from '../types';
import { getAuthHeaders, formatTaipeiTime } from '../utils';
import { PropertyImportModal } from './PropertyImportModal';

interface PropertyManagerProps {
  token: string | null;
  useSandbox: boolean;
  properties: PropertyRecord[];
  onRefresh: () => void;
  onOpenAssistantForProperty?: (propertyId: string) => void;
}

const DEFAULT_FORM: Partial<PropertyRecord> = {
  title: '',
  city: '新竹縣',
  district: '竹北市',
  neighborhood: '高鐵特區',
  address: '',
  totalPriceWan: 2800,
  priceUnit: '萬元',
  priceIncludesParking: 'yes',
  separateParkingPriceWan: null,
  buildingAreaPing: 45.5,
  mainBuildingAreaPing: 28.5,
  auxiliaryBuildingAreaPing: 4.2,
  publicFacilitiesAreaPing: 12.8,
  landAreaPing: null,
  parkingAreaPing: null,
  areaUnit: '坪',
  areaDefinition: '權狀總坪(含車位)',
  rooms: 3,
  livingRooms: 2,
  bathrooms: 2,
  floor: 8,
  totalFloors: 15,
  ageYears: 5,
  hasElevator: 'unknown',
  parkingType: '坡道平面',
  parkingSpaces: 1,
  schoolAndTransitInfo: '',
  schoolAndTransitSource: '',
  features: [],
  knownLimitations: [],
  sourceUrl: '',
  caseOwnership: 'self',
  ownershipType: '自有委託',
  internalCaseCode: '',
  listingStatus: '一般委託',
  listingPeriod: '',
  internalNotes: '',
  externalAgency: '',
  externalStore: '',
  externalAgent: '',
  externalContact: '',
  cooperationStatus: 'unconfirmed',
  cooperationNotes: '',
  verifiedDate: new Date().toISOString().slice(0, 10),
  status: 'active',
};

export const PropertyManager: React.FC<PropertyManagerProps> = ({
  token,
  useSandbox,
  properties,
  onRefresh,
  onOpenAssistantForProperty,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'self' | 'external' | 'active' | 'disabled'>('all');
  const [coopFilter, setCoopFilter] = useState<'all' | ExternalCooperationStatus>('all');
  const [showImportModal, setShowImportModal] = useState(false);

  const [editingProperty, setEditingProperty] = useState<Partial<PropertyRecord> | null>(null);
  const [featuresText, setFeaturesText] = useState('');
  const [limitationsText, setLimitationsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const openCreateForm = () => {
    setEditingProperty({ ...DEFAULT_FORM });
    setFeaturesText('高鐵步行圈、雙衛浴開窗');
    setLimitationsText('');
    setErrorMsg(null);
  };

  const openEditForm = (p: PropertyRecord) => {
    setEditingProperty({ ...p });
    setFeaturesText((p.features || []).join('、'));
    setLimitationsText((p.knownLimitations || []).join('、'));
    setErrorMsg(null);
  };

  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProperty) return;
    setSaving(true);
    setErrorMsg(null);

    const payload = {
      ...editingProperty,
      features: featuresText
        .split(/[、,，\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
      knownLimitations: limitationsText
        .split(/[、,，\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      const isEdit = Boolean(editingProperty.id);
      const url = isEdit ? `/api/properties/${editingProperty.id}` : '/api/properties';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || '儲存物件失敗');
        setSaving(false);
        return;
      }

      setEditingProperty(null);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || '網路異常');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (prop: PropertyRecord) => {
    const nextStatus = prop.status === 'active' ? 'disabled' : 'active';
    try {
      await fetch(`/api/properties/${prop.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(token, useSandbox),
        body: JSON.stringify({ status: nextStatus }),
      });
      onRefresh();
    } catch {
      // ignore
    }
  };

  const handleDeleteProperty = async (propId: string) => {
    if (!window.confirm('確定要刪除此筆物件資料嗎？此操作不可復原。')) {
      return;
    }
    try {
      const res = await fetch(`/api/properties/${propId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token, useSandbox),
      });
      if (res.ok) {
        if (editingProperty?.id === propId) {
          setEditingProperty(null);
        }
        onRefresh();
      }
    } catch {
      // ignore
    }
  };

  // Filter properties
  const filtered = properties.filter((p) => {
    // Tab filter
    if (filterType === 'self' && p.caseOwnership !== 'self') return false;
    if (filterType === 'external' && p.caseOwnership !== 'external') return false;
    if (filterType === 'active' && p.status !== 'active') return false;
    if (filterType === 'disabled' && p.status !== 'disabled') return false;

    // Cooperation status filter
    if (coopFilter !== 'all') {
      if (p.caseOwnership !== 'external') return false;
      const status = p.cooperationStatus || 'unconfirmed';
      if (status !== coopFilter) return false;
    }

    return true;
  });

  const selfCount = properties.filter((p) => p.caseOwnership === 'self').length;
  const externalCount = properties.filter((p) => p.caseOwnership === 'external').length;

  return (
    <div className="space-y-5 pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">物件庫存管理</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            支援公開網址與文字匯入、案件歸屬管理（價格單位：萬元｜面積單位：坪）
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Requirement 1: Import Property Button */}
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="min-h-[44px] px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-colors"
          >
            <Layers className="w-4 h-4 text-cyan-200" />
            <span>匯入物件</span>
          </button>
          <button
            type="button"
            onClick={openCreateForm}
            className="min-h-[44px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            <span>新增手動建檔</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Cooperation Filter */}
      <div className="flex items-center justify-between flex-wrap gap-2.5">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto">
          {(
            [
              { id: 'all', label: `全部 (${properties.length})` },
              { id: 'self', label: `自有案件 (${selfCount})` },
              { id: 'external', label: `他人案件 (${externalCount})` },
              { id: 'active', label: `上架中 (${properties.filter((p) => p.status === 'active').length})` },
              { id: 'disabled', label: `已停用 (${properties.filter((p) => p.status === 'disabled').length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg min-h-[36px] shrink-0 transition-colors ${
                filterType === tab.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* External Cooperation Status Filter */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500 font-medium">合作狀態：</span>
          <select
            value={coopFilter}
            onChange={(e) => setCoopFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
          >
            <option value="all">全部合作狀態</option>
            <option value="available">可合作</option>
            <option value="negotiating">待洽談</option>
            <option value="unconfirmed">未確認</option>
            <option value="unavailable">不可合作</option>
          </select>
        </div>
      </div>

      {/* Import Modal */}
      <PropertyImportModal
        token={token}
        useSandbox={useSandbox}
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => onRefresh()}
      />

      {/* Manual Create / Edit Form */}
      {editingProperty && (
        <form
          onSubmit={handleSaveProperty}
          className="bg-white rounded-2xl p-5 border-2 border-slate-900 space-y-4 shadow-lg animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              {editingProperty.id ? '修改物件資料' : '手動新增物件建檔'}
            </h3>
            <button
              type="button"
              onClick={() => setEditingProperty(null)}
              className="p-2 text-slate-400 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Case Ownership Selection in Form */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <label className="block text-xs font-bold text-slate-800">案件歸屬 *</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="caseOwnership"
                  checked={editingProperty.caseOwnership === 'self'}
                  onChange={() =>
                    setEditingProperty({
                      ...editingProperty,
                      caseOwnership: 'self',
                      ownershipType: '自有委託',
                    })
                  }
                  className="w-4 h-4 text-indigo-600"
                />
                <span>自有案件</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="caseOwnership"
                  checked={editingProperty.caseOwnership === 'external'}
                  onChange={() =>
                    setEditingProperty({
                      ...editingProperty,
                      caseOwnership: 'external',
                      ownershipType: '外部合作物件',
                    })
                  }
                  className="w-4 h-4 text-amber-600"
                />
                <span>他人案件</span>
              </label>
            </div>

            {editingProperty.caseOwnership === 'self' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">內部案件編號</label>
                  <input
                    type="text"
                    value={editingProperty.internalCaseCode || ''}
                    onChange={(e) =>
                      setEditingProperty({ ...editingProperty, internalCaseCode: e.target.value })
                    }
                    placeholder="如：C-2026-001"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">委託狀態</label>
                  <input
                    type="text"
                    value={editingProperty.listingStatus || ''}
                    onChange={(e) =>
                      setEditingProperty({ ...editingProperty, listingStatus: e.target.value })
                    }
                    placeholder="一般委託／專任委託"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">委託期間</label>
                  <input
                    type="text"
                    value={editingProperty.listingPeriod || ''}
                    onChange={(e) =>
                      setEditingProperty({ ...editingProperty, listingPeriod: e.target.value })
                    }
                    placeholder="2026/01/01 ~ 2026/12/31"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block font-semibold text-slate-600 mb-1">內部備註</label>
                  <input
                    type="text"
                    value={editingProperty.internalNotes || ''}
                    onChange={(e) =>
                      setEditingProperty({ ...editingProperty, internalNotes: e.target.value })
                    }
                    placeholder="屋主聯繫注意事項、鑰匙位置等"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            )}

            {editingProperty.caseOwnership === 'external' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">來源同業／品牌</label>
                  <input
                    type="text"
                    value={editingProperty.externalAgency || ''}
                    onChange={(e) =>
                      setEditingProperty({ ...editingProperty, externalAgency: e.target.value })
                    }
                    placeholder="永慶房屋／信義房屋"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">門店與承辦業務</label>
                  <input
                    type="text"
                    value={editingProperty.externalAgent || ''}
                    onChange={(e) =>
                      setEditingProperty({ ...editingProperty, externalAgent: e.target.value })
                    }
                    placeholder="高鐵加盟店・陳專員"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">公開聯絡方式</label>
                  <input
                    type="text"
                    value={editingProperty.externalContact || ''}
                    onChange={(e) =>
                      setEditingProperty({ ...editingProperty, externalContact: e.target.value })
                    }
                    placeholder="0912-345-678"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">合作狀態</label>
                  <select
                    value={editingProperty.cooperationStatus || 'unconfirmed'}
                    onChange={(e) =>
                      setEditingProperty({
                        ...editingProperty,
                        cooperationStatus: e.target.value as ExternalCooperationStatus,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  >
                    <option value="unconfirmed">未確認</option>
                    <option value="available">可合作</option>
                    <option value="negotiating">待洽談</option>
                    <option value="unavailable">不可合作</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-600 mb-1">合作條件備註</label>
                  <input
                    type="text"
                    value={editingProperty.cooperationNotes || ''}
                    onChange={(e) =>
                      setEditingProperty({ ...editingProperty, cooperationNotes: e.target.value })
                    }
                    placeholder="配件佣金拆帳約定、帶看提前約定規範"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">物件案名 *</label>
              <input
                type="text"
                required
                value={editingProperty.title || ''}
                onChange={(e) => setEditingProperty({ ...editingProperty, title: e.target.value })}
                placeholder="例如：竹北高鐵特區・惠友大三房平車"
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">生活圈</label>
              <input
                type="text"
                value={editingProperty.neighborhood || ''}
                onChange={(e) => setEditingProperty({ ...editingProperty, neighborhood: e.target.value })}
                placeholder="如：高鐵特區、關新商圈"
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">縣市 *</label>
              <input
                type="text"
                required
                value={editingProperty.city || ''}
                onChange={(e) => setEditingProperty({ ...editingProperty, city: e.target.value })}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">行政區 *</label>
              <input
                type="text"
                required
                value={editingProperty.district || ''}
                onChange={(e) => setEditingProperty({ ...editingProperty, district: e.target.value })}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block font-bold text-slate-700 mb-1">路段／地址</label>
              <input
                type="text"
                value={editingProperty.address || ''}
                onChange={(e) => setEditingProperty({ ...editingProperty, address: e.target.value })}
                placeholder="如：新竹縣竹北市文興路二段"
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">開價總價（單位：萬元）*</label>
              <input
                type="number"
                required
                value={editingProperty.totalPriceWan ?? ''}
                onChange={(e) => setEditingProperty({ ...editingProperty, totalPriceWan: Number(e.target.value) })}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tabular-nums font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">總價是否包含車位</label>
              <select
                value={editingProperty.priceIncludesParking || 'yes'}
                onChange={(e) =>
                  setEditingProperty({ ...editingProperty, priceIncludesParking: e.target.value as any })
                }
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              >
                <option value="yes">總價已含車位</option>
                <option value="separate">車位價格另計</option>
                <option value="no">無車位／不含車位</option>
                <option value="unknown">尚未確認口徑</option>
              </select>
            </div>

            {editingProperty.priceIncludesParking === 'separate' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">另計車位價格（萬元）</label>
                <input
                  type="number"
                  value={editingProperty.separateParkingPriceWan ?? ''}
                  onChange={(e) =>
                    setEditingProperty({
                      ...editingProperty,
                      separateParkingPriceWan: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="如：220"
                  className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tabular-nums"
                />
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">權狀建物坪數（坪）*</label>
              <input
                type="number"
                step="0.01"
                required
                value={editingProperty.buildingAreaPing ?? ''}
                onChange={(e) => setEditingProperty({ ...editingProperty, buildingAreaPing: Number(e.target.value) })}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tabular-nums font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">主建物實坪（坪）</label>
              <input
                type="number"
                step="0.01"
                value={editingProperty.mainBuildingAreaPing ?? ''}
                onChange={(e) =>
                  setEditingProperty({
                    ...editingProperty,
                    mainBuildingAreaPing: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                placeholder="室內面積"
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">附屬建物面積（坪）</label>
              <input
                type="number"
                step="0.01"
                value={editingProperty.auxiliaryBuildingAreaPing ?? ''}
                onChange={(e) =>
                  setEditingProperty({
                    ...editingProperty,
                    auxiliaryBuildingAreaPing: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                placeholder="陽台、雨遮"
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tabular-nums"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">房</label>
                <input
                  type="number"
                  value={editingProperty.rooms ?? ''}
                  onChange={(e) =>
                    setEditingProperty({
                      ...editingProperty,
                      rooms: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="w-full min-h-[44px] px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">廳</label>
                <input
                  type="number"
                  value={editingProperty.livingRooms ?? ''}
                  onChange={(e) =>
                    setEditingProperty({
                      ...editingProperty,
                      livingRooms: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="w-full min-h-[44px] px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">衛</label>
                <input
                  type="number"
                  value={editingProperty.bathrooms ?? ''}
                  onChange={(e) =>
                    setEditingProperty({
                      ...editingProperty,
                      bathrooms: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="w-full min-h-[44px] px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">所在樓層</label>
                <input
                  type="number"
                  value={editingProperty.floor ?? ''}
                  onChange={(e) =>
                    setEditingProperty({
                      ...editingProperty,
                      floor: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="w-full min-h-[44px] px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">總樓層</label>
                <input
                  type="number"
                  value={editingProperty.totalFloors ?? ''}
                  onChange={(e) =>
                    setEditingProperty({
                      ...editingProperty,
                      totalFloors: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="w-full min-h-[44px] px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">屋齡(年)</label>
              <input
                type="number"
                value={editingProperty.ageYears ?? ''}
                onChange={(e) =>
                  setEditingProperty({
                    ...editingProperty,
                    ageYears: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className="w-full min-h-[44px] px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">電梯設備</label>
              <select
                value={editingProperty.hasElevator || 'unknown'}
                onChange={(e) => setEditingProperty({ ...editingProperty, hasElevator: e.target.value as any })}
                className="w-full min-h-[44px] px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                <option value="yes">有電梯</option>
                <option value="no">無電梯（爬梯）</option>
                <option value="unknown">電梯待查證（未知）</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">車位型式</label>
              <select
                value={editingProperty.parkingType || '坡道平面'}
                onChange={(e) => setEditingProperty({ ...editingProperty, parkingType: e.target.value as any })}
                className="w-full min-h-[44px] px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              >
                <option value="坡道平面">坡道平面</option>
                <option value="坡道機械">坡道機械</option>
                <option value="升降平面">升降平面</option>
                <option value="升降機械">升降機械</option>
                <option value="庭院車位">庭院車位</option>
                <option value="無車位">無車位</option>
                <option value="待確認">待確認</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">外部來源網址（選填）</label>
              <input
                type="url"
                value={editingProperty.sourceUrl || ''}
                onChange={(e) => setEditingProperty({ ...editingProperty, sourceUrl: e.target.value })}
                placeholder="https://..."
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block font-bold text-slate-700 mb-1">學校與交通資訊</label>
              <input
                type="text"
                value={editingProperty.schoolAndTransitInfo || ''}
                onChange={(e) => setEditingProperty({ ...editingProperty, schoolAndTransitInfo: e.target.value })}
                placeholder="鄰近學校與交通現況"
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block font-bold text-slate-700 mb-1">已知限制或抗性（頓號分隔）</label>
              <input
                type="text"
                value={limitationsText}
                onChange={(e) => setLimitationsText(e.target.value)}
                placeholder="如：可隔三房現況待查、車位另計等"
                className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
              />
            </div>
          </div>

          {errorMsg && <div className="text-xs text-rose-600 font-bold">{errorMsg}</div>}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            {editingProperty.id ? (
              <button
                type="button"
                onClick={() => handleDeleteProperty(editingProperty.id!)}
                className="min-h-[44px] px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                <span>刪除此物件</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditingProperty(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 text-cyan-400" />
                <span>{saving ? '儲存中...' : '確認儲存物件'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Property Cards List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 space-y-2">
            <p className="text-sm font-semibold text-slate-700">目前尚無符合篩選條件的物件</p>
            <p className="text-xs text-slate-500">
              點擊上方「匯入物件」或「新增手動建檔」建立您的在庫物件。
            </p>
          </div>
        ) : (
          filtered.map((prop) => (
            <div
              key={prop.id}
              className={`bg-white rounded-2xl p-5 border transition-colors ${
                prop.status === 'disabled' ? 'border-slate-200 opacity-60' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center flex-wrap gap-2 text-xs">
                    {/* Status Badge */}
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                        prop.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {prop.status === 'active' ? '上架中' : '已停用'}
                    </span>

                    {/* Case Ownership Badge */}
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                        prop.caseOwnership === 'self'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {prop.caseOwnership === 'self' ? '自有案件' : '他人案件'}
                    </span>

                    {/* External Cooperation Status Badge */}
                    {prop.caseOwnership === 'external' && (
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                          prop.cooperationStatus === 'available'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : prop.cooperationStatus === 'negotiating'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : prop.cooperationStatus === 'unavailable'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        合作：
                        {prop.cooperationStatus === 'available'
                          ? '可合作'
                          : prop.cooperationStatus === 'negotiating'
                          ? '待洽談'
                          : prop.cooperationStatus === 'unavailable'
                          ? '不可合作'
                          : '未確認'}
                      </span>
                    )}

                    <span className="text-slate-500 font-medium">
                      {prop.city}
                      {prop.district}
                      {prop.neighborhood ? `（${prop.neighborhood}）` : ''}
                    </span>

                    {prop.isDemoData && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        示範資料
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{prop.title}</h3>

                  {prop.address && (
                    <p className="text-xs text-slate-500 font-mono">
                      地址：{prop.address}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="text-lg font-mono font-bold text-slate-900 tabular-nums">
                    {prop.totalPriceWan.toLocaleString()} <span className="text-xs font-normal">萬元</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {prop.priceIncludesParking === 'yes'
                      ? '總價含車位'
                      : prop.priceIncludesParking === 'separate'
                      ? `車位另計 (${prop.separateParkingPriceWan ?? '待確認'}萬)`
                      : prop.priceIncludesParking === 'no'
                      ? '不含車位'
                      : '車位計價待確認'}
                  </div>
                </div>
              </div>

              {/* Area & Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block">建物面積</span>
                  <span className="font-mono font-semibold text-slate-800 tabular-nums">
                    {prop.buildingAreaPing} 坪
                  </span>
                  {prop.mainBuildingAreaPing ? (
                    <span className="text-[11px] text-slate-500 block font-mono">
                      主建 {prop.mainBuildingAreaPing} 坪
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 block">{prop.areaDefinition}</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 block">格局與樓層</span>
                  <span className="font-mono font-semibold text-slate-800 tabular-nums">
                    {prop.rooms ?? '待查'}房{prop.livingRooms ?? ''}廳{prop.bathrooms ?? ''}衛
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {prop.floor ?? '—'}F / 共{prop.totalFloors ?? '—'}F
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">屋齡與電梯</span>
                  <span className="font-mono font-semibold text-slate-800 tabular-nums">
                    {prop.ageYears !== null ? `${prop.ageYears} 年` : '屋齡待確認'}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    電梯：{prop.hasElevator === 'yes' ? '有' : prop.hasElevator === 'no' ? '無' : '待確認'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">車位配置</span>
                  <span className="font-semibold text-slate-800">{prop.parkingType}</span>
                  <span className="text-[11px] text-slate-500 block font-mono tabular-nums">
                    {prop.parkingSpaces !== null ? `${prop.parkingSpaces} 席` : '席數待查'}
                  </span>
                </div>
              </div>

              {/* Notes & Limitations */}
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs text-slate-600">
                {prop.caseOwnership === 'external' && prop.externalAgency && (
                  <p>
                    <strong className="text-slate-800">刊登同業：</strong>
                    {prop.externalAgency}
                    {prop.externalAgent && ` · ${prop.externalAgent}`}
                    {prop.externalContact && ` · 聯絡：${prop.externalContact}`}
                  </p>
                )}
                {prop.schoolAndTransitInfo && (
                  <p>
                    <strong className="text-slate-800">學校與交通：</strong>
                    {prop.schoolAndTransitInfo}
                  </p>
                )}
                {prop.knownLimitations && prop.knownLimitations.length > 0 && (
                  <p className="text-amber-800">
                    <strong>已知限制：</strong>
                    {prop.knownLimitations.join('、')}
                  </p>
                )}
              </div>

              {/* Bottom Card Footer */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="text-slate-400 font-mono tabular-nums text-[11px]">
                  確認日期：{prop.verifiedDate}
                  {prop.sourceSiteName && ` · 來源：${prop.sourceSiteName}`}
                  {prop.sourceItemNumber && ` (#${prop.sourceItemNumber})`}
                </div>
                <div className="flex items-center gap-2">
                  {onOpenAssistantForProperty && (
                    <button
                      type="button"
                      onClick={() => onOpenAssistantForProperty(prop.id)}
                      className="min-h-[36px] px-2.5 py-1.5 bg-gradient-to-r from-slate-900 to-indigo-950 text-cyan-300 font-semibold rounded-lg flex items-center gap-1 shadow-2xs hover:from-slate-800 transition"
                      title="以此物件為上下文向賈維斯交代工作"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>問助理</span>
                    </button>
                  )}
                  {prop.sourceUrl && (
                    <a
                      href={prop.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 text-cyan-700 hover:underline flex items-center gap-1 text-xs font-semibold"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>來源網址</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => openEditForm(prop)}
                    className="min-h-[36px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>修改</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(prop)}
                    className="min-h-[36px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg flex items-center gap-1"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{prop.status === 'active' ? '停用' : '重新上架'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
