/** Төлбөрийн ангилал — DB дэх bill_category enum-тэй яг тохирно */
export type BillCategory = 'WATER_HEAT' | 'SOH' | 'ELECTRICITY';

/** Оршин суугчийн дэлгэц дээрх төлөв */
export type PaymentStatus = 'PAID' | 'UNPAID' | 'PARTIAL' | 'OVERPAID';

export type TransactionStatus = 'MATCHED' | 'PARTIAL' | 'UNMATCHED' | 'IGNORED';

/** Табын дараалал ба монгол нэр — нэг эх сурвалжаас удирдана */
export const CATEGORIES: { key: BillCategory; label: string; hasMeter: boolean }[] = [
  { key: 'WATER_HEAT', label: 'Ус, дулаан', hasMeter: true },
  { key: 'SOH', label: 'СӨХ', hasMeter: false },
  { key: 'ELECTRICITY', label: 'Цахилгаан', hasMeter: true },
];

export const CATEGORY_LABEL: Record<BillCategory, string> = {
  WATER_HEAT: 'Ус, дулаан',
  SOH: 'СӨХ',
  ELECTRICITY: 'Цахилгаан',
};

/** v_flat_category_state view-ийн нэг мөр */
export interface FlatCategoryState {
  flat_id: string;
  flat_number: number;
  category: BillCategory;
  /** эерэг = өртэй · сөрөг = илүү төлсөн · 0 = цэвэр */
  balance: number;
  /** Бүх сарын нэхэмжлэлийн нийлбэр */
  total_billed: number;
  /** Бүх төлсөн мөнгөний нийлбэр */
  total_paid: number;
  billing_month: string | null;
  prev_reading: number | null;
  current_reading: number | null;
  usage_amount: number | null;
  bill_amount: number | null;
  status: PaymentStatus;
  // ── зөвхөн ус дулаанд ──
  hot_prev: number | null;
  hot_current: number | null;
  cold_prev: number | null;
  cold_current: number | null;
  /** Нэхэмжлэл бодогдсон задаргаа — тухайн үеийн тарифыг хадгалсан */
  breakdown: BillLineDetail[] | null;
}

/**
 * Нэг төлсөн баримт.
 *
 * Огноо нь БАНКНЫ гүйлгээний огноо — оршин суугч өөрийн хуулгатайгаа
 * тулгаж чадах ёстой. Системд бүртгэсэн огноо биш.
 */
export interface PaymentEntry {
  id: string;
  /** Шүүлтэд хэрэглэх сар — 'YYYY-MM' */
  month: string;
  /** Банкны гүйлгээний бүтэн огноо */
  date: string;
  category: BillCategory;
  amount: number;
  /**
   * Тухайн сард ЯМАР дүн нэхэмжилсэн байсан бэ (ижил ангилалд).
   * Оршин суугч «хэдийн эсрэг хэдийг төлсөн бэ» гэдгийг харах ёстой.
   * Тэр сард нэхэмжлэл байхгүй бол null.
   */
  billedThatMonth: number | null;
}

/** invoices.breakdown доторх нэг мөр */
export interface BillLineDetail {
  code: string;
  label: string;
  unit: TariffUnit;
  rate: number;
  qty: number;
  amount: number;
}

/** Оршин суугчийн дэлгэцэд API-аас буцаах бүтэн хариу */
export interface ResidentDashboardData {
  flatNumber: number;
  ownerName: string | null;
  categories: FlatCategoryState[];
  /** Төлсөн баримтууд, шинэ нь эхэндээ */
  payments: PaymentEntry[];
  /** Төлөгдөөгүй үлдсэн сарууд, хуучнаас нь эхлэн */
  debts: DebtRow[];
}

/**
 * Төлөгдөөгүй үлдсэн нэг сарын мөр.
 *
 * ⚠️ Төлбөр тодорхой сарын нэхэмжлэлд наалддаггүй тул «энэ сар төлөгдсөн
 * үү» гэдгийг ДҮРМЭЭР тогтооно: төлсөн мөнгө ХАМГИЙН ХУУЧИН өрийг эхэлж
 * хаана (FIFO). Ус, цахилгааны төлбөрт нийтлэг хэрэглэдэг журам.
 */
export interface DebtRow {
  /** 'YYYY-MM' */
  month: string;
  category: BillCategory;
  /** Тухайн сард нэхэмжилсэн дүн */
  billed: number;
  /** Үүнээс төлөгдөөгүй үлдсэн нь */
  remaining: number;
}

/** announcements хүснэгтийн нэг мөр — СӨХ-ийн мэдээ, зарлал */
export type AnnouncementKind = 'INFO' | 'URGENT' | 'MAINTENANCE';

export interface Announcement {
  id: string;
  kind: AnnouncementKind;
  title: string;
  body: string;
  is_pinned: boolean;
  published_at: string;
}

/** bank_accounts хүснэгтийн нэг мөр — /dans дэлгэцэд */
export interface BankAccount {
  id: string;
  account_number: string;
  category: BillCategory;
  display_name: string;
}

/**
 * tariffs.unit — тарифыг хэрхэн хэрэглэх вэ.
 *
 * NUMBER нь МӨНГӨ БИШ — коэффициент, хоног, цаг зэрэг томьёоны орц.
 */
export type TariffUnit =
  | 'PER_M3'
  | 'PER_KWH'
  | 'CAPACITY'
  | 'FIXED'
  | 'NUMBER'
  | 'PERCENT';

/** tariffs хүснэгтийн нэг мөр */
export interface Tariff {
  id: string;
  category: BillCategory;
  code: string;
  label: string;
  unit: TariffUnit;
  rate: number;
  sort_order: number;
  /** Аль орцод хамаарах вэ. null = бүх орцод. */
  entrance: number | null;
  effective_from: string;
  effective_to: string | null;
}
