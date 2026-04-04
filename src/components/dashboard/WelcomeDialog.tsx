'use client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Building2, Truck, User } from "lucide-react"

interface UserPermissions {
  canViewHoz: boolean
  canViewMwsal: boolean
}

interface UserInfo {
  id: string
  name: string
  permissions: UserPermissions
}

interface WelcomeDialogProps { 
  open: boolean
  onSelect: (system: 'hoz' | 'mwsal') => void
  user?: UserInfo | null
}

export function WelcomeDialog({ open, onSelect, user }: WelcomeDialogProps) {
  if (!open) return null

  const canViewHoz = user?.permissions?.canViewHoz ?? true
  const canViewMwsal = user?.permissions?.canViewMwsal ?? true
  const availableSystems = (canViewHoz ? 1 : 0) + (canViewMwsal ? 1 : 0)

  // إذا كان هناك نظام واحد متاح فقط، اختره تلقائياً
  if (availableSystems === 1) {
    if (canViewHoz) {
      setTimeout(() => onSelect('hoz'), 100)
    } else if (canViewMwsal) {
      setTimeout(() => onSelect('mwsal'), 100)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center space-y-4">
          <CardTitle className="text-3xl font-bold text-gray-800">مرحباً بكم في نظام دراسة المخزون</CardTitle>
          {user && (
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <User className="w-5 h-5" />
              <span className="text-lg font-medium">{user.name}</span>
            </div>
          )}
          <CardDescription className="text-lg">عايد حمود العنزي - مدير التخطيط</CardDescription>
          <p className="text-sm text-muted-foreground">إعداد: عبدالله فرحان العنزي - موظف نوبكو</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-gray-600">يرجى اختيار النظام للمتابعة</p>
          <div className="grid md:grid-cols-2 gap-4">
            {canViewHoz && (
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-2 hover:border-blue-500" 
                onClick={() => onSelect('hoz')}
              >
                <CardContent className="p-6 text-center">
                  <Building2 className="w-16 h-16 mx-auto mb-4 text-blue-500" />
                  <h3 className="text-xl font-bold mb-2">هوز (E200)</h3>
                  <p className="text-gray-500">مستودع هوز</p>
                </CardContent>
              </Card>
            )}
            {canViewMwsal && (
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-2 hover:border-green-500" 
                onClick={() => onSelect('mwsal')}
              >
                <CardContent className="p-6 text-center">
                  <Truck className="w-16 h-16 mx-auto mb-4 text-green-500" />
                  <h3 className="text-xl font-bold mb-2">موصول (E300)</h3>
                  <p className="text-gray-500">مستودع موصول</p>
                </CardContent>
              </Card>
            )}
          </div>
          {!canViewHoz && !canViewMwsal && (
            <div className="text-center text-red-500 p-4 bg-red-50 rounded-lg">
              <p>غير مصرح لك بالوصول إلى أي نظام</p>
              <p className="text-sm text-gray-500 mt-2">يرجى التواصل مع المشرف</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
