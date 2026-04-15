'use client'
import { Button } from "@/components/ui/button"
import { Home, Package, AlertTriangle, Clock, Heart, FileText, LogIn, LogOut, RefreshCw, Syringe, Shield, Cigarette, Droplets, Building2, Users, XCircle, Activity, Flame, Snowflake, Zap, Pill, Truck } from "lucide-react"

interface UserPermissions {
  canViewInventory: boolean
  canViewAlerts: boolean
  canViewExpiring: boolean
  canViewExpired: boolean
  canViewLifeSaving: boolean
  canViewVaccines: boolean
  canViewStrategic: boolean
  canViewSmoking: boolean
  canViewKidney: boolean
  canViewCentral: boolean
  canViewReports: boolean
  canViewMovement: boolean
  canViewAlternatives: boolean
  canViewDelivery: boolean
  canViewHoz: boolean
  canViewMwsal: boolean
}

interface UserInfo {
  id: string
  name: string
  permissions: UserPermissions
}

interface SidebarProps { 
  currentPage: string
  onPageChange: (page: any) => void
  selectedSystem: 'hoz' | 'mwsal' | null
  onSystemChange: () => void
  isAdmin: boolean
  onAdminToggle: () => void
  user?: UserInfo | null
  onLogout?: () => void
}

export function Sidebar({ currentPage, onPageChange, selectedSystem, onSystemChange, isAdmin, onAdminToggle, user, onLogout }: SidebarProps) {
  const allMenuItems = [
    { id: 'home', label: 'الرئيسية', icon: Home, perm: null },
    { id: 'inventory', label: 'المخزون اللحظي', icon: Package, perm: 'canViewInventory' as keyof UserPermissions },
    { id: 'alerts', label: 'التنبيهات (Hold)', icon: AlertTriangle, perm: 'canViewAlerts' as keyof UserPermissions },
    { id: 'expiring', label: 'قاربت على الانتهاء', icon: Clock, perm: 'canViewExpiring' as keyof UserPermissions },
    { id: 'expired', label: 'البنود المنتهية', icon: XCircle, perm: 'canViewExpired' as keyof UserPermissions },
    { id: 'life-saving', label: 'البنود المنقذة للحياة', icon: Heart, perm: 'canViewLifeSaving' as keyof UserPermissions },
    { id: 'vaccines', label: 'اللقاحات', icon: Syringe, perm: 'canViewVaccines' as keyof UserPermissions },
    { id: 'strategic', label: 'البنود الاستراتيجية', icon: Shield, perm: 'canViewStrategic' as keyof UserPermissions },
    { id: 'smoking', label: 'بنود التدخين', icon: Cigarette, perm: 'canViewSmoking' as keyof UserPermissions },
    { id: 'kidney', label: 'بنود الكلى', icon: Droplets, perm: 'canViewKidney' as keyof UserPermissions },
    { id: 'central', label: 'البنود المركزية', icon: Building2, perm: 'canViewCentral' as keyof UserPermissions },
    { id: 'alternatives', label: 'البدائل الدوائية', icon: Pill, perm: 'canViewAlternatives' as keyof UserPermissions },
    { id: 'delivery-schedule', label: 'جدول التوصيل', icon: Truck, perm: 'canViewDelivery' as keyof UserPermissions },
    { id: 'reports', label: 'التقارير', icon: FileText, perm: 'canViewReports' as keyof UserPermissions },
    { id: '_divider_movement', label: '---', icon: Activity, perm: null },
    { id: 'movement', label: 'تحليل الحركة', icon: Activity, perm: 'canViewMovement' as keyof UserPermissions },
    { id: 'fast-movement', label: 'بنود سريعة الحركة', icon: Flame, perm: 'canViewMovement' as keyof UserPermissions },
    { id: 'slow-movement', label: 'بنود قليلة الحركة', icon: Snowflake, perm: 'canViewMovement' as keyof UserPermissions },
    { id: 'no-movement', label: 'بنود عديمة الحركة', icon: Zap, perm: 'canViewMovement' as keyof UserPermissions },
  ]

  // إضافة عنصر إدارة المستخدمين للأدمن
  const menuItems = isAdmin 
    ? [...allMenuItems, { id: 'users', label: 'إدارة المستخدمين', icon: Users, perm: null }]
    : allMenuItems

  // فلترة العناصر بناءً على الصلاحيات
  const filteredMenuItems = menuItems.filter(item => {
    if (item.perm === null) return true
    return user?.permissions?.[item.perm] ?? true
  })

  return (
    <aside className="w-64 bg-white border-l shadow-sm flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-lg font-bold text-gray-800">نظام دراسة المخزون</h1>
        <p className="text-sm text-gray-500 mt-1">عايد حمود العنزي - مدير التخطيط</p>
        <div className="mt-2 text-xs text-muted-foreground">إعداد: عبدالله فرحان العنزي - موظف نوبكو</div>
        {user && !isAdmin && (
          <div className="mt-2 text-sm text-blue-600 font-medium">
            {user.name}
          </div>
        )}
      </div>
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">النظام:</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedSystem === 'hoz' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
            {selectedSystem === 'hoz' ? 'هوز (E200)' : 'موصول (E300)'}
          </span>
        </div>
        <Button variant="ghost" size="sm" className="w-full mt-2" onClick={onSystemChange}>
          <RefreshCw className="w-4 h-4 ml-2" />
          تغيير النظام
        </Button>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredMenuItems.map((item) => {
          if (item.id.startsWith('_divider')) {
            return (
              <div key={item.id} className="border-t my-2 pt-2">
                <span className="text-xs text-gray-400 px-3">تحليل الحركة</span>
              </div>
            )
          }
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <button 
              key={item.id} 
              onClick={() => onPageChange(item.id)} 
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-right transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-gray-700'}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="p-3 border-t space-y-2">
        {isAdmin ? (
          <Button variant="destructive" className="w-full" onClick={onAdminToggle}>
            <LogOut className="w-4 h-4 ml-2" />
            خروج الأدمن
          </Button>
        ) : (
          <>
            <Button variant="outline" className="w-full" onClick={onAdminToggle}>
              <LogIn className="w-4 h-4 ml-2" />
              دخول الأدمن
            </Button>
            {onLogout && (
              <Button variant="ghost" className="w-full text-gray-500" onClick={onLogout}>
                <LogOut className="w-4 h-4 ml-2" />
                تسجيل الخروج
              </Button>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
