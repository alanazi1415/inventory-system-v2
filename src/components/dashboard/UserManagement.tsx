'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Users, UserPlus, Edit2, Trash2, Save, X, Check, Package, AlertTriangle, Clock, 
  Heart, Syringe, Shield, Cigarette, Droplets, Building2, FileText, Database
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Permission {
  key: string
  label: string
  icon: any
}

const PERMISSIONS: Permission[] = [
  { key: 'canViewInventory', label: 'المخزون اللحظي', icon: Package },
  { key: 'canViewAlerts', label: 'التنبيهات', icon: AlertTriangle },
  { key: 'canViewExpiring', label: 'قاربت على الانتهاء', icon: Clock },
  { key: 'canViewLifeSaving', label: 'المنقذة للحياة', icon: Heart },
  { key: 'canViewVaccines', label: 'اللقاحات', icon: Syringe },
  { key: 'canViewStrategic', label: 'الاستراتيجية', icon: Shield },
  { key: 'canViewSmoking', label: 'بنود التدخين', icon: Cigarette },
  { key: 'canViewKidney', label: 'بنود الكلى', icon: Droplets },
  { key: 'canViewCentral', label: 'البنود المركزية', icon: Building2 },
  { key: 'canViewReports', label: 'التقارير', icon: FileText },
]

const SYSTEM_PERMISSIONS: Permission[] = [
  { key: 'canViewHoz', label: 'مستودع هوز', icon: Database },
  { key: 'canViewMwsal', label: 'مستودع موصول', icon: Database },
]

interface User {
  id: string
  username: string
  name: string
  isActive: boolean
  canViewInventory: boolean
  canViewAlerts: boolean
  canViewExpiring: boolean
  canViewLifeSaving: boolean
  canViewVaccines: boolean
  canViewStrategic: boolean
  canViewSmoking: boolean
  canViewKidney: boolean
  canViewCentral: boolean
  canViewReports: boolean
  canViewHoz: boolean
  canViewMwsal: boolean
  createdAt: string
}

