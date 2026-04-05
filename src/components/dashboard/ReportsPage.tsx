'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { FileText, TrendingUp, PieChart as PieChartIcon, BarChart3, Activity } from "lucide-react"
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, RadialBarChart, RadialBar, ComposedChart
} from 'recharts'

interface ReportsPageProps { system: 'hoz' | 'mwsal' }

const COLORS = {
  primary: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
  orange: '#f97316',
  indigo: '#6366f1',
  teal: '#14b8a6',
}

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

export function ReportsPage({ system }: ReportsPageProps) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    setLoading(true)
    fetch(`/api/stats?system=${system}`)
      .then(r => r.json())
      .then(data => {
        setStats(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [system])

  const systemName = system === 'hoz' ? 'مستودع هوز' : 'مستودع موصول'

  // بيانات توزيع حالات الانتهاء
  const expiryData = stats?.expiryDistribution ? [
    { name: 'أقل من شهر', value: stats.expiryDistribution.oneMonth, color: COLORS.danger, label: 'حرج' },
    { name: '1-3 أشهر', value: stats.expiryDistribution.threeMonths, color: COLORS.warning, label: 'تحذير' },
    { name: '3-6 أشهر', value: stats.expiryDistribution.sixMonths, color: COLORS.orange, label: 'انتباه' },
    { name: '6-12 شهر', value: stats.expiryDistribution.oneYear, color: COLORS.primary, label: 'عادي' },
    { name: 'أكثر من سنة', value: stats.expiryDistribution.overYear, color: COLORS.success, label: 'جيد' },
  ] : []

  // بيانات أنواع Hold
  const holdTypesData = stats?.holdTypes?.map((h: any, i: number) => ({
    name: h.type?.substring(0, 15) || 'غير محدد',
    fullName: h.type || 'غير محدد',
    البنود: h.count,
    الكمية: h.qty,
    color: PIE_COLORS[i % PIE_COLORS.length]
  })) || []

  // بيانات التصنيفات
  const categoriesData = [
    { name: 'المنقذة للحياة', value: stats?.lifeSavingItems || 0, color: COLORS.pink },
    { name: 'اللقاحات', value: stats?.vaccineItems || 0, color: COLORS.success },
    { name: 'الاستراتيجية', value: stats?.strategicItems || 0, color: COLORS.purple },
    { name: 'التدخين', value: stats?.smokingItems || 0, color: COLORS.cyan },
    { name: 'الكلى', value: stats?.kidneyItems || 0, color: COLORS.teal },
    { name: 'المركزية', value: stats?.centralItems || 0, color: COLORS.indigo },
  ].filter(d => d.value > 0)

  // بيانات شريطية للبنود
  const barData = [
    { name: 'الإجمالي', البنود: stats?.totalItems || 0 },
    { name: 'قاربت على الانتهاء', البنود: stats?.expiringItems || 0 },
    { name: 'المنتهية', البنود: stats?.expiredItems || 0 },
    { name: 'عليها Hold', البنود: stats?.holdItems || 0 },
  ]

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border text-right" dir="rtl">
          <p className="font-bold text-gray-800">{label}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} style={{ color: p.color }} className="text-sm">
              {p.name}: {p.value?.toLocaleString('ar-SA')}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // رسم دائري مخصص
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, value }: any) => {
    if (percent < 0.05) return null
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-xs font-bold">
        {value?.toLocaleString('ar-SA')}
      </text>
    )
  }

  const reports = [
    { title: 'تقرير البنود قاربت على الانتهاء', desc: 'ستنتهي صلاحيتها خلال 90 يوم', count: stats?.expiringItems || 0, color: 'text-orange-500' },
    { title: 'تقرير البنود المنتهية', desc: 'انتهت صلاحيتها', count: stats?.expiredItems || 0, color: 'text-red-500' },
    { title: 'تقرير البنود المنقذة للحياة', desc: 'البنود المصنفة كمنقذة للحياة', count: stats?.lifeSavingItems || 0, color: 'text-pink-500' },
    { title: 'تقرير اللقاحات', desc: 'جميع اللقاحات في المخزون', count: stats?.vaccineItems || 0, color: 'text-green-500' },
    { title: 'تقرير البنود الاستراتيجية', desc: 'البنود المصنفة كاستراتيجية', count: stats?.strategicItems || 0, color: 'text-purple-500' },
    { title: 'تقرير بنود التدخين', desc: 'البنود المصنفة للتدخين', count: stats?.smokingItems || 0, color: 'text-cyan-500' },
    { title: 'تقرير بنود الكلى', desc: 'البنود المصنفة للكلى', count: stats?.kidneyItems || 0, color: 'text-teal-500' },
    { title: 'تقرير البنود المركزية', desc: 'البنود المركزية', count: stats?.centralItems || 0, color: 'text-indigo-500' },
  ]

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">جاري تحميل البيانات...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-500" />
          التقارير والإحصائيات
        </h2>
        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {systemName}
        </span>
      </div>

      {/* ملخص سريع */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
          <CardContent className="p-4">
            <p className="text-blue-100 text-sm">إجمالي البنود</p>
            <p className="text-3xl font-bold">{stats?.totalItems?.toLocaleString('ar-SA') || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
          <CardContent className="p-4">
            <p className="text-green-100 text-sm">الكمية المتاحة</p>
            <p className="text-3xl font-bold">{stats?.availableQty?.toLocaleString('ar-SA') || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
          <CardContent className="p-4">
            <p className="text-orange-100 text-sm">قاربت على الانتهاء</p>
            <p className="text-3xl font-bold">{stats?.expiringItems?.toLocaleString('ar-SA') || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white border-0">
          <CardContent className="p-4">
            <p className="text-yellow-100 text-sm">عليها Hold</p>
            <p className="text-3xl font-bold">{stats?.holdItems?.toLocaleString('ar-SA') || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* الرسوم البيانية الرئيسية */}
      <div className="grid md:grid-cols-2 gap-6">
        
        {/* رسم توزيع حالات الانتهاء - دائري */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChartIcon className="w-5 h-5 text-orange-500" />
              توزيع حالات الانتهاء
            </CardTitle>
            <CardDescription>تصنيف البنود حسب الفترة المتبقية للانتهاء</CardDescription>
          </CardHeader>
          <CardContent>
            {expiryData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={expiryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {expiryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-gray-400">
                لا توجد بيانات
              </div>
            )}
          </CardContent>
        </Card>

        {/* رسم البنود حسب التصنيف - شريطي */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              البنود حسب التصنيف
            </CardTitle>
            <CardDescription>توزيع البنود المصنفة</CardDescription>
          </CardHeader>
          <CardContent>
            {categoriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={categoriesData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => v.toLocaleString('ar-SA')} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="البنود" radius={[0, 4, 4, 0]}>
                    {categoriesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-gray-400">
                لا توجد بيانات
              </div>
            )}
          </CardContent>
        </Card>

        {/* رسم ملخص البنود - شريطي */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="w-5 h-5 text-blue-500" />
              ملخص المخزون
            </CardTitle>
            <CardDescription>نظرة عامة على حالة المخزون</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => v.toLocaleString('ar-SA')} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="البنود" fill={COLORS.primary} radius={[4, 4, 0, 0]}>
                  <Cell fill={COLORS.primary} />
                  <Cell fill={COLORS.warning} />
                  <Cell fill={COLORS.danger} />
                  <Cell fill={COLORS.orange} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* رسم أنواع Hold */}
        {holdTypesData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5 text-yellow-500" />
                توزيع أنواع Hold
              </CardTitle>
              <CardDescription>تصنيف البنود المحجوبة حسب السبب</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={holdTypesData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tickFormatter={(v) => v.toLocaleString('ar-SA')} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => v.toLocaleString('ar-SA')} />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = holdTypesData.find((d: { name: string }) => d.name === label)
                        return (
                          <div className="bg-white p-3 rounded-lg shadow-lg border text-right" dir="rtl">
                            <p className="font-bold text-gray-800 text-xs">{data?.fullName}</p>
                            <p className="text-sm text-blue-500">البنود: {payload[0]?.value?.toLocaleString('ar-SA')}</p>
                            <p className="text-sm text-green-500">الكمية: {payload[1]?.value?.toLocaleString('ar-SA')}</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar yAxisId="left" dataKey="البنود" fill={COLORS.warning} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="الكمية" stroke={COLORS.danger} strokeWidth={2} dot={{ fill: COLORS.danger }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* التقارير */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            قائمة التقارير
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {reports.map((r, i) => (
              <div key={i} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <p className="font-medium text-sm">{r.title}</p>
                <p className="text-xs text-gray-500 mb-2">{r.desc}</p>
                <p className={`text-xl font-bold ${r.color}`}>{r.count.toLocaleString('ar-SA')} بند</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* جدول الكميات */}
      <Card>
        <CardHeader>
          <CardTitle>ملخص الكميات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <p className="text-sm text-gray-600 mb-1">إجمالي الكمية</p>
              <p className="text-2xl font-bold text-blue-600">{stats?.totalQty?.toLocaleString('ar-SA') || 0}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-sm text-gray-600 mb-1">الكمية المتاحة</p>
              <p className="text-2xl font-bold text-green-600">{stats?.availableQty?.toLocaleString('ar-SA') || 0}</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg text-center">
              <p className="text-sm text-gray-600 mb-1">الكمية المحجوبة</p>
              <p className="text-2xl font-bold text-yellow-600">{stats?.holdQtySum?.toLocaleString('ar-SA') || 0}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg text-center">
              <p className="text-sm text-gray-600 mb-1">البنود المنتهية</p>
              <p className="text-2xl font-bold text-red-600">{stats?.expiredItems?.toLocaleString('ar-SA') || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
