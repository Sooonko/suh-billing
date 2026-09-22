import type { TariffRow } from './water-heat';

/**
 * Орц тусгайлсан тарифыг ерөнхийтэй нэгтгэх.
 *
 * Орц бүр өөр журамтай байж болно — жишээ нь 1 орц 9 сар хүртэл ус
 * халаалтын төлбөр аваагүй. Тухайн орцод зориулсан мөр байвал ерөнхий
 * мөрийг код (`code`) -оороо ДАРНА.
 *
 * ⚠️ Дарагдсан мөрийг ХАСАХГҮЙ, солино. Тиймээс орцын тариф 0 байвал тэр
 * мөр 0 дүнтэйгээр задаргаанд үлдэж, «яагаад 0 вэ» гэдэг нь ил харагдана.
 */
export interface TariffWithEntrance extends TariffRow {
  entrance: number | null;
  sortOrder: number;
}

export function resolveTariffs(
  all: readonly TariffWithEntrance[],
  entrance: number | null,
): TariffRow[] {
  const byCode = new Map<string, TariffWithEntrance>();

  // Эхлээд ерөнхий мөрүүд
  for (const row of all) {
    if (row.entrance === null) byCode.set(row.code, row);
  }
  // Дараа нь тухайн орцынх — дарна
  if (entrance !== null) {
    for (const row of all) {
      if (row.entrance === entrance) byCode.set(row.code, row);
    }
  }

  return [...byCode.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ code, label, unit, rate }) => ({ code, label, unit, rate }));
}
