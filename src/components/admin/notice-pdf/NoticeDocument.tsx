import { Document, Font, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { formatBillingMonth, formatMnt, formatMonthList } from '@/lib/format';
import type { FlatNotice, NoticeCategory, NoticesPayload } from '@/lib/notices';
import { buildPaymentReference } from '@/lib/payment-reference';
import { CATEGORY_LABEL } from '@/lib/types';

/**
 * Хаалганд наах мэдэгдэл — A4 хуудсанд 2 багана, 105 мм өргөн карт,
 * хайчлах тасархай зураастай. Картын өндөр нь айлын ангиллын тооноос
 * хамаарна — тогтмол сүлжээ (2×4) 1 ангилалтай айлд хагас хуудас хоосон
 * үлдээж байв. Багана бүрийг дээрээс доош дүүргэнэ.
 *
 * ⚠️ Өндрийг урьдчилан бодож байрлуулдаг тул карт доторх бүх мөр ТОГТМОЛ
 * өндөртэй (`H`). Мөр нэмэх/өөрчлөхдөө `H`-г заавал засна — эс бөгөөс
 * карт хуудаснаас хална. Тоолуурын заалт, нэмэлт тайлбар мессеж
 * ЗОРИУДААР байхгүй — QR-аар вэбээс харна.
 *
 * ⚠️ Энэ модулийг ЗӨВХӨН браузерт динамикаар татна (`NoticePdfButton`).
 * react-pdf ~1MB тул товч дарах хүртэл хуудасны ачаалалд нэмэгдэхгүй.
 *
 * ХАР-ЦАГААН принтерт зориулсан: анхаарал татах хэсгийг өнгөөр биш хар
 * тууз, том тод тоо, хүрээгээр гаргана.
 *
 * Фонт: Noto Sans — Roboto-д ₮ тэмдэгт байхгүй. Латин + кирилл + ₮-ээр
 * таслаж 230KB болгосон (бүтэн нь 1.9MB). Сум (→), ✓ зэрэг тэмдэгт
 * фонтод БАЙХГҮЙ — хоосон дөрвөлжин болж хэвлэгдэнэ, бичихгүй.
 */

const origin = typeof window === 'undefined' ? '' : window.location.origin;
Font.register({
  family: 'Noto',
  fonts: [
    { src: `${origin}/fonts/NotoSans-Regular.ttf`, fontWeight: 400 },
    { src: `${origin}/fonts/NotoSans-Bold.ttf`, fontWeight: 700 },
    { src: `${origin}/fonts/NotoSans-Black.ttf`, fontWeight: 900 },
  ],
});
/**
 * QR-ын заах хаяг. PDF-ийг localhost дээрээс татсан ч хэвлэсэн QR нь
 * жинхэнэ сайт руу заах ёстой — тиймээс env-ээр тогтооно.
 */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(/\/$/, '');

// Монгол үгийг зураасаар таслахгүй — «төл-бөр» гэж хуваагдвал уншихад муу
Font.registerHyphenationCallback((word) => [word]);

const DUE_TEXT = 'Сар бүрийн 20-ны өмнө';
const GRAY = '#555';
const PAGE_H = 841.89; // A4, pt

/** Картын мөрүүдийн тогтмол өндөр (pt) — `cardHeight` эдгээрээр бодно */
const H = {
  padTop: 8,
  padBottom: 7,
  strip: 14,
  head: 50, // QR 46 + дээр доор 2
  blockBorder: 1.2,
  blockPad: 2,
  blockTop: 14,
  debt: 11, // 10 + marginTop 1
  pay: 9.5,
  blockGap: 2.5,
};

const blockHeight = (c: NoticeCategory) =>
  2 * (H.blockBorder + H.blockPad) + H.blockTop + (c.previous >= 1 ? H.debt : 0) + H.pay;

const cardHeight = (n: FlatNotice) =>
  H.padTop + H.strip + H.head + H.padBottom +
  n.categories.reduce((sum, c) => sum + blockHeight(c) + H.blockGap, 0);

/** Багана бүрийг дээрээс доош дүүргэнэ: [хуудас][багана][карт] */
function layoutPages(notices: FlatNotice[]): FlatNotice[][][] {
  const pages: FlatNotice[][][] = [];
  let col: FlatNotice[] = [];
  let used = 0;
  const flush = () => {
    if (!col.length) return;
    const page = pages[pages.length - 1];
    if (page && page.length < 2) page.push(col);
    else pages.push([col]);
    col = [];
    used = 0;
  };
  for (const n of notices) {
    const h = cardHeight(n);
    if (used + h > PAGE_H) flush();
    col.push(n);
    used += h;
  }
  flush();
  return pages;
}

const s = StyleSheet.create({
  page: { fontFamily: 'Noto', fontSize: 8, color: '#000', flexDirection: 'row' },
  column: { width: '50%' },
  card: { paddingHorizontal: 12, paddingTop: H.padTop, paddingBottom: H.padBottom, borderBottom: '0.6 dashed #999' },
  cutV: { position: 'absolute', left: '50%', top: 0, bottom: 0, borderLeft: '0.6 dashed #999' },

  strip: {
    backgroundColor: '#000',
    color: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: H.strip,
    paddingHorizontal: 7,
    borderRadius: 3,
  },
  stripName: { fontSize: 7, fontWeight: 700 },
  stripTitle: { fontSize: 7, fontWeight: 900, letterSpacing: 0.8 },

  head: { flexDirection: 'row', alignItems: 'center', height: H.head },
  flatRow: { flexDirection: 'row', alignItems: 'baseline' },
  flatNo: { fontSize: 26, fontWeight: 900, lineHeight: 1 },
  flatWord: { fontSize: 10, fontWeight: 700, marginLeft: 3 },
  headRight: { flex: 1, alignItems: 'flex-end', marginRight: 7 },
  month: { fontSize: 9, fontWeight: 700 },
  dueLabel: { fontSize: 6, color: GRAY, marginTop: 1 },
  dueText: { fontSize: 8, fontWeight: 900, borderBottom: '1.2 solid #000' },

  block: {
    border: `${H.blockBorder} solid #000`,
    borderRadius: 3,
    paddingVertical: H.blockPad,
    paddingHorizontal: 6,
    marginBottom: H.blockGap,
  },
  blockTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: H.blockTop },
  catLabel: { fontSize: 9.5, fontWeight: 900 },
  dueBox: { flexDirection: 'row', alignItems: 'baseline' },
  dueCaption: { fontSize: 5.5, color: GRAY, letterSpacing: 0.4, marginRight: 5 },
  amount: { fontSize: 13, fontWeight: 900, lineHeight: 1.05 },

  debtLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    alignItems: 'center',
    backgroundColor: '#e6e6e6',
    paddingHorizontal: 3,
    height: H.debt - 1,
    marginTop: 1,
    marginHorizontal: -3,
    borderRadius: 2,
  },
  // Өндрийг Text-д биш View-д өгнө — react-pdf өндөрт багтаагүй мөрийг зурдаггүй
  payRow: { height: H.pay, justifyContent: 'flex-end' },
  pay: { fontSize: 6, color: '#222' },
  payRef: { fontWeight: 700, color: '#000' },

  black: { fontWeight: 900 },
});

