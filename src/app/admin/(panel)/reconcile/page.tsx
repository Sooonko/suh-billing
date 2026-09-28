import { redirect } from 'next/navigation';

/**
 * Хуучин «Тулгалт / Дансны хуулга» хаяг.
 *
 * Энэ хуудас «Төлбөрийн хуулга»-тай ижил жагсаалтыг өөр хэлбэрээр
 * харуулдаг байсан тул хоёуланг нь /admin/payments дотор нэгтгэв.
 * Хадгалсан холбоос, хавчуурга эвдрэхгүйн тулд чиглүүлнэ.
 */
export default function ReconcileRedirect() {
  redirect('/admin/payments?tab=import');
}
