import type { AnnouncementKind } from '@/lib/types';

/**
 * Зарлалын төрөл бүрийн өнгө, дүрс, шошго — нэг эх сурвалж.
 *
 * ⚠️ 'use client' файлд байлгаж БОЛОХГҮЙ: `/medee/[id]` (Server Component)
 * мөн хэрэглэдэг. Client файлаас импортолсон объект сервер дээр жинхэнэ
 * утга биш, «client reference» болж ирдэг.
 */
export const KIND: Record<
  AnnouncementKind,
  { label: string; icon: string; badge: string; bar: string; hero: string; tile: string }
> = {
  URGENT: {
    label: 'Яаралтай',
    icon: '🚨',
    badge: 'bg-red-100 text-red-800 ring-red-600/20',
    bar: 'bg-red-500',
    hero: 'border-red-200 bg-linear-to-br from-red-50 to-white',
    tile: 'bg-red-600',
  },
  MAINTENANCE: {
    label: 'Засвар, хуваарь',
    icon: '🔧',
    badge: 'bg-amber-100 text-amber-900 ring-amber-600/20',
    bar: 'bg-amber-500',
    hero: 'border-amber-200 bg-linear-to-br from-amber-50 to-white',
    tile: 'bg-amber-500',
  },
  INFO: {
    label: 'Мэдээлэл',
    icon: '📢',
    badge: 'bg-slate-100 text-slate-700 ring-slate-500/20',
    bar: 'bg-slate-300',
    hero: 'border-slate-300 bg-linear-to-br from-slate-50 to-white',
    tile: 'bg-slate-900',
  },
};
