import { CopyButton } from '@/components/layout/CopyButton';
import { PageHeader } from '@/components/layout/PageHeader';
import { createAdminClient } from '@/lib/supabase/admin';
import { SOH } from '@/lib/soh-config';
import { CATEGORY_LABEL, type BankAccount } from '@/lib/types';

/** "MN110015001175205621" → "MN11 0015 0011 7520 5621" */
function groupIban(value: string): string {
  return value.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

/** Данс тогтмол тул 1 цаг кэшлэнэ */
export const revalidate = 3600;

/**
 * Дансны дугаарын дэлгэц.
 *
 * Гүйлгээний утганд тоот бичихийг ОНЦЛОН сануулна — автомат тулгалт бүхэлдээ
 * үүнээс шалтгаална. Утганд тоот байхгүй бол админ гараар хайх шаардлагатай
 * болно.
 */
async function fetchAccounts(): Promise<BankAccount[]> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from('bank_accounts')
      .select('id, account_number, category, display_name')
      .order('category');
    if (error) return [];
    return (data ?? []) as BankAccount[];
  } catch {
    return [];
  }
}

export default async function BankAccountsPage() {
  const accounts = await fetchAccounts();

  return (
    <div>
      <PageHeader title="Дансны дугаар" subtitle="Цахилгаан, Ус дулаан, СӨХ гэсэн 3 төрлийн данс байдаг тул өөрийн хэрэглээний төлбөрөө тус тусын дансанд хийнэ үү." />

      {/* Хамгийн чухал заавар — дээр, тод харагдана */}
      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="flex gap-3 text-sm text-amber-900">
          <span aria-hidden className="text-base leading-none">⚠️</span>
          <span>
            <span className="font-semibold">Анхаарна уу: </span>
            {SOH.transferRule} Ингэснээр төлбөр тань автоматаар бүртгэгдэнэ.
          </span>
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center text-sm text-slate-500">
          Дансны мэдээлэл бүртгэгдээгүй байна.
        </div>
      ) : (
        <ul className="space-y-3 md:grid md:grid-cols-3 md:gap-5 md:space-y-0">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-col md:items-start md:gap-4 md:p-5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {CATEGORY_LABEL[account.category] ?? account.display_name}
                </p>
                {/*
                  Дансны дугаар 20 тэмдэгттэй тул картаас хальж байсан.
                  IBAN-ыг 4-өөр бүлэглэвэл уншихад хялбар бөгөөд зайнууд
                  нь мөр таслах боломж өгнө. Хуулах товч нь зайгүй ЖИНХЭНЭ
                  дугаарыг хуулна — банк руу зайтай хуулбал буруу болно.
                */}
                <p className="mt-1 break-words font-bold tabular-nums text-slate-900">
                  {groupIban(account.account_number)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{account.display_name}</p>
              </div>
              <CopyButton value={account.account_number} label={account.display_name} />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 text-center text-xs leading-relaxed text-slate-400">
        Төлбөр тань 1–2 хоногийн дотор дэлгэц дээр тусна.
        <br />
        Хэрэв тусаагүй бол СӨХ-тэй холбогдоно уу.
      </p>
    </div>
  );
}
