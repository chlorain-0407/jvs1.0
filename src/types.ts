export type ConfidenceStatus = 'explicit' | 'inferred' | 'missing' | 'to_confirm' | 'ai_suggested' | 'agent_confirmed';

export interface SourcedField<T> {
  value: T;
  sourceQuote: string;
  confidence: ConfidenceStatus;
  flaggedAmbiguity?: string;
  confirmedByAgent?: boolean;
}

export interface BudgetField {
  minWan: number | null;
  maxWan: number | null;
  includesParking: 'yes' | 'no' | 'unspecified';
  unit: '萬元';
  sourceQuote: string;
  confidence: ConfidenceStatus;
  flaggedAmbiguity?: string;
}

export interface RoomField {
  minRooms: number | null;
  preferredRooms: number | null;
  propertyTypes: string[];
  sourceQuote: string;
  confidence: ConfidenceStatus;
  flaggedAmbiguity?: string;
}

export interface ParkingField {
  needParking: 'required' | 'preferred' | 'not_needed' | 'unspecified';
  parkingTypes: string[];
  minSpaces: number | null;
  sourceQuote: string;
  confidence: ConfidenceStatus;
  flaggedAmbiguity?: string;
}

export interface ElevatorField {
  needElevator: 'required' | 'preferred' | 'not_needed' | 'unspecified';
  sourceQuote: string;
  confidence: ConfidenceStatus;
  flaggedAmbiguity?: string;
}

export interface AgeField {
  maxAgeYears: number | null;
  conditionType: 'required' | 'preferred' | 'unspecified';
  sourceQuote: string;
  confidence: ConfidenceStatus;
  flaggedAmbiguity?: string;
}

export interface ConditionItem {
  id: string;
  category: string;
  description: string;
  sourceQuote: string;
  confidence: ConfidenceStatus;
  flaggedAmbiguity?: string;
}

export interface BuyerRequirement {
  buyerName: SourcedField<string>;
  contactPhone: SourcedField<string>;
  purchasePurpose: SourcedField<string>;
  preferredRegions: SourcedField<string[]>;
  budget: BudgetField;
  roomsAndType: RoomField;
  parking: ParkingField;
  elevator: ElevatorField;
  propertyAge: AgeField;
  commuteTarget: SourcedField<string>;
  schoolDistrict: SourcedField<string>;
  familyAndLifestyle: SourcedField<string>;
  timeline: SourcedField<string>;
  mustHaves: ConditionItem[];
  niceToHaves: ConditionItem[];
  dealBreakers: ConditionItem[];
  followUpQuestions: string[];
  ambiguityAlerts: string[];
}

export type UserApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type UserRole = 'admin' | 'agent' | 'platform_admin';

