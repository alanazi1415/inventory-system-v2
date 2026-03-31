'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { WelcomeDialog } from '@/components/dashboard/WelcomeDialog'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { InventoryTable } from '@/components/dashboard/InventoryTable'
import { AdminLoginPage } from '@/components/dashboard/AdminLoginPage'
import { AdminPage } from '@/components/dashboard/AdminPage'
import { ReportsPage } from '@/components/dashboard/ReportsPage'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Clock, Heart, Package, RefreshCw, Calendar, Syringe, Shield, Cigarette, Droplets, Building2 } from "lucide-react"

type Page = 'home' | 'inventory' | 'alerts' | 'expiring' | 'life-saving' | 'reports' | 'vaccines' | 'strategic' | 'smoking' | 'kidney' | 'central'

export default function HomePage() {
  const { selectedSystem, showWelcome, setSelectedSystem, setShowWelcome, resetWelcome } = useAppStore()
  const [currentPage, setCurrentPage] = useState<Page>('home')
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [time, setTime] = useState(new Date())

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { if (selectedSystem) fetchStats() }, [selectedSystem])

  // تسجيل الزيارة
  useEffect(() => {
    if (selectedSystem && !isAdmin) {
      fetch('/api/visitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: currentPage, system: selectedSystem })
      }).catch(() => {})
    }
  }, [selectedSystem, currentPage, isAdmin])

  const fetchStats = async () => {
    if (!selectedSystem) return
    setLoading(true)
    try {
      const r = await fetch(`/api/stats?system=${selectedSystem}`)
      setStats(await r.json())
    } catch { } finally { setLoading(false) }
  }

  const handleSystemSelect = (s: 'hoz' | 'mwsal') => { setSelectedSystem(s); setCurrentPage('home') }
  const handleAdminClick = () => { if (isAdmin) { fetch('/api/auth', { method: 'DELETE' }); setIsAdmin(false); setCurrentPage('home') } else setShowAdminLogin(true) }
  const handleAdminLogin = () => { setShowAdminLogin(false); setIsAdmin(true) }
  const handleCardClick = (cat: string) => {
    if (cat === 'hold') setCurrentPage('alerts')
    else if (cat === 'expiring') setCurrentPage('expiring')
    else if (cat === 'life-saving') setCurrentPage('life-saving')
    else if (cat === 'vaccine') setCurrentPage('vaccines')
    else if (cat === 'strategic') setCurrentPage('strategic')
    else if (cat === 'smoking') setCurrentPage('smoking')
    else if (cat === 'kidney') setCurrentPage('kidney')
    else if (cat === 'central') setCurrentPage('central')
    else setCurrentPage('inventory')
  }

  const formatDate = (d: Date) => d.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const formatTime = (d: Date) => d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  if (!selectedSystem || showWelcome) return <WelcomeDialog open={true} onSelect={handleSystemSelect} />
  if (showAdminLogin) return <AdminLoginPage onLogin={handleAdminLogin} onClose={() => setShowAdminLogin(false)} />
  if (isAdmin) return <div className="flex min-h-screen"><Sidebar currentPage={currentPage} onPageChange={setCurrentPage} selectedSystem={selectedSystem} onSystemChange={resetWelcome} isAdmin={isAdmin} onAdminToggle={handleAdminClick} /><main className="flex-1 bg-gray-50"><AdminPage onLogout={() => { setIsAdmin(false); setCurrentPage('home') }} /></main></div>

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><h1 className="text-2xl font-bold">لوحة التحكم</h1><p className="text-gray-500">{selectedSystem === 'hoz' ? 'مستودع هوز (E200)' : 'مستودع موصول (E300)'}</p></div>
              <div className="flex items-center gap-4">
                <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0 shadow-lg">
                  <CardContent className="p-3 flex items-center gap-3"><Calendar className="w-5 h-5" /><div className="text-sm"><p className="opacity-90">{formatDate(time)}</p><p className="font-bold font-mono text-lg">{formatTime(time)}</p></div></CardContent>
                </Card>
                <Button onClick={fetchStats} disabled={loading} variant="outline"><RefreshCw className={`w-4 h-4 ml-2 ${loading ? 'animate-spin' : ''}`} />تحديث</Button>
              </div>
            </div>
            {loading ? <div className="flex items-center justify-center min-h-64"><p className="text-gray-500">جاري التحميل...</p></div> : stats ? (
              <>
                <StatsCards stats={stats} onCardClick={handleCardClick} />
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3 mt-6">
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentPage('inventory')}><CardContent className="p-3 flex flex-col items-center gap-2"><Package className="w-7 h-7 text-blue-500" /><p className="font-semibold text-sm">المخزون اللحظي</p><p className="text-xs text-gray-500">{stats.totalItems?.toLocaleString('ar-SA') || 0} بند</p></CardContent></Card>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentPage('alerts')}><CardContent className="p-3 flex flex-col items-center gap-2"><AlertTriangle className="w-7 h-7 text-red-500" /><p className="font-semibold text-sm">التنبيهات</p><p className="text-xs text-gray-500">{stats.holdItems?.toLocaleString('ar-SA') || 0} بند Hold</p></CardContent></Card>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentPage('expiring')}><CardContent className="p-3 flex flex-col items-center gap-2"><Clock className="w-7 h-7 text-orange-500" /><p className="font-semibold text-sm">قاربت على الانتهاء</p><p className="text-xs text-gray-500">{stats.expiringItems || 0} بند</p></CardContent></Card>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentPage('life-saving')}><CardContent className="p-3 flex flex-col items-center gap-2"><Heart className="w-7 h-7 text-pink-500" /><p className="font-semibold text-sm">المنقذة للحياة</p><p className="text-xs text-gray-500">{stats.lifeSavingItems || 0} بند</p></CardContent></Card>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentPage('vaccines')}><CardContent className="p-3 flex flex-col items-center gap-2"><Syringe className="w-7 h-7 text-green-500" /><p className="font-semibold text-sm">اللقاحات</p><p className="text-xs text-gray-500">{stats.vaccineItems || 0} بند</p></CardContent></Card>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentPage('strategic')}><CardContent className="p-3 flex flex-col items-center gap-2"><Shield className="w-7 h-7 text-amber-500" /><p className="font-semibold text-sm">الاستراتيجية</p><p className="text-xs text-gray-500">{stats.strategicItems || 0} بند</p></CardContent></Card>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-blue-50" onClick={() => setCurrentPage('smoking')}><CardContent className="p-3 flex flex-col items-center gap-2"><Cigarette className="w-7 h-7 text-blue-600" /><p className="font-semibold text-sm">بنود التدخين</p><p className="text-xs text-gray-500">{stats.smokingItems || 0} بند</p></CardContent></Card>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-cyan-50" onClick={() => setCurrentPage('kidney')}><CardContent className="p-3 flex flex-col items-center gap-2"><Droplets className="w-7 h-7 text-cyan-600" /><p className="font-semibold text-sm">بنود الكلى</p><p className="text-xs text-gray-500">{stats.kidneyItems || 0} بند</p></CardContent></Card>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-slate-50" onClick={() => setCurrentPage('central')}><CardContent className="p-3 flex flex-col items-center gap-2"><Building2 className="w-7 h-7 text-slate-600" /><p className="font-semibold text-sm">البنود المركزية</p><p className="text-xs text-gray-500">{stats.centralItems || 0} بند</p></CardContent></Card>
                </div>
              </>
            ) : <Card><CardContent className="p-8 text-center"><p className="text-gray-500">لا توجد بيانات. يرجى رفع ملفات Excel من صفحة الأدمن.</p></CardContent></Card>}
          </div>
        )
      case 'inventory': return <div className="p-6"><h2 className="text-2xl font-bold mb-4">المخزون اللحظي</h2><InventoryTable system={selectedSystem} category="all" /></div>
      case 'alerts': return (
        <div className="p-6 space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2"><AlertTriangle className="w-6 h-6 text-yellow-500" />التنبيهات</h2>
          <Card><CardHeader><CardTitle className="text-yellow-600">البنود عليها Hold</CardTitle><CardDescription>بنود محجوبة لأسباب مختلفة</CardDescription></CardHeader><CardContent><InventoryTable system={selectedSystem} category="hold" /></CardContent></Card>
        </div>
      )
      case 'expiring': return <div className="p-6"><h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Clock className="w-6 h-6 text-orange-500" />البنود قاربت على الانتهاء (أقل من 90 يوم)</h2><InventoryTable system={selectedSystem} category="expiring" /></div>
      case 'life-saving': return <div className="p-6"><h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Heart className="w-6 h-6 text-pink-500" />البنود المنقذة للحياة</h2><InventoryTable system={selectedSystem} category="life_saving" /></div>
      case 'vaccines': return <div className="p-6"><h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Syringe className="w-6 h-6 text-green-500" />اللقاحات</h2><InventoryTable system={selectedSystem} category="vaccine" /></div>
      case 'strategic': return <div className="p-6"><h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Shield className="w-6 h-6 text-amber-500" />البنود الاستراتيجية</h2><InventoryTable system={selectedSystem} category="strategic" /></div>
      case 'smoking': return <div className="p-6"><h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Cigarette className="w-6 h-6 text-blue-600" />بنود التدخين</h2><InventoryTable system={selectedSystem} category="smoking" /></div>
      case 'kidney': return <div className="p-6"><h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Droplets className="w-6 h-6 text-cyan-600" />بنود الكلى</h2><InventoryTable system={selectedSystem} category="kidney" /></div>
      case 'central': return <div className="p-6"><h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Building2 className="w-6 h-6 text-slate-600" />البنود المركزية</h2><InventoryTable system={selectedSystem} category="central" /></div>
      case 'reports': return <ReportsPage system={selectedSystem} />
      default: return null
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} selectedSystem={selectedSystem} onSystemChange={resetWelcome} isAdmin={isAdmin} onAdminToggle={handleAdminClick} />
      <main className="flex-1 bg-gray-50 overflow-auto">{renderPage()}</main>
    </div>
  )
}
