# سجل التغييرات - تحديث ميزة تحليل الحركة

## التاريخ: 2026-04-12

---

## 1. تحديث قاعدة البيانات (Prisma Schema)

### الملف: `prisma/schema.prisma`

#### التغييرات على نموذج ItemMovement:
- إضافة `autoMovementClass` - التصنيف التلقائي
- إضافة `userMovementClass` - التصنيف اليدوي من المستخدم
- إضافة `classifiedBy` - من قام بالتصنيف
- إضافة `classifiedAt` - تاريخ التصنيف
- إضافة `notes` - ملاحظات المستخدم
- إضافة `batchCount` - عدد التشغيلات
- إضافة `uniqueExpiryDates` - عدد تواريخ الانتهاء المختلفة
- إضافة `uniqueOrders` - عدد أوامر البيع الفريدة
- إضافة `currentStock` - الكمية الحالية في المخزون
- إضافة `availableStock` - الكمية المتاحة
- إضافة `analysisPeriodDays` - عدد أيام فترة التحليل
- إضافة `analysisDateFrom` - بداية فترة التحليل
- إضافة `analysisDateTo` - نهاية فترة التحليل
- إضافة `syncedFromInventory` - حالة المزامنة مع المخزون
- إزالة `movementClass` (استبدال بـ `autoMovementClass`)

#### نموذج جديد: ClassificationLog
- `itemNumber` - رقم البند
- `system` - المستودع
- `oldClass` - التصنيف القديم
- `newClass` - التصنيف الجديد
- `changedBy` - من قام بالتغيير
- `reason` - سبب التغيير
- `createdAt` - تاريخ التغيير

#### التغييرات على نموذج User:
- إزالة `canViewTopUp`
- إزالة `canCalculateTopUp`
- إضافة `canClassifyMovement` - صلاحية التصنيف اليدوي

#### التغييرات على نموذج MovementThresholds:
- إزالة حقول TOP UP
- إضافة `defaultAnalysisPeriod` - الفترة الافتراضية للتحليل

#### النماذج المحذوفة:
- `TopUpSuggestion` - تم حذفها بالكامل

---

## 2. تحديث API تحليل الحركة

### الملف: `src/app/api/movement/route.ts`

#### الميزات الجديدة:
1. **فلترة الفترة الزمنية**: دعم فلترة حسب 30، 60، 90، 180، 365 يوم
2. **التصنيف اليدوي**: PATCH endpoint لتصنيف البنود يدوياً
3. **تجميع ذكي**: تجميع البيانات مع تتبع Batches وتواريخ الانتهاء
4. **مزامنة محسنة**: تحديث المخزون الحالي من جدول Inventory
5. **سجل التغييرات**: تسجيل كل تغيير في التصنيف

#### التحسينات:
- دعم `genericItemNumber` و `tradeItemNumber` و `customerItemNumber`
- تسجيل عدد المعاملات، التشغيلات، تواريخ الانتهاء
- ربط المخزون الحالي مع تحليل الحركة

---

## 3. تحديث واجهة المستخدم

### الملف: `src/components/dashboard/MovementPage.tsx`

#### الميزات الجديدة:
1. **فلترة الفترة الزمنية**: قائمة منسدلة لاختيار فترة التحليل
2. **التصنيف اليدوي**: زر تعديل لكل بند لتغيير تصنيفه
3. **عرض تفصيلي**: عرض عدد التشغيلات والمخزون الحالي
4. **إحصائيات محسنة**: ملخص شامل للبيانات

#### المحذوفات:
- إزالة تبويب "اقتراحات التغذية"
- إزالة جميع مراجع TOP UP

---

## 4. تحديث إدارة المستخدمين

### الملف: `src/components/dashboard/UserManagement.tsx`

#### التغييرات:
- إزالة صلاحيات TOP UP
- إضافة صلاحية "التصنيف اليدوي للبنود"

---

## 5. تحديث API المستخدمين

### الملف: `src/app/api/users/route.ts`

#### التغييرات:
- استبدال `canViewTopUp` و `canCalculateTopUp` بـ `canClassifyMovement`

---

## 6. الملفات المحذوفة

- `src/components/dashboard/TopUpSuggestions.tsx`
- `src/app/api/movement/topup/` (مجلد كامل)
- `src/app/api/export/topup/` (مجلد كامل)

---

## 7. تحديث API إنشاء الجداول

### الملف: `src/app/api/create-tables/route.ts`

#### التغييرات:
- إزالة إنشاء جدول TopUpSuggestion
- إضافة إنشاء جدول ClassificationLog
- إضافة الأعمدة الجديدة لجدول ItemMovement
- إضافة عمود canClassifyMovement لجدول User

---

## خطوات النشر

1. **نسخ الملفات المحدثة إلى GitHub**:
   - `prisma/schema.prisma`
   - `src/app/api/movement/route.ts`
   - `src/components/dashboard/MovementPage.tsx`
   - `src/components/dashboard/UserManagement.tsx`
   - `src/app/api/users/route.ts`
   - `src/app/api/create-tables/route.ts`

2. **حذف الملفات المحذوفة**:
   - `src/components/dashboard/TopUpSuggestions.tsx`
   - `src/app/api/movement/topup/`
   - `src/app/api/export/topup/`

3. **تشغيل المزامنة على Vercel**:
   - سيتم تشغيل `prisma db push` تلقائياً
   - سيتم إنشاء الجداول الجديدة

4. **تحديث صلاحيات المستخدمين** (اختياري):
   - من لوحة التحكم، منح صلاحية "التصنيف اليدوي" للمستخدمين المطلوبين

---

## ملاحظات مهمة

1. **البيانات القديمة**: الحقول الجديدة ستكون بقيم افتراضية للبنود الموجودة
2. **المزامنة**: يُنصح بالضغط على "مزامنة المخزون" بعد النشر لتحديث المخزون الحالي
3. **إعادة رفع التقارير**: يُنصح بإعادة رفع تقارير الحركة للحصول على البيانات الكاملة
