'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  Package, RefreshCw, AlertCircle, TrendingUp, Calculator,
  ArrowUpCircle, Clock, Filter, Download
} from "lucide-react"

interface TopUpItem {
  id: string
  genericItemNumber: string
  description: string | null
  system: string
  currentStock: number
  availableStock: number
  avgDailyConsumption: number
  daysOfStock: number
  suggestedQty: number
  urgencyLevel: string
  calculationDate: string
  analysisPeriodDays: number
}

interface UrgencyCount {
  level: string
  count: number
}

interface TopUpSuggestionsProps {
  system: 'hoz' | 'mwsal'
}

const URGENCY_COLORS: Record<string, string> = {
  'حرج': '#dc2626',
  'عالي': '#ea580c',
  'متوسط': '#ca8a04',
  'منخفض': '#16a34a'
}

const URGENCY_ORDER = ['حرج', 'عالي', 'متوسط', 'منخفض']

export function TopUpSuggestions({ system }: TopUpSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<TopUpItem[]>([])
  const [urgencyCounts, setUrgencyCounts] = useState<UrgencyCount[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [selectedUrgency, setSelectedUrgency] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [settings, setSettings] = useState({
    topUpDaysToAnalyze: 90,
    topUpSafetyFactor: 1.5,
    topUpMinStockDays: 30
  })

  const pageSize = 50
  const systemName = system === 'hoz' ? 'مستودع هوز' : 'مستودع موصول'

  useEffect(() => {
    fetchSuggestions()
  }, [system, page, selectedUrgency])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchSuggestions()
      } else {
        setPage(1)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  const fetchSuggestions = async () => {
    setLoading(true)
    try {
      const offset = (page - 1) * pageSize
      let url = `/api/movement/topup?system=${system}&limit=${pageSize}&offset=${offset}`
      if (selectedUrgency !== 'all') url += `&urgency=${encodeURIComponent(selectedUrgency)}`
      if (search) url += `&search=${encodeURIComponent(search)}`
      
      const res = await fetch(url)
      const data = await res.json()
      
      if (data.success) {
        setSuggestions(data.suggestions)
        setTotal(data.total)
        setUrgencyCounts(data.urgencyCounts || [])
        setSettings(data.settings || settings)
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCalculate = async () => {
    setCalculating(true)
    setMessage(null)
    
    try {
      const res = await fetch('/api/movement/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: `تم حساب الاقتراحات بنجاح - ${data.stats.updated} بند` 
        })
        fetchSuggestions()
      } else {
        setMessage({ type: 'error', text: data.error || 'حدث خطأ في الحساب' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'حدث خطأ في الاتصال' })
    } finally {
      setCalculating(false)
    }
  }

  const handleExport = async () => {
    try {
      const res = await fetch(`/api/movement/topup?system=${system}&limit=10000`)
      const data = await res.json()
      
      if (data.success && data.suggestions.length > 0) {
        // تحويل إلى CSV
        const headers = ['رقم البند', 'الوصف', 'المخزون الحالي', 'المخزون المتاح', 'متوسط الاستهلاك اليومي', 'أيام المخزون', 'الكمية المقترحة', 'مستوى الإلحاح']
        const rows = data.suggestions.map((s: TopUpItem) => [
          s.genericItemNumber,
          s.description || '',
          s.currentStock,
          s.availableStock,
          s.avgDailyConsumption.toFixed(2),
          s.daysOfStock.toFixed(1),
          Math.ceil(s.suggestedQty),
          s.urgencyLevel
        ])
        
        const csv = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n')
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `اقتراحات_التغذية_${system}_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
        URL.revokeObjectURL(link.href)
      }
    } catch (error) {
      console.error('Export error:', error)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  const getUrgencyIcon = (level: string) => {
    switch (level) {
      case 'حرج': return <AlertCircle className="w-4 h-4" />
      case 'عالي': return <ArrowUpCircle className="w-4 h-4" />
      case 'متوسط': return <Clock className="w-4 h-4" />
      case 'منخفض': return <Package className="w-4 h-4" />
      default: return <Package className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* العنوان */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-500" />
            اقتراحات تغذية المستودع (TOP UP)
          </h2>
          <p className="text-gray-500">{systemName} • {total.toLocaleString('ar-SA')} بند يحتاج تغذية</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={total === 0}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            تصدير
          </Button>
          <Button
            onClick={handleCalculate}
            disabled={calculating}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            {calculating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                جاري الحساب...
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4" />
                حساب الاقتراحات
              </>
            )}
          </Button>
        </div>
      </div>

      {/* رسالة */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* معلومات الإعدادات */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">📅 فترة التحليل:</span>
            <span className="font-semibold mr-2">{settings.topUpDaysToAnalyze} يوم</span>
          </div>
          <div>
            <span className="text-gray-500">🛡️ معامل الأمان:</span>
            <span className="font-semibold mr-2">{settings.topUpSafetyFactor}x</span>
          </div>
          <div>
            <span className="text-gray-500">📦 الحد الأدنى للمخزون:</span>
            <span className="font-semibold mr-2">{settings.topUpMinStockDays} يوم</span>
          </div>
        </div>
      </div>

      {/* ملخص الإلحاح */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {URGENCY_ORDER.map(level => {
          const count = urgencyCounts.find(c => c.level === level)?.count || 0
          const isSelected = selectedUrgency === level
          const color = URGENCY_COLORS[level]
          return (
            <Card 
              key={level}
              className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => setSelectedUrgency(isSelected ? 'all' : level)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-sm font-medium">{level}</span>
                </div>
                <p className="text-2xl font-bold" style={{ color }}>
                  {count.toLocaleString('ar-SA')}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* البحث والفلتر */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Package className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث برقم البند..."
                className="pr-10"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={selectedUrgency}
                onChange={(e) => setSelectedUrgency(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">جميع المستويات</option>
                <option value="حرج">حرج</option>
                <option value="عالي">عالي</option>
                <option value="متوسط">متوسط</option>
                <option value="منخفض">منخفض</option>
              </select>
            </div>

            <Button variant="outline" size="sm" onClick={fetchSuggestions}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* جدول الاقتراحات */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة الاقتراحات</CardTitle>
          <CardDescription>
            عرض {suggestions.length} من أصل {total.toLocaleString('ar-SA')} بند
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد اقتراحات تغذية</p>
              <p className="text-sm mt-2">اضغط "حساب الاقتراحات" لتحليل المخزون</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-right p-3 font-medium">رقم البند</th>
                    <th className="text-right p-3 font-medium">الوصف</th>
                    <th className="text-center p-3 font-medium">الإلحاح</th>
                    <th className="text-center p-3 font-medium">المخزون المتاح</th>
                    <th className="text-center p-3 font-medium">الاستهلاك اليومي</th>
                    <th className="text-center p-3 font-medium">أيام المخزون</th>
                    <th className="text-center p-3 font-medium bg-green-50">الكمية المقترحة</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-3 font-mono text-xs">{item.genericItemNumber}</td>
                      <td className="p-3 max-w-[200px] truncate" title={item.description || ''}>
                        {item.description || '-'}
                      </td>
                      <td className="p-3 text-center">
                        <Badge 
                          style={{ 
                            backgroundColor: URGENCY_COLORS[item.urgencyLevel] || '#999',
                            color: 'white'
                          }}
                          className="gap-1"
                        >
                          {getUrgencyIcon(item.urgencyLevel)}
                          {item.urgencyLevel}
                        </Badge>
                      </td>
                      <td className="p-3 text-center font-medium">
                        {item.availableStock.toLocaleString('ar-SA')}
                      </td>
                      <td className="p-3 text-center text-gray-600">
                        {item.avgDailyConsumption.toFixed(1)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          item.daysOfStock <= 7 ? 'bg-red-100 text-red-700' :
                          item.daysOfStock <= 15 ? 'bg-orange-100 text-orange-700' :
                          item.daysOfStock <= 30 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {item.daysOfStock.toFixed(0)} يوم
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold text-green-700 bg-green-50">
                        {Math.ceil(item.suggestedQty).toLocaleString('ar-SA')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* الصفحات */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                السابق
              </Button>
              <span className="text-sm text-gray-500">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                التالي
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
