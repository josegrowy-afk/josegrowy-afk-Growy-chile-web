export type CurrencyCode = 'CLP' | 'MXN' | 'USD' | 'EUR' | 'ARS' | 'COP' | 'PEN';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  locale: string;
  decimals: number;
}

export type FixedCostCategory =
  | 'arriendo'
  | 'sueldos'
  | 'servicios_basicos'
  | 'marketing'
  | 'software'
  | 'otros';

export interface FixedCostChange {
  effectiveFromMonth: string;
  newAmount: number;
}

export interface FixedCost {
  id: string;
  name: string;
  amount: number;
  category: FixedCostCategory;
  notes?: string;
  scheduledChange?: FixedCostChange | null;
}

export interface ProductSupplyCostItem {
  id: string;
  name: string;
  amount: number;
}

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  price: number;
  variableCost: number;
  /** Desglose opcional de múltiples costos por insumo que suman a variableCost */
  supplyCostItems?: ProductSupplyCostItem[];
  /** Porcentaje de comisión por pago con tarjeta débito o crédito (% sobre el precio) */
  cardFeePercent?: number;
  /** Porcentaje de impuestos (% sobre el precio) */
  taxPercent?: number;
  /** Costo fijo de envío o despacho por unidad */
  shippingCost?: number;
  /** Costo de tiempo personal involucrado por unidad */
  personalTimeCost?: number;
  /** Minutos de tiempo personal dedicados por unidad (opcional, para calcular margen por hora) */
  personalTimeMinutes?: number;
  /** Campo legado opcional (no usado en UI) */
  mixPercent?: number;
  /** Control inteligente de inventario (opcional por producto) */
  trackInventory?: boolean;
  initialStock?: number;
  minStock?: number;
}

export interface MonthlyProjectionOverride {
  unitsByProduct?: Record<string, number>;
  notes?: string;
}

export type TransactionType = 'income' | 'fixed_expense' | 'variable_expense' | 'other_expense';

export type OperationalObligationCategory =
  | 'proveedores'
  | 'remuneraciones'
  | 'impuestos'
  | 'credito'
  | 'otros';

export interface ActualTransaction {
  id: string;
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  productId?: string;
  units?: number;
  expenseCategory?: OperationalObligationCategory;
  linkedAccountId?: string;
  linkedInventoryMovementId?: string;
}

export interface MonthlyActualRecord {
  month: string;
  transactions: ActualTransaction[];
  manualIncome?: number;
  manualFixedExpense?: number;
  manualVariableExpense?: number;
  manualOtherExpense?: number;
  actualUnitsSold?: number;
  notes?: string;
}

export interface AccountPaymentEntry {
  id: string;
  date: string;
  amount: number;
  note?: string;
  linkedTransactionId?: string;
}

export interface AccountReceivable {
  id: string;
  clientName: string;
  documentRef: string;
  issueDate: string;
  dueDate: string;
  expectedCollectionDate?: string;
  amount: number;
  paidAmount: number;
  payments: AccountPaymentEntry[];
  productId?: string;
  units?: number;
  notes?: string;
}

export type PayablePriority = 'alta' | 'media' | 'baja';

export interface AccountPayable {
  id: string;
  supplierName: string;
  documentRef: string;
  category: OperationalObligationCategory;
  issueDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  priority: PayablePriority;
  payments: AccountPaymentEntry[];
  notes?: string;
}

export type InventoryMovementType = 'purchase' | 'sale' | 'adjustment_in' | 'damage_loss';

export interface InventoryMovement {
  id: string;
  productId: string;
  date: string;
  type: InventoryMovementType;
  quantity: number;
  unitCost: number;
  note?: string;
  linkedTransactionId?: string;
  linkedPayableId?: string;
  linkedReceivableId?: string;
}

export interface WorkingCapitalExtras {
  otherCurrentAssets?: number;
  pendingTaxes?: number;
  pendingPayroll?: number;
  shortTermDebt?: number;
  otherCurrentLiabilities?: number;
}

export interface IvaSettings {
  /** Activar estimador referencial de IVA mensual */
  enabled?: boolean;
  /** true = los precios ingresados incluyen IVA; false = precios netos */
  pricesIncludeIva?: boolean;
  /** Día del mes configurable para recordatorio de F29 (1 a 28) */
  f29Day?: number;
  /** Tasa de IVA porcentual (por defecto 19% en Chile) */
  ivaRatePercent?: number;
}

export interface OwnerSalaryConfig {
  /** true = incluir sueldo del dueño como costo fijo de referencia */
  included?: boolean;
  /** Sueldo mensual asignado al dueño */
  monthlyAmount?: number;
}

export interface MonthlyCloseChecklist {
  month: string;
  actualsChecked?: boolean;
  receivablesPayablesChecked?: boolean;
  comparedVsProjected?: boolean;
  deviationsReviewed?: boolean;
  closedAt?: string;
  notes?: string;
}

