import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Гэрийн хавтсанд өөр lockfile байгаа тул үндсэн хавтсыг тодорхой зааж өгнө
  outputFileTracingRoot: path.join(import.meta.dirname, '.'),

  // `next dev` ба `next build` нэг .next хавтсыг хуваавал webhack module-ууд
  // эвдэрч 500 алдаа гардаг. Dev ажиллаж байхад build шалгах шаардлага гарвал
  // NEXT_DIST_DIR=.next-verify npm run build гэж тусад нь хийнэ.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
