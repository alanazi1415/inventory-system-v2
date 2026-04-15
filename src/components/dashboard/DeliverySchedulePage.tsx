'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Truck, Search, RefreshCw, Calendar, Clock, CheckCircle, AlertTriangle, Building2, CheckCircle2 } from "lucide-react"

interface DeliveryCenter {
  id: string
  nameEn: string
  nameAr: string
  code: string
  deliveryDay: number
  deliveryDayEn: string
  deliveryDayAr: string
  isActive: boolean
  lastApproved: string | null
  approvedBy: string | null
  notes: string | null
  daysUntilDelivery: number
}

interface Stats {
  total: number
  needApproval: number // 24-48 ساعة
  in24Hours: number // 24 ساعة
  in48Hours: number // 48 ساعة
}

interface DeliverySchedulePageProps {
  selectedSystem: 'hoz' | 'mwsal'
}

export function DeliverySchedulePage({ selectedSystem }: DeliverySchedulePageProps) {
  const [centers, setCenters] = useState<DeliveryCenter[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'48h' | 'all'>('48h')
  const [stats, setStats] = useState<Stats>({ total: 0, needApproval: 0, in24Hours: 0, in48Hours: 0 })

  useEffect(() => {
    fetchCenters()
  }, [filter])

  const fetchCenters = async () => {
    setLoading(true)
    try {
      // نجلب كل المراكز ثم نفلتر محلياً
      const res = await fetch(`/api/delivery-schedule?limit=1000`)
      const data = await res.json()
      if (data.success) {
        const allCenters = data.centers || []
        
        // حساب الإحصائيات الجديدة
        const in24Hours = allCenters.filter((c: DeliveryCenter) => c.daysUntilDelivery === 1).length
        const in48Hours = allCenters.filter((c: DeliveryCenter) => c.daysUntilDelivery === 2).length
        const needApproval = in24Hours + in48Hours
        
        setStats({ 
          total: allCenters.length, 
          needApproval, 
          in24Hours, 
          in48Hours 
        })
        
        // فلترة حسب الاختيار - الافتراضي 48 ساعة (يشمل 24 و 48)
        let filtered = allCenters
        if (filter === '48h') {
          // 24-48 ساعة (1-2 يوم)
          filtered = allCenters.filter((c: DeliveryCenter) => c.daysUntilDelivery === 1 || c.daysUntilDelivery === 2)
        }
        
        // ترتيب حسب الأيام المتبقية
        filtered.sort((a: DeliveryCenter, b: DeliveryCenter) => a.daysUntilDelivery - b.daysUntilDelivery)
        setCenters(filtered)
      }
    } catch (error) {
      console.error('Error fetching delivery centers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (centerId: string) => {
    try {
      const res = await fetch('/api/delivery-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: centerId, 
          approvedBy: 'user',
          notes: 'تمت الموافقة'
        })
      })
      const data = await res.json()
      if (data.success) {
        fetchCenters()
      }
    } catch (error) {
      console.error('Error approving center:', error)
    }
  }

  // فلترة حسب البحث
  const filteredCenters = centers.filter(center => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      center.nameEn.toLowerCase().includes(searchLower) ||
      center.nameAr.includes(search) ||
      center.code.toLowerCase().includes(searchLower)
    )
  })

  // تحديد حالة المركز
  const getCenterStatus = (daysUntil: number): { color: string; label: string; urgent: boolean } => {
    if (daysUntil === 1) {
      return { color: 'bg-orange-500', label: 'غداً - 24 ساعة', urgent: true }
    } else if (daysUntil === 2) {
      return { color: 'bg-yellow-500', label: 'بعد غد - 48 ساعة', urgent: true }
    } else {
      return { color: 'bg-gray-400', label: `${daysUntil} يوم`, urgent: false }
    }
  }

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="w-6 h-6 text-indigo-600" />
            المراكز الصحية التي تحتاج موافقة
          </h1>
          <p className="text-gray-500">المراكز التي باقي على موعد توصيلها 24-48 ساعة - يجب إعطاءها موافقة مسبقة</p>
          <p className="text-xs text-amber-600 mt-1">
            ⚠️ ملاحظة: إذا صادف موعد التوصيل يوم الجمعة يتم التوصيل يوم الخميس، وإذا صادف يوم السبت يتم التوصيل يوم الأحد
          </p>
        </div>
        <Button variant="outline" onClick={fetchCenters} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-2 gap-4">
        <Card 
          className={`cursor-pointer transition-all ${filter === '48h' ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
          onClick={() => setFilter('48h')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-sm text-gray-600">تحتاج موافقة (48 ساعة)</p>
              <p className="text-2xl font-bold text-orange-600">{stats.needApproval}</p>
              <p className="text-xs text-gray-400">{stats.in24Hours} غداً + {stats.in48Hours} بعد غد</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all ${filter === 'all' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setFilter('all')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600">جميع المراكز</p>
              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* رسالة تذكيرية */}
      {filter === '48h' && stats.needApproval > 0 && (
        <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <div>
              <p className="font-bold text-orange-700">
                ⚠️ يوجد {stats.needApproval} مركز يحتاج موافقة خلال 48 ساعة
              </p>
              <p className="text-sm text-orange-600">
                ({stats.in24Hours} مركز غداً + {stats.in48Hours} مركز بعد غد) - يجب إعطاء الموافقة قبل موعد التوصيل
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* البحث */}
      <div className="relative">
        <Search className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
        <Input
          placeholder="بحث باسم المركز أو الرمز..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-9"
        />
      </div>

      {/* قائمة المراكز */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">جاري التحميل...</p>
        </div>
      ) : filteredCenters.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-400 mb-4" />
            <p className="text-gray-500">
              {filter === '48h' 
                ? 'لا توجد مراكز تحتاج موافقة خلال 48 ساعة' 
                : 'لا توجد مراكز في جدول التوصيل'}
            </p>
            {filter === '48h' && (
              <p className="text-sm text-green-500 mt-2">✓ جميع المراكز القريبة حصلت على موافقة</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredCenters.map((center) => {
            const status = getCenterStatus(center.daysUntilDelivery)
            return (
              <Card 
                key={center.id} 
                className={`overflow-hidden transition-all ${status.urgent ? 'border-2 border-orange-300 bg-orange-50/30' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-4 h-4 rounded-full ${status.color} animate-pulse`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">{center.nameAr}</span>
                          <Badge variant="outline" className="text-xs font-mono">
                            {center.code}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">{center.nameEn}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            موعد التوصيل: يوم {center.deliveryDay} من كل شهر
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`${status.color} text-white text-sm px-3 py-1`}>
                        {status.label}
                      </Badge>
                      {center.lastApproved ? (
                        <div className="text-center bg-green-50 rounded-lg px-3 py-2">
                          <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                          <p className="text-xs text-green-600 font-medium">تمت الموافقة</p>
                        </div>
                      ) : status.urgent ? (
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove(center.id)}
                        >
                          <CheckCircle className="w-4 h-4 ml-1" />
                          موافقة
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
