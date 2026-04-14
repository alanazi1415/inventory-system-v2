'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Settings, Save, RotateCcw, AlertTriangle, Lock, Info } from "lucide-react"

interface ThresholdSettingsProps {
  system: 'hoz' | 'mwsal'
}

interface Thresholds {
  veryFastMinTransactions: number
  veryFastMinQty: number
  fastMinTransactions: number
  fastMinQty: number
  mediumMinTransactions: number
  mediumMinQty: number
  slowMinTransactions: number
  defaultAnalysisPeriod: number
  // إعدادات إضافية
  useTransactionsOnly: boolean
  useQtyOnly: boolean
  preferConfirmDate: boolean
}

const DEFAULT_THRESHOLDS: Thresholds = {
  veryFastMinTransactions: 50,
  veryFastMinQty: 5000,
  fastMinTransactions: 20,
  fastMinQty: 2000,
  mediumMinTransactions: 10,
  mediumMinQty: 500,
  slowMinTransactions: 3,
  defaultAnalysisPeriod: 90,
  useTransactionsOnly: false,
  useQtyOnly: false,
  preferConfirmDate: true
}

const PERIOD_OPTIONS = [
  { value: 7, label: 'أسبوع واحد' },
  { value: 14, label: 'أسبوعين' },
  { value: 30, label: 'شهر واحد' },
  { value: 60, label: 'شهرين' },
  { value: 90, label: '3 أشهر' },
  { value: 180, label: '6 أشهر' },
  { value: 365, label: 'سنة كاملة' },
  { value: 0, label: 'جميع الفترات' },
]

