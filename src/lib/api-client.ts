/**
 * Админы дэлгэцээс API дуудах нэг арга.
 *
 * ЯАГААД ХЭРЭГТЭЙ: өмнө нь компонент бүр `await response.json()`-ыг шууд
 * дууддаг байв. Сервер HTML алдааны хуудас (Vercel-ийн 504 timeout г.м.)
 * буцаахад, эсвэл сүлжээ тасрахад тэр мөр exception шидэж, `busy` төлөв
 * `true` хэвээр гацдаг — товч мөнхөд «Хадгалж байна…» гэж үлддэг.
 *
 * Энэ функц ХЭЗЭЭ Ч exception шидэхгүй: үр дүнг эсвэл ойлгомжтой алдааны
 * мессежийг буцаана.
 */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function callApi<T = Record<string, unknown>>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<ApiResult<T>> {
  const { json, ...rest } = init ?? {};
  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      ...(json === undefined
        ? {}
        : {
            body: JSON.stringify(json),
            headers: { 'Content-Type': 'application/json', ...rest.headers },
          }),
    });
  } catch {
    return { ok: false, error: 'Сервертэй холбогдож чадсангүй. Интернэтээ шалгаад дахин оролдоно уу.' };
  }

  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

  if (!response.ok) {
    return {
      ok: false,
      error:
        data?.error ??
        (response.status === 401
          ? 'Нэвтрэх хугацаа дууссан байна. Хуудсыг сэргээгээд дахин нэвтэрнэ үү.'
          : `Алдаа гарлаа (${response.status})`),
    };
  }
  return { ok: true, data: (data ?? {}) as T };
}
