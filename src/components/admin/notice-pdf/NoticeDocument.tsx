import { Document, Font, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { formatBillingMonth, formatMnt, formatMonthList, formatReading } from '@/lib/format';
import type { FlatNotice, NoticeCategory, NoticesPayload } from '@/lib/notices';
import { buildPaymentReference } from '@/lib/payment-reference';
import { CATEGORY_LABEL } from '@/lib/types';

/**
 * Хаалганд наах мэдэгдэл — A4 хуудсанд 105×99 мм хэмжээтэй 6 карт (2×3),
 * хайчлах тасархай зураастай. A6 (4 карт) хаалганд хэт том байсан.
 * 3 ангилал + өмнөх үлдэгдэлтэй айл ч багтах ёстой — зай нэмэхдээ
 * хамгийн их агуулгатай картаар шалгах.
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
const PER_PAGE = 6;
const GRAY = '#555';

const s = StyleSheet.create({
  page: { fontFamily: 'Noto', fontSize: 8, color: '#000', flexDirection: 'row', flexWrap: 'wrap' },
  card: { width: '50%', height: '33.333%', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 9 },
  cutV: { position: 'absolute', left: '50%', top: 0, bottom: 0, borderLeft: '0.6 dashed #999' },
  cutH1: { position: 'absolute', top: '33.333%', left: 0, right: 0, borderTop: '0.6 dashed #999' },
  cutH2: { position: 'absolute', top: '66.667%', left: 0, right: 0, borderTop: '0.6 dashed #999' },

  strip: {
    backgroundColor: '#000',
    color: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderRadius: 3,
  },
  stripName: { fontSize: 7, fontWeight: 700 },
  stripTitle: { fontSize: 7, fontWeight: 900, letterSpacing: 0.8 },

  head: { flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: 2 },
  flatRow: { flexDirection: 'row', alignItems: 'baseline' },
  flatNo: { fontSize: 26, fontWeight: 900, lineHeight: 1 },
  flatWord: { fontSize: 10, fontWeight: 700, marginLeft: 3 },
  headRight: { flex: 1, alignItems: 'flex-end', marginRight: 7 },
  month: { fontSize: 9, fontWeight: 700 },
  dueLabel: { fontSize: 6, color: GRAY, marginTop: 1 },
  dueText: { fontSize: 8, fontWeight: 900, borderBottom: '1.2 solid #000' },

  block: { border: '1.2 solid #000', borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6, marginBottom: 2.5 },
  blockTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catLabel: { fontSize: 9.5, fontWeight: 900 },
  dueBox: { flexDirection: 'row', alignItems: 'baseline' },
  dueCaption: { fontSize: 5.5, color: GRAY, letterSpacing: 0.4, marginRight: 5 },
  amount: { fontSize: 13, fontWeight: 900, lineHeight: 1.05 },

  table: { marginTop: 1.5, borderTop: '0.5 solid #bbb', paddingTop: 1 },
  tr: { flexDirection: 'row', fontSize: 6.8 },
  th: { flexDirection: 'row', fontSize: 5.5, color: GRAY },
  cName: { width: '34%' },
  cNum: { width: '22%', textAlign: 'right' },

  debtLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    backgroundColor: '#e6e6e6',
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    marginTop: 1,
    marginHorizontal: -3,
    borderRadius: 2,
  },
  pay: { marginTop: 1.5, fontSize: 6, color: '#222' },
  payRef: { fontWeight: 700, color: '#000' },

  foot: { position: 'absolute', left: 12, right: 12, bottom: 7, borderTop: '0.8 solid #000', paddingTop: 2 },
  footText: { fontSize: 6, color: '#222' },
  bold: { fontWeight: 700 },
  black: { fontWeight: 900 },
});

/** "MN110015001175205621" → "MN11 0015 0011 7520 5621" */
const groupIban = (v: string) => v.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

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

      {/*
        Задаргаа — зөвхөн өмнөх үлдэгдэл байвал. Ганц сарын дүнг давтах нь илүүц.
        Нэг мөрөнд багтаана — 3 ангилал бүгд өртэй айл 99 мм картад багтах ёстой.
      */}
      {c.previous >= 1 && (
        <View style={s.debtLine}>
          <Text>{c.current >= 1 ? `${Number(month.slice(5, 7))} сар: ${formatMnt(c.current)}` : ''}</Text>
          <Text style={s.black}>
            {`Өмнөх үлдэгдэл${c.previousMonths.length ? ` (${formatMonthList(c.previousMonths)})` : ''}: ${formatMnt(c.previous)}`}
          </Text>
        </View>
      )}

      <Text style={s.pay}>
        {account ? `Данс: ${groupIban(account)}   ·   ` : ''}
        Утга: <Text style={s.payRef}>{reference}</Text>
      </Text>
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

      {/*
        QR толгойд, тоотын хажууд — доод талд тусдаа хэсэг болговол 99 мм
        картад 3 ангилал багтахгүй. Уншуулахад оршин суугчийн дэлгэц (/197)
        нээгдэнэ — өр, төлсөн түүх, данс.
      */}
      <View style={s.foot}>
        <Text style={s.footText}>
          QR уншуулж эсвэл <Text style={s.bold}>{`${SITE_URL.replace(/^https?:\/\//, '')}/${n.flatNumber}`}</Text> хаягаар
          төлбөрөө вэбээс харна уу.
        </Text>
        <Text style={s.footText}>
          Гүйлгээний утганд <Text style={s.bold}>ТООТОО</Text> заавал бичнэ үү. Лавлах утас:{' '}
          <Text style={s.bold}>{data.phone}</Text>
        </Text>
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
          <View style={s.cutH1} fixed />
          <View style={s.cutH2} fixed />
        </Page>
      ))}
    </Document>
  );
}
