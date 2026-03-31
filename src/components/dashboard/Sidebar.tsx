'use client'
import { Button } from "@/components/ui/button"
import { Home, Package, AlertTriangle, Clock, Heart, FileText, LogIn, LogOut, RefreshCw, Syringe, Shield, Cigarette, Droplets, Building2 } from "lucide-react"

interface SidebarProps { currentPage: string; onPageChange: (page: any) => void; selectedSystem: 'hoz' | 'mwsal' | null; onSystemChange: () => void; isAdmin: boolean; onAdminToggle: () => void }

export function Sidebar({ currentPage, onPageChange, selectedSystem, onSystemChange, isAdmin, onAdminToggle }: SidebarProps) {
  const menuItems = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'inventory', label: 'المخزون اللحظي', icon: Package },
    { id: 'alerts', label: 'التنبيهات (Hold)', icon: AlertTriangle },
    { id: 'expiring', label: 'قاربت على الانتهاء', icon: Clock },
    { id: 'life-saving', label: 'البنود المنقذة للحياة', icon: Heart },
    { id: 'vaccines', label: 'اللقاحات', icon: Syringe },
    { id: 'strategic', label: 'البنود الاستراتيجية', icon: Shield },
    { id: 'smoking', label: 'بنود التدخين', icon: Cigarette },
    { id: 'kidney', label: 'بنود الكلى', icon: Droplets },
    { id: 'central', label: 'البنود المركزية', icon: Building2 },
    { id: 'reports', label: 'التقارير', icon: FileText },
  ]
  return (
    <aside className="w-64 bg-white border-l shadow-sm flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-lg font-bold text-gray-800">نظام دراسة المخزون</h1>
        <p className="text-sm text-gray-500 mt-1">عايد حمود العنزي - مدير التخطيط</p>
        <div className="mt-2 text-xs text-muted-foreground">إعداد: عبدالله فرحان العنزي - موظف نوبكو</div>
      </div>
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">النظام:</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedSystem === 'hoz' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
            {selectedSystem === 'hoz' ? 'هوز (E200)' : 'موصول (E300)'}
          </span>
        </div>
        <Button variant="ghost" size="sm" className="w-full mt-2" onClick={onSystemChange}><RefreshCw className="w-4 h-4 ml-2" />تغيير النظام</Button>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <button key={item.id} onClick={() => onPageChange(item.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-right transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-gray-700'}`}>
              <Icon className="w-5 h-5" /><span className="text-sm font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="p-3 border-t">
        <Button variant={isAdmin ? "destructive" : "outline"} className="w-full" onClick={onAdminToggle}>
          {isAdmin ? <><LogOut className="w-4 h-4 ml-2" />تسجيل الخروج</> : <><LogIn className="w-4 h-4 ml-2" />دخول الأدمن</>}
        </Button>
      </div>
    </aside>
  )
}
