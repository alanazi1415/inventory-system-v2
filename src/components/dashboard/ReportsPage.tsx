'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText } from "lucide-react"

interface ReportsPageProps { system: 'hoz' | 'mwsal' }

export function ReportsPage({ system }: ReportsPageProps) {
  const [stats, setStats] = useState<any>(null)
  useEffect(() => {
    fetch(`/api/stats?system=${system}`).then(r => r.json()).then(setStats).catch(() => {})
  }, [system])
  
  const reports = [
    { title: 'تقرير البنود قاربت على الانتهاء', desc: 'ستنتهي صلاحيتها خلال 90 يوم', count: stats?.expiringItems || 0 },
    { title: 'تقرير البنود المنقذة للحياة', desc: 'البنود المصنفة كمنقذة للحياة', count: stats?.lifeSavingItems || 0 },
    { title: 'تقرير اللقاحات', desc: 'جميع اللقاحات في المخزون', count: stats?.vaccineItems || 0 },
    { title: 'تقرير البنود الاستراتيجية', desc: 'البنود المصنفة كاستراتيجية', count: stats?.strategicItems || 0 },
    { title: 'تقرير بنود التدخين', desc: 'البنود المصنفة للتدخين', count: stats?.smokingItems || 0 },
    { title: 'تقرير بنود الكلى', desc: 'البنود المصنفة للكلى', count: stats?.kidneyItems || 0 },
    { title: 'تقرير البنود المركزية', desc: 'البنود المركزية', count: stats?.centralItems || 0 },
  ]
  
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6" />التقارير</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r, i) => (
          <Card key={i} className="hover:shadow-lg transition-shadow">
            <CardHeader><CardTitle className="text-lg">{r.title}</CardTitle><p className="text-sm text-gray-500">{r.desc}</p></CardHeader>
            <CardContent><p className="text-2xl font-bold text-primary">{r.count.toLocaleString('ar-SA')} بند</p></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>ملخص المخزون</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg"><p className="text-sm text-gray-600">إجمالي البنود</p><p className="text-2xl font-bold text-blue-600">{stats?.totalItems?.toLocaleString('ar-SA') || 0}</p></div>
            <div className="p-4 bg-green-50 rounded-lg"><p className="text-sm text-gray-600">إجمالي الكمية</p><p className="text-2xl font-bold text-green-600">{stats?.totalQty?.toLocaleString('ar-SA') || 0}</p></div>
            <div className="p-4 bg-purple-50 rounded-lg"><p className="text-sm text-gray-600">الكمية المتاحة</p><p className="text-2xl font-bold text-purple-600">{stats?.availableQty?.toLocaleString('ar-SA') || 0}</p></div>
            <div className="p-4 bg-yellow-50 rounded-lg"><p className="text-sm text-gray-600">بنود عليها Hold</p><p className="text-2xl font-bold text-yellow-600">{stats?.holdItems?.toLocaleString('ar-SA') || 0}</p></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
