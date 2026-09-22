/**
 * Excel / CSV файлыг БРАУЗЕР дээр уншиж, мөрүүдийг JSON болгох.
 *
 * Серверт биш браузерт уншдаг шалтгаан: Vercel Hobby-ийн serverless функц 10
 * секундын хязгаартай. Браузер дээр уншвал сервер рүү зөвхөн жижиг JSON явна.
 *
 * SheetJS-ийг ДИНАМИКААР импортолсон — админаас бусад хуудасны bundle-д
 * ~1MB номын сан оруулахгүйн тулд.
 */

/**
 * Толгой мөрийг таних "зангуу" үгс.
 *
 * Аль нэг нүдэнд эдгээрийн нэг нь агуулагдвал тэр мөр толгой байх магадлалтай.
 * Нэхэмжлэл, банкны хуулга хоёуланд нь тохирно.
 */
const ANCHORS = ['тоот', 'огноо', 'орлого', 'зарлага', 'кредит', 'дебит', 'гүйлгээ', 'заалт'];

/**
 * Толгой мөр хэддүгээр мөр вэ гэдгийг олох.
 *
 * ⚠️ Яагаад хэрэгтэй вэ: СӨХ-ийн Excel дээр толгой нь ХОЁР мөр байдаг —
 * дээр нь бүлгийн нэр («Заалт», «Цэвэр ус», «Тогтмол зардал»), доор нь
 * жинхэнэ баганын нэр («Халуун ус 9 сар заалт»). Нийлүүлсэн нүдний утга
 * зөвхөн эхний баганад ордог тул бүлгийн мөр сийрэг байдаг.
 *
 * Тиймээс зангуу үг агуулсан, хамгийн олон дүүрэн нүдтэй мөрийг сонгоно.
 */
export function findHeaderRow(grid: unknown[][]): number {
  let best = 0;
  let bestScore = -1;

  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const cells = (grid[i] ?? []).map((c) => String(c ?? '').toLowerCase().trim());
    const filled = cells.filter((c) => c !== '').length;
    if (filled < 2) continue;

    const hasAnchor = cells.some((c) => ANCHORS.some((a) => c.includes(a)));
    if (!hasAnchor) continue;

    // Зангуутай мөрүүдээс хамгийн дүүрэн нь — бүлгийн мөр сийрэг байна
    if (filled > bestScore) {
      bestScore = filled;
      best = i;
    }
  }

  return bestScore === -1 ? 0 : best;
}

/**
 * Толгойн мөрийн ХООСОН нүдийг дээрх мөрүүдээс нөхөх.
 *
 * ⚠️ Яагаад хэрэгтэй вэ: Excel дээр «Тоот» гэх багана ихэвчлэн БОСОО
 * НИЙЛҮҮЛСЭН байдаг — 1 ба 2-р мөрийг хамарсан нэг нүд. SheetJS нийлүүлсэн
 * нүдний утгыг зөвхөн ЭХНИЙ нүдэнд тавьдаг тул толгойн мөрөнд тэр багана
 * хоосон харагдана:
 *
 *   мөр1: [0]Тоот  [1]Заалт        [8]Цэвэр ус
 *   мөр2: [0]—     [1]Халуун ус …  [8]Цэвэр ус тариф ААН
 *
 * Хоосон нүдийг дээрээс нь нөхвөл [0] = «Тоот» болж, бусад нь өөрсдийн
 * нарийвчилсан нэрээ хадгална.
 */
function fillFromAbove(grid: unknown[][], headerIndex: number): unknown[] {
  const header = [...(grid[headerIndex] ?? [])];

  // Мөр богино байвал дээрх мөрүүдийн уртад тааруулна
  const width = Math.max(...grid.slice(0, headerIndex + 1).map((row) => (row ?? []).length), 0);

  for (let column = 0; column < width; column++) {
    if (String(header[column] ?? '').trim() !== '') continue;

    // Дээшээ ойрхноос нь хайна
    for (let row = headerIndex - 1; row >= 0; row--) {
      const value = String(grid[row]?.[column] ?? '').trim();
      if (value !== '') {
        header[column] = value;
        break;
      }
    }
  }

  return header;
}

