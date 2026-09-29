import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Peace Apartment Төлбөрийн систем',
  description: 'Айлын ус, дулаан, СӨХ, цахилгааны төлбөрийн мэдээлэл',

  /**
   * Хөтчийн таб дээрх дүрсийг ХООСОН гэж ЗАРИМДАА зарлана.
   *
   * ЯАГААД: төсөлд дүрсний файл байхгүй тул хөтөч `/favicon.ico` гуйдаг.
   * Тэр хаяг манай `[flat]` маршрутад баригдаж HTML буцаадаг — дүрс биш.
   * Хөтөч уншиж чадалгүй өмнө нь localhost:3000 дээр ажиллаж байсан ӨӨР
   * аппын дүрсийг табанд үлдээж, танил бус цэнхэр лого гарч ирж байв.
   *
   * `data:,` нь хоосон дүрс. Ингэснээр хөтөч `/favicon.ico` огт гуйхгүй
   * бөгөөд өөр аппын лого харагдахгүй. Өөрийн лого тавих бол энэ мөрийг
   * устгаад `src/app/icon.svg` файл нэмэхэд хангалттай.
   */
  icons: { icon: 'data:,' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/**
 * Хамгийн гадна бүрхүүл — зөвхөн html/body.
 *
 * Дэлгэцийн бүтэц хоёр салаалдаг тул тус тусдаа layout-т хуваасан:
 *  · (resident)/layout.tsx — оршин суугчийн цэс, толгой
 *  · admin/(panel)/layout.tsx — админы цэс
 * Ингэснээр админ дэлгэц оршин суугчийн доод цэсийг өмсөхгүй.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
