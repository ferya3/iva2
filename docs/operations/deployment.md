# استقرار Production

## زیرساخت پیشنهادی شروع

| منبع       | مقدار                                                                |
| ---------- | -------------------------------------------------------------------- |
| سرور       | Ubuntu 24.04 LTS، 8 vCPU، 16GB RAM، 200GB NVMe — دیتاسنتر داخل ایران |
| PostgreSQL | روی همان میزبان در شروع؛ در مرحله رشد سرور مستقل + replica           |
| Redis      | 2GB (`noeviction`, AOF)                                              |
| پشتیبان    | فضای ذخیره‌سازی مستقل (Object Storage داخلی سازگار با S3)            |

## راه‌اندازی

```bash
sudo apt install -y docker.io docker-compose-v2 certbot
git clone <repo> /opt/cognitest && cd /opt/cognitest
cp .env.production.example .env.production   # رمزها و APP_KEY را تکمیل کنید
sudo certbot certonly --standalone -d api.cognitest.ir -d clinic.cognitest.ir -d admin.cognitest.ir
docker compose --env-file .env.production up -d --build
docker compose logs -f migrate                 # migration + seed (نقش مالک)
```

- PostgreSQL و Redis فقط در شبکه `internal` هستند (پورت عمومی ندارند).
- پنل مدیریت فقط از آدرس‌های `infrastructure/nginx/snippets/admin-allowlist.conf` در دسترس است.
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

```bash
git pull && docker compose --env-file .env.production build
docker compose --env-file .env.production up -d   # migrate قبل از api اجرا می‌شود
```

## Desktop Player

- ساخت نصب‌کننده ویندوز: `pnpm --filter @cognitest/desktop-player dist:win` (روی Windows یا CI ویندوز).
- امضای کد (`CSC_LINK`) برای جلوگیری از هشدار SmartScreen ضروری است.
- آدرس API در زمان build با `MAIN_VITE_API_URL` تعیین می‌شود.
- داده‌های محلی: `%APPDATA%/Cognitest` — outbox رمزنگاری‌شده؛ کلید با DPAPI محافظت می‌شود.

## پایش

`docker compose --profile monitoring up -d` و [`infrastructure/monitoring/alerts.md`](../../infrastructure/monitoring/alerts.md).
