import { BuyerRequirement, ConfidenceStatus } from './types';

export function formatTaipeiTime(isoString?: string): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatConfidenceLabel(conf: ConfidenceStatus): string {
  switch (conf) {
    case 'explicit':
      return '原話明示';
    case 'to_confirm':
    case 'inferred':
      return '待確認';
    case 'ai_suggested':
      return 'AI建議（未確認）';
    case 'agent_confirmed':
      return '經紀人確認';
    case 'missing':
    default:
      return '尚未提供';
  }
}

export function getAuthHeaders(token: string | null, useSandbox: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (useSandbox) {
    headers['x-storage-mode'] = 'sandbox';
  }
  return headers;
}

export function createEmptyRequirement(): BuyerRequirement {
  return {
    buyerName: { value: '', sourceQuote: '', confidence: 'missing' },
    contactPhone: { value: '', sourceQuote: '', confidence: 'missing' },
    purchasePurpose: { value: '', sourceQuote: '', confidence: 'missing' },
    preferredRegions: { value: [], sourceQuote: '', confidence: 'missing' },
    budget: {
      minWan: null,
      maxWan: null,
      includesParking: 'unspecified',
      unit: '萬元',
      sourceQuote: '',
      confidence: 'missing',
    },
    roomsAndType: {
      minRooms: null,
      preferredRooms: null,
      propertyTypes: [],
      sourceQuote: '',
      confidence: 'missing',
    },
    parking: {
      needParking: 'unspecified',
      parkingTypes: [],
      minSpaces: null,
      sourceQuote: '',
      confidence: 'missing',
    },
    elevator: {
      needElevator: 'unspecified',
      sourceQuote: '',
      confidence: 'missing',
    },
    propertyAge: {
      maxAgeYears: null,
      conditionType: 'unspecified',
      sourceQuote: '',
      confidence: 'missing',
    },
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
}
