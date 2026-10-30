# مدل زمان‌بندی موتور آزمون

## یک محور زمانی

تمام زمان‌ها روی **یک ساعت** ثبت می‌شوند: `performance.now()` که به لحظه شروع جلسه rebase شده است (`OffsetClock`).
همین محور زمانی، مبنای `requestAnimationFrame` و `Event.timeStamp` در Chromium است؛ پس زمان ارائه محرک و زمان پاسخ قابل تفریق‌اند.
زمان‌ها `double` (میلی‌ثانیه، اعشاری) هستند و تا پایگاه داده (`DOUBLE PRECISION`) بدون گرد شدن حمل می‌شوند
(در PHP مقدار `precision=-1` تنظیم شده؛ تست `EventIngestTest::test_the_full_demo_stream_round_trips_exactly` این را تضمین می‌کند).

| فیلد               | معنا                                            |
| ------------------ | ----------------------------------------------- |
| `timestamp_ms`     | زمان ثبت رویداد توسط recorder (همیشه غیرنزولی)  |
| `planned_time_ms`  | زمان برنامه‌ریزی‌شده ارائه محرک                 |
| `actual_time_ms`   | تخمین زمان ارائه واقعی (vsync) یا زمان خروج صدا |
| `received_time_ms` | `Event.timeStamp` ورودی، rebase شده             |
| `reaction_time_ms` | `received_time_ms − actual_time_ms` محرک مربوط  |

## محرک دیداری

- زمان‌بندی **فریم‌محور** است، نه `setTimeout`. در هر callback فریم، زمان vsync بعدی پیش‌بینی می‌شود:
  `projected = frameTime + presentationLatencyFrames × frameInterval`.
- محرک در فریمی نمایش داده می‌شود که `projected` نزدیک‌ترین vsync به زمان برنامه‌ریزی‌شده باشد (خطای حداکثر نیم فریم).
- محرک‌ها از قبل در DOM ساخته شده‌اند؛ نمایش فقط تغییر `visibility` است (هیچ layout/paint سنگینی در فریم).
- وضعیت ارائه: `on_time` (|خطا| ≤ نیم فریم)، `late`، یا `dropped` (کل پنجره نمایش از دست رفته).
- `presentationLatencyFrames` (پیش‌فرض ۱) **تخمین** است و باید با فوتودیود برای هر پلتفرم اندازه‌گیری و در پروتکل تنظیم شود.

## محرک شنیداری

- صدا با `AudioBufferSourceNode.start(when)` روی ساعت صوتی زمان‌بندی می‌شود (دقت نمونه‌ای).
- نگاشت ساعت صوتی ↔ `performance.now()` با `AudioContext.getOutputTimestamp()`؛
  `outputLatency` گزارش‌شده کم می‌شود تا **خروج صوتی** (نه تحویل بافر) روی زمان برنامه‌ریزی‌شده بیفتد.
- صداها با `lookahead` (پیش‌فرض ۱۲۰ms) زمان‌بندی می‌شوند تا jank رشته اصلی بر onset اثر نگذارد.
- تأخیرهای گزارش‌شده سیستم‌عامل تقریبی‌اند → **تست Loopback** الزامی است.

## ورودی

- `keydown` و `pointerdown` در فاز capture؛ `KeyboardEvent.code` (مستقل از چیدمان فارسی/انگلیسی).
- تکرار خودکار کلید (`repeat`) نادیده گرفته می‌شود؛ کلیدهای خارج از پروتکل ثبت نمی‌شوند.
- تأخیر dispatch (`handler − event.timeStamp`) پایش می‌شود. **تأخیر سخت‌افزاری صفحه‌کلید/USB با نرم‌افزار قابل اندازه‌گیری نیست.**

## نسبت‌دادن پاسخ

| شرط                                             | validity                                  |
| ----------------------------------------------- | ----------------------------------------- |
| اولین پاسخ در پنجره پاسخ و RT ≥ آستانه پیش‌دستی | `valid`                                   |
| اولین پاسخ با RT کمتر از آستانه                 | `anticipatory`                            |
| پاسخ‌های بعدی به همان محرک                      | `unmatched` (تکراری؛ به محرک لینک می‌شود) |
| پس از پنجره و پیش از محرک بعدی                  | `late`                                    |
| پیش از هر محرک                                  | `unmatched` بدون محرک                     |

## تکرارپذیری

ترتیب کوشش‌ها و SOA با PRNG بذرپذیر (mulberry32) ساخته می‌شود. بذر در شروع جلسه از سرور گرفته و در رویداد
`session_started` ثبت می‌شود؛ `buildTimeline(protocol, seed)` همان جلسه را دقیقاً بازسازی می‌کند.

## محیط اجرا (Electron)

`backgroundThrottling: false`، سوییچ‌های `disable-renderer-backgrounding`/`disable-background-timer-throttling`،
kiosk + always-on-top در حین آزمون، و ثبت `focus_lost`/`visibility_hidden` برای کنترل کیفیت.
