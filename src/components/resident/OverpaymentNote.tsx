/**
 * Илүү төлөлтийн санамж.
 * Үлдэгдэл сөрөг үед л харагдана — өөр тохиолдолд юу ч зурахгүй.
 */
export function OverpaymentNote({ balance }: { balance: number }) {
  if (balance >= 0) return null;

  return (
    <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
      <span aria-hidden className="text-base leading-none">💡</span>
      <p>
        <span className="font-semibold">Санамж: </span>
        Таны илүү төлсөн дүн дараа сарын төлбөрөөс автоматаар хасагдаж бодогдоно.
      </p>
    </div>
  );
}
