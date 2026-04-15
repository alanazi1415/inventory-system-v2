'use client'
import { Card, CardContent } from "@/components/ui/card"
import { Clock, Package, Heart, Ban, Syringe, Info, XCircle } from "lucide-react"

interface UserPermissions {
  canViewInventory?: boolean
  canViewAlerts?: boolean
  canViewExpiring?: boolean
  canViewExpired?: boolean
  canViewLifeSaving?: boolean
  canViewVaccines?: boolean
  canViewStrategic?: boolean
  canViewSmoking?: boolean
  canViewKidney?: boolean
  canViewCentral?: boolean
  canViewReports?: boolean
  canViewAlternatives?: boolean
  canViewHoz?: boolean
  canViewMwsal?: boolean
}

interface StatsCardsProps { 
  stats: { 
    totalItems?: number
    expiredItems?: number
    expiringItems?: number
    holdItems?: number
    lifeSavingItems?: number
    vaccineItems?: number
    holdTypes?: { type: string; count: number; qty: number }[]
  }
  onCardClick: (cat: string) => void
  permissions?: UserPermissions | null
}

export function StatsCards({ stats, onCardClick, permissions }: StatsCardsProps) {
  const allCards = [
    { id: 'total', label: 'إجمالي البنود', value: stats?.totalItems ?? 0, icon: Package, color: 'text-blue-500', bgColor: 'bg-blue-50', clickable: false, perm: null },
    { id: 'expired', label: 'البنود المنتهية', value: stats?.expiredItems ?? 0, icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50', clickable: true, perm: 'canViewExpired' as keyof UserPermissions },
    { id: 'expiring', label: 'قاربت على الانتهاء', value: stats?.expiringItems ?? 0, icon: Clock, color: 'text-orange-500', bgColor: 'bg-orange-50', clickable: true, perm: 'canViewExpiring' as keyof UserPermissions },
    { id: 'hold', label: 'البنود عليها Hold', value: stats?.holdItems ?? 0, icon: Ban, color: 'text-yellow-600', bgColor: 'bg-yellow-50', clickable: true, perm: 'canViewAlerts' as keyof UserPermissions },
    { id: 'life-saving', label: 'البنود المنقذة للحياة', value: stats?.lifeSavingItems ?? 0, icon: Heart, color: 'text-pink-500', bgColor: 'bg-pink-50', clickable: true, perm: 'canViewLifeSaving' as keyof UserPermissions },
    { id: 'vaccine', label: 'اللقاحات', value: stats?.vaccineItems ?? 0, icon: Syringe, color: 'text-green-500', bgColor: 'bg-green-50', clickable: true, perm: 'canViewVaccines' as keyof UserPermissions },
  ]

  // فلترة البطاقات بناءً على الصلاحيات
  const cards = allCards.filter(card => {
    if (card.perm === null) return true
    return permissions?.[card.perm] ?? true
  })

  return (
    <div className="space-y-4">
      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card 
              key={card.id} 
              className={`${card.clickable ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''} ${card.bgColor}`} 
              onClick={() => card.clickable && onCardClick(card.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">{card.label}</p>
                    <p className={`text-2xl font-bold ${card.color}`}>{(card.value ?? 0).toLocaleString('ar-SA')}</p>
                  </div>
                  <Icon className={`w-8 h-8 ${card.color}`} />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Hold Types Distribution */}
      {stats?.holdTypes && stats.holdTypes.length > 0 && permissions?.canViewAlerts !== false && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-5 h-5 text-yellow-600" />
              <h3 className="font-bold text-yellow-800">توزيع أنواع Hold</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats.holdTypes.map((ht, i) => (
                <div key={i} className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-sm text-gray-600 truncate" title={ht.type}>{ht.type}</p>
                  <div className="flex justify-between items-center mt-1">
                    <p className="font-bold text-yellow-700">{ht.count} بند</p>
                    <p className="text-sm text-gray-500">{(ht.qty ?? 0).toLocaleString('ar-SA')} وحدة</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
