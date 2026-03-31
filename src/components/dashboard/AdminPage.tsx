'use client'
import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Upload, FileSpreadsheet, RefreshCw, Users, Eye, Database, Heart, Syringe, Ban, AlertTriangle, Clock, Shield, Cigarette, Droplets, Building2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AdminPageProps { onLogout: () => void }

export function AdminPage({ onLogout }: AdminPageProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedSystem, setSelectedSystem] = useState<string>('hoz')
  const [uploadLogs, setUploadLogs] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats')
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('system', selectedSystem)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (data.success) {
        toast({ title: "تم الرفع بنجاح", description: data.message })
        setUploadLogs(prev => [{
          fileName: file.name,
          system: selectedSystem,
          records: data.recordsCount,
          time: new Date().toLocaleString('ar-SA')
        }, ...prev])
        setTimeout(fetchStats, 1000)
      } else {
        toast({ title: "خطأ", description: data.details || data.error, variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "خطأ", description: 'حدث خطأ في الاتصال', variant: "destructive" })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const systemOptions = [
    { value: 'hoz', label: 'هوز', desc: 'مستودع هوز', icon: Database, color: 'text-purple-500', bgColor: 'bg-purple-50' },
    { value: 'mwsal', label: 'موصول', desc: 'مستودع موصول', icon: Database, color: 'text-orange-500', bgColor: 'bg-orange-50' },
    { value: 'life_saving', label: 'المنقذة للحياة', desc: 'بنود منقذة', icon: Heart, color: 'text-pink-500', bgColor: 'bg-pink-50' },
    { value: 'narcotic', label: 'المخدرات', desc: 'بنود مخدرة', icon: Ban, color: 'text-purple-600', bgColor: 'bg-purple-50' },
    { value: 'vaccine', label: 'اللقاحات', desc: 'قائمة اللقاحات', icon: Syringe, color: 'text-green-500', bgColor: 'bg-green-50' },
    { value: 'strategic', label: 'الاستراتيجية', desc: 'بنود استراتيجية', icon: Shield, color: 'text-amber-500', bgColor: 'bg-amber-50' },
    { value: 'smoking', label: 'التدخين', desc: 'بنود التدخين', icon: Cigarette, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { value: 'kidney', label: 'الكلى', desc: 'بنود الكلى', icon: Droplets, color: 'text-cyan-600', bgColor: 'bg-cyan-50' },
    { value: 'central', label: 'المركزية', desc: 'البنود المركزية', icon: Building2, color: 'text-slate-600', bgColor: 'bg-slate-50' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">لوحة تحكم الأدمن</h1>
          <p className="text-gray-500">إدارة البيانات والملفات</p>
        </div>
        <Button variant="outline" onClick={onLogout}>تسجيل الخروج</Button>
      </div>

      {/* Visitors Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-blue-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600">إجمالي الزيارات</p>
              <p className="text-2xl font-bold text-blue-600">{stats?.totalVisits?.toLocaleString('ar-SA') || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Eye className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-600">زيارات اليوم</p>
              <p className="text-2xl font-bold text-green-600">{stats?.todayVisits?.toLocaleString('ar-SA') || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hoz Stats */}
        <Card className="border-purple-200">
          <CardHeader className="bg-purple-50 pb-2">
            <CardTitle className="text-purple-700 flex items-center gap-2">
              <Database className="w-5 h-5" />
              هوز (E200)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between"><span>إجمالي البنود:</span><strong>{stats?.hozItems?.toLocaleString('ar-SA') || 0}</strong></div>
              <div className="flex justify-between text-orange-600"><span>قاربت على الانتهاء:</span><strong>{stats?.hozExpiring?.toLocaleString('ar-SA') || 0}</strong></div>
              <div className="flex justify-between text-yellow-600"><span>عليها Hold:</span><strong>{stats?.hozHoldItems?.toLocaleString('ar-SA') || 0}</strong></div>
              <div className="flex justify-between text-pink-600"><span>المنقذة للحياة:</span><strong>{stats?.lifeSavingInHoz?.toLocaleString('ar-SA') || 0}</strong></div>
            </div>
          </CardContent>
        </Card>

        {/* Mwsal Stats */}
        <Card className="border-orange-200">
          <CardHeader className="bg-orange-50 pb-2">
            <CardTitle className="text-orange-700 flex items-center gap-2">
              <Database className="w-5 h-5" />
              موصول (E300)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between"><span>إجمالي البنود:</span><strong>{stats?.mwsalItems?.toLocaleString('ar-SA') || 0}</strong></div>
              <div className="flex justify-between text-orange-600"><span>قاربت على الانتهاء:</span><strong>{stats?.mwsalExpiring?.toLocaleString('ar-SA') || 0}</strong></div>
              <div className="flex justify-between text-yellow-600"><span>عليها Hold:</span><strong>{stats?.mwsalHoldItems?.toLocaleString('ar-SA') || 0}</strong></div>
              <div className="flex justify-between text-pink-600"><span>المنقذة للحياة:</span><strong>{stats?.lifeSavingInMwsal?.toLocaleString('ar-SA') || 0}</strong></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Special Items Uploaded */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        <Card className="bg-pink-50">
          <CardContent className="p-3 flex flex-col items-center">
            <Heart className="w-5 h-5 text-pink-500 mb-1" />
            <p className="text-xs text-gray-600">المنقذة للحياة</p>
            <p className="text-lg font-bold text-pink-600">{stats?.lifeSavingCount?.toLocaleString('ar-SA') || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50">
          <CardContent className="p-3 flex flex-col items-center">
            <Ban className="w-5 h-5 text-purple-600 mb-1" />
            <p className="text-xs text-gray-600">المخدرات</p>
            <p className="text-lg font-bold text-purple-600">{stats?.narcoticCount?.toLocaleString('ar-SA') || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50">
          <CardContent className="p-3 flex flex-col items-center">
            <Syringe className="w-5 h-5 text-green-500 mb-1" />
            <p className="text-xs text-gray-600">اللقاحات</p>
            <p className="text-lg font-bold text-green-600">{stats?.vaccineCount?.toLocaleString('ar-SA') || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50">
          <CardContent className="p-3 flex flex-col items-center">
            <Shield className="w-5 h-5 text-amber-500 mb-1" />
            <p className="text-xs text-gray-600">الاستراتيجية</p>
            <p className="text-lg font-bold text-amber-600">{stats?.strategicCount?.toLocaleString('ar-SA') || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50">
          <CardContent className="p-3 flex flex-col items-center">
            <Cigarette className="w-5 h-5 text-blue-600 mb-1" />
            <p className="text-xs text-gray-600">التدخين</p>
            <p className="text-lg font-bold text-blue-600">{stats?.smokingCount?.toLocaleString('ar-SA') || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-cyan-50">
          <CardContent className="p-3 flex flex-col items-center">
            <Droplets className="w-5 h-5 text-cyan-600 mb-1" />
            <p className="text-xs text-gray-600">الكلى</p>
            <p className="text-lg font-bold text-cyan-600">{stats?.kidneyCount?.toLocaleString('ar-SA') || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-50">
          <CardContent className="p-3 flex flex-col items-center">
            <Building2 className="w-5 h-5 text-slate-600 mb-1" />
            <p className="text-xs text-gray-600">المركزية</p>
            <p className="text-lg font-bold text-slate-600">{stats?.centralCount?.toLocaleString('ar-SA') || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            رفع ملفات Excel
          </CardTitle>
          <CardDescription>اختر التصنيف ثم ارفع ملف Excel الخاص به</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 md:grid-cols-9 gap-2">
            {systemOptions.map((opt) => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.value}
                  onClick={() => setSelectedSystem(opt.value)}
                  className={`p-2 rounded-lg border-2 text-center transition-colors ${
                    selectedSystem === opt.value
                      ? 'border-primary bg-primary/10'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 mx-auto mb-1 ${opt.color}`} />
                  <p className="font-medium text-xs">{opt.label}</p>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls"
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="min-w-32">
              {uploading ? (
                <><RefreshCw className="w-4 h-4 ml-2 animate-spin" />جاري الرفع...</>
              ) : (
                <><FileSpreadsheet className="w-4 h-4 ml-2" />اختار ملف</>
              )}
            </Button>
            <p className="text-sm text-gray-500">ملفات مدعومة: .xlsx, .xls</p>
          </div>
        </CardContent>
      </Card>

      {/* Upload Logs */}
      {uploadLogs.length > 0 && (
        <Card>
          <CardHeader><CardTitle>سجل العمليات</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uploadLogs.map((log, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-medium">{log.fileName}</p>
                      <p className="text-sm text-gray-500">{log.system} - {log.records} سجل</p>
                    </div>
                  </div>
                  <Badge variant="secondary">{log.time}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader><CardTitle>تعليمات مهمة</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p><strong>1.</strong> 📊 <strong>رفع ملفات المخزون (هوز/موصول):</strong> تحتوي على بيانات المخزون الكاملة</p>
          <p><strong>2.</strong> ❤️ <strong>رفع قائمة البنود المنقذة للحياة:</strong> يربط البنود تلقائياً مع المخزون</p>
          <p><strong>3.</strong> 💊 <strong>رفع قائمة المخدرات:</strong> يصنف البنود المخدرة في المخزون</p>
          <p><strong>4.</strong> 💉 <strong>رفع قائمة اللقاحات:</strong> يصنف اللقاحات في المخزون</p>
          <p><strong>5.</strong> 🛡️ <strong>رفع قائمة البنود الاستراتيجية:</strong> يصنف البنود الاستراتيجية</p>
          <p><strong>6.</strong> 🚬 <strong>رفع قائمة بنود التدخين:</strong> يصنف بنود التدخين</p>
          <p><strong>7.</strong> 🩺 <strong>رفع قائمة بنود الكلى:</strong> يصنف بنود الكلى</p>
          <p><strong>8.</strong> 🏢 <strong>رفع قائمة البنود المركزية:</strong> يصنف البنود المركزية</p>
          <p className="text-xs text-gray-500 mt-2">⚠️ يجب رفع ملفات المخزون أولاً، ثم رفع القوائم الخاصة للتصنيف الصحيح</p>
        </CardContent>
      </Card>
    </div>
  )
}
