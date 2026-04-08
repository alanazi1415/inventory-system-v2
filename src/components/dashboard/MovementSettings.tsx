'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Settings, Save, RotateCcw, AlertTriangle, Lock } from "lucide-react"

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
  topUpDaysToAnalyze: number
  topUpSafetyFactor: number
  topUpMinStockDays: number
}

const DEFAULT_THRESHOLDS: Thresholds = {
  veryFastMinTransactions: 50,
  veryFastMinQty: 5000,
  fastMinTransactions: 20,
  fastMinQty: 2000,
  mediumMinTransactions: 10,
  mediumMinQty: 500,
  slowMinTransactions: 3,
  topUpDaysToAnalyze: 90,
  topUpSafetyFactor: 1.5,
  topUpMinStockDays: 30
}

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
      // جلب صلاحيات المستخدم الحالي
      const res = await fetch('/api/user-auth/me')
      if (res.ok) {
        const data = await res.json()
        if (data.user) {
          // المستخدم لديه صلاحية التعديل
          setCanEdit(!!data.user.canEditMovementSettings)
        }
      }
    } catch {
      // إذا فشل، نتحقق من صلاحية الأدمن
      try {
        const adminRes = await fetch('/api/admin/check-session')
        const adminData = await adminRes.json()
        setCanEdit(adminData.authenticated === true)
      } catch {
        setCanEdit(false)
      }
    }
  }

  const fetchThresholds = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/movement/thresholds?system=${system}`)
      const data = await res.json()
      
      if (data.success && data.thresholds) {
        setThresholds({
          veryFastMinTransactions: data.thresholds.veryFastMinTransactions,
          veryFastMinQty: data.thresholds.veryFastMinQty,
          fastMinTransactions: data.thresholds.fastMinTransactions,
          fastMinQty: data.thresholds.fastMinQty,
          mediumMinTransactions: data.thresholds.mediumMinTransactions,
          mediumMinQty: data.thresholds.mediumMinQty,
          slowMinTransactions: data.thresholds.slowMinTransactions,
          topUpDaysToAnalyze: data.thresholds.topUpDaysToAnalyze,
          topUpSafetyFactor: data.thresholds.topUpSafetyFactor,
          topUpMinStockDays: data.thresholds.topUpMinStockDays
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
        setMessage({ type: 'success', text: 'تم حفظ الإعدادات بنجاح' })
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

  const updateThreshold = (key: keyof Thresholds, value: number) => {
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
              className="gap-2"
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

        {/* حدود التصنيف */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-700 border-b pb-2">📊 حدود تصنيف الحركة</h4>
          
          {/* سريع جداً */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div className="col-span-2 md:col-span-4">
              <label className="flex items-center gap-2 text-sm font-medium text-red-600">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                سريع جداً (Very Fast)
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div className="col-span-2 md:col-span-4">
              <label className="flex items-center gap-2 text-sm font-medium text-orange-600">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                سريع (Fast)
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div className="col-span-2 md:col-span-4">
              <label className="flex items-center gap-2 text-sm font-medium text-yellow-600">
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                متوسط (Medium)
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div className="col-span-2 md:col-span-4">
              <label className="flex items-center gap-2 text-sm font-medium text-blue-600">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                بطيء (Slow)
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
            <div></div>
          </div>
        </div>

        {/* إعدادات TOP UP */}
        <div className="space-y-4 pt-4 border-t">
          <h4 className="font-semibold text-gray-700 border-b pb-2">📦 إعدادات اقتراحات التغذية (TOP UP)</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500">عدد أيام التحليل</label>
              <Input
                type="number"
                value={thresholds.topUpDaysToAnalyze}
                onChange={(e) => updateThreshold('topUpDaysToAnalyze', parseInt(e.target.value) || 0)}
                className="mt-1"
                disabled={!canEdit}
              />
              <p className="text-xs text-gray-400 mt-1">عدد الأيام السابقة لحساب متوسط الاستهلاك</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">معامل الأمان</label>
              <Input
                type="number"
                step="0.1"
                value={thresholds.topUpSafetyFactor}
                onChange={(e) => updateThreshold('topUpSafetyFactor', parseFloat(e.target.value) || 1)}
                className="mt-1"
                disabled={!canEdit}
              />
              <p className="text-xs text-gray-400 mt-1">مضاعفة المخزون المطلوب للأمان (1.5 = 150%)</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">الحد الأدنى لأيام المخزون</label>
              <Input
                type="number"
                value={thresholds.topUpMinStockDays}
                onChange={(e) => updateThreshold('topUpMinStockDays', parseInt(e.target.value) || 0)}
                className="mt-1"
                disabled={!canEdit}
              />
              <p className="text-xs text-gray-400 mt-1">أيام المخزون المستهدفة لكل بند</p>
            </div>
          </div>
        </div>

        {/* تنبيه */}
        <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-700 rounded-lg text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <strong>ملاحظة:</strong> الإعدادات تُطبق على التحليلات الجديدة فقط. 
            لإعادة تصنيف البنود الحالية، ارفع تقرير الحركة مرة أخرى.
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
