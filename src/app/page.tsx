'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { LoginPage } from '@/components/dashboard/LoginPage'
import { WelcomeDialog } from '@/components/dashboard/WelcomeDialog'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { InventoryTable } from '@/components/dashboard/InventoryTable'
import { AdminLoginPage } from '@/components/dashboard/AdminLoginPage'
import { AdminPage } from '@/components/dashboard/AdminPage'
import { ReportsPage } from '@/components/dashboard/ReportsPage'
import { UserManagement } from '@/components/dashboard/UserManagement'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Clock, Heart, Package, RefreshCw, Calendar, Syringe, Shield, Cigarette, Droplets, Building2 } from "lucide-react"

type Page = 'home' | 'inventory' | 'alerts' | 'expiring' | 'life-saving' | 'reports' | 'vaccines' | 'strategic' | 'smoking' | 'kidney' | 'central' | 'users'

export default function HomePage() {
  const { selectedSystem, showWelcome, user, isAuthenticated, setSelectedSystem, setShowWelcome, resetWelcome, setUser, logout } = useAppStore()
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [time, setTime] = useState(new Date())
  const [checkingAuth, setCheckingAuth] = useState(true)

  // التحقق من الجلسة عند تحميل الصفحة
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/user-auth')
        const data = await res.json()
        if (data.authenticated && data.user) {
          setUser(data.user)
        }
      } catch (error) {
        console.log('Auth check error:', error)
      } finally {
        setCheckingAuth(false)
      }
    }
    checkAuth()
  }, [setUser])

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { if (selectedSystem) fetchStats() }, [selectedSystem])

  // تسجيل الزيارة
  useEffect(() => {
    if (selectedSystem && !isAdmin && isAuthenticated) {
      fetch('/api/visitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: currentPage, system: selectedSystem })
      }).catch(() => {})
    }
  }, [selectedSystem, currentPage, isAdmin, isAuthenticated])

  const fetchStats = async () => {
    if (!selectedSystem) return
    setLoading(true)
    try {
      const r = await fetch(`/api/stats?system=${selectedSystem}`)
      setStats(await r.json())
    } catch { } finally { setLoading(false) }
  }

  const handleSystemSelect = (s: 'hoz' | 'mwsal') => { 
    // التحقق من صلاحية الوصول للنظام
    if (s === 'hoz' && user?.permissions && !user.permissions.canViewHoz) {
      alert('غير مصرح لك بالوصول إلى مستودع هوز')
      return
    }
    if (s === 'mwsal' && user?.permissions && !user.permissions.canViewMwsal) {
      alert('غير مصرح لك بالوصول إلى مستودع موصول')
      return
    }
    setSelectedSystem(s)
    setCurrentPage('home')
  }

  const handleUserLogin = (userData: any) => {
    setUser(userData)
  }

  const handleUserLogout = async () => {
    try {
      await fetch('/api/user-auth', { method: 'DELETE' })
    } catch (error) {}
    logout()
    setCurrentPage('home')
  }

  const handleAdminClick = () => { 
    if (isAdmin) { 
      fetch('/api/auth', { method: 'DELETE' })
      setIsAdmin(false)
      setCurrentPage('home')
    } else {
      setShowAdminLogin(true)
    }
  }

  const handleAdminLogin = () => { 
    setShowAdminLogin(false)
    setIsAdmin(true)
    setCurrentPage('home')
  }

  const handleCardClick = (cat: string) => {
    // التحقق من الصلاحيات قبل الانتقال
    const permMap: Record<string, { perm: boolean; page: Page }> = {
      'hold': { perm: user?.permissions?.canViewAlerts ?? true, page: 'alerts' },
      'expiring': { perm: user?.permissions?.canViewExpiring ?? true, page: 'expiring' },
      'life-saving': { perm: user?.permissions?.canViewLifeSaving ?? true, page: 'life-saving' },
      'vaccine': { perm: user?.permissions?.canViewVaccines ?? true, page: 'vaccines' },
      'strategic': { perm: user?.permissions?.canViewStrategic ?? true, page: 'strategic' },
      'smoking': { perm: user?.permissions?.canViewSmoking ?? true, page: 'smoking' },
      'kidney': { perm: user?.permissions?.canViewKidney ?? true, page: 'kidney' },
      'central': { perm: user?.permissions?.canViewCentral ?? true, page: 'central' },
    }
    
    if (permMap[cat]) {
      if (!permMap[cat].perm) {
        alert('غير مصرح لك بالوصول إلى هذا القسم')
        return
      }
      setCurrentPage(permMap[cat].page)
    } else {
      setCurrentPage('inventory')
    }
  }

  const formatDate = (d: Date) => d.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const formatTime = (d: Date) => d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  // شاشة التحميل
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحقق من الجلسة...</p>
        </div>
      </div>
    )
  }

  // صفحة تسجيل الدخول
  if (!isAuthenticated) {
    if (showAdminLogin) {
      return <AdminLoginPage onLogin={handleAdminLogin} onClose={() => setShowAdminLogin(false)} />
    }
    return <LoginPage onLogin={handleUserLogin} onAdminLogin={() => setShowAdminLogin(true)} />
  }

  // صفحة اختيار النظام (مع الترحيب)
  if (!selectedSystem || showWelcome) {
    return <WelcomeDialog open={true} onSelect={handleSystemSelect} user={user} />
  }

  // صفحة الأدمن
  if (isAdmin) {
    return (
      <div className="flex min-h-screen">
        <Sidebar 
          currentPage={currentPage} 
          onPageChange={setCurrentPage} 
          selectedSystem={selectedSystem} 
          onSystemChange={resetWelcome} 
          isAdmin={isAdmin} 
          onAdminToggle={handleAdminClick}
          user={user}
        />
        <main className="flex-1 bg-gray-50">
          {currentPage === 'users' ? (
            <div className="p-6">
              <UserManagement />
            </div>
          ) : (
            <AdminPage 
              onLogout={() => { setIsAdmin(false); setCurrentPage('home') }}
              onManageUsers={() => setCurrentPage('users')}
            />
          )}
        </main>
      </div>
    )
  }

  // التحقق من صلاحية الوصول للصفحة الحالية
  const canAccessPage = (page: Page): boolean => {
    if (!user?.permissions) return true
    
    const permMap: Record<string, boolean> = {
      'inventory': user.permissions.canViewInventory,
      'alerts': user.permissions.canViewAlerts,
      'expiring': user.permissions.canViewExpiring,
      'life-saving': user.permissions.canViewLifeSaving,
      'vaccines': user.permissions.canViewVaccines,
      'strategic': user.permissions.canViewStrategic,
      'smoking': user.permissions.canViewSmoking,
      'kidney': user.permissions.canViewKidney,
      'central': user.permissions.canViewCentral,
      'reports': user.permissions.canViewReports,
    }
    
    if (page === 'home') return true
    return permMap[page] ?? true
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">لوحة التحكم</h1>
                <p className="text-gray-500">{selectedSystem === 'hoz' ? 'مستودع هوز (E200)' : 'مستودع موصول (E300)'}</p>
                {user && <p className="text-sm text-muted-foreground">مرحباً، {user.name}</p>}
              </div>
              <div className="flex items-center gap-4">
                <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0 shadow-lg">
                  <CardContent className="p-3 flex items-center gap-3">
                    <Calendar className="w-5 h-5" />
                    <div className="text-sm">
                      <p className="opacity-90">{formatDate(time)}</p>
                      <p className="font-bold font-mono text-lg">{formatTime(time)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Button onClick={fetchStats} disabled={loading} variant="outline">
                  <RefreshCw className={`w-4 h-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
                  تحديث
                </Button>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center min-h-64">
                <p className="text-gray-500">جاري التحميل...</p>
              </div>
            ) : stats ? (
              <>
                <StatsCards stats={stats} onCardClick={handleCardClick} permissions={user?.permissions} />
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3 mt-6">
                  {user?.permissions?.canViewInventory !== false && (
                    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentPage('inventory')}>
                      <CardContent className="p-3 flex flex-col items-center gap-2">
                        <Package className="w-7 h-7 text-blue-500" />
                        <p className="font-semibold text-sm">المخزون اللحظي</p>
                        <p className="text-xs text-gray-500">{stats.totalItems?.toLocaleString('ar-SA') || 0} بند</p>
                      </CardContent>
                    </Card>
                  )}
                  {user?.permissions?.canViewAlerts !== false && (
                    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentPage('alerts')}>
                      <CardContent className="p-3 flex flex-col items-center gap-2">
                        <AlertTriangle className="w-7 h-7 text-red-500" />
                        <p className="font-semibold text-sm">التنبيهات</p>
                        <p className="text-xs text-gray-500">{stats.holdItems?.toLocaleString('ar-SA') || 0} بند Hold</p>
                      </CardContent>
                    </Card>
                  )}
                  {user?.permissions?.canViewExpiring !== false && (
                    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentPage('expiring')}>
                      <CardContent className="p-3 flex flex-col items-center gap-2">
                        <Clock className="w-7 h-7 text-orange-500" />
                        <p className="font-semibold text-sm">قاربت على الانتهاء</p>
                        <p className="text-xs text-gray-500">{stats.expiringItems || 0} بند</p>
                      </CardContent>
                    </Card>
                  )}
                  {user?.permissions?.canViewLifeSaving !== false && (
                    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentPage('life-saving')}>
                      <CardContent className="p-3 flex flex-col items-center gap-2">
                        <Heart className="w-7 h-7 text-pink-500" />
                        <p className="font-semibold text-sm">المنقذة للحياة</p>
                        <p className="text-xs text-gray-500">{stats.lifeSavingItems || 0} بند</p>
                      </CardContent>
                    </Card>
                  )}
                  {user?.permissions?.canViewVaccines !== false && (
                    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentPage('vaccines')}>
                      <CardContent className="p-3 flex flex-col items-center gap-2">
                        <Syringe className="w-7 h-7 text-green-500" />
                        <p className="font-semibold text-sm">اللقاحات</p>
                        <p className="text-xs text-gray-500">{stats.vaccineItems || 0} بند</p>
                      </CardContent>
                    </Card>
                  )}
                  {user?.permissions?.canViewStrategic !== false && (
                    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentPage('strategic')}>
                      <CardContent className="p-3 flex flex-col items-center gap-2">
                        <Shield className="w-7 h-7 text-amber-500" />
                        <p className="font-semibold text-sm">الاستراتيجية</p>
                        <p className="text-xs text-gray-500">{stats.strategicItems || 0} بند</p>
                      </CardContent>
                    </Card>
                  )}
                  {user?.permissions?.canViewSmoking !== false && (
                    <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-blue-50" onClick={() => setCurrentPage('smoking')}>
                      <CardContent className="p-3 flex flex-col items-center gap-2">
                        <Cigarette className="w-7 h-7 text-blue-600" />
                        <p className="font-semibold text-sm">بنود التدخين</p>
                        <p className="text-xs text-gray-500">{stats.smokingItems || 0} بند</p>
                      </CardContent>
                    </Card>
                  )}
                  {user?.permissions?.canViewKidney !== false && (
                    <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-cyan-50" onClick={() => setCurrentPage('kidney')}>
                      <CardContent className="p-3 flex flex-col items-center gap-2">
                        <Droplets className="w-7 h-7 text-cyan-600" />
                        <p className="font-semibold text-sm">بنود الكلى</p>
                        <p className="text-xs text-gray-500">{stats.kidneyItems || 0} بند</p>
                      </CardContent>
                    </Card>
                  )}
                  {user?.permissions?.canViewCentral !== false && (
                    <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-slate-50" onClick={() => setCurrentPage('central')}>
                      <CardContent className="p-3 flex flex-col items-center gap-2">
                        <Building2 className="w-7 h-7 text-slate-600" />
                        <p className="font-semibold text-sm">البنود المركزية</p>
                        <p className="text-xs text-gray-500">{stats.centralItems || 0} بند</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-gray-500">لا توجد بيانات. يرجى رفع ملفات Excel من صفحة الأدمن.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )
      case 'inventory': 
        return canAccessPage('inventory') ? (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">المخزون اللحظي</h2>
            <InventoryTable system={selectedSystem} category="all" />
          </div>
        ) : (
          <div className="p-6"><p className="text-red-500">غير مصرح لك بالوصول إلى هذه الصفحة</p></div>
        )
      case 'alerts': 
        return canAccessPage('alerts') ? (
          <div className="p-6 space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
              التنبيهات
            </h2>
            <Card>
              <CardHeader>
                <CardTitle className="text-yellow-600">البنود عليها Hold</CardTitle>
                <CardDescription>بنود محجوبة لأسباب مختلفة</CardDescription>
              </CardHeader>
              <CardContent>
                <InventoryTable system={selectedSystem} category="hold" />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="p-6"><p className="text-red-500">غير مصرح لك بالوصول إلى هذه الصفحة</p></div>
        )
      case 'expiring': 
        return canAccessPage('expiring') ? (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Clock className="w-6 h-6 text-orange-500" />
              البنود قاربت على الانتهاء (أقل من 90 يوم)
            </h2>
            <InventoryTable system={selectedSystem} category="expiring" />
          </div>
        ) : (
          <div className="p-6"><p className="text-red-500">غير مصرح لك بالوصول إلى هذه الصفحة</p></div>
        )
      case 'life-saving': 
        return canAccessPage('life-saving') ? (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Heart className="w-6 h-6 text-pink-500" />
              البنود المنقذة للحياة
            </h2>
            <InventoryTable system={selectedSystem} category="life_saving" />
          </div>
        ) : (
          <div className="p-6"><p className="text-red-500">غير مصرح لك بالوصول إلى هذه الصفحة</p></div>
        )
      case 'vaccines': 
        return canAccessPage('vaccines') ? (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Syringe className="w-6 h-6 text-green-500" />
              اللقاحات
            </h2>
            <InventoryTable system={selectedSystem} category="vaccine" />
          </div>
        ) : (
          <div className="p-6"><p className="text-red-500">غير مصرح لك بالوصول إلى هذه الصفحة</p></div>
        )
      case 'strategic': 
        return canAccessPage('strategic') ? (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Shield className="w-6 h-6 text-amber-500" />
              البنود الاستراتيجية
            </h2>
            <InventoryTable system={selectedSystem} category="strategic" />
          </div>
        ) : (
          <div className="p-6"><p className="text-red-500">غير مصرح لك بالوصول إلى هذه الصفحة</p></div>
        )
      case 'smoking': 
        return canAccessPage('smoking') ? (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Cigarette className="w-6 h-6 text-blue-600" />
              بنود التدخين
            </h2>
            <InventoryTable system={selectedSystem} category="smoking" />
          </div>
        ) : (
          <div className="p-6"><p className="text-red-500">غير مصرح لك بالوصول إلى هذه الصفحة</p></div>
        )
      case 'kidney': 
        return canAccessPage('kidney') ? (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Droplets className="w-6 h-6 text-cyan-600" />
              بنود الكلى
            </h2>
            <InventoryTable system={selectedSystem} category="kidney" />
          </div>
        ) : (
          <div className="p-6"><p className="text-red-500">غير مصرح لك بالوصول إلى هذه الصفحة</p></div>
        )
      case 'central': 
        return canAccessPage('central') ? (
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-slate-600" />
              البنود المركزية
            </h2>
            <InventoryTable system={selectedSystem} category="central" />
          </div>
        ) : (
          <div className="p-6"><p className="text-red-500">غير مصرح لك بالوصول إلى هذه الصفحة</p></div>
        )
      case 'reports': 
        return canAccessPage('reports') ? (
          <ReportsPage system={selectedSystem} />
        ) : (
          <div className="p-6"><p className="text-red-500">غير مصرح لك بالوصول إلى هذه الصفحة</p></div>
        )
      default: 
        return null
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar 
        currentPage={currentPage} 
        onPageChange={setCurrentPage} 
        selectedSystem={selectedSystem} 
        onSystemChange={resetWelcome} 
        isAdmin={isAdmin} 
        onAdminToggle={handleAdminClick}
        user={user}
        onLogout={handleUserLogout}
      />
      <main className="flex-1 bg-gray-50 overflow-auto">{renderPage()}</main>
    </div>
  )
}