export function MovementSettings({ system }: ThresholdSettingsProps) {
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isDefault, setIsDefault] = useState(true)
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    fetchThresholds()
    checkEditPermission()
  }, [system])

  const checkEditPermission = async () => {
    try {
      // التحقق من صلاحية الأدمن أولاً
      const adminRes = await fetch('/api/admin/check-session')
      const adminData = await adminRes.json()
      if (adminData.authenticated === true) {
        setCanEdit(true)
        return
      }

      // التحقق من صلاحية المستخدم
      const res = await fetch('/api/user-auth')
      if (res.ok) {
        const data = await res.json()
        if (data.authenticated && data.user) {
          // المستخدم لديه صلاحية التعديل
          setCanEdit(!!data.user.permissions?.canEditMovementSettings)
        }
      }
    } catch {
      setCanEdit(false)
    }
  }

  const fetchThresholds = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/movement/thresholds?system=${system}`)
      const data = await res.json()
      
      if (data.success && data.thresholds) {
        setThresholds({
          veryFastMinTransactions: data.thresholds.veryFastMinTransactions || DEFAULT_THRESHOLDS.veryFastMinTransactions,
          veryFastMinQty: data.thresholds.veryFastMinQty || DEFAULT_THRESHOLDS.veryFastMinQty,
          fastMinTransactions: data.thresholds.fastMinTransactions || DEFAULT_THRESHOLDS.fastMinTransactions,
          fastMinQty: data.thresholds.fastMinQty || DEFAULT_THRESHOLDS.fastMinQty,
          mediumMinTransactions: data.thresholds.mediumMinTransactions || DEFAULT_THRESHOLDS.mediumMinTransactions,
          mediumMinQty: data.thresholds.mediumMinQty || DEFAULT_THRESHOLDS.mediumMinQty,
          slowMinTransactions: data.thresholds.slowMinTransactions || DEFAULT_THRESHOLDS.slowMinTransactions,
          defaultAnalysisPeriod: data.thresholds.defaultAnalysisPeriod || DEFAULT_THRESHOLDS.defaultAnalysisPeriod,
          useTransactionsOnly: data.thresholds.useTransactionsOnly ?? DEFAULT_THRESHOLDS.useTransactionsOnly,
          useQtyOnly: data.thresholds.useQtyOnly ?? DEFAULT_THRESHOLDS.useQtyOnly,
          preferConfirmDate: data.thresholds.preferConfirmDate ?? DEFAULT_THRESHOLDS.preferConfirmDate
        })
        setIsDefault(data.thresholds.isDefault)
      }
    } catch (error) {
      console.error('Error fetching thresholds:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!canEdit) {
      setMessage({ type: 'error', text: '⚠️ ليس لديك صلاحية تعديل الإعدادات' })
      return
    }
    
    setSaving(true)
    setMessage(null)
    
    try {
      const res = await fetch('/api/movement/thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system,
          ...thresholds
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        const reclassifiedMsg = data.reclassifiedItems 
          ? `\n📊 تم إعادة تصنيف ${data.reclassifiedItems.toLocaleString('ar-SA')} بند`
          : ''
        setMessage({ type: 'success', text: `✅ تم حفظ الإعدادات بنجاح${reclassifiedMsg}` })
        setHasChanges(false)
        setIsDefault(false)
      } else {
        setMessage({ type: 'error', text: data.error || 'حدث خطأ في الحفظ' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'حدث خطأ في الاتصال' })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!canEdit) {
      setMessage({ type: 'error', text: '⚠️ ليس لديك صلاحية إعادة الإعدادات' })
      return
    }
    
    if (!confirm('هل أنت متأكد من إعادة الإعدادات للقيم الافتراضية؟')) return
    
    try {
      const res = await fetch(`/api/movement/thresholds?system=${system}`, {
        method: 'DELETE'
      })
      
      const data = await res.json()
      
      if (data.success) {
        setThresholds(DEFAULT_THRESHOLDS)
        setHasChanges(false)
        setIsDefault(true)
        setMessage({ type: 'success', text: 'تم إعادة الإعدادات للقيم الافتراضية' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'حدث خطأ' })
    }
  }

  const updateThreshold = (key: keyof Thresholds, value: number | boolean) => {
    setThresholds(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-blue-100">
      <CardHeader className="bg-gradient-to-l from-blue-50 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="w-5 h-5 text-blue-500" />
              إعدادات تصنيف الحركة
              {!canEdit && <Lock className="w-4 h-4 text-orange-500" />}
            </CardTitle>
            <CardDescription>
              خصص حدود تصنيف البنود حسب احتياجاتك
              {isDefault && <span className="text-orange-500 mr-2">(القيم الافتراضية)</span>}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-2"
              disabled={!canEdit}
            >
              <RotateCcw className="w-4 h-4" />
              إعادة الافتراضي
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4" />
              {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6" dir="rtl">
        {message && (
          <div className={`p-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        {!canEdit && (
          <div className="flex items-start gap-2 p-3 bg-orange-50 text-orange-700 rounded-lg text-sm">
            <Lock className="w-5 h-5 flex-shrink-0" />
            <div>
              <strong>ملاحظة:</strong> أنت تستعرض الإعدادات فقط. لتعديلها يجب أن تمنح صلاحية "تعديل الإعدادات" من لوحة الأدمن.
            </div>
          </div>
        )}

        {/* فترة التحليل */}
        <div className="space-y-4 p-4 bg-purple-50 rounded-lg">
          <h4 className="font-semibold text-purple-700 flex items-center gap-2">
            📅 فترة التحليل
          </h4>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="text-sm text-gray-600">اختر الفترة:</label>
              <select
                value={thresholds.defaultAnalysisPeriod}
                onChange={(e) => updateThreshold('defaultAnalysisPeriod', parseInt(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 mt-1"
                disabled={!canEdit}
              >
                {PERIOD_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-sm text-gray-600">أو أدخل عدد أيام مخصص:</label>
              <Input
                type="number"
                value={thresholds.defaultAnalysisPeriod}
                onChange={(e) => updateThreshold('defaultAnalysisPeriod', parseInt(e.target.value) || 90)}
                className="mt-1"
                disabled={!canEdit}
              />
            </div>
          </div>
          
          <div className="flex items-start gap-2 text-sm text-purple-600 bg-purple-100 p-2 rounded">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>سيتم تحليل المعاملات من آخر {thresholds.defaultAnalysisPeriod === 0 ? 'جميع الفترات' : `${thresholds.defaultAnalysisPeriod} يوم`} فقط</span>
          </div>
        </div>

        {/* حدود التصنيف */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-700 border-b pb-2">📊 حدود تصنيف الحركة</h4>
          
          {/* سريع جداً */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end p-3 bg-red-50 rounded-lg">
            <div className="col-span-2 md:col-span-4">
              <label className="flex items-center gap-2 text-sm font-medium text-red-600">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                سريع جداً (Very Fast) - حركة عالية جداً
              </label>
            </div>
            <div>
              <label className="text-xs text-gray-500">الحد الأدنى للمعاملات</label>
              <Input
                type="number"
                value={thresholds.veryFastMinTransactions}
                onChange={(e) => updateThreshold('veryFastMinTransactions', parseInt(e.target.value) || 0)}
                className="mt-1"
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">الحد الأدنى للكمية</label>
              <Input
                type="number"
                value={thresholds.veryFastMinQty}
                onChange={(e) => updateThreshold('veryFastMinQty', parseInt(e.target.value) || 0)}
                className="mt-1"
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* سريع */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end p-3 bg-orange-50 rounded-lg">
            <div className="col-span-2 md:col-span-4">
              <label className="flex items-center gap-2 text-sm font-medium text-orange-600">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                سريع (Fast) - حركة جيدة
              </label>
            </div>
            <div>
              <label className="text-xs text-gray-500">الحد الأدنى للمعاملات</label>
              <Input
                type="number"
                value={thresholds.fastMinTransactions}
                onChange={(e) => updateThreshold('fastMinTransactions', parseInt(e.target.value) || 0)}
                className="mt-1"
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">الحد الأدنى للكمية</label>
              <Input
                type="number"
                value={thresholds.fastMinQty}
                onChange={(e) => updateThreshold('fastMinQty', parseInt(e.target.value) || 0)}
                className="mt-1"
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* متوسط */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end p-3 bg-yellow-50 rounded-lg">
            <div className="col-span-2 md:col-span-4">
              <label className="flex items-center gap-2 text-sm font-medium text-yellow-600">
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                متوسط (Medium) - حركة معتدلة
              </label>
            </div>
            <div>
              <label className="text-xs text-gray-500">الحد الأدنى للمعاملات</label>
              <Input
                type="number"
                value={thresholds.mediumMinTransactions}
                onChange={(e) => updateThreshold('mediumMinTransactions', parseInt(e.target.value) || 0)}
                className="mt-1"
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">الحد الأدنى للكمية</label>
              <Input
                type="number"
                value={thresholds.mediumMinQty}
                onChange={(e) => updateThreshold('mediumMinQty', parseInt(e.target.value) || 0)}
                className="mt-1"
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* بطيء */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end p-3 bg-blue-50 rounded-lg">
            <div className="col-span-2 md:col-span-4">
              <label className="flex items-center gap-2 text-sm font-medium text-blue-600">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                بطيء (Slow) - حركة قليلة
              </label>
            </div>
            <div>
              <label className="text-xs text-gray-500">الحد الأدنى للمعاملات</label>
              <Input
                type="number"
                value={thresholds.slowMinTransactions}
                onChange={(e) => updateThreshold('slowMinTransactions', parseInt(e.target.value) || 0)}
                className="mt-1"
                disabled={!canEdit}
              />
            </div>
            <div className="flex items-end">
              <span className="text-xs text-gray-400">أقل من هذا = عديم الحركة</span>
            </div>
          </div>
        </div>

        {/* خيارات إضافية */}
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold text-gray-700 flex items-center gap-2">
            ⚙️ خيارات إضافية
          </h4>
          
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={thresholds.preferConfirmDate}
                onChange={(e) => updateThreshold('preferConfirmDate', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
                disabled={!canEdit}
              />
              <div>
                <span className="text-sm font-medium">استخدام Confirm Date للتاريخ</span>
                <p className="text-xs text-gray-500">استخدام عمود Confirm Date بدلاً من Date Of Creation</p>
              </div>
            </label>
          </div>
        </div>

        {/* شرح التصنيف */}
        <div className="space-y-3 p-4 bg-gray-100 rounded-lg text-sm">
          <h4 className="font-semibold text-gray-700">📋 كيف يعمل التصنيف؟</h4>
          <ul className="space-y-2 text-gray-600">
            <li>• <strong>سريع جداً:</strong> معاملات ≥ {thresholds.veryFastMinTransactions} وكمية ≥ {thresholds.veryFastMinQty.toLocaleString()}</li>
            <li>• <strong>سريع:</strong> معاملات ≥ {thresholds.fastMinTransactions} وكمية ≥ {thresholds.fastMinQty.toLocaleString()}</li>
            <li>• <strong>متوسط:</strong> معاملات ≥ {thresholds.mediumMinTransactions} وكمية ≥ {thresholds.mediumMinQty.toLocaleString()}</li>
            <li>• <strong>بطيء:</strong> معاملات ≥ {thresholds.slowMinTransactions}</li>
            <li>• <strong>عديم الحركة:</strong> أقل من {thresholds.slowMinTransactions} معاملات</li>
          </ul>
        </div>

        {/* تنبيه */}
        <div className="flex items-start gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <strong>تلقائي:</strong> عند حفظ الإعدادات، سيتم إعادة تصنيف جميع البنود الموجودة تلقائياً بالإعدادات الجديدة.
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