export function UserManagement() {
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    isActive: true,
    canViewInventory: true,
    canViewAlerts: true,
    canViewExpiring: true,
    canViewLifeSaving: true,
    canViewVaccines: true,
    canViewStrategic: true,
    canViewSmoking: true,
    canViewKidney: true,
    canViewCentral: true,
    canViewReports: true,
    canViewHoz: true,
    canViewMwsal: true,
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (data.users) setUsers(data.users)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      name: '',
      isActive: true,
      canViewInventory: true,
      canViewAlerts: true,
      canViewExpiring: true,
      canViewLifeSaving: true,
      canViewVaccines: true,
      canViewStrategic: true,
      canViewSmoking: true,
      canViewKidney: true,
      canViewCentral: true,
      canViewReports: true,
      canViewHoz: true,
      canViewMwsal: true,
    })
    setEditingUser(null)
    setShowForm(false)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      username: user.username,
      password: '',
      name: user.name,
      isActive: user.isActive,
      canViewInventory: user.canViewInventory,
      canViewAlerts: user.canViewAlerts,
      canViewExpiring: user.canViewExpiring,
      canViewLifeSaving: user.canViewLifeSaving,
      canViewVaccines: user.canViewVaccines,
      canViewStrategic: user.canViewStrategic,
      canViewSmoking: user.canViewSmoking,
      canViewKidney: user.canViewKidney,
      canViewCentral: user.canViewCentral,
      canViewReports: user.canViewReports,
      canViewHoz: user.canViewHoz,
      canViewMwsal: user.canViewMwsal,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formData.username || !formData.name) {
      toast({ title: "خطأ", description: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" })
      return
    }
    
    if (!editingUser && !formData.password) {
      toast({ title: "خطأ", description: "يرجى إدخال كلمة المرور للمستخدم الجديد", variant: "destructive" })
      return
    }

    try {
      const url = '/api/users'
      const method = editingUser ? 'PUT' : 'POST'
      const body = editingUser 
        ? { ...formData, id: editingUser.id }
        : formData

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()

      if (data.success) {
        toast({ title: "تم الحفظ", description: editingUser ? "تم تحديث المستخدم بنجاح" : "تم إنشاء المستخدم بنجاح" })
        resetForm()
        fetchUsers()
      } else {
        toast({ title: "خطأ", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "خطأ", description: "حدث خطأ في الاتصال", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return

    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast({ title: "تم الحذف", description: "تم حذف المستخدم بنجاح" })
        fetchUsers()
      }
    } catch (error) {
      toast({ title: "خطأ", description: "حدث خطأ في الحذف", variant: "destructive" })
    }
  }

  const togglePermission = (key: string) => {
    setFormData(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))
  }

  const toggleAllPermissions = (value: boolean) => {
    setFormData(prev => ({
      ...prev,
      canViewInventory: value,
      canViewAlerts: value,
      canViewExpiring: value,
      canViewLifeSaving: value,
      canViewVaccines: value,
      canViewStrategic: value,
      canViewSmoking: value,
      canViewKidney: value,
      canViewCentral: value,
      canViewReports: value,
      canViewHoz: value,
      canViewMwsal: value,
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            إدارة المستخدمين
          </h2>
          <p className="text-gray-500">إنشاء وتعديل المستخدمين والصلاحيات</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <UserPlus className="w-4 h-4 ml-2" />
            مستخدم جديد
          </Button>
        )}
      </div>

      {/* User Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingUser ? 'تعديل مستخدم' : 'مستخدم جديد'}</CardTitle>
            <CardDescription>
              {editingUser ? 'تعديل بيانات المستخدم والصلاحيات' : 'إنشاء مستخدم جديد مع الصلاحيات'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">اسم المستخدم</label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="مثال: user1"
                  disabled={!!editingUser}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">الاسم الظاهر</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: مركز صحي الشمال"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  كلمة المرور {editingUser && '(اتركها فارغة للإبقاء على القديمة)'}
                </label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="كلمة المرور"
                />
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">حالة الحساب:</label>
              <button
                onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  formData.isActive 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                {formData.isActive ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                {formData.isActive ? 'مفعل' : 'معطل'}
              </button>
            </div>

            {/* Systems Permissions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">المستودعات المتاحة:</label>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {SYSTEM_PERMISSIONS.map((perm) => {
                  const Icon = perm.icon
                  const isActive = formData[perm.key as keyof typeof formData] as boolean
                  return (
                    <button
                      key={perm.key}
                      onClick={() => togglePermission(perm.key)}
                      className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-colors ${
                        isActive 
                          ? 'border-green-500 bg-green-50 text-green-700' 
                          : 'border-gray-200 bg-gray-50 text-gray-500'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm">{perm.label}</span>
                      {isActive ? <Check className="w-4 h-4 mr-auto" /> : <X className="w-4 h-4 mr-auto" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Categories Permissions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">صلاحيات العرض:</label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleAllPermissions(true)}>
                    تحديد الكل
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleAllPermissions(false)}>
                    إلغاء الكل
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {PERMISSIONS.map((perm) => {
                  const Icon = perm.icon
                  const isActive = formData[perm.key as keyof typeof formData] as boolean
                  return (
                    <button
                      key={perm.key}
                      onClick={() => togglePermission(perm.key)}
                      className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-colors ${
                        isActive 
                          ? 'border-green-500 bg-green-50 text-green-700' 
                          : 'border-gray-200 bg-gray-50 text-gray-500'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm">{perm.label}</span>
                      {isActive ? <Check className="w-4 h-4 mr-auto" /> : <X className="w-4 h-4 mr-auto" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 ml-2" />
                حفظ
              </Button>
              <Button variant="outline" onClick={resetForm}>
                <X className="w-4 h-4 ml-2" />
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة المستخدمين ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-gray-500 py-8">جاري التحميل...</p>
          ) : users.length === 0 ? (
            <p className="text-center text-gray-500 py-8">لا يوجد مستخدمين. قم بإنشاء مستخدم جديد.</p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.name}</span>
                        <Badge variant={user.isActive ? "default" : "destructive"} className="text-xs">
                          {user.isActive ? 'مفعل' : 'معطل'}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        {user.username} • {user.canViewHoz ? 'هوز' : ''} {user.canViewHoz && user.canViewMwsal ? ' | ' : ''} {user.canViewMwsal ? 'موصول' : ''}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {PERMISSIONS.filter(p => user[p.key as keyof User] === true).map(p => (
                          <Badge key={p.key} variant="outline" className="text-xs">
                            {p.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(user.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
