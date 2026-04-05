'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search, RefreshCw, Flame, Zap, Activity, Clock, Snowflake, Package,
  Download, TrendingUp
} from "lucide-react"

interface MovementItem {
  id: string
  genericItemNumber: string
  description: string | null
  system: string
  totalQtyDispatched: number
  transactionCount: number
  avgQtyPerTransaction: number
  firstDispatchDate: string | null
  lastDispatchDate: string | null
  daysSpan: number
  movementClass: string
  movementScore: number
  daysSinceLastDispatch: number | null
}

interface MovementCategoryPageProps {
  system: 'hoz' | 'mwsal'
  classes: string[]
  title: string
  icon: 'flame' | 'zap' | 'activity' | 'clock' | 'snowflake'
  accentColor: string
  bgColor: string
  description: string
}

const CLASS_CONFIG = {
  'سريع جداً': { color: '#ef4444', bgColor: 'bg-red-50', borderColor: 'border-red-200', textColor: 'text-red-700' },
  'سريع': { color: '#f97316', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', textColor: 'text-orange-700' },
  'متوسط': { color: '#eab308', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200', textColor: 'text-yellow-700' },
  'بطيء': { color: '#3b82f6', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', textColor: 'text-blue-700' },
  'عديم الحركة': { color: '#6b7280', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', textColor: 'text-gray-700' },
}

function getMovementIcon(className: string) {
  switch (className) {
    case 'سريع جداً': return <Flame className="w-4 h-4" />
    case 'سريع': return <Zap className="w-4 h-4" />
    case 'متوسط': return <Activity className="w-4 h-4" />
    case 'بطيء': return <Clock className="w-4 h-4" />
    case 'عديم الحركة': return <Snowflake className="w-4 h-4" />
    default: return <Activity className="w-4 h-4" />
  }
}

function getHeaderIcon(icon: string) {
  switch (icon) {
    case 'flame': return <Flame className="w-7 h-7" />
    case 'zap': return <Zap className="w-7 h-7" />
    case 'activity': return <Activity className="w-7 h-7" />
    case 'clock': return <Clock className="w-7 h-7" />
    case 'snowflake': return <Snowflake className="w-7 h-7" />
    default: return <Activity className="w-7 h-7" />
  }
}

export function MovementCategoryPage({
  system,
  classes,
  title,
  icon,
  accentColor,
  bgColor,
  description
}: MovementCategoryPageProps) {
  const [items, setItems] = useState<MovementItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  // الترتيب الافتراضي: بنود عديمة الحركة ترتب حسب الأطول فترة بدون صرف
  const defaultSortBy = classes.includes('عديم الحركة') ? 'daysSinceLastDispatch' : 'movementScore'
  const [sortBy, setSortBy] = useState<string>(defaultSortBy)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(classes.includes('عديم الحركة') ? 'desc' : 'desc')
  const [exporting, setExporting] = useState(false)
  const [summaryStats, setSummaryStats] = useState<{
    totalQty: number
    totalTransactions: number
    avgDaysSpan: number
  } | null>(null)

  const pageSize = 50

  const fetchData = async () => {
    setLoading(true)
    try {
      const offset = (page - 1) * pageSize
      // بناء معاملات الفلتر - نمرر عدة تصنيفات
      const classParams = classes.map(c => `class=${encodeURIComponent(c)}`).join('&')
      let url = `/api/movement?system=${system}&limit=${pageSize}&offset=${offset}&${classParams}`
      if (search) url += `&search=${encodeURIComponent(search)}`

      const res = await fetch(url)
      const data = await res.json()

      if (data.items) {
        let sortedItems = data.items
        // ترتيب محلي
        sortedItems.sort((a: MovementItem, b: MovementItem) => {
          const aVal = (a as any)[sortBy] ?? 0
          const bVal = (b as any)[sortBy] ?? 0
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
          }
          return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
        })

        setItems(sortedItems)
        setTotal(data.total)
      }
    } catch (error) {
      console.error('Error fetching movement data:', error)
    } finally {
      setLoading(false)
    }
  }

  // جلب إحصائيات ملخصة
  const fetchSummary = async () => {
    try {
      const classParams = classes.map(c => `class=${encodeURIComponent(c)}`).join('&')
      const res = await fetch(`/api/movement?system=${system}&limit=1&offset=0&${classParams}`)
      const data = await res.json()
      if (data.total !== undefined) {
        setTotal(data.total)
      }
    } catch (error) {
      console.error('Error fetching summary:', error)
    }
  }

  useEffect(() => {
    fetchData()
  }, [system, page, sortBy, sortDir])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchData()
      } else {
        setPage(1)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    fetchSummary()
  }, [system])

  // حساب الإحصائيات من البيانات المعروضة
  useEffect(() => {
    if (items.length > 0) {
      const totalQty = items.reduce((sum, item) => sum + item.totalQtyDispatched, 0)
      const totalTx = items.reduce((sum, item) => sum + item.transactionCount, 0)
      const avgDays = items.reduce((sum, item) => sum + item.daysSpan, 0) / items.length
      setSummaryStats({ totalQty, totalTransactions: totalTx, avgDaysSpan: Math.round(avgDays) })
    }
  }, [items])

  const totalPages = Math.ceil(total / pageSize)

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
  }

  const exportToCSV = () => {
    const headers = ['رقم البند', 'الوصف', 'التصنيف', 'الكمية المصروفة', 'عدد المعاملات', 'المتوسط', 'الفترة (يوم)', 'تاريخ أول صرف', 'تاريخ آخر صرف', 'منذ كم يوم (يوم)']
    const rows = items.map(item => [
      item.genericItemNumber,
      item.description || '',
      item.movementClass,
      item.totalQtyDispatched,
      item.transactionCount,
      item.avgQtyPerTransaction.toFixed(0),
      item.daysSpan,
      item.firstDispatchDate ? new Date(item.firstDispatchDate).toLocaleDateString('ar-SA') : '',
      item.lastDispatchDate ? new Date(item.lastDispatchDate).toLocaleDateString('ar-SA') : '',
      item.daysSinceLastDispatch ?? ''
    ])

    const BOM = '\uFEFF'
    const csvContent = BOM + [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${title.replace(/\s+/g, '_')}_${system}.csv`
    link.click()
  }

  // تحديد تصنيف للتصدير
  const getCategoryParam = (): string => {
    if (classes.includes('سريع جداً') || classes.includes('سريع')) return 'fast'
    if (classes.includes('بطيء')) return 'slow'
    if (classes.includes('عديم الحركة')) return 'no-movement'
    return 'all'
  }

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const categoryParam = getCategoryParam()
      const res = await fetch(`/api/export/movement?system=${system}&category=${categoryParam}`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'فشل التصدير')
      }
      const blob = await res.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      const date = new Date().toISOString().split('T')[0]
      link.download = `${title.replace(/\s+/g, '_')}_${system}_${date}.xlsx`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (error: any) {
      alert('حدث خطأ أثناء التصدير: ' + error.message)
    } finally {
      setExporting(false)
    }
  }

  const HeaderIcon = getHeaderIcon(icon)
  const systemName = system === 'hoz' ? 'مستودع هوز (E200)' : 'مستودع موصول (E300)'

  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th
      className="text-right p-3 font-medium cursor-pointer hover:bg-gray-100 transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortBy === field && (
          <span className="text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  )

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* العنوان */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <div className={`p-2 rounded-lg ${bgColor}`}>
              <span className={accentColor}>{HeaderIcon}</span>
            </div>
            {title}
          </h2>
          <p className="text-gray-500 mt-1">{description}</p>
          <p className="text-sm text-gray-400 mt-1">{systemName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={items.length === 0}>
            <Download className="w-4 h-4 ml-1" />
            تصدير CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={exporting || total === 0} className="gap-1">
            <Download className={`w-4 h-4 ml-1 ${exporting ? 'animate-pulse' : ''}`} />
            {exporting ? 'جاري التصدير...' : 'تصدير Excel'}
          </Button>
        </div>
      </div>

      {/* بطاقات الإحصائيات */}
      {summaryStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className={`${bgColor} border-0`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">إجمالي البنود</p>
                  <p className={`text-2xl font-bold ${accentColor}`}>{total.toLocaleString('ar-SA')}</p>
                </div>
                <Package className={`w-8 h-8 ${accentColor} opacity-50`} />
              </div>
            </CardContent>
          </Card>
          <Card className={`${bgColor} border-0`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">إجمالي الكمية المصروفة</p>
                  <p className={`text-2xl font-bold ${accentColor}`}>{summaryStats.totalQty.toLocaleString('ar-SA')}</p>
                </div>
                <TrendingUp className={`w-8 h-8 ${accentColor} opacity-50`} />
              </div>
            </CardContent>
          </Card>
          <Card className={`${bgColor} border-0`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">إجمالي المعاملات</p>
                  <p className={`text-2xl font-bold ${accentColor}`}>{summaryStats.totalTransactions.toLocaleString('ar-SA')}</p>
                </div>
                <Activity className={`w-8 h-8 ${accentColor} opacity-50`} />
              </div>
            </CardContent>
          </Card>
          <Card className={`${bgColor} border-0`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">متوسط الفترة</p>
                  <p className={`text-2xl font-bold ${accentColor}`}>{summaryStats.avgDaysSpan} يوم</p>
                </div>
                <Clock className={`w-8 h-8 ${accentColor} opacity-50`} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* شارات التصنيفات المفعلة */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500">التصنيفات:</span>
        {classes.map(cls => {
          const config = CLASS_CONFIG[cls as keyof typeof CLASS_CONFIG]
          return (
            <Badge
              key={cls}
              style={{ backgroundColor: config?.color || '#999', color: 'white' }}
              className="gap-1 text-sm"
            >
              {getMovementIcon(cls)}
              {cls}
            </Badge>
          )
        })}
      </div>

      {/* البحث */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث برقم البند أو الوصف..."
                className="pr-10"
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* جدول البنود */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة البنود</CardTitle>
          <CardDescription>
            عرض {items.length} من أصل {total.toLocaleString('ar-SA')} بند
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد بنود في هذا التصنيف</p>
              <p className="text-sm mt-2">ارفع تقرير Full Dispatch من نظام BY لعرض البيانات</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <SortableHeader field="genericItemNumber">رقم البند</SortableHeader>
                    <SortableHeader field="description">الوصف</SortableHeader>
                    <th className="text-center p-3 font-medium">التصنيف</th>
                    <SortableHeader field="totalQtyDispatched">الكمية المصروفة</SortableHeader>
                    <SortableHeader field="transactionCount">المعاملات</SortableHeader>
                    <SortableHeader field="avgQtyPerTransaction">المتوسط</SortableHeader>
                    <SortableHeader field="daysSpan">الفترة</SortableHeader>
                    <SortableHeader field="lastDispatchDate">آخر صرف</SortableHeader>
                    <SortableHeader field="daysSinceLastDispatch">منذ كم يوم</SortableHeader>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const classConfig = CLASS_CONFIG[item.movementClass as keyof typeof CLASS_CONFIG]
                    return (
                      <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-3 font-mono text-xs">{item.genericItemNumber}</td>
                        <td className="p-3 max-w-[200px] truncate" title={item.description || ''}>
                          {item.description || '-'}
                        </td>
                        <td className="p-3 text-center">
                          <Badge
                            style={{
                              backgroundColor: classConfig?.color || '#999',
                              color: 'white'
                            }}
                            className="gap-1"
                          >
                            {getMovementIcon(item.movementClass)}
                            {item.movementClass}
                          </Badge>
                        </td>
                        <td className="p-3 text-center font-medium">
                          {item.totalQtyDispatched.toLocaleString('ar-SA')}
                        </td>
                        <td className="p-3 text-center">
                          {item.transactionCount.toLocaleString('ar-SA')}
                        </td>
                        <td className="p-3 text-center text-gray-600">
                          {item.avgQtyPerTransaction.toFixed(0)}
                        </td>
                        <td className="p-3 text-center text-gray-600">
                          {item.daysSpan} يوم
                        </td>
                        <td className="p-3 text-center text-gray-600 text-xs">
                          {item.lastDispatchDate
                            ? new Date(item.lastDispatchDate).toLocaleDateString('ar-SA')
                            : '-'
                          }
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            item.daysSinceLastDispatch === null ? 'bg-gray-100 text-gray-500' :
                            item.daysSinceLastDispatch >= 180 ? 'bg-red-100 text-red-700' :
                            item.daysSinceLastDispatch >= 90 ? 'bg-orange-100 text-orange-700' :
                            item.daysSinceLastDispatch >= 30 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {item.daysSinceLastDispatch !== null ? `${item.daysSinceLastDispatch} يوم` : '-'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ترقيم الصفحات */}
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
