import { Document, Font, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { formatBillingMonth, formatMnt, formatReading } from '@/lib/format';
import type { FlatNotice, NoticeCategory, NoticesPayload } from '@/lib/notices';
import { buildPaymentReference } from '@/lib/payment-reference';
import { CATEGORY_LABEL } from '@/lib/types';

/**
 * Хаалганд наах мэдэгдэл — A4 хуудсанд A6 хэмжээтэй 4 карт (2×2),
 * хайчлах тасархай зураастай.
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
const PER_PAGE = 4;
const GRAY = '#555';

const s = StyleSheet.create({
  page: { fontFamily: 'Noto', fontSize: 8, color: '#000', flexDirection: 'row', flexWrap: 'wrap' },
  card: { width: '50%', height: '50%', padding: 14 },
  cutV: { position: 'absolute', left: '50%', top: 0, bottom: 0, borderLeft: '0.6 dashed #999' },
  cutH: { position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '0.6 dashed #999' },

  strip: {
    backgroundColor: '#000',
    color: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
  },
  stripName: { fontSize: 7, fontWeight: 700 },
  stripTitle: { fontSize: 7, fontWeight: 900, letterSpacing: 0.8 },

  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4, marginBottom: 6 },
  flatRow: { flexDirection: 'row', alignItems: 'baseline' },
  flatNo: { fontSize: 34, fontWeight: 900, lineHeight: 1 },
  flatWord: { fontSize: 12, fontWeight: 700, marginLeft: 3 },
  headRight: { alignItems: 'flex-end' },
  headSide: { flexDirection: 'row', alignItems: 'flex-end' },
  qrBox: { alignItems: 'center', marginLeft: 7 },
  qrCaption: { fontSize: 5, color: GRAY, marginTop: 1 },
  month: { fontSize: 10, fontWeight: 700 },
  dueLabel: { fontSize: 6.5, color: GRAY, marginTop: 2 },
  dueText: { fontSize: 8.5, fontWeight: 900, borderBottom: '1.2 solid #000' },

  block: { border: '1.4 solid #000', borderRadius: 4, paddingVertical: 5, paddingHorizontal: 7, marginBottom: 5 },
  blockTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catLabel: { fontSize: 10.5, fontWeight: 900 },
  dueBox: { alignItems: 'flex-end' },
  dueCaption: { fontSize: 5.5, color: GRAY, letterSpacing: 0.4 },
  amount: { fontSize: 15, fontWeight: 900, lineHeight: 1.05 },

  table: { marginTop: 3, borderTop: '0.5 solid #bbb', paddingTop: 2 },
  tr: { flexDirection: 'row', fontSize: 7 },
  th: { flexDirection: 'row', fontSize: 5.8, color: GRAY },
  cName: { width: '34%' },
  cNum: { width: '22%', textAlign: 'right' },

  line: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, marginTop: 1.5 },
  debtLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    fontWeight: 900,
    backgroundColor: '#e6e6e6',
    paddingHorizontal: 3,
    paddingVertical: 1,
    marginTop: 1.5,
    marginHorizontal: -3,
    borderRadius: 2,
  },
  pay: { marginTop: 3, fontSize: 6.3, color: '#222' },
  payRef: { fontWeight: 700, color: '#000' },

  foot: { position: 'absolute', left: 14, right: 14, bottom: 12, borderTop: '0.8 solid #000', paddingTop: 3 },
  footText: { fontSize: 6.5, textAlign: 'center' },
  bold: { fontWeight: 700 },
});

/** "MN110015001175205621" → "MN11 0015 0011 7520 5621" */
const groupIban = (v: string) => v.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

/** ['2026-07','2026-08'] → "7, 8 сар"; олон бол «5–8 сар» */
function monthList(months: string[]): string {
  const nums = months.map((m) => Number(m.slice(5, 7)));
  if (nums.length > 3) return `${nums[0]}–${nums[nums.length - 1]} сар`;
  return `${nums.join(', ')} сар`;
}

const diff = (pair: [number | null, number | null]) =>
  pair[0] === null || pair[1] === null ? null : Math.round((pair[1] - pair[0]) * 100) / 100;

function ReadingRow({ name, pair, unit }: { name: string; pair: [number | null, number | null]; unit: string }) {
  const used = diff(pair);
  return (
    <View style={s.tr}>
      <Text style={s.cName}>{name}</Text>
      <Text style={s.cNum}>{formatReading(pair[0])}</Text>
      <Text style={s.cNum}>{formatReading(pair[1])}</Text>
      <Text style={[s.cNum, s.bold]}>{used === null ? '—' : `${formatReading(used)} ${unit}`}</Text>
    </View>
  );
}

function CategoryBlock({ c, flatNumber, month, account }: { c: NoticeCategory; flatNumber: number; month: string; account?: string }) {
  const r = c.readings;
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

      {r && (
        <View style={s.table}>
          <View style={s.th}>
            <Text style={s.cName}>Заалт</Text>
            <Text style={s.cNum}>Өмнөх</Text>
            <Text style={s.cNum}>Одоо</Text>
            <Text style={s.cNum}>Хэрэглээ</Text>
          </View>
          {r.meter && <ReadingRow name="Тоолуур" pair={r.meter} unit="кВт·ц" />}
          {r.hot && <ReadingRow name="Халуун ус" pair={r.hot} unit="м³" />}
          {r.cold && <ReadingRow name="Хүйтэн ус" pair={r.cold} unit="м³" />}
        </View>
      )}

      {/* Задаргаа — зөвхөн өмнөх үлдэгдэл байвал. Ганц сарын дүнг давтах нь илүүц. */}
      {c.previous >= 1 && (
        <>
          {c.current >= 1 && (
            <View style={s.line}>
              <Text>{`${Number(month.slice(5, 7))} сарын төлбөр`}</Text>
              <Text>{formatMnt(c.current)}</Text>
            </View>
          )}
          <View style={s.debtLine}>
            <Text>{`Өмнөх үлдэгдэл${c.previousMonths.length ? ` (${monthList(c.previousMonths)})` : ''}`}</Text>
            <Text>{formatMnt(c.previous)}</Text>
          </View>
        </>
      )}

      <Text style={s.pay}>
        {account ? `Данс: ${groupIban(account)}   ·   ` : ''}
        Утга: <Text style={s.payRef}>{reference}</Text>
      </Text>
    </View>
  );
}

