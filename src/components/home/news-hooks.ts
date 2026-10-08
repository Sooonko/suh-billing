'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { parseSeen, readSeenRaw, subscribeSeen, unseenOf, type NewsStamp } from '@/lib/news-seen';

/**
 * Уншаагүй зарлалууд — ШУУД шинэчлэгдэнэ (цэсний тэмдэг, сануулгад).
 *
 * Сервер дээр болон анхны hydration-д `null` — localStorage сервер дээр
 * байхгүй тул «шинэ» тэмдгийг хөтөч дээр л зурна. Ингэснээр React-ын
 * hydration зөрүү гарахгүй.
 */
export function useUnseen<T extends NewsStamp>(items: T[]): T[] | null {
  const raw = useSyncExternalStore(subscribeSeen, readSeenRaw, () => null);
  const now = useNow();
  return useMemo(
    () => (raw === null || now === null ? null : unseenOf(items, parseSeen(raw), now)),
    [raw, now, items],
  );
}

/**
 * Хуудас нээгдэх мөчийн «шинэ» жагсаалт — ТОГТМОЛ.
 *
 * Зарлалын карт дээрх «ШИНЭ» тэмдэг уншиж байх зуур алга болвол хүн
 * юу шинэ байсныг мэдэхгүй үлдэнэ. Тиймээс энэ айлчлалын турш хэвээр
 * үлдээж, ДАРААГИЙН удаа ороход л арилгана.
 */
export function useNewSnapshot<T extends NewsStamp>(items: T[]): Set<string> | null {
  const [snapshot, setSnapshot] = useState<Set<string> | null>(null);
  useEffect(() => {
    setSnapshot(new Set(unseenOf(items, parseSeen(readSeenRaw()), Date.now()).map((i) => i.id)));
    // Зөвхөн анх нээгдэхэд — items өөрчлөгдвөл (админ шинэ зарлал нэмсэн)
    // шинэ зарлал snapshot-д орох ёстой тул items-ийн id-г хамааруулна
  }, [items.map((i) => i.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  return snapshot;
}

/** Одоогийн цаг — сервер дээр null (hydration зөрүүнээс сэргийлнэ), минут тутам шинэчлэгдэнэ */
export function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