/**
 * Толгойн нэрсийг давхардлаас цэвэрлэх.
 *
 * Хүснэгтэд «Тоот» хоёр удаа, «Төлбөр» гурван удаа тохиолдож болно.
 * Объектын түлхүүр давхардвал сүүлийнх нь өмнөхийг дардаг тул
 * «Төлбөр_2», «Төлбөр_3» гэж ялгана. Баганын ДАРААЛАЛ хадгалагдана —
 * заалтын багануудыг байрлалаар нь ялгадаг тул энэ чухал.
 */
function uniqueHeaders(row: unknown[]): string[] {
  const seen = new Map<string, number>();

  return row.map((cell, index) => {
    const name = String(cell ?? '').replace(/\s+/g, ' ').trim() || `багана_${index + 1}`;
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return count === 1 ? name : `${name}_${count}`;
  });
}

export interface SheetData {
  /** Excel доод талын табын нэр — жишээ «9 сар 1 орц» */
  name: string;
  rows: Record<string, unknown>[];
  /** Толгой Excel дээр хэддүгээр мөрөнд байсан бэ (1-ээс эхэлсэн дугаар) */
  headerRow: number;
}

/**
 * Файлын БҮХ sheet-ийг уншина.
 *
 * ⚠️ Яагаад бүгдийг вэ: СӨХ нэхэмжлэлээ орцоор хуваадаг — «9 сар 1 орц»,
 * «9 сар 2 орц» гэсэн тусдаа таб. Тоот нь байр даяар давхардахгүй
 * (flats.flat_number нь unique) тул орц нь тулгалтад хамаагүй — бүх табыг
 * нэгтгээд оруулж болно. Админ файлаа 2 удаа оруулах шаардлагагүй.
 *
 * Толгойн мөрийг таб тус бүрт ТУСАД НЬ олно — табуудын бүтэц зөрж болно.
 */
/**
 * Сараалжийг (мөр бүр нүдний массив) объектын жагсаалт болгох.
 *
 * Толгой олох, нийлүүлсэн нүд нөхөх, давхардсан нэр ялгах гурвуулаа ЭНД
 * хийгдэнэ. Тест ч, бодит импорт ч ижил функц дуудна — эс бөгөөс тест
 * ажиллаад бодит файл унах эрсдэлтэй.
 */
export function gridToRows(grid: unknown[][]): { rows: Record<string, unknown>[]; headerRow: number } {
  if (!grid.length) return { rows: [], headerRow: 1 };

  const headerIndex = findHeaderRow(grid);
  const headers = uniqueHeaders(fillFromAbove(grid, headerIndex));

  const rows = grid.slice(headerIndex + 1).map((row) => {
    const record: Record<string, unknown> = {};
    headers.forEach((name, index) => {
      record[name] = row[index] ?? '';
    });
    return record;
  });

  return { rows, headerRow: headerIndex + 1 };
}

export async function readSheets(file: File): Promise<SheetData[]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();

  // cellDates: огнооны нүдийг Date объект болгоно (серийн дугаар биш)
  const workbook = XLSX.read(buffer, { cellDates: true });

  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    if (!sheet) return { name, rows: [], headerRow: 1 };

    // Эхлээд ЦЭВЭР сараалж уншина — толгой хаана байгааг өөрсдөө шийднэ
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    return { name, ...gridToRows(grid) };
  });
}

/** Нэг sheet-тэй файлд (банкны хуулга) — зөвхөн эхний табыг авна */
export async function readSheetRows(file: File): Promise<SheetData> {
  const sheets = await readSheets(file);
  return sheets[0] ?? { name: '', rows: [], headerRow: 1 };
}