export interface UserAccount {
  id: string;
  username?: string; // 登入帳號（4～32字元英數字／底線／連字號／小數點）
  email: string; // 聯絡或識別信箱
  contactEmail?: string; // 選填聯絡信箱
  contactPhone?: string; // 選填聯絡電話
  name: string; // 真實姓名
  company?: string; // 所屬店別／公司
  picture?: string;
  role: UserRole;
  status: UserApprovalStatus;
  publicReason?: string; // 可讓申請人看到的原因（rejected / suspended）
  internalNote?: string; // 管理員內部備註（禁止傳給一般申請人）
  version?: number; // 樂觀鎖版本號，防止並發重複覆蓋
  submittedAt?: string; // 申請時間 / 重新提交時間
  reviewedAt?: string; // 最近審核處理時間
  reviewedBy?: string; // 最近審核管理員 ID
  isDemoAccount?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalAuditLogRecord {
  id: string;
  targetUserId: string;
  targetUserName: string;
  targetUsername?: string;
  targetUserEmail: string;
  operatorUserId: string;
  operatorUserName: string;
  action: 'approve' | 'reject' | 'suspend' | 'restore' | 'reset_password';
  fromStatus: UserApprovalStatus;
  toStatus: UserApprovalStatus;
  publicReason?: string;
  internalNote?: string;
  timestamp: string; // ISO string (Asia/Taipei formatted in UI)
}

export interface PasswordResetRequestRecord {
  id: string;
  username: string;
  contactInfo?: string;
  reason?: string;
  status: 'pending' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
}

export interface BuyerRecord {
  id: string;
  ownerUserId: string;
  name: string;
  contactPhone: string;
  currentRequirement: BuyerRequirement;
  missingCriticalFields: string[];
  isDemoData?: boolean;
  requirementVersion?: number; // 需求版本號（變更購屋條件時遞增）
  requirementUpdatedAt?: string; // 需求最後變更時間（用於與配案時間比對）
  noteCount?: number; // 備註筆數
  latestNoteSummary?: string; // 最新備註摘要
  latestNoteTime?: string; // 最新備註時間
  latestInteractionTime?: string; // 最後互動時間
  createdAt: string;
  updatedAt: string;
}

export type CustomerNoteSource =
  | 'general' // 一般備註
  | 'client_quote' // 客戶原話
  | 'phone' // 電話紀錄
  | 'line' // LINE補充
  | 'tour' // 帶看補充
  | 'agent_observation'; // 業務觀察

export interface CustomerNoteVersion {
  content: string;
  source: CustomerNoteSource;
  updatedAt: string;
  updatedBy: string;
}

export interface CustomerNoteRecord {
  id: string;
  buyerId: string;
  ownerUserId: string;
  authorName: string;
  content: string;
  source: CustomerNoteSource;
  relatedTourId?: string | null;
  relatedTourTitle?: string | null;
  version: number;
  versionHistory?: CustomerNoteVersion[];
  isDeleted: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAiSuggestionRecord {
  id: string;
  buyerId: string;
  ownerUserId: string;
  generatedAt: string;
  dataSnapshotTimestamp: string;
  missingRequirements: {
    item: string;
    reason: string;
    sourceQuoteOrBasis?: string;
  }[];
  conflicts: {
    field: string;
    description: string;
    sourceQuoteOrBasis?: string;
  }[];
  actionSuggestions: {
    title: string;
    detail: string;
    actionType: 'followup_call' | 'verify_condition' | 'schedule_tour' | 'other';
    draftTaskTitle?: string;
  }[];
  communicationTips: string[];
}

export type RecordInputMethod = 'text' | 'paste' | 'unknown';

export interface IntakeSessionRecord {
  id: string;
  ownerUserId: string;
  buyerId: string | null;
  idempotencyKey: string;
  recordingConsentType: 'agent_summary' | 'client_consent_recorded' | 'text_input';
  inputMethod?: RecordInputMethod;
  rawTranscript: string;
  aiDraft: BuyerRequirement;
  confirmedRequirement: BuyerRequirement | null;
  status: 'draft' | 'confirmed';
  createdAt: string;
  updatedAt: string;
}

export type CaseOwnership = 'self' | 'external';

export type ExternalCooperationStatus = 'unconfirmed' | 'available' | 'unavailable' | 'negotiating';

export interface PropertyRecord {
  id: string;
  ownerUserId: string;
  title: string;
  city: string;
  district: string;
  neighborhood: string;
  address: string;
  totalPriceWan: number;
  priceUnit: '萬元';
  priceIncludesParking: 'yes' | 'no' | 'separate' | 'unknown';
  separateParkingPriceWan?: number | null;
  buildingAreaPing: number;
  areaUnit: '坪';
  areaDefinition: '權狀總坪(含車位)' | '權狀總坪(不含車位)' | '主建物+附屬建物' | '主建物實坪' | '未明確定義';
  // Detailed areas
  mainBuildingAreaPing?: number | null;
  auxiliaryBuildingAreaPing?: number | null;
  publicFacilitiesAreaPing?: number | null;
  landAreaPing?: number | null;
  parkingAreaPing?: number | null;
  propertyUsage?: string;
  completionDate?: string;
  rooms: number | null;
  livingRooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  ageYears: number | null;
  hasElevator: 'yes' | 'no' | 'unknown';
  parkingType: '坡道平面' | '坡道機械' | '升降平面' | '升降機械' | '庭院車位' | '無車位' | '待確認';
  parkingSpaces: number | null;
  parkingPriceWan?: number | null;
  schoolAndTransitInfo: string;
  schoolAndTransitSource: string;
  features: string[];
  knownLimitations: string[];
  sourceUrl: string;
  ownershipType: '自有委託' | '外部合作物件';
  // New Case Ownership specifications
  caseOwnership?: CaseOwnership;
  internalCaseCode?: string;
  listingStatus?: string;
  listingPeriod?: string;
  internalNotes?: string;
  externalAgency?: string;
  externalStore?: string;
  externalAgent?: string;
  externalContact?: string;
  cooperationStatus?: ExternalCooperationStatus;
  cooperationNotes?: string;
  cooperationConfirmedDate?: string;
  // Source info
  sourceSiteName?: string;
  sourceItemNumber?: string;
  sourceFetchedAt?: string;
  ownershipHistory?: {
    caseOwnership: CaseOwnership;
    updatedAt: string;
    note?: string;
  }[];
  verifiedDate: string;
  status: 'active' | 'disabled';
  isDemoData?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyDraftExtracted {
  title: string;
  city: string;
  district: string;
  neighborhood: string;
  address: string;
  totalPriceWan: number | null;
  priceUnit: '萬元';
  priceIncludesParking: 'yes' | 'no' | 'separate' | 'unknown';
  separateParkingPriceWan: number | null;
  buildingAreaPing: number | null;
  mainBuildingAreaPing: number | null;
  auxiliaryBuildingAreaPing: number | null;
  publicFacilitiesAreaPing: number | null;
  landAreaPing: number | null;
  parkingAreaPing: number | null;
  areaUnit: '坪';
  areaDefinition: '權狀總坪(含車位)' | '權狀總坪(不含車位)' | '主建物+附屬建物' | '主建物實坪' | '未明確定義';
  propertyUsage: string;
  completionDate: string;
  rooms: number | null;
  livingRooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  ageYears: number | null;
  hasElevator: 'yes' | 'no' | 'unknown';
  parkingType: '坡道平面' | '坡道機械' | '升降平面' | '升降機械' | '庭院車位' | '無車位' | '待確認';
  parkingSpaces: number | null;
  parkingPriceWan: number | null;
  schoolAndTransitInfo: string;
  features: string[];
  knownLimitations: string[];
  externalAgency: string;
  externalContact: string;
  sourceSiteName: string;
  sourceItemNumber: string;
  sourceUrl: string;
  rawSourceSnippet?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType: 'exact_source' | 'exact_item_number' | 'suspected_address' | 'none';
  matchedProperty: PropertyRecord | null;
  differences?: {
    field: string;
    label: string;
    oldValue: any;
    newValue: any;
  }[];
}

export interface MatchEvaluationItem {
  propertyId: string;
  propertySnapshot: PropertyRecord;
  passedHardFilters: boolean;
  score: number;
  candidateStatus?: 'eligible' | 'to_verify' | 'rejected';
  matchedConditions: string[];
  unmetConditions: string[];
  unknownOrToVerifyConditions: string[];
  aiRecommendationReason: string;
  nextQuestionsToVerify: string[];
}

export interface MatchRunRecord {
  id: string;
  ownerUserId: string;
  buyerId: string;
  buyerName: string;
  isPreliminary: boolean;
  preliminaryWarnings: string[];
  buyerRequirementSnapshot: BuyerRequirement;
  evaluatedCount: number;
  matchedResults: MatchEvaluationItem[];
  toVerifyCandidates?: MatchEvaluationItem[];
  rejectedSummary: {
    propertyId: string;
    title: string;
    unmetMustHaves: string[];
  }[];
  relaxationSuggestions: string[];
  requirementVersionAtMatch?: number;
  isOutdated?: boolean;
  createdAt: string;
}

// ============================================================================
// Phase 2: Showing Tour, Segments, Tasks & Follow-up Types
// ============================================================================

export type TimelineSpeaker = 'buyer' | 'spouse' | 'family' | 'agent' | 'unknown';

export type TimelineCategory =
  | 'likes' // 喜歡的地方
  | 'dislikes' // 不喜歡的地方
  | 'client_questions' // 客戶疑問
  | 'new_requirements' // 新增需求
  | 'agent_observations' // 業務觀察
  | 'other'; // 其他

export interface TourPropertyItem {
  id: string; // propertyId or external-xxx
  isExternalSnapshot: boolean;
  title: string;
  cityDistrict: string;
  address?: string;
  totalPriceWan: number;
  roomsSummary: string;
  sourceUrl?: string;
  notes?: string;
  visitedOrder: number;
}

export interface TourSegmentRecord {
  id: string;
  tourId: string;
  ownerUserId: string;
  propertyId: string; // The property this segment belongs to
  propertyTitle: string;
  recordedAt: string; // ISO (輸入或保存時間)
  inputMethod?: RecordInputMethod;
  elapsedSeconds: number; // Seconds since tour started
  rawTranscript: string;
  editedTranscript: string;
  categories: TimelineCategory[];
  summary: string;
  speaker: TimelineSpeaker;
  speakerLabel: string;
  crossPropertyAmbiguityAlert?: string; // Alert if AI notices another property might be mentioned
  status: 'confirmed' | 'pending_review';
  createdAt: string;
}

export interface SourcedItem {
  text: string;
  sourceSegmentId: string;
  sourceQuote: string;
}

export interface TourSummaryReport {
  isRuleBased?: boolean;
  generationNotice?: string;
  unprovidedItems?: string[];
  isLegacyUnverified?: boolean;
  legacyWarningTag?: string;
  sourceVersion?: number;
  generatedAt?: string;
  processingMode?: 'ai_grounded' | 'rule_based';
  failureCategory?: string;
  failureMessage?: string;
  perPropertySummary: {
    propertyId: string;
    propertyTitle: string;
    likes: (string | SourcedItem)[];
    dislikes: (string | SourcedItem)[];
    clientQuestions: (string | SourcedItem)[];
    agentObservations: (string | SourcedItem)[];
  }[];
  unansweredQuestions: (string | SourcedItem)[];
  newDiscoveredRequirements: (string | SourcedItem)[];
  manualReviewItems?: (string | SourcedItem)[];
  suggestedTasks: {
    title: string;
    priority: 'high' | 'medium' | 'low';
    dueNote?: string;
    propertyId?: string;
    propertyTitle?: string;
    sourceSegmentId?: string;
    sourceQuote?: string;
  }[];
  customerThankYouMessage: string;
  internalAgentSummary: string;
  requirementUpdateDraft?: {
    mustHavesToAdd: (string | SourcedItem)[];
    niceToHavesToAdd: (string | SourcedItem)[];
    budgetAdjustmentWan?: { minWan?: number; maxWan?: number };
    lifestyleNotes?: string;
    generalNote: string;
  };
}

export interface TourReportHistoryEntry {
  version: number;
  generatedAt: string;
  mode: 'ai_grounded' | 'rule_based';
  report: TourSummaryReport;
}

export interface TourRecord {
  id: string;
  ownerUserId: string;
  tourType: 'registered_buyer' | 'coop_buyer';
  buyerId?: string | null;
  buyerName: string;
  coopAgentName?: string;
  coopNotes?: string;
  status: 'in_progress' | 'completed_pending_review' | 'finished';
  startedAt: string;
  endedAt?: string | null;
  activePropertyId: string;
  properties: TourPropertyItem[];
  segments: TourSegmentRecord[];
  summaryReport?: TourSummaryReport | null;
  pendingDraftReport?: TourSummaryReport | null;
  reportHistory?: TourReportHistoryEntry[];
  lastRegenerateStatus?: {
    mode: 'ai_grounded' | 'rule_based';
    generatedAt: string;
    failureCategory?: string;
    failureMessage?: string;
  };
  isRequirementUpdatedToBuyer?: boolean;
  isLegacyUnverified?: boolean;
  legacyWarningTag?: string;
  tasksCreatedCount?: number;
  tasksConfirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DebriefAuditLogRecord {
  id: string;
  tourId: string;
  buyerName: string;
  ownerUserId: string;
  processingMode: 'ai_grounded' | 'rule_based';
  sourceVersion: number;
  failureCategory?: string;
  failureMessage?: string;
  timestamp: string;
  segmentCount: number;
  propertyCount: number;
}

export interface TourTaskRecord {
  id: string;
  ownerUserId: string;
  tourId?: string | null;
  buyerId?: string | null;
  buyerName: string;
  propertyTitle?: string;
  title: string;
  details?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'completed';
  dueNote?: string;
  dueDate?: string; // Asia/Taipei YYYY-MM-DD
  dueTimeSlot?: string; // e.g. "下午時段"
  channel?: 'phone' | 'line' | 'meeting' | 'other';
  completedAt?: string | null;
  postponedCount?: number;
  changeLogs?: { timestamp: string; note: string }[];
  isAnsweredToClient?: boolean;
  isLegacyUnverified?: boolean;
  legacyWarningTag?: string;
  sourceSegmentId?: string;
  sourceQuote?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Phase 3: Voice Assistant Workbench & Continuous Follow-up Types
// ============================================================================

export type FollowUpChannel = 'phone' | 'line' | 'meeting' | 'other';

export interface FollowUpInteractionRecord {
  id: string;
  ownerUserId: string;
  buyerId?: string | null;
  buyerName: string;
  isCoopBuyer?: boolean;
  coopAgentName?: string;
  channel: FollowUpChannel;
  inputMethod?: RecordInputMethod;
  occurredAt: string; // ISO
  rawNotes: string; // 原始文字
  clientFeedback: string; // 客戶實際回覆
  agentObservations?: string; // 業務觀察
  agreedNextSteps?: string; // 已約定事項（未約定則不填）
  suggestedAction?: string; // AI 或業務建議下一步
  relatedPropertyTitle?: string;
  relatedTourId?: string;
  proposedRequirementDiff?: {
    mustHavesToAdd?: string[];
    niceToHavesToAdd?: string[];
    budgetAdjustmentWan?: { minWan?: number | null; maxWan?: number | null };
    lifestyleNotes?: string;
    generalNote?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type AssistantActionType =
  | 'QUERY_BUYER_PROGRESS' // 查詢客戶需求與最近進度
  | 'QUERY_RECENT_TOURS_AND_QUESTIONS' // 整理最近帶看及未解答問題
  | 'QUERY_TASKS_BY_SCHEDULE' // 查詢今天、明天與逾期待辦
  | 'CREATE_FOLLOWUP_TASK' // 建立追蹤待辦 (寫入草稿)
  | 'RECORD_FOLLOWUP_INTERACTION' // 記錄追蹤回饋 (寫入草稿)
  | 'PROPOSE_REQUIREMENT_UPDATE' // 提出需求更新草稿 (寫入草稿)
  | 'RUN_MATCHING_EVALUATION' // 依已確認需求重新配案
  | 'GENERATE_LINE_DRAFT' // 產生 LINE 追蹤訊息草稿
  | 'UNSUPPORTED_ACTION'; // 不支援的操作（例如要求語音刪除資料或自動送出訊息）

export interface AssistantActionDraft {
  id: string;
  ownerUserId: string;
  actionType: AssistantActionType;
  targetBuyerId?: string | null;
  targetBuyerName?: string;
  targetPropertyId?: string | null;
  targetPropertyTitle?: string;
  targetVersionSnapshot?: {
    buyerUpdatedAt?: string;
  };
  title: string;
  description: string;
  fullResolvedDateTime?: string; // 台北時區完整日期時間如 "2026-10-09 (週五)"
  timeSlot?: string; // 如 "下午時段"
  params: Record<string, any>;
  missingFields: string[];
  sourceQuote?: string;
  status: 'pending_confirmation' | 'executed' | 'cancelled' | 'failed';
  idempotencyKey: string;
  executedAt?: string | null;
  executionResultSummary?: string;
  createdAt: string;
}

export interface BuyerProgressSummary {
  buyerName: string;
  buyerId?: string;
  confirmedRequirementsSummary: string;
  recentInteractions: {
    date: string;
    type: '帶看' | '追蹤';
    summary: string;
    sourceId: string;
  }[];
  likes: string[];
  dislikes: string[];
  unansweredQuestions: string[];
  agreedNextSteps: string[];
  aiSuggestions: string[];
  dataGapNotes?: string[];
}

export interface AssistantResponse {
  intent: AssistantActionType;
  isQueryOnly: boolean;
  queryAnswer?: {
    text: string;
    buyerProgress?: BuyerProgressSummary;
    tasksSummary?: {
      overdue: TourTaskRecord[];
      today: TourTaskRecord[];
      tomorrow: TourTaskRecord[];
      noDueDate: TourTaskRecord[];
      aiDailyWorkBrief?: string;
      briefGeneratedAt?: string;
    };
    lineMessageDraft?: {
      scenario: string;
      messageText: string;
      sourceBasis: string[];
    };
  };
  actionDraft?: AssistantActionDraft | null;
  candidateBuyers?: {
    id: string;
    name: string;
    contactPhone: string;
    currentRequirementSummary: string;
  }[];
  unsupportedReason?: string;
  availableAlternatives?: string[];
}

// ============================================================================
// Phase 4: Buyer LINE Chat Screenshot Analysis & Integration Types
// ============================================================================

export type ConversationTargetType = 'existing_buyer' | 'new_buyer' | 'coop_buyer';
export type ConversationSpeakerRole = 'buyer' | 'agent' | 'family' | 'other';

export interface ExtractedChatMessage {
  id: string;
  imageIndex: number; // 來源圖片序號 1~5
  orderInImage: number; // 訊息順序 1~N
  rawSpeakerLabel: string; // 畫面中發言者標示
  candidateRole: ConversationSpeakerRole; // AI 候選角色
  confirmedRole: ConversationSpeakerRole; // 使用者確認角色 (買方 / 業務 / 配偶或其他家人 / 其他或未知)
  timestampStr: string; // 顯示時間與日期，如 "下午 2:15" 或 "未知"
  text: string; // 訊息文字 (可編輯修正)
  isAmbiguous: boolean; // 模糊、裁切或無法辨識
  ambiguityReason?: string;
  isSuspectedDuplicate: boolean; // 疑似跨圖重疊訊息
  duplicateReason?: string;
  isIgnored?: boolean; // 使用者是否略過
}

export interface SourcedAnalysisFact {
  value: string;
  sourceQuote: string;
  sourceImageIndex?: number;
  speakerRole: 'buyer' | 'agent' | 'ai_inference';
  confidence: 'explicit' | 'inferred' | 'unconfirmed';
  changeSequence?: string;
  isConfirmedByAgent?: boolean;
}

export interface BuyerRequirementDiffItem {
  fieldKey: string;
  fieldLabel: string;
  currentValueDisplay: string;
  proposedValueDisplay: string;
  sourceQuote: string;
  speakerRole: 'buyer' | 'agent' | 'ai_inference';
  changeNote?: string;
  accepted: boolean;
  userEditedValue?: any;
}

export interface ConversationAnalysisDraft {
  buyerNameCandidate?: string;
  contactPhoneCandidate?: string;
  purchasePurpose: SourcedAnalysisFact;
  preferredRegions: {
    regions: string[];
    sourceQuote: string;
    speakerRole: 'buyer' | 'agent' | 'ai_inference';
  };
  budget: {
    minWan: number | null;
    maxWan: number | null;
    includesParking: 'yes' | 'no' | 'unspecified';
    sourceQuote: string;
    speakerRole: 'buyer' | 'agent' | 'ai_inference';
    changeSequence?: string;
  };
  roomsAndType: {
    minRooms: number | null;
    preferredRooms: number | null;
    propertyTypes: string[];
    sourceQuote: string;
    speakerRole: 'buyer' | 'agent' | 'ai_inference';
    isPreferenceOnly?: boolean;
  };
  parking: {
    needParking: 'required' | 'preferred' | 'not_needed' | 'unspecified';
    parkingTypes: string[];
    sourceQuote: string;
    speakerRole: 'buyer' | 'agent' | 'ai_inference';
  };
  elevator: {
    needElevator: 'required' | 'preferred' | 'not_needed' | 'unspecified';
    sourceQuote: string;
    speakerRole: 'buyer' | 'agent' | 'ai_inference';
  };
  commuteAndFamily: {
    commuteTarget: string;
    schoolDistrict: string;
    familyAndLifestyle: string;
    sourceQuote: string;
    speakerRole: 'buyer' | 'agent' | 'ai_inference';
  };
  mustHaves: ConditionItem[];
  niceToHaves: ConditionItem[];
  dealBreakers: ConditionItem[];
  timeline: {
    value: string;
    sourceQuote: string;
    isDateConfirmed: boolean;
    speakerRole: 'buyer' | 'agent' | 'ai_inference';
  };
  likes: string[];
  dislikes: string[];
  clientQuestions: {
    question: string;
    sourceQuote: string;
    isVerified: boolean;
  }[];
  agreedNextSteps: {
    item: string;
    sourceQuote: string;
    hasExactDate: boolean;
    dueDateStr?: string;
  }[];
  followUpQuestions: string[];
  suggestedFollowUpAction: string;
  lineDraft: {
    scenario: string;
    messageText: string;
    sourceBasis: string[];
  };
  diffItems?: BuyerRequirementDiffItem[];
}

export interface ConversationImportRecord {
  id: string;
  ownerUserId: string;
  targetType: ConversationTargetType;
  buyerId?: string | null;
  buyerName: string;
  coopAgency?: string;
  coopAgentName?: string;
  imageCount: number;
  status: 'draft_extracted' | 'analyzed' | 'confirmed';
  messages: ExtractedChatMessage[];
  analysisDraft?: ConversationAnalysisDraft | null;
  appliedActions?: {
    savedImport: boolean;
    createdBuyerId?: string;
    updatedBuyerId?: string;
    savedFollowUpId?: string;
    createdTaskIds?: string[];
    matchRunId?: string;
    appliedAt?: string;
  };
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

