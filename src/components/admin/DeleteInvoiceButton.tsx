'use client';

import { useRouter } from 'next/navigation';
import { useConfirm, useToast } from '@/components/ui/Feedback';
import { callApi } from '@/lib/api-client';
import { formatBillingMonth, formatMnt } from '@/lib/format';
import { CATEGORY_LABEL, type BillCategory } from '@/lib/types';

/**
 * Нэхэмжлэл устгах — баталгаажуулах цонхтой.
 *
 * ЯАГААД ЦОНХ ХЭРЭГТЭЙ ВЭ:
 * Нэхэмжлэл устгахад тэр айлын ӨР БУУРНА. Хэрэв тэр сард төлбөр
 * оногдсон байсан бол илүү төлөлт болж хувирна. Нэг дарахад буцаах
 * боломжгүй зүйл болох тул юу устахыг ТОДОРХОЙ харуулж баталгаажуулна.
 */
export function DeleteInvoiceButton({
  id,
  flatNumber,
  category,
  billingMonth,
  billAmount,
}: {
  id: string;
  flatNumber: number;
  category: BillCategory;
  billingMonth: string;
  billAmount: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  function open() {
    confirm({
      title: 'Нэхэмжлэлийг устгах уу?',
      details: [
        ['Тоот', String(flatNumber)],
        ['Ангилал', CATEGORY_LABEL[category]],
        ['Сар', formatBillingMonth(billingMonth)],
        ['Нэхэмжилсэн дүн', formatMnt(billAmount)],
      ],
      warning: (
        <>
          Устгавал тэр айлын өр <b>{formatMnt(billAmount)}</b>-өөр буурна. Хэрэв энэ сард төлбөр
          оногдсон бол илүү төлөлт болж харагдана. Буцаах боломжгүй.
        </>
      ),
      confirmLabel: 'Устгах',
      tone: 'danger',
      action: async () => {
        const result = await callApi(`/api/admin/invoices?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (!result.ok) return result.error;
        toast(`${flatNumber} тоотын ${formatBillingMonth(billingMonth)}-ын нэхэмжлэл устлаа`);
        router.refresh();
      },
    });
  }

  return (
    <button
      type="button"
      onClick={open}
      title="Нэхэмжлэл устгах"
      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
    >
      Устгах
    </button>
  );
}