export interface CashFlowScenarioConfig {
  optimisticInflowPct?: number;
  optimisticOutflowPct?: number;
  pessimisticInflowPct?: number;
  pessimisticOutflowPct?: number;
}

export interface BusinessWorkspace {
  id: string;
  ownerUid?: string;
  name: string;
  tagline?: string;
  currency: CurrencyConfig;
  startMonth: string;
  targetProfit: number;
  expectedMonthlyUnits: number;
  monthlyGrowthPercent: number;
  projectionMonthsCount: number;
  baseMonthlyUnitsByProduct: Record<string, number>;
  fixedCosts: FixedCost[];
  products: ProductItem[];
  projectionOverrides: Record<string, MonthlyProjectionOverride>;
  actuals: Record<string, MonthlyActualRecord>;
  /** Módulos financieros inteligentes PYME */
  initialCashBalance?: number;
  cashBalanceConfigured?: boolean;
  workingCapitalExtras?: WorkingCapitalExtras;
  receivables?: AccountReceivable[];
  payables?: AccountPayable[];
  inventoryMovements?: InventoryMovement[];
  /** Realidad chilena: estimación de IVA / F29 y sueldo del dueño */
  ivaSettings?: IvaSettings;
  ownerSalary?: OwnerSalaryConfig;
  /** Fase 3: cierre de mes guiado y escenarios de flujo de caja */
  monthlyCloseChecklists?: Record<string, MonthlyCloseChecklist>;
  cashFlowScenarioConfig?: CashFlowScenarioConfig;
  isDemo?: boolean;
  createdAt?: string;
  updatedAt: string;
}

export type ColorTone = 'pastel' | 'formal';

export interface AppStorageState {
  version: number;
  activeBusinessId: string;
  businesses: BusinessWorkspace[];
  theme: 'light' | 'dark';
  colorTone?: ColorTone;
}

export type ViewTab =
  | 'dashboard'
  | 'simple'
  | 'calculator'
  | 'projections'
  | 'actuals'
  | 'catalog'
  | 'faq'
  | 'settings'
  | 'admin';

export type UserRole = 'user' | 'admin';
export type AccessStatus = 'pending' | 'active' | 'revoked';
export type PaymentStatus = 'unpaid' | 'paid' | 'code_redeemed' | 'manual_admin';
export type BillingDay = 5 | 15 | 30;
export type PlanType = 'monthly' | 'annual';

export type MpSubscriptionStatus = 'none' | 'pending' | 'authorized' | 'paused' | 'cancelled';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  accessStatus: AccessStatus;
  paymentStatus: PaymentStatus;
  planType?: PlanType;
  billingDay?: BillingDay;
  nextPaymentDueAt?: string;
  lastPaymentAt?: string;
  accessCodeUsed?: string;
  paymentReference?: string;
  onboardingCompleted?: boolean;
  /** Fase 3: resumen mensual por correo, referidos y débito automático Mercado Pago */
  monthlySummaryEmailEnabled?: boolean;
  referredByCode?: string;
  referralMonthsEarned?: number;
  mpPreapprovalId?: string;
  mpSubscriptionStatus?: MpSubscriptionStatus;
  autoRenewEnabled?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LandingContentConfig {
  heroEyebrow: string;
  heroPrimaryCta: string;
  heroChecks: string;
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  step3Title: string;
  step3Desc: string;
  whatIsEyebrow: string;
  whatIsTitle: string;
  whatIsBody: string;
  whatIsPillar1Title: string;
  whatIsPillar1Desc: string;
  whatIsPillar2Title: string;
  whatIsPillar2Desc: string;
  breakevenEyebrow: string;
  breakevenTitle: string;
  breakevenDefinition: string;
  breakevenImportanceTitle: string;
  breakevenImportancePoints: string;
  breakevenPillarsTitle: string;
  breakevenFixedTitle: string;
  breakevenFixedDesc: string;
  breakevenVariableTitle: string;
  breakevenVariableDesc: string;
  breakevenPriceTitle: string;
  breakevenPriceDesc: string;
  breakevenExampleTitle: string;
  breakevenExampleBody: string;
  breakevenRealityToProjection: string;
  breakevenClosingQuote: string;
  equilibrioEyebrow: string;
  equilibrioTitle: string;
  equilibrioSubtitle: string;
  equilibrioFeatures: string;
  equilibrioCtaLabel: string;
  equilibrioTrustNote: string;
  upcomingEyebrow: string;
  upcomingTitle: string;
  upcomingSubtitle: string;
  creatorEyebrow: string;
  creatorTitle: string;
  creatorName: string;
  creatorRole: string;
  creatorPhotoUrl: string;
  creatorBio: string;
  creatorClosingNote: string;
  creatorQuoteCta: string;
  closingTitle: string;
  closingSubtitle: string;
  closingCtaLabel: string;
  painEyebrow: string;
  painTitle: string;
  painPoints: string;
  priceComparisonText: string;
  privacyTitle: string;
  privacyBody: string;
  supportHumanTitle: string;
  supportHumanBody: string;
  excelEyebrow: string;
  excelTitle: string;
  excelSubtitle: string;
  excelAudienceText: string;
  excelNonReplacementNotice: string;
  excelBridgeQuote: string;
  excelIncludesList: string;
  excelCtaLabel: string;
  excelSecondaryLabel: string;
  excelTaxDisclaimer: string;
}

