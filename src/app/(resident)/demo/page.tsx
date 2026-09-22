import { ResidentDashboard } from '@/components/resident/ResidentDashboard';
import { MOCK_RESIDENT } from '@/lib/mock-data';

/**
 * /demo — датабаз холбохоос ӨМНӨ дэлгэцээ харах хуудас.
 * Туршилтын датаг src/lib/mock-data.ts дотроос засаж янз бүрийн төлөв үзнэ.
 */
export default function DemoPage() {
  return (
    <ResidentDashboard data={MOCK_RESIDENT} />
  );
}
