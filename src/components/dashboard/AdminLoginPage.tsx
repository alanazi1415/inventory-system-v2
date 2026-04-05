'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Lock, User, X } from "lucide-react"

interface AdminLoginPageProps { onLogin: () => void; onClose: () => void }

export function AdminLoginPage({ onLogin, onClose }: AdminLoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
      const data = await res.json()
      if (data.success) onLogin()
      else setError(data.error || 'بيانات الدخول غير صحيحة')
    } catch { setError('حدث خطأ في الاتصال') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="relative">
          <button onClick={onClose} className="absolute left-4 top-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          <CardTitle className="text-center text-2xl">تسجيل دخول الأدمن</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">اسم المستخدم</label>
            <div className="relative">
              <User className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
              <Input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" className="pr-10" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pr-10" onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
            </div>
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <Button className="w-full" onClick={handleLogin} disabled={loading}>{loading ? 'جاري التحقق...' : 'دخول'}</Button>
        </CardContent>
      </Card>
    </div>
  )
}
