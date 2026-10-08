'use client';

import { useEffect } from 'react';
import { markSeen } from '@/lib/news-seen';

/** Зарлалын хуудсыг нээсэн бол уншсан гэж тэмдэглэнэ — цэсний «шинэ» тэмдэг буурна */
export function MarkSeen({ id }: { id: string }) {
  useEffect(() => {
    markSeen([id]);
  }, [id]);
  return null;
}
