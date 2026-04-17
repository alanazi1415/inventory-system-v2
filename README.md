# 🏥 نظام إدارة المخزون - Inventory System V2

نظام متكامل لإدارة مخزون الأدوية والمنتجات الصيدلانية.

## ✨ المميزات

- 📊 **إدارة المخزون**: عرض وتتبع كميات المنتجات المتاحة
- ⏰️ **تتبع الصلاحية**: تنبيهات للأصناف قريبة أو منتهية الصلاحية
- 🚑 **بنود حيوية**: تصنيف وتتبع الأدوية الحيوية
- 💉 **اللقاحات**: إدارة وتتبع مخزون اللقاحات
- 💊 **المخدّرات**: مراقبة الأصناف المخدّرة بشكل آمن
- 🔬 **بنود استراتيجية**: تصنيف الأصناف الاستراتيجية
- 🫁 **بنود التدخين**: تتبع أدوية التبغ
- 🫘 **بنود الكلى**: إدارة أدوية الكلى
- 🏥 **البنود المركزية**: تصنيف الأصناف المركزية
- 📱 **تصميم متجاوب**: يعمل على جميع الأجهزة

## 🛠️ التقنيات المستخدمة

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Radix UI
- **Charts**: Recharts
- **State**: Zustand
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Deployment**: Vercel

## 🚀 التشغيل المحلي

### المتطلبات

- Node.js 18+
- PostgreSQL Database (أو استخدام Neon)

### خطوات التثبيت

```bash
# استنساخ المشروع
git clone https://github.com/alanazi1415/inventory-system-v2.git
cd inventory-system-v2

# تثبيت التبعيات
npm install

# نسخ ملف البيئة
cp .env.example .env
# ثم عدّل DATABASE_URL في .env

# إنشاء جداول قاعدة البيانات
npx prisma db push

# تشغيل الخادم المحلي
npm run dev
```

### إعداد قاعدة البيانات

1. أنشئ حساب على [Neon](https://neon.tech)
2. أنشئ مشروع جديد
3. انسخ Connection String
4. ضعه في ملف `.env`:

```
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

## 📁 هيكل المشروع

```
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── debug/     # نقطة نهاية للتصحيح
│   │       └── upload/     # رفع ملفات Excel
│   └── lib/
│       ├── db.ts          # اتصال قاعدة البيانات
│       ├── rateLimit.ts   # حماية من الطلبات الكثيرة
│       └── utils.ts        # أدوات مساعدة
├── prisma/
│   └── schema.prisma       # تعريف قاعدة البيانات
├── upload/                 # ملفات الرفع المؤقتة
└── download/               # ملفات التنزيل
```

## 🔒 الأمان

- ✅ Rate Limiting لحماية API
- ✅ التحقق من المدخلات
- ✅ حماية مسارات التصحيح
- ✅ توكنات آمنة في GitHub Secrets

## 📝 أنواع الأنظمة المدعومة

| النظام | الوصف |
|--------|-------|
| `hoz` | مستودع هوز |
| `mwsal` | مستودع موصول |
| `life_saving` | أدوية حيوية |
| `narcotic` | أدوية مخدّرة |
| `vaccine` | لقاحات |
| `strategic` | أصناف استراتيجية |
| `smoking` | أدوية التبغ |
| `kidney` | أدوية الكلى |
| `central` | أصناف مركزية |

## 🧪 الاختبار

```bash
# اختبار البناء
npm run build

# اختبار الأداء
npm run lint
```

## 📄 الرخصة

MIT License

## 👨‍💻 المطور

[mranazi1415](https://github.com/alanazi1415)
