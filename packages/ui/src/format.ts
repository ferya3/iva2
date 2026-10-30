const nf = new Intl.NumberFormat('fa-IR');
const dateFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Tehran',
});

/** Number with Persian digits. */
export const faNumber = (n: number | null | undefined) => (n === null || n === undefined ? '—' : nf.format(n));

/** Jalali (Solar Hijri) calendar date. */
export const faDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : '—');

export const faDateTime = (iso: string | null | undefined) => (iso ? dateTimeFmt.format(new Date(iso)) : '—');

/** Rial → Toman display. */
export const faToman = (rial: number) => `${nf.format(Math.round(rial / 10))} تومان`;
