# Dockview

یک داشبورد سبک و واکنش‌گرا برای مشاهده و مدیریت Docker Engine روی سرور. Dockview بدون دیتابیس و بدون وابستگی npm اجرا می‌شود و اطلاعات را مستقیماً از Docker API می‌خواند.

## امکانات نسخه MVP

- نمایش کانتینرهای فعال و متوقف، ایمیج، وضعیت و پورت‌ها
- نمایش زنده CPU، RAM و ترافیک شبکه هر کانتینر (هر ۵ ثانیه)
- اطلاعات Docker Engine، سیستم‌عامل، CPU و RAM میزبان
- جزئیات کانتینر شامل IP، mountها، labelها و restart policy
- اجرای start، stop و restart با تأیید کاربر
- جستجو و فیلتر وضعیت، رابط فارسی و موبایل‌پسند
- محافظت API با کلید دسترسی

## نصب روی سرور لینوکس

پیش‌نیاز: Docker Engine به همراه Docker Compose plugin.

```bash
git clone https://github.com/YOUR_USERNAME/dockview.git
cd dockview
chmod +x install.sh
./install.sh
```

سپس `http://SERVER_IP:3000` را باز و کلیدی را که نصب‌کننده چاپ می‌کند وارد کنید. نصب‌کننده شناسه گروه Docker Socket را نیز خودکار ثبت می‌کند تا برنامه با کاربر غیر root اجرا شود. برای تغییر پورت، مقدار `DOCKVIEW_PORT` را در `.env` عوض کرده و `docker compose up -d` اجرا کنید.

## اجرای توسعه

روی لینوکس یا WSL که Docker Socket در مسیر استاندارد قرار دارد:

```bash
npm start
```

متغیرهای قابل تنظیم: `PORT`، `DOCKER_SOCKET` و `API_TOKEN`.

## نکته امنیتی مهم

دسترسی به `/var/run/docker.sock` عملاً سطح دسترسی مدیریتی روی Docker Host ایجاد می‌کند. Dockview را مستقیماً روی اینترنت عمومی منتشر نکنید. آن را پشت HTTPS و VPN یا reverse proxy دارای احراز هویت قرار دهید، فایروال را محدود کنید و یک `API_TOKEN` قوی نگه دارید. در محیط جدی‌تر می‌توان از socket proxy با دسترسی محدود استفاده کرد.

## نقشه راه

- صفحه‌های کامل Images، Volumes و Networks
- log viewer و terminal اختیاری
- نمودار تاریخچه منابع و هشدارها
- پشتیبانی چند سرور با Agent جداگانه
- کاربران، نقش‌ها و ورود با OIDC

## مجوز

MIT
