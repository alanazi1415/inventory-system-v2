'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Pill, Search, Package, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"

interface AlternativeGroup {
  id: string
  itemNumber: string
  description: string | null
  isActive: boolean
  items: AlternativeItem[]
}

interface AlternativeItem {
  id: string
  itemNumber: string
  sortOrder: number
  availableStock?: number
}

interface AlternativesPageProps {
  selectedSystem: 'hoz' | 'mwsal'
}

export function AlternativesPage({ selectedSystem }: AlternativesPageProps) {
  const [groups, setGroups] = useState<AlternativeGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchAlternatives()
  }, [])

  const fetchAlternatives = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/alternatives?limit=1000')
      const data = await res.json()
      if (data.success) {
        setGroups(data.groups || [])
      }
    } catch (error) {
      console.error('Error fetching alternatives:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  // فلترة حسب البحث
  const filteredGroups = groups.filter(group => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      group.itemNumber.includes(search) ||
      (group.description?.toLowerCase().includes(searchLower)) ||
      group.items.some(item => item.itemNumber.includes(search))
    )
  })

  // حساب الإحصائيات
  const stats = {
    totalGroups: groups.length,
    totalAlternatives: groups.reduce((sum, g) => sum + g.items.length, 0),
    withStock: groups.filter(g => g.items.some(i => (i.availableStock || 0) > 0)).length
  }

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Pill className="w-6 h-6 text-teal-600" />
            البدائل الدوائية
          </h1>
          <p className="text-gray-500">البنود البديلة لكل دواء مع كميات المخزون المتاحة</p>
        </div>
        <Button variant="outline" onClick={fetchAlternatives} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-teal-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Pill className="w-8 h-8 text-teal-500" />
            <div>
              <p className="text-sm text-gray-600">إجمالي البدائل</p>
              <p className="text-2xl font-bold text-teal-600">{stats.totalGroups}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600">بنود بديلة</p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalAlternatives}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-600">متوفر بديل</p>
              <p className="text-2xl font-bold text-green-600">{stats.withStock}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* البحث */}
      <div className="relative">
        <Search className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
        <Input
          placeholder="بحث برقم البند أو الوصف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-9"
        />
      </div>

      {/* قائمة البدائل */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">جاري التحميل...</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Pill className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">لا توجد بدائل دوائية</p>
            <p className="text-sm text-gray-400 mt-1">يمكن للأدمن رفع ملف البدائل من لوحة التحكم</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredGroups.map((group) => (
            <Card key={group.id} className="overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                onClick={() => toggleGroup(group.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedGroups.has(group.id) ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold">{group.itemNumber}</span>
                      <Badge variant="outline" className="text-xs">
                        {group.items.length} بديل
                      </Badge>
                    </div>
                    {group.description && (
                      <p className="text-sm text-gray-500 mt-1">{group.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {group.items.some(i => (i.availableStock || 0) > 0) && (
                    <Badge className="bg-green-100 text-green-700">متوفر بديل</Badge>
                  )}
                </div>
              </div>

              {expandedGroups.has(group.id) && (
                <div className="border-t bg-gray-50 p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 border-b">
                        <th className="text-right pb-2">#</th>
                        <th className="text-right pb-2">رقم البند البديل</th>
                        <th className="text-right pb-2">الكمية المتاحة</th>
                        <th className="text-right pb-2">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item, idx) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="py-2 text-gray-400">{idx + 1}</td>
                          <td className="py-2 font-mono">{item.itemNumber}</td>
                          <td className="py-2">
                            {(item.availableStock || 0) > 0 ? (
                              <span className="text-green-600 font-medium">
                                {item.availableStock?.toLocaleString('ar-SA')}
                              </span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                          <td className="py-2">
                            {(item.availableStock || 0) > 0 ? (
                              <Badge className="bg-green-100 text-green-700 text-xs">متوفر</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">غير متوفر</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