/** "MN110015001175205621" → "MN11 0015 0011 7520 5621" */
const groupIban = (v: string) => v.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

function CategoryBlock({ c, flatNumber, month, account }: { c: NoticeCategory; flatNumber: number; month: string; account?: string }) {
  // Нэг л сар төлөгдөөгүй бол утганд сарыг бичнэ — тулгалт сарыг таамаглахгүй.
  // Олон сар бол сар бичихгүй: FIFO хамгийн хуучнаас нь хаана.
  const owed = [...c.previousMonths, ...(c.current >= 1 ? [month] : [])];
  const reference = buildPaymentReference(flatNumber, c.category, owed.length === 1 ? owed[0] : null);

  return (
    <View style={s.block} wrap={false}>
      <View style={s.blockTop}>
        <Text style={s.catLabel}>{CATEGORY_LABEL[c.category]}</Text>
        <View style={s.dueBox}>
          <Text style={s.dueCaption}>ТӨЛӨХ ДҮН</Text>
          <Text style={s.amount}>{formatMnt(c.due)}</Text>
        </View>
      </View>

      {/*
        Задаргаа — зөвхөн өмнөх үлдэгдэл байвал. Ганц сарын дүнг давтах нь илүүц.
        Нэг мөрөнд багтаана — картын өндрийг багасгана.
      */}
      {c.previous >= 1 && (
        <View style={s.debtLine}>
          <Text>{c.current >= 1 ? `${Number(month.slice(5, 7))} сар: ${formatMnt(c.current)}` : ''}</Text>
          <Text style={s.black}>
            {`Өмнөх үлдэгдэл${c.previousMonths.length ? ` (${formatMonthList(c.previousMonths)})` : ''}: ${formatMnt(c.previous)}`}
          </Text>
        </View>
      )}

      <View style={s.payRow}>
        <Text style={s.pay}>
          {account ? `Данс: ${groupIban(account)}   ·   ` : ''}
          Утга: <Text style={s.payRef}>{reference}</Text>
        </Text>
      </View>
    </View>
  );
}

