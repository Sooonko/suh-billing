import type { ResidentDashboardData } from './types';

/**
 * Дэлгэц зурах үеийн туршилтын дата.
 * Гурван төлөв бүрийг харуулна: илүү төлсөн · төлөөгүй · төлсөн.
 *
 * Ус дулааны тоонууд нь СӨХ-ийн жинхэнэ хүснэгтээс авсан (193 тоот).
 */
export const MOCK_RESIDENT: ResidentDashboardData = {
  flatNumber: 193,
  ownerName: 'Ичинноров Энхжин',
  categories: [
    {
      flat_id: 'mock-1',
      flat_number: 193,
      category: 'WATER_HEAT',
      billing_month: '2026-09',
      prev_reading: null,
      current_reading: null,
      hot_prev: 111,
      hot_current: 113,
      cold_prev: 126,
      cold_current: 130,
      usage_amount: 6,
      bill_amount: 50420.7,
      // 50,420.70 нэхэмжилсэн ба 70,420.70 төлсөн → 20,000 илүү
      total_billed: 50420.7,
      total_paid: 70420.7,
      balance: -20000,
      status: 'OVERPAID',
      breakdown: [
        { code: 'CLEAN_WATER', label: 'Цэвэр ус тариф', unit: 'PER_M3', rate: 3500, qty: 6, amount: 21000 },
        { code: 'WASTE_WATER', label: 'Бохир ус тариф', unit: 'PER_M3', rate: 3200, qty: 6, amount: 19200 },
        { code: 'BASE_FEE', label: 'Усны суурь хураамж', unit: 'FIXED', rate: 3000, qty: 1, amount: 3000 },
        { code: 'HEATING', label: 'Ус халаалсны төлбөр', unit: 'FIXED', rate: 2637, qty: 1, amount: 2637 },
        { code: 'VAT', label: 'НӨАТ', unit: 'PERCENT', rate: 10, qty: 45837, amount: 4583.7 },
      ],
    },
    {
      flat_id: 'mock-1',
      flat_number: 193,
      category: 'SOH',
      billing_month: '2026-09',
      prev_reading: null,
      current_reading: null,
      hot_prev: null,
      hot_current: null,
      cold_prev: null,
      cold_current: null,
      usage_amount: null,
      bill_amount: 25000,
      total_billed: 25000,
      total_paid: 0,
      balance: 25000, // огт төлөөгүй
      status: 'UNPAID',
      breakdown: null,
    },
    {
      flat_id: 'mock-1',
      flat_number: 193,
      category: 'ELECTRICITY',
      billing_month: '2026-09',
      prev_reading: 8421,
      current_reading: 8563,
      hot_prev: null,
      hot_current: null,
      cold_prev: null,
      cold_current: null,
      usage_amount: 142,
      bill_amount: 33370,
      total_billed: 33370,
      total_paid: 33370,
      balance: 0, // бүрэн төлсөн
      // 8 сарын өрөө 9 сард төлсөн жишээ — төлбөр төлсөн САРЫНХАА мөрөнд гарна
      status: 'PAID',
      breakdown: null,
    },
  ],
  debts: [
    { month: '2026-08', category: 'ELECTRICITY', billed: 15000, remaining: 15000 },
    { month: '2026-09', category: 'SOH', billed: 25000, remaining: 25000 },
  ],
  payments: [
    { id: 'p1', month: '2026-09', date: '2026-09-18T00:00:00Z', category: 'WATER_HEAT', amount: 70420.7,
      covers: [
        { month: '2026-08', amount: 20000, billed: 20000 },
        { month: '2026-09', amount: 50420.7, billed: 50420.7 },
      ] },
    { id: 'p2', month: '2026-09', date: '2026-09-12T00:00:00Z', category: 'ELECTRICITY', amount: 33370,
      covers: [{ month: '2026-09', amount: 33370, billed: 18370 }] },
    { id: 'p3', month: '2026-08', date: '2026-08-15T00:00:00Z', category: 'ELECTRICITY', amount: 15000,
      covers: [{ month: '2026-08', amount: 15000, billed: 15000 }] },
  ],
};
