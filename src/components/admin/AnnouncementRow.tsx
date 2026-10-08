'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useConfirm, useToast } from '@/components/ui/Feedback';
import { callApi } from '@/lib/api-client';
import type { AnnouncementKind } from '@/lib/types';

export interface AdminAnnouncement {
  id: string;
  kind: AnnouncementKind;
  title: string;
  body: string;
  is_pinned: boolean;
  is_active: boolean;
  published_at: string;
  expires_at: string | null;
}

const KIND_LABEL: Record<AnnouncementKind, { label: string; badge: string }> = {
  INFO: { label: 'Мэдээлэл', badge: 'bg-slate-100 text-slate-700' },
  URGENT: { label: 'Яаралтай', badge: 'bg-red-100 text-red-800' },
  MAINTENANCE: { label: 'Засвар', badge: 'bg-amber-100 text-amber-900' },
};

const BTN =
  'rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50';

/** Нэг зарлалын мөр — нуух, онцлох, устгах, холбоос хуулах үйлдэлтэй */
export function AnnouncementRow({ item }: { item: AdminAnnouncement }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const kind = KIND_LABEL[item.kind] ?? KIND_LABEL.INFO;

  async function patch(patchBody: { isActive?: boolean; isPinned?: boolean }, done: string) {
    setBusy(true);
    const result = await callApi('/api/admin/announcements', {
      method: 'PATCH',
      json: { id: item.id, ...patchBody },
    });
    setBusy(false);
    // Өмнө нь алдааг чимээгүй залгидаг байв — админ «дарсан, юу ч болсонгүй» гэж төөрдөг
    if (!result.ok) {
      toast(result.error, 'error');
      return;
    }
    toast(done);
    router.refresh();
  }

  function remove() {
    confirm({
      title: 'Зарлалыг бүрмөсөн устгах уу?',
      quote: item.title,
      message: 'Түр нуух бол «Нуух» товчийг ашиглана уу — хүссэн үедээ буцааж гаргана.',
      confirmLabel: 'Устгах',
      tone: 'danger',
      action: async () => {
        const result = await callApi(`/api/admin/announcements?id=${encodeURIComponent(item.id)}`, {
          method: 'DELETE',
        });
        if (!result.ok) return result.error;
        toast('Зарлал устлаа');
        router.refresh();
      },
    });
  }

  /**
   * Зарлалын холбоосыг хуулна — Messenger, Facebook группт тавихад.
   * Тэнд гарчиг, тайлбартай урьдчилсан харагдац (preview) автоматаар гарна.
   */
  async function copyLink() {
    const url = `${window.location.origin}/medee/${item.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Холбоос хуулагдлаа — чат руу буулгаж тавина уу');
    } catch {
      // http эсвэл хуучин хөтөч — гараар хуулах боломж өгнө
      window.prompt('Холбоосыг хуулна уу:', url);
    }
  }

  const expired = item.expires_at !== null && new Date(item.expires_at) < new Date();
  const visible = item.is_active && !expired;

  return (
    <li
      className={`rounded-xl border p-4 shadow-sm transition ${
        visible ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-70'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${kind.badge}`}>
          {kind.label}
        </span>
        {item.is_pinned && <span className="text-[11px] font-semibold text-slate-500">📌 Онцлох</span>}
        {!item.is_active && <span className="text-[11px] font-semibold text-slate-500">🙈 Нуусан</span>}
        {expired && <span className="text-[11px] font-semibold text-slate-500">⌛ Хугацаа дууссан</span>}
        <span className="ml-auto text-xs text-slate-400">
          {new Date(item.published_at).toLocaleDateString('mn-MN')}
        </span>
      </div>

      <p className="font-semibold text-slate-900">{item.title}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{item.body}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            patch({ isActive: !item.is_active }, item.is_active ? 'Зарлалыг нуулаа' : 'Зарлал дахин харагдана')
          }
          className={BTN}
        >
          {item.is_active ? 'Нуух' : 'Гаргах'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            patch({ isPinned: !item.is_pinned }, item.is_pinned ? 'Онцлохоос хаслаа' : 'Онцлох болголоо')
          }
          className={BTN}
        >
          {item.is_pinned ? 'Онцлохоос хасах' : 'Онцлох'}
        </button>
        {/* Нуусан зарлалын холбоос оршин суугчид «олдсонгүй» гэж гарна — хуулах нь утгагүй */}
        {visible && (
          <button type="button" onClick={copyLink} className={BTN}>
            🔗 Холбоос хуулах
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={remove}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
        >
          Устгах
        </button>
      </div>
    </li>
  );
}