const QR_SIZE = 46;

/**
 * Айлын хуудасны QR — вектор Path болгож зурна.
 *
 * ЯАГААД ЗУРАГ (PNG) БИШ: хэвлэхэд бүдгэрдэггүй, 200 айлд файл томрохгүй,
 * canvas хэрэггүй.
 *
 * Алдаа засах түвшин M — хаалган дээр наасан цаас үрэгдэж, бага зэрэг
 * будагдсан ч уншигдана.
 */
function QrCode({ text }: { text: string }) {
  const { size, data } = QRCode.create(text, { errorCorrectionLevel: 'M' }).modules;
  // Мөр дэх дараалсан хар нүдийг НЭГ тэгш өнцөгт болгоно — нүд бүрээр
  // зурвал 186 айлын файл 0.5MB → 1.3MB болж томорч байв
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!data[y * size + x]) continue;
      let run = 1;
      while (x + run < size && data[y * size + x + run]) run++;
      d += `M${x} ${y}h${run}v1h-${run}z`;
      x += run - 1;
    }
  }
  return (
    <Svg width={QR_SIZE} height={QR_SIZE} viewBox={`0 0 ${size} ${size}`}>
      <Path d={d} fill="#000" />
    </Svg>
  );
}

function NoticeCard({ n, data }: { n: FlatNotice; data: NoticesPayload }) {
  return (
    <View style={s.card}>
      <View style={s.strip}>
        <Text style={s.stripName}>{data.buildingName}</Text>
        <Text style={s.stripTitle}>ТӨЛБӨРИЙН МЭДЭГДЭЛ</Text>
      </View>

      <View style={s.head}>
        <View style={s.flatRow}>
          <Text style={s.flatNo}>{n.flatNumber}</Text>
          <Text style={s.flatWord}>тоот</Text>
        </View>
        <View style={s.headRight}>
          <Text style={s.month}>{formatBillingMonth(data.month)}</Text>
          <Text style={s.dueLabel}>Төлөх хугацаа</Text>
          <Text style={s.dueText}>{DUE_TEXT}</Text>
        </View>
        {/* Уншуулахад оршин суугчийн дэлгэц (/197) нээгдэнэ — өр, төлсөн түүх, заалт */}
        <QrCode text={`${SITE_URL}/${n.flatNumber}`} />
      </View>

      {n.categories.map((c) => (
        <CategoryBlock
          key={c.category}
          c={c}
          flatNumber={n.flatNumber}
          month={data.month}
          account={data.accounts[c.category]}
        />
      ))}
    </View>
  );
}

export function NoticeDocument({ data }: { data: NoticesPayload }) {
  return (
    <Document title={`Төлбөрийн мэдэгдэл ${data.month}`} author={data.buildingName}>
      {layoutPages(data.notices).map((columns, i) => (
        <Page key={i} size="A4" style={s.page}>
          {columns.map((col, j) => (
            <View key={j} style={s.column}>
              {col.map((n) => (
                <NoticeCard key={n.flatNumber} n={n} data={data} />
              ))}
            </View>
          ))}
          <View style={s.cutV} fixed />
        </Page>
      ))}
    </Document>
  );
}