export interface TestimonialItem {
  id: string;
  name: string;
  businessName: string;
  city?: string;
  quote: string;
  resultHighlight?: string;
  permissionGranted: boolean;
}

export type FunnelStep =
  | 'visit'
  | 'login'
  | 'onboarding'
  | 'first_calculation'
  | 'payment';

export interface FunnelEventRecord {
  id: string;
  sessionId: string;
  step: FunnelStep;
  source?: 'landing' | 'public_calculator' | 'app' | 'demo' | 'payment_view';
  planType?: PlanType;
  day: string;
  createdAt?: unknown;
}

export interface AppConfig {
  paymentUrl: string;
  annualPaymentUrl?: string;
  monthlyPriceClp?: number;
  annualPriceClp?: number;
  mpRecurringEnabled?: boolean;
  priceLabel: string;
  currencyNote: string;
  heroTitle: string;
  heroSubtitle: string;
  guaranteeText: string;
  refundGuaranteeText?: string;
  whatsappUrl?: string;
  testimonials?: TestimonialItem[];
  contactEmail: string;
  welcomeMessage: string;
  announcementText: string;
  announcementActive: boolean;
  excelProductName?: string;
  excelPriceLabel?: string;
  excelPriceAmount?: number;
  excelPaymentUrl?: string;
  excelActive?: boolean;
  landingContent?: Partial<LandingContentConfig>;
  updatedAt?: unknown;
}

export interface GuideLead {
  id: string;
  email: string;
  fixedCosts?: number;
  variableCost?: number;
  unitPrice?: number;
  breakEvenUnits?: number;
  consentAccepted: boolean;
  source: 'landing_calculator';
  createdAt?: unknown;
}

export interface PublicBreakEvenDraft {
  fixedCosts: number;
  variableCost: number;
  unitPrice: number;
  createdAt: string;
}

export type FaqCategory = 'pagos' | 'uso' | 'calculos' | 'cuenta' | 'soporte';

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: FaqCategory;
  order: number;
  published: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AccessCode {
  code: string;
  status: 'unused' | 'used' | 'revoked';
  note?: string;
  codeKind?: 'standard' | 'referral';
  referrerUid?: string;
  referrerEmail?: string;
  referrerDisplayName?: string;
  bonusDays?: number;
  referrerRewardApplied?: boolean;
  referrerRewardAppliedAt?: string;
  createdBy: string;
  createdAt?: unknown;
  usedByUid?: string;
  usedByEmail?: string;
  usedAt?: unknown;
}

export type TicketStatus = 'nuevo' | 'respondido' | 'cerrado';
export type TicketType = 'duda' | 'sugerencia' | 'problema';

export interface TicketAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  ticketType?: TicketType;
  attachments?: TicketAttachment[];
  status: TicketStatus;
  adminReply?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminLogEntry {
  id: string;
  adminUid: string;
  adminEmail: string;
  action: string;
  target: string;
  details: string;
  createdAt?: unknown;
}

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionRecord {
  id: string;
  ownerUid: string;
  endpoint: string;
  keys: PushSubscriptionKeys;
  planType?: PlanType;
  billingDay?: BillingDay;
  nextPaymentDueAt?: string;
  enabled: boolean;
  userAgent?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PaymentNotificationPayload {
  kind: 'reminder' | 'expired';
  title: string;
  body: string;
  tag: string;
  url: string;
  requireInteraction: boolean;
  daysUntilDue: number;
  nextDueISO: string;
}

export type PaymentMethodType = 'mercadopago' | 'codigo_acceso' | 'registro_admin';

export type PaymentReceiptStatus =
  | 'enviado_correo'
  | 'pendiente_envio'
  | 'disponible_descarga';

export interface PaymentHistoryEntry {
  id: string;
  ownerUid: string;
  planType: PlanType;
  amountClp: number;
  transactionId: string;
  paymentMethod: PaymentMethodType;
  paidAt: string;
  periodCoveredEnd: string;
  receiptStatus: PaymentReceiptStatus;
  receiptNumber?: string;
  receiptSentTo?: string;
  receiptSentAt?: string;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ExcelOrderStatus =
  | 'pendiente'
  | 'pagada'
  | 'entregada'
  | 'error_envio'
  | 'anulada';

export interface ExcelOrderRecord {
  id: string;
  name: string;
  email: string;
  status: ExcelOrderStatus;
  amountCLP: number;
  paymentReference?: string;
  licenseId: string;
  termsAcceptedAt: string;
  createdAt?: unknown;
  paidAt?: string;
  deliveredAt?: string;
  deliveryAttempts: number;
  lastError?: string;
}

