# استقرار Production

## زیرساخت پیشنهادی شروع

| منبع       | مقدار                                                                |
| ---------- | -------------------------------------------------------------------- |
| سرور       | Ubuntu 24.04 LTS، 8 vCPU، 16GB RAM، 200GB NVMe — دیتاسنتر داخل ایران |
| PostgreSQL | روی همان میزبان در شروع؛ در مرحله رشد سرور مستقل + replica           |
| Redis      | 2GB (`noeviction`, AOF)                                              |
| پشتیبان    | فضای ذخیره‌سازی مستقل (Object Storage داخلی سازگار با S3)            |

## نصب با یک دستور

پیش از اجرا، رکوردهای DNS نوع A برای `api.`، `clinic.` و `admin.` دامنه را به IP سرور اشاره دهید.

```bash
curl -fsSL https://raw.githubusercontent.com/ferya3/iva2/claude/kind-maxwell-ibgtgr/scripts/install.sh | sudo bash -s -- --domain example.ir --email ops@example.ir
```

اگر مخزن خصوصی است (raw.githubusercontent بدون توکن کار نمی‌کند):

```bash
sudo git clone -b claude/kind-maxwell-ibgtgr https://github.com/ferya3/iva2.git /opt/cognitest && sudo bash /opt/cognitest/scripts/install.sh --domain example.ir --email ops@example.ir
```

اسکریپت `scripts/install.sh` این کارها را انجام می‌دهد:

1. نصب Docker و Compose از مخازن خود Ubuntu (بدون نیاز به download.docker.com)؛
2. دریافت یا به‌روزرسانی کد در `/opt/cognitest`؛
3. ساخت رمزهای تصادفی و `APP_KEY` در `.env.production` (در اجراهای بعدی حفظ می‌شوند)؛
4. گواهی Let's Encrypt برای سه زیردامنه (یا self-signed اگر DNS هنوز آماده نیست) و تنظیم تمدید خودکار؛
5. محدودکردن پنل مدیریت به IP اتصال SSH شما (یا `--admin-ip`)؛
6. ساخت imageها، اجرای migration با نقش مالک و راه‌اندازی سرویس‌ها؛
7. ساخت حساب مدیر سامانه؛ رمز در `/root/cognitest-admin.txt` ذخیره می‌شود.

اجرای دوباره همان دستور امن است: کد به‌روز، imageها بازسازی و migrationها اعمال می‌شوند؛ رمزها، گواهی و حساب مدیر دست نمی‌خورند.

| گزینه                   | کاربرد                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `--registry-mirror URL` | آینه Docker Hub — روی سرورهای داخل ایران لازم است (Docker Hub آدرس‌های ایران را مسدود می‌کند) |
| `--npm-registry URL`    | آینه npm برای مرحله build                                                                     |
| `--self-signed`         | بدون Let's Encrypt (تست یا شبکه داخلی)                                                        |
| `--admin-ip IP,IP`      | آدرس‌های مجاز برای `admin.`                                                                   |
| `--demo`                | کلینیک نمایشی (`owner@demo.cognitest.ir` / `password`)                                        |
| `--admin-email`         | ایمیل حساب مدیر سامانه (پیش‌فرض `admin@DOMAIN`)                                               |

- PostgreSQL و Redis فقط در شبکه `internal` هستند (پورت عمومی ندارند).
- Horizon dashboard (`/horizon`) فقط از شبکه داخلی و برای مدیر سامانه.

## پشتیبان‌گیری

```bash
# روزانه — خارج از سرور اصلی
docker compose exec -T postgres pg_dump -U cognitest -Fc cognitest | \
  gpg --encrypt -r backup@cognitest.ir > cognitest-$(date +%F).dump.gpg
```

- نگهداشت: ۱۴ روزانه، ۸ هفتگی، ۱۲ ماهانه. تست بازیابی ماهانه روی محیط جدا.
- volume `reports` (فایل‌های PDF) نیز روزانه همگام شود؛ قابل بازتولید از `reports.content` است.
- کلید `APP_KEY` جداگانه و امن نگهداری شود: بدون آن داده‌های رمزنگاری‌شده (کد ملی، تلفن، یادداشت‌ها) قابل بازیابی نیستند.

## به‌روزرسانی

همان دستور نصب را دوباره اجرا کنید، یا:

```bash
cd /opt/cognitest && sudo bash scripts/install.sh --domain example.ir --email ops@example.ir
```

## Desktop Player

- ساخت نصب‌کننده ویندوز: `pnpm --filter @cognitest/desktop-player dist:win` (روی Windows یا CI ویندوز).
- امضای کد (`CSC_LINK`) برای جلوگیری از هشدار SmartScreen ضروری است.
- آدرس API در زمان build با `MAIN_VITE_API_URL` تعیین می‌شود.
- داده‌های محلی: `%APPDATA%/Cognitest` — outbox رمزنگاری‌شده؛ کلید با DPAPI محافظت می‌شود.

## پایش

`docker compose --profile monitoring up -d` و [`infrastructure/monitoring/alerts.md`](../../infrastructure/monitoring/alerts.md).
