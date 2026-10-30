import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-5xl font-bold text-brand-600">۴۰۴</p>
        <p className="mt-2 text-slate-600">صفحه یا پرونده مورد نظر یافت نشد.</p>
        <Link href="/" className="mt-4 inline-block text-brand-700 hover:underline">
          بازگشت به داشبورد
        </Link>
      </div>
    </main>
  );
}
