import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Peace Apartment Төлбөрийн систем',
  description: 'Айлын ус, дулаан, СӨХ, цахилгааны төлбөрийн мэдээлэл',
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