const QR_SIZE = 44;

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
        <View style={s.headSide}>
          <View style={s.headRight}>
            <Text style={s.month}>{formatBillingMonth(data.month)}</Text>
            <Text style={s.dueLabel}>Төлөх хугацаа</Text>
            <Text style={s.dueText}>{DUE_TEXT}</Text>
          </View>
          {/* Уншуулахад оршин суугчийн дэлгэц (/197) нээгдэнэ — өр, төлсөн түүх, данс */}
          <View style={s.qrBox}>
            <QrCode text={`${SITE_URL}/${n.flatNumber}`} />
            <Text style={s.qrCaption}>Уншуулж харах</Text>
          </View>
        </View>
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

      <View style={s.foot}>
        <Text style={s.footText}>
          Гүйлгээний утганд <Text style={s.bold}>ТООТОО</Text> заавал бичнэ үү. Ангилал бүрийг өөрийн дансанд төлнө.
        </Text>
        <Text style={[s.footText, s.bold]}>Лавлах утас: {data.phone}</Text>
      </View>
    </View>
  );
}

export function NoticeDocument({ data }: { data: NoticesPayload }) {
  const pages: FlatNotice[][] = [];
  for (let i = 0; i < data.notices.length; i += PER_PAGE) {
    pages.push(data.notices.slice(i, i + PER_PAGE));
  }

  return (
    <Document title={`Төлбөрийн мэдэгдэл ${data.month}`} author={data.buildingName}>
      {pages.map((group, i) => (
        <Page key={i} size="A4" style={s.page}>
          {group.map((n) => (
            <NoticeCard key={n.flatNumber} n={n} data={data} />
          ))}
          <View style={s.cutV} fixed />
          <View style={s.cutH} fixed />
        </Page>
      ))}
    </Document>
  );
}
