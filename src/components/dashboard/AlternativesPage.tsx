'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Pill, Search, Package, AlertCircle, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, XCircle, CheckCircle } from "lucide-react"

interface AlternativeGroup {
  id: string
  itemNumber: string
  description: string | null
  isActive: boolean
  originalStock: number
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
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  useEffect(() => {
    fetchAlternatives()
  }, [selectedSystem, page])

  const fetchAlternatives = async (searchTerm?: string) => {
    setLoading(true)
    try {
      const searchQuery = searchTerm !== undefined ? searchTerm : search
      const offset = (page - 1) * pageSize
      const res = await fetch(`/api/alternatives?limit=${pageSize}&offset=${offset}&system=${selectedSystem}${searchQuery ? `&search=${searchQuery}` : ''}`)
      const data = await res.json()
      if (data.success) {
        setGroups(data.groups || [])
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || 1)
      }
    } catch (error) {
      console.error('Error fetching alternatives:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPage(1)
    fetchAlternatives(search)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
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

  // حساب الإحصائيات
  const stats = {
    totalGroups: total,
    totalAlternatives: groups.reduce((sum, g) => sum + g.items.length, 0),
    originalNotAvailable: groups.filter(g => g.originalStock === 0 && g.items.some(i => (i.availableStock || 0) > 0)).length,
    allAvailable: groups.filter(g => g.originalStock > 0).length
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
        <Button variant="outline" onClick={() => fetchAlternatives()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-4 gap-4">
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
              <p className="text-sm text-gray-600">بنود بديلة في الصفحة</p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalAlternatives}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-600">الأصل متوفر</p>
              <p className="text-2xl font-bold text-green-600">{stats.allAvailable}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-sm text-gray-600">يحتاج بديل</p>
              <p className="text-2xl font-bold text-orange-600">{stats.originalNotAvailable}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* البحث */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
          <Input
            placeholder="بحث برقم البند أو الوصف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pr-9"
          />
        </div>
        <Button onClick={handleSearch}>بحث</Button>
      </div>

      {/* قائمة البدائل */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">جاري التحميل...</p>
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Pill className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">لا توجد بدائل دوائية</p>
            <p className="text-sm text-gray-400 mt-1">يمكن للأدمن رفع ملف البدائل من لوحة التحكم</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {groups.map((group) => {
              const hasAlternativeWithStock = group.items.some(i => (i.availableStock || 0) > 0)
              const originalAvailable = group.originalStock > 0
              
              return (
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
                          {/* حالة البند الأصلي */}
                          {originalAvailable ? (
                            <Badge className="bg-green-100 text-green-700 text-xs">
                              متوفر ({group.originalStock.toLocaleString('ar-SA')})
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 text-xs">
                              غير متوفر
                            </Badge>
                          )}
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
                      {!originalAvailable && hasAlternativeWithStock && (
                        <Badge className="bg-green-100 text-green-700">يوجد بديل متوفر</Badge>
                      )}
                      {!originalAvailable && !hasAlternativeWithStock && (
                        <Badge className="bg-red-100 text-red-700">لا يوجد بديل متوفر</Badge>
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
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (page <= 3) {
                    pageNum = i + 1
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = page - 2 + i
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(pageNum)}
                      disabled={loading}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <span className="text-sm text-gray-500 mr-2">
                صفحة {page} من {totalPages}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
