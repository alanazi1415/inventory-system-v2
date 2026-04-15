'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Truck, Search, RefreshCw, Calendar, Clock, CheckCircle, AlertTriangle, Building2 } from "lucide-react"

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
  urgent: number
  today: number
  upcoming: number
}

interface DeliverySchedulePageProps {
  selectedSystem: 'hoz' | 'mwsal'
}

export function DeliverySchedulePage({ selectedSystem }: DeliverySchedulePageProps) {
  const [centers, setCenters] = useState<DeliveryCenter[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'urgent' | 'today' | 'upcoming'>('all')
  const [stats, setStats] = useState<Stats>({ total: 0, urgent: 0, today: 0, upcoming: 0 })

  useEffect(() => {
    fetchCenters()
  }, [filter])

  const fetchCenters = async () => {
    setLoading(true)
    try {
      const filterParam = filter !== 'all' ? `&filter=${filter}` : ''
      const res = await fetch(`/api/delivery-schedule?limit=1000${filterParam}`)
      const data = await res.json()
      if (data.success) {
        setCenters(data.centers || [])
        setStats(data.stats || { total: 0, urgent: 0, today: 0, upcoming: 0 })
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
        // تحديث القائمة
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
    if (daysUntil === 0) {
      return { color: 'bg-red-500', label: 'توصيل اليوم!', urgent: true }
    } else if (daysUntil === 1) {
      return { color: 'bg-orange-500', label: 'غداً', urgent: true }
    } else if (daysUntil === 2) {
      return { color: 'bg-yellow-500', label: 'بعد يومين', urgent: true }
    } else if (daysUntil <= 7) {
      return { color: 'bg-blue-500', label: `${daysUntil} أيام`, urgent: false }
    } else {
      return { color: 'bg-gray-400', label: `${daysUntil} يوم`, urgent: false }
    }
  }

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-600" />
            جدول التوصيل للمراكز الصحية
          </h1>
          <p className="text-gray-500">مواعيد التوصيل والمراكز التي تحتاج موافقة</p>
        </div>
        <Button variant="outline" onClick={fetchCenters} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-4 gap-4">
        <Card 
          className={`cursor-pointer transition-all ${filter === 'all' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setFilter('all')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600">إجمالي المراكز</p>
              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all ${filter === 'today' ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => setFilter('today')}
        >
          <CardContent className="p-4 flex items-center gap-3 bg-red-50">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-sm text-gray-600">توصيل اليوم</p>
              <p className="text-2xl font-bold text-red-600">{stats.today}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all ${filter === 'urgent' ? 'ring-2 ring-orange-500' : ''}`}
          onClick={() => setFilter('urgent')}
        >
          <CardContent className="p-4 flex items-center gap-3 bg-orange-50">
            <Clock className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-sm text-gray-600">عاجل (48 ساعة)</p>
              <p className="text-2xl font-bold text-orange-600">{stats.urgent}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all ${filter === 'upcoming' ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => setFilter('upcoming')}
        >
          <CardContent className="p-4 flex items-center gap-3 bg-green-50">
            <Calendar className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-600">هذا الأسبوع</p>
              <p className="text-2xl font-bold text-green-600">{stats.upcoming}</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
            <Truck className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">لا توجد مراكز في جدول التوصيل</p>
            <p className="text-sm text-gray-400 mt-1">يمكن للأدمن رفع ملف جدول التوصيل من لوحة التحكم</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredCenters.map((center) => {
            const status = getCenterStatus(center.daysUntilDelivery)
            return (
              <Card 
                key={center.id} 
                className={`overflow-hidden transition-all ${status.urgent ? 'border-2 border-orange-300' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${status.color}`} />
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
                            يوم {center.deliveryDay} من كل شهر - {center.deliveryDayAr}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge 
                        className={`${status.color} text-white`}
                      >
                        {status.label}
                      </Badge>
                      {center.lastApproved ? (
                        <div className="text-center">
                          <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                          <p className="text-xs text-gray-500">تمت الموافقة</p>
                        </div>
                      ) : status.urgent ? (
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={() => handleApprove(center.id)}
                        >
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
