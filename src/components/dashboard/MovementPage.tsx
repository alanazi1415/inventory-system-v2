'use client'
import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  TrendingUp, TrendingDown, Minus, Upload, Search, Filter, 
  Package, Activity, BarChart3, PieChart as PieChartIcon, RefreshCw,
  Flame, Zap, Clock, Snowflake
} from "lucide-react"
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts'

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
}

interface ClassCount {
  class: string
  count: number
}

const MOVEMENT_COLORS = {
  'سريع جداً': '#ef4444',  // أحمر
  'سريع': '#f97316',       // برتقالي
  'متوسط': '#eab308',      // أصفر
  'بطيء': '#3b82f6',       // أزرق
  'عديم الحركة': '#6b7280' // رمادي
}

const MOVEMENT_ICONS = {
  'سريع جداً': Flame,
  'سريع': Zap,
  'متوسط': Activity,
  'بطيء': Clock,
  'عديم الحركة': Snowflake
}

interface MovementPageProps {
  system: 'hoz' | 'mwsal'
}

export function MovementPage({ system }: MovementPageProps) {
  const [items, setItems] = useState<MovementItem[]>([])
  const [classCounts, setClassCounts] = useState<ClassCount[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedClass, setSelectedClass] = useState<string>('all')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const pageSize = 50
  const systemName = system === 'hoz' ? 'مستودع هوز' : 'مستودع موصول'

  const fetchData = async () => {
    setLoading(true)
    try {
      const offset = (page - 1) * pageSize
      let url = `/api/movement?system=${system}&limit=${pageSize}&offset=${offset}`
      if (selectedClass !== 'all') url += `&class=${encodeURIComponent(selectedClass)}`
      if (search) url += `&search=${encodeURIComponent(search)}`
      
      const res = await fetch(url)
      const data = await res.json()
      
      if (data.items) {
        setItems(data.items)
        setTotal(data.total)
        setClassCounts(data.classCounts || [])
      }
    } catch (error) {
      console.error('Error fetching movement data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [system, page, selectedClass])

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('system', system)

      const res = await fetch('/api/movement', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (data.success) {
        setUploadMessage({ 
          type: 'success', 
          text: `تم تحليل ${data.stats.uniqueItems} بند من ${data.stats.totalRecords} سجل` 
        })
        fetchData()
      } else {
        setUploadMessage({ type: 'error', text: data.error || 'حدث خطأ في التحليل' })
      }
    } catch (error) {
      setUploadMessage({ type: 'error', text: 'حدث خطأ في الاتصال' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // بيانات الرسم الدائري
  const pieData = classCounts.map(c => ({
    name: c.class,
    value: c.count,
    color: MOVEMENT_COLORS[c.class as keyof typeof MOVEMENT_COLORS] || '#999'
  }))

  // بيانات الرسم الشريطي
  const barData = classCounts.map(c => ({
    name: c.class,
    البنود: c.count,
    color: MOVEMENT_COLORS[c.class as keyof typeof MOVEMENT_COLORS] || '#999'
  }))

  // أعلى 10 بنود حركة
  const topItems = items.slice(0, 10).map(item => ({
    name: item.description?.substring(0, 20) || item.genericItemNumber,
    الكمية: item.totalQtyDispatched,
    المعاملات: item.transactionCount
  }))

  const totalPages = Math.ceil(total / pageSize)

  const getMovementIcon = (className: string) => {
    const Icon = MOVEMENT_ICONS[className as keyof typeof MOVEMENT_ICONS] || Activity
    return <Icon className="w-4 h-4" />
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* العنوان */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-500" />
            تحليل حركة البنود
          </h2>
          <p className="text-gray-500">{systemName} • {total.toLocaleString('ar-SA')} بند</p>
        </div>
        
        {/* رفع التقرير */}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleUpload}
            className="hidden"
            id="movement-upload"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                جاري التحليل...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                رفع تقرير الحركة
              </>
            )}
          </Button>
        </div>
      </div>

      {/* رسالة الرفع */}
      {uploadMessage && (
        <div className={`p-4 rounded-lg ${uploadMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {uploadMessage.text}
        </div>
      )}

      {/* ملخص التصنيفات */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {classCounts.map(c => {
          const color = MOVEMENT_COLORS[c.class as keyof typeof MOVEMENT_COLORS] || '#999'
          const isSelected = selectedClass === c.class
          return (
            <Card 
              key={c.class}
              className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
              onClick={() => setSelectedClass(isSelected ? 'all' : c.class)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  {getMovementIcon(c.class)}
                  <span className="text-sm font-medium">{c.class}</span>
                </div>
                <p className="text-2xl font-bold" style={{ color }}>
                  {c.count.toLocaleString('ar-SA')}
                </p>
                <p className="text-xs text-gray-500">
                  {((c.count / total) * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* الرسوم البيانية */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* رسم دائري */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChartIcon className="w-5 h-5 text-purple-500" />
              توزيع تصنيفات الحركة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-gray-400">
                لا توجد بيانات - ارفع تقرير الحركة
              </div>
            )}
          </CardContent>
        </Card>

        {/* رسم شريطي */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              عدد البنود حسب التصنيف
            </CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => v.toLocaleString('ar-SA')} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => v.toLocaleString('ar-SA')} />
                  <Bar dataKey="البنود" radius={[0, 4, 4, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-gray-400">
                لا توجد بيانات
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* البحث والفلتر */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث برقم البند أو الوصف..."
                className="pr-10"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">جميع التصنيفات</option>
                <option value="سريع جداً">سريع جداً</option>
                <option value="سريع">سريع</option>
                <option value="متوسط">متوسط</option>
                <option value="بطيء">بطيء</option>
                <option value="عديم الحركة">عديم الحركة</option>
              </select>
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
              <p>لا توجد بيانات</p>
              <p className="text-sm mt-2">ارفع تقرير Full Dispatch من نظام BY للبدء</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-right p-3 font-medium">رقم البند</th>
                    <th className="text-right p-3 font-medium">الوصف</th>
                    <th className="text-center p-3 font-medium">التصنيف</th>
                    <th className="text-center p-3 font-medium">الكمية المصروفة</th>
                    <th className="text-center p-3 font-medium">المعاملات</th>
                    <th className="text-center p-3 font-medium">المتوسط</th>
                    <th className="text-center p-3 font-medium">الفترة</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-3 font-mono text-xs">{item.genericItemNumber}</td>
                      <td className="p-3 max-w-[200px] truncate" title={item.description || ''}>
                        {item.description || '-'}
                      </td>
                      <td className="p-3 text-center">
                        <Badge 
                          style={{ 
                            backgroundColor: MOVEMENT_COLORS[item.movementClass as keyof typeof MOVEMENT_COLORS] || '#999',
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
