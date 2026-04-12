'use client'
import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  TrendingUp, Upload, Search, Filter, 
  Package, Activity, BarChart3, PieChart as PieChartIcon, RefreshCw,
  Flame, Zap, Clock, Snowflake, Download, Link2, Database, Settings,
  Edit3, Save, X, Info, Calendar, Layers
} from "lucide-react"
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { MovementSettings } from './MovementSettings'

interface MovementItem {
  id: string
  genericItemNumber: string
  description: string | null
  system: string
  totalQtyDispatched: number
  transactionCount: number
  avgQtyPerTransaction: number
  firstDispatchDate: string | null
  lastDispatchDate: string | null
  daysSpan: number
  autoMovementClass: string
  userMovementClass: string | null
  effectiveMovementClass: string
  isUserClassified: boolean
  movementScore: number
  daysSinceLastDispatch: number | null
  batchCount: number
  uniqueExpiryDates: number
  uniqueOrders: number
  currentStock: number
  availableStock: number
  notes: string | null
}

interface ClassCount {
  class: string
  count: number
}

interface Stats {
  totalItems: number
  totalQtyDispatched: number
  totalTransactions: number
}

const MOVEMENT_COLORS = {
  'سريع جداً': '#ef4444',
  'سريع': '#f97316',
  'متوسط': '#eab308',
  'بطيء': '#3b82f6',
  'عديم الحركة': '#6b7280'
}

const PERIOD_OPTIONS = [
  { value: 0, label: 'جميع الفترات' },
  { value: 30, label: 'آخر شهر' },
  { value: 60, label: 'آخر شهرين' },
  { value: 90, label: 'آخر 3 أشهر' },
  { value: 180, label: 'آخر 6 أشهر' },
  { value: 365, label: 'آخر سنة' },
]

// تحليل الأعمدة بشكل ذكي
function analyzeColumns(headers: string[]) {
  const result = {
    itemNumberCol: -1,
    qtyCol: -1,
    dateCol: -1,
    descCol: -1,
    batchCol: -1,
    expiryCol: -1,
    orderCol: -1,
  }
  
  const itemNumberKeywords = ['generic item number', 'item number', 'generic', 'رقم البند', 'كود']
  const qtyKeywords = ['pick qty', 'quantity', 'qty', 'الكمية', 'صرف']
  const descKeywords = ['description', 'وصف', 'trade description', 'name']
  const batchKeywords = ['batch', 'lot', 'تشغيلة', 'رقم التشغيلة']
  const expiryKeywords = ['best before', 'expiry', 'انتهاء', 'تاريخ الانتهاء']
  const orderKeywords = ['sales order', 'order number', 'رقم الطلب', 'أمر البيع']
  // Confirm Date هو المفضل للحسابات (العمود Q)
  const preferredDateKeywords = ['confirm date', 'تاريخ التأكيد']
  const secondaryDateKeywords = ['date of creation', 'creation date', 'تاريخ الإنشاء', 'تاريخ الصرف']
  const excludeDateKeywords = ['best before', 'expiry', 'expiration', 'انتهاء', 'production']
  const genericDateKeywords = ['date', 'تاريخ']

  headers.forEach((header, index) => {
    const h = String(header).toLowerCase().trim()
    if (result.itemNumberCol === -1 && itemNumberKeywords.some(k => h.includes(k))) result.itemNumberCol = index
    if (result.qtyCol === -1 && qtyKeywords.some(k => h.includes(k))) result.qtyCol = index
    if (result.descCol === -1 && descKeywords.some(k => h.includes(k))) result.descCol = index
    if (result.batchCol === -1 && batchKeywords.some(k => h.includes(k))) result.batchCol = index
    if (result.expiryCol === -1 && expiryKeywords.some(k => h.includes(k))) result.expiryCol = index
    if (result.orderCol === -1 && orderKeywords.some(k => h.includes(k))) result.orderCol = index
  })

  // البحث عن عامود Confirm Date أولاً (المفضل للحسابات)
  headers.forEach((header, index) => {
    const h = String(header).toLowerCase().trim()
    if (preferredDateKeywords.some(k => h === k || h.includes(k))) {
      result.dateCol = index
      return
    }
  })

  // إذا لم يوجد Confirm Date، ابحث عن Date Of Creation
  if (result.dateCol === -1) {
    headers.forEach((header, index) => {
      if (result.dateCol !== -1) return
      const h = String(header).toLowerCase().trim()
      if (secondaryDateKeywords.some(k => h === k || h.includes(k))) {
        result.dateCol = index
        return
      }
    })
  }

  // البحث عن عامود تاريخ عام
  if (result.dateCol === -1) {
    headers.forEach((header, index) => {
      if (result.dateCol !== -1) return
      const h = String(header).toLowerCase().trim()
      if (excludeDateKeywords.some(k => h.includes(k))) return
      if (genericDateKeywords.some(k => h.includes(k))) {
        result.dateCol = index
      }
    })
  }
  
  return result
}

interface MovementPageProps {
  system: 'hoz' | 'mwsal'
}

type TabType = 'analysis' | 'settings'

export function MovementPage({ system }: MovementPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>('analysis')
  const [items, setItems] = useState<MovementItem[]>([])
  const [classCounts, setClassCounts] = useState<ClassCount[]>([])
  const [stats, setStats] = useState<Stats>({ totalItems: 0, totalQtyDispatched: 0, totalTransactions: 0 })
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [uploadPercent, setUploadPercent] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedClass, setSelectedClass] = useState<string>('all')
  const [selectedPeriod, setSelectedPeriod] = useState(90)
  const [settingsLoaded, setSettingsLoaded] = useState(false) // هل تم تحميل الإعدادات
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [updatingStock, setUpdatingStock] = useState(false)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editClass, setEditClass] = useState<string>('')
  const [editNotes, setEditNotes] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const pageSize = 50
  const systemName = system === 'hoz' ? 'مستودع هوز' : 'مستودع موصول'

  const fetchData = async () => {
    setLoading(true)
    try {
      const offset = (page - 1) * pageSize
      let url = `/api/movement?system=${system}&limit=${pageSize}&offset=${offset}`
      if (selectedClass !== 'all') url += `&class=${encodeURIComponent(selectedClass)}`
      if (search) url += `&search=${encodeURIComponent(search)}`
      if (selectedPeriod > 0) url += `&periodDays=${selectedPeriod}`
      
      const res = await fetch(url)
      const data = await res.json()
      
      if (res.ok && data.items) {
        setItems(data.items)
        setTotal(data.total)
        setClassCounts(data.classCounts || [])
        setStats(data.stats || { totalItems: 0, totalQtyDispatched: 0, totalTransactions: 0 })
      } else if (data.error) {
        console.error('API error:', data.error, data.details)
        setUploadMessage({ type: 'error', text: `خطأ: ${data.error}\n${data.details || ''}` })
      }
    } catch (error) {
      console.error('Error fetching movement data:', error)
      setUploadMessage({ type: 'error', text: 'حدث خطأ في جلب البيانات' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'analysis') {
      fetchData()
    }
  }, [system, page, selectedClass, selectedPeriod, activeTab])

  // تحميل الإعدادات المحفوظة عند فتح الصفحة أو الرجوع من الإعدادات
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch(`/api/movement/thresholds?system=${system}`)
        const data = await res.json()
        if (data.success && data.thresholds) {
          const newPeriod = data.thresholds.defaultAnalysisPeriod || 90
          if (newPeriod !== selectedPeriod) {
            setSelectedPeriod(newPeriod)
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error)
      } finally {
        setSettingsLoaded(true)
      }
    }
    loadSettings()
  }, [system, activeTab]) // إضافة activeTab للتحديث عند الرجوع من الإعدادات

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchData()
      } else {
        setPage(1)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  // مزامنة البنود من المخزون
  const handleSync = async () => {
    setSyncing(true)
    setUploadMessage(null)

    try {
      const res = await fetch('/api/movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system,
          syncInventory: true,
          analysisPeriodDays: selectedPeriod
        })
      })

      // التحقق من أن الـ response هو JSON
      const contentType = res.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text()
        throw new Error(`خطأ في الخادم: ${text.substring(0, 100)}...`)
      }

      const data = await res.json()

      if (data.success) {
        const stats = data.stats
        let msg = `✅ تمت المزامنة بنجاح\n\n`
        msg += `📊 الإحصائيات:\n`
        msg += `• البنود في المخزون: ${stats.uniqueNumbers || stats.totalInventoryItems}\n`
        msg += `• بنود عديمة الحركة للإضافة: ${stats.withoutMovement}\n`
        msg += `• تمت الإضافة: ${stats.added}\n`
        msg += `• تم التحديث: ${stats.updated}\n`
        setUploadMessage({ type: 'success', text: msg })
        fetchData()
      } else {
        setUploadMessage({ type: 'error', text: data.error || 'حدث خطأ في المزامنة' })
      }
    } catch (error: any) {
      setUploadMessage({ type: 'error', text: `حدث خطأ: ${error.message}` })
    } finally {
      setSyncing(false)
    }
  }

  // تحديث المخزون من InventoryItem
  const handleUpdateStock = async () => {
    setUpdatingStock(true)
    setUploadMessage(null)

    try {
      const res = await fetch('/api/movement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system,
          updateStock: true
        })
      })

      const contentType = res.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text()
        throw new Error(`خطأ في الخادم: ${text.substring(0, 100)}...`)
      }

      const data = await res.json()

      if (data.success) {
        setUploadMessage({ 
          type: 'success', 
          text: `✅ تم تحديث المخزون بنجاح\n📦 تم تحديث ${data.stats?.updatedItems || 0} بند` 
        })
        fetchData()
      } else {
        setUploadMessage({ type: 'error', text: data.error || 'حدث خطأ في تحديث المخزون' })
      }
    } catch (error: any) {
      setUploadMessage({ type: 'error', text: `حدث خطأ: ${error.message}` })
    } finally {
      setUpdatingStock(false)
    }
  }

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/export/movement?system=${system}&category=all`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'فشل التصدير')
      }
      const blob = await res.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      const systemNameExport = system === 'hoz' ? 'هوز' : 'موصول'
      const date = new Date().toISOString().split('T')[0]
      link.download = `تحليل_الحركة_${systemNameExport}_${date}.xlsx`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (error: any) {
      alert('حدث خطأ أثناء التصدير: ' + error.message)
    } finally {
      setExporting(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const confirmMsg = `سيتم رفع التقرير إلى: ${systemName}\n\nهل أنت متأكد أن هذا التقرير يخص ${systemName}؟`
    if (!confirm(confirmMsg)) {
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploading(true)
    setUploadMessage(null)
    setUploadProgress('جاري قراءة الملف...')
    setUploadPercent(0)

    try {
      const XLSX = await import('xlsx')
      setUploadProgress('جاري تحليل البيانات...')
      setUploadPercent(5)

      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

      if (rawData.length < 2) {
        setUploadMessage({ type: 'error', text: 'الملف فارغ أو لا يحتوي بيانات' })
        setUploading(false)
        setUploadPercent(0)
        return
      }

      // تحليل الأعمدة
      const headers = rawData[0] as string[]
      const colMap = analyzeColumns(headers)

      if (colMap.itemNumberCol === -1 || colMap.qtyCol === -1) {
        setUploadMessage({ type: 'error', text: 'لم يتم العثور على أعمدة مطلوبة (رقم البند / الكمية)' })
        setUploading(false)
        setUploadPercent(0)
        return
      }

      setUploadProgress('جاري تجميع البيانات...')
      setUploadPercent(10)

      // تجميع البيانات حسب رقم البند
      const movementMap = new Map<string, {
        totalQty: number
        transactionCount: number
        description: string
        dates: string[]
        batches: Set<string>
        expiryDates: Set<string>
        orders: Set<string>
      }>()

      let dateFrom: string | null = null
      let dateTo: string | null = null
      const totalRows = rawData.length - 1
      
      // حساب تاريخ البداية للفلترة حسب الفترة المحددة في الإعدادات
      const today = new Date()
      today.setHours(0, 0, 0, 0) // تصفير الوقت للمقارنة الدقيقة
      const cutoffDate = selectedPeriod > 0 
        ? new Date(today.getTime() - (selectedPeriod * 24 * 60 * 60 * 1000))
        : null
      
      if (cutoffDate) {
        cutoffDate.setHours(0, 0, 0, 0) // تصفير الوقت للمقارنة الدقيقة
      }
      
      let filteredRows = 0
      let skippedRows = 0

      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i]
        if (!row || row.length === 0) continue

        const itemNumber = String(row[colMap.itemNumberCol] || '').trim()
        const qty = parseFloat(row[colMap.qtyCol]) || 0

        if (!itemNumber || qty <= 0) continue

        const description = colMap.descCol !== -1 ? String(row[colMap.descCol] || '') : ''
        const batch = colMap.batchCol !== -1 ? String(row[colMap.batchCol] || '') : ''
        const expiry = colMap.expiryCol !== -1 ? String(row[colMap.expiryCol] || '') : ''
        const order = colMap.orderCol !== -1 ? String(row[colMap.orderCol] || '') : ''

        // استخراج التاريخ (التاريخ فقط بدون الوقت)
        let dateStr: string | null = null
        let rowDate: Date | null = null
        if (colMap.dateCol !== -1 && row[colMap.dateCol]) {
          const dateValue = row[colMap.dateCol]
          if (typeof dateValue === 'number') {
            // تاريخ Excel - تحويل إلى تاريخ فقط
            rowDate = new Date((dateValue - 25569) * 86400 * 1000)
          } else {
            // نص التاريخ مثل: 2026-02-12 07:48:25
            // نأخذ التاريخ فقط (أول 10 أحرف)
            const dateText = String(dateValue).trim()
            const dateOnly = dateText.substring(0, 10) // YYYY-MM-DD
            rowDate = new Date(dateOnly)
          }
          if (!isNaN(rowDate.getTime())) {
            // تصفير الوقت للمقارنة الدقيقة
            rowDate.setHours(0, 0, 0, 0)
            dateStr = rowDate.toISOString()
            
            // فلترة ذكية: تخطي المعاملات خارج الفترة المحددة
            if (cutoffDate && rowDate < cutoffDate) {
              skippedRows++
              continue // تخطي هذا الصف
            }
            
            if (!dateFrom || dateStr < dateFrom) dateFrom = dateStr
            if (!dateTo || dateStr > dateTo) dateTo = dateStr
          }
        }
        
        filteredRows++

        const existing = movementMap.get(itemNumber) || {
          totalQty: 0,
          transactionCount: 0,
          description: '',
          dates: [] as string[],
          batches: new Set<string>(),
          expiryDates: new Set<string>(),
          orders: new Set<string>()
        }

        existing.totalQty += qty
        existing.transactionCount += 1
        if (description && !existing.description) {
          existing.description = description.substring(0, 200)
        }
        if (dateStr) {
          existing.dates.push(dateStr)
        }
        if (batch) existing.batches.add(batch)
        if (expiry) existing.expiryDates.add(expiry)
        if (order) existing.orders.add(order)

        movementMap.set(itemNumber, existing)

        // تحديث التقدم
        if (i % 5000 === 0) {
          const percent = 10 + Math.floor((i / totalRows) * 50)
          setUploadPercent(percent)
          const filterInfo = cutoffDate 
            ? ` (فترة التحليل: آخر ${selectedPeriod} يوم)` 
            : ''
          setUploadProgress(`جاري تحليل الصف ${i.toLocaleString('ar-SA')} من ${totalRows.toLocaleString('ar-SA')}...${filterInfo} (${percent}%)`)
        }
      }
      
      // إظهار معلومات الفلترة
      if (selectedPeriod > 0 && skippedRows > 0) {
        console.log(`Period filter: ${filteredRows} rows within ${selectedPeriod} days, ${skippedRows} rows skipped`)
      }

      setUploadProgress(`جاري إرسال البيانات (${movementMap.size.toLocaleString('ar-SA')} بند)...`)
      setUploadPercent(65)

      // إرسال البيانات المجمعة
      const aggregatedItems = Array.from(movementMap.entries()).map(([itemNumber, data]) => ({
        genericItemNumber: itemNumber,
        description: data.description,
        totalQty: data.totalQty,
        transactionCount: data.transactionCount,
        dates: data.dates,
        batchCount: data.batches.size,
        uniqueExpiryDates: data.expiryDates.size,
        uniqueOrders: data.orders.size
      }))

      // إرسال على دفعات صغيرة لتجنب timeout
      const batchSize = 200
      const totalBatches = Math.ceil(aggregatedItems.length / batchSize)
      let totalSaved = 0
      let stockUpdated = 0
      let batchErrors: string[] = []

      for (let i = 0; i < aggregatedItems.length; i += batchSize) {
        const batchIndex = Math.floor(i / batchSize) + 1
        const isLastBatch = batchIndex === totalBatches
        const batch = aggregatedItems.slice(i, i + batchSize)
        
        const percent = 60 + Math.floor((batchIndex / totalBatches) * 40)
        setUploadPercent(percent)
        setUploadProgress(`جاري حفظ الدفعة ${batchIndex} من ${totalBatches}... (${percent}%)`)

        const res = await fetch('/api/movement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: batch,
            system,
            fileName: file.name,
            totalRecords: rawData.length - 1,
            uniqueItems: movementMap.size,
            dateFrom,
            dateTo,
            analysisPeriodDays: selectedPeriod,
            clearExisting: batchIndex === 1, // حذف البيانات القديمة فقط في الدفعة الأولى
            isLastBatch // لتحديث المخزون في الدفعة الأخيرة فقط
          })
        })

        // التحقق من أن الـ response هو JSON
        const contentType = res.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text()
          throw new Error(`خطأ في الخادم: ${text.substring(0, 200)}...`)
        }

        const data = await res.json()

        if (data.success) {
          totalSaved += (data.stats?.savedItems || batch.length)
          if (data.stats?.stockUpdated) {
            stockUpdated = data.stats.stockUpdated
          }
        } else {
          batchErrors.push(data.error || 'خطأ غير معروف')
          // إذا كان الخطأ متعلق بقاعدة البيانات، نتوقف
          if (data.error?.includes('column') || data.error?.includes('does not exist')) {
            throw new Error(`⚠️ قاعدة البيانات تحتاج تحديث!\n\nيرجى تشغيل: /api/fix-all\n\nالتفاصيل: ${data.error}`)
          }
        }
      }

      if (batchErrors.length > 0 && totalSaved === 0) {
        throw new Error(batchErrors[0])
      }

      setUploadPercent(100)
      setUploadProgress('اكتمل!')
      
      let successMsg = `✅ تم تحليل ${movementMap.size.toLocaleString('ar-SA')} بند من ${filteredRows.toLocaleString('ar-SA')} سجل - ${systemName}\n`
      
      // إضافة معلومات الفلترة حسب الفترة
      if (selectedPeriod > 0) {
        const cutoffDateStr = cutoffDate!.toLocaleDateString('ar-SA')
        successMsg += `📅 فترة التحليل: آخر ${selectedPeriod} يوم (من ${cutoffDateStr})\n`
        if (skippedRows > 0) {
          successMsg += `⏭️ تم استبعاد ${skippedRows.toLocaleString('ar-SA')} سجل خارج الفترة\n`
        }
      } else {
        successMsg += `📅 فترة التحليل: جميع الفترات\n`
      }
      
      successMsg += `📦 تم حفظ ${totalSaved.toLocaleString('ar-SA')} بند\n`
      if (stockUpdated > 0) {
        successMsg += `📊 تم تحديث المخزون لـ ${stockUpdated.toLocaleString('ar-SA')} بند`
      }
      
      setUploadMessage({ 
        type: 'success', 
        text: successMsg
      })
      fetchData()
    } catch (error: any) {
      console.error('Upload error:', error)
      setUploadMessage({ type: 'error', text: `حدث خطأ: ${error.message || 'خطأ في الاتصال'}` })
    } finally {
      setUploading(false)
      setUploadPercent(0)
      setUploadProgress('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // حفظ التصنيف اليدوي
  const handleSaveClassification = async (itemNumber: string) => {
    try {
      const res = await fetch('/api/movement', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemNumber,
          system,
          userMovementClass: editClass,
          notes: editNotes
        })
      })

      const data = await res.json()

      if (data.success) {
        setUploadMessage({ type: 'success', text: 'تم حفظ التصنيف بنجاح' })
        setEditingItem(null)
        setEditClass('')
        setEditNotes('')
        fetchData()
      } else {
        setUploadMessage({ type: 'error', text: data.error || 'حدث خطأ' })
      }
    } catch (error: any) {
      setUploadMessage({ type: 'error', text: 'حدث خطأ في الاتصال' })
    }
  }

  // بدء التعديل
  const startEditing = (item: MovementItem) => {
    setEditingItem(item.genericItemNumber)
    setEditClass(item.userMovementClass || item.autoMovementClass)
    setEditNotes(item.notes || '')
  }

  // إلغاء التعديل
  const cancelEditing = () => {
    setEditingItem(null)
    setEditClass('')
    setEditNotes('')
  }

  // بيانات الرسوم البيانية
  const pieData = classCounts.map(c => ({
    name: c.class,
    value: c.count,
    color: MOVEMENT_COLORS[c.class as keyof typeof MOVEMENT_COLORS] || '#999'
  }))

  const barData = classCounts.map(c => ({
    name: c.class,
    البنود: c.count,
    color: MOVEMENT_COLORS[c.class as keyof typeof MOVEMENT_COLORS] || '#999'
  }))

  const totalPages = Math.ceil(total / pageSize)

  const getMovementIcon = (className: string) => {
    switch (className) {
      case 'سريع جداً':
        return <Flame className="w-4 h-4" />
      case 'سريع':
        return <Zap className="w-4 h-4" />
      case 'متوسط':
        return <Activity className="w-4 h-4" />
      case 'بطيء':
        return <Clock className="w-4 h-4" />
      case 'عديم الحركة':
        return <Snowflake className="w-4 h-4" />
      default:
        return <Activity className="w-4 h-4" />
    }
  }

  const tabs = [
    { id: 'analysis' as TabType, label: 'تحليل الحركة', icon: Activity },
    { id: 'settings' as TabType, label: 'الإعدادات', icon: Settings },
  ]

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* التبويبات */}
      <div className="border-b">
        <div className="flex gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  isActive 
                    ? 'border-blue-500 text-blue-600 bg-blue-50/50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* محتوى التبويبات */}
      {activeTab === 'analysis' && (
        <>
          {/* العنوان */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="w-6 h-6 text-blue-500" />
                تحليل حركة البنود
              </h2>
              <p className="text-gray-500">{systemName} • {total.toLocaleString('ar-SA')} بند</p>
            </div>
            
            {/* الأزرار */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${system === 'mwsal' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  المستودع: {systemName}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                  className="gap-2"
                  title="مزامنة البنود من المخزون"
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      جاري المزامنة...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4" />
                      مزامنة المخزون
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUpdateStock}
                  disabled={updatingStock || total === 0}
                  className="gap-2"
                  title="تحديث كميات المخزون من المخزون اللحظي"
                >
                  {updatingStock ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      جاري التحديث...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      تحديث الكميات
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  disabled={exporting || total === 0}
                  className="gap-2"
                >
                  <Download className={`w-4 h-4 ${exporting ? 'animate-pulse' : ''}`} />
                  {exporting ? 'جاري التصدير...' : 'تصدير Excel'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleUpload}
                  className="hidden"
                  id="movement-upload"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className={`gap-2 ${system === 'mwsal' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                  title={selectedPeriod > 0 ? `سيتم تحليل المعاملات من آخر ${selectedPeriod} يوم فقط (حسب الإعدادات)` : 'سيتم تحليل جميع المعاملات في الملف'}
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      جاري التحليل...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      رفع تقرير الحركة
                      {selectedPeriod > 0 && (
                        <span className="text-xs opacity-80">({selectedPeriod} يوم)</span>
                      )}
                    </>
                  )}
                </Button>
              </div>
              
              {/* شريط التقدم */}
              {uploading && (
                <div className="w-full max-w-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-blue-600">{uploadProgress}</span>
                    <span className="text-xs font-bold text-blue-600">{uploadPercent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-gradient-to-l from-blue-500 to-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadPercent}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* رسالة الرفع */}
          {uploadMessage && (
            <div className={`p-4 rounded-lg whitespace-pre-line ${uploadMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {uploadMessage.text}
            </div>
          )}

          {/* ملخص الإحصائيات */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Package className="w-4 h-4" />
                  <span className="text-sm">إجمالي البنود</span>
                </div>
                <p className="text-2xl font-bold">{stats.totalItems.toLocaleString('ar-SA')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm">الكمية المصروفة</span>
                </div>
                <p className="text-2xl font-bold">{stats.totalQtyDispatched.toLocaleString('ar-SA')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Activity className="w-4 h-4" />
                  <span className="text-sm">المعاملات</span>
                </div>
                <p className="text-2xl font-bold">{stats.totalTransactions.toLocaleString('ar-SA')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Layers className="w-4 h-4" />
                  <span className="text-sm">فترة التحليل</span>
                </div>
                <p className="text-2xl font-bold">{selectedPeriod === 0 ? 'الكل' : `${selectedPeriod} يوم`}</p>
              </CardContent>
            </Card>
          </div>

          {/* ملخص التصنيفات */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {classCounts.map(c => {
              const color = MOVEMENT_COLORS[c.class as keyof typeof MOVEMENT_COLORS] || '#999'
              const isSelected = selectedClass === c.class
              return (
                <Card 
                  key={c.class}
                  className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => setSelectedClass(isSelected ? 'all' : c.class)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      {getMovementIcon(c.class)}
                      <span className="text-sm font-medium">{c.class}</span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color }}>
                      {c.count.toLocaleString('ar-SA')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {total > 0 ? ((c.count / total) * 100).toFixed(1) : 0}%
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* الرسوم البيانية */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PieChartIcon className="w-5 h-5 text-purple-500" />
                  توزيع تصنيفات الحركة
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[250px] text-gray-400 gap-2">
                    <Database className="w-12 h-12 opacity-50" />
                    <p>لا توجد بيانات</p>
                    <p className="text-sm">ارفع تقرير الحركة أو اضغط "مزامنة المخزون"</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  عدد البنود حسب التصنيف
                </CardTitle>
              </CardHeader>
              <CardContent>
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={barData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => v.toLocaleString('ar-SA')} />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => (v ?? 0).toLocaleString('ar-SA')} />
                      <Bar dataKey="البنود" radius={[0, 4, 4, 0]}>
                        {barData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-gray-400">
                    لا توجد بيانات
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* البحث والفلتر */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="بحث برقم البند أو الوصف..."
                    className="pr-10"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="all">جميع التصنيفات</option>
                    <option value="سريع جداً">سريع جداً</option>
                    <option value="سريع">سريع</option>
                    <option value="متوسط">متوسط</option>
                    <option value="بطيء">بطيء</option>
                    <option value="عديم الحركة">عديم الحركة</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-blue-700">
                    فترة التحليل: <strong>{selectedPeriod === 0 ? 'الكل' : `${selectedPeriod} يوم`}</strong>
                  </span>
                  <a href="#" onClick={() => setActiveTab('settings')} className="text-xs text-blue-500 hover:underline mr-2">
                    (تغيير)
                  </a>
                </div>

                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* جدول البنود */}
          <Card>
            <CardHeader>
              <CardTitle>قائمة البنود</CardTitle>
              <CardDescription>
                عرض {items.length} من أصل {total.toLocaleString('ar-SA')} بند
                {' '}• اضغط على ✏️ لتعديل تصنيف البند
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد بيانات</p>
                  <p className="text-sm mt-2">ارفع تقرير Full Dispatch من نظام BY أو اضغط "مزامنة المخزون"</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-right p-3 font-medium">رقم البند</th>
                        <th className="text-right p-3 font-medium">الوصف</th>
                        <th className="text-center p-3 font-medium">التصنيف</th>
                        <th className="text-center p-3 font-medium">الكمية المصروفة</th>
                        <th className="text-center p-3 font-medium">المعاملات</th>
                        <th className="text-center p-3 font-medium">التشغيلات</th>
                        <th className="text-center p-3 font-medium">المخزون</th>
                        <th className="text-center p-3 font-medium">آخر صرف</th>
                        <th className="text-center p-3 font-medium">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="p-3 font-mono text-xs">{item.genericItemNumber}</td>
                          <td className="p-3 max-w-[200px] truncate" title={item.description || ''}>
                            {item.description || '-'}
                          </td>
                          <td className="p-3 text-center">
                            {editingItem === item.genericItemNumber ? (
                              <select
                                value={editClass}
                                onChange={(e) => setEditClass(e.target.value)}
                                className="border rounded px-2 py-1 text-sm"
                              >
                                <option value="سريع جداً">سريع جداً</option>
                                <option value="سريع">سريع</option>
                                <option value="متوسط">متوسط</option>
                                <option value="بطيء">بطيء</option>
                                <option value="عديم الحركة">عديم الحركة</option>
                              </select>
                            ) : (
                              <Badge 
                                style={{ 
                                  backgroundColor: MOVEMENT_COLORS[item.effectiveMovementClass as keyof typeof MOVEMENT_COLORS] || '#999',
                                  color: 'white'
                                }}
                                className="gap-1"
                              >
                                {getMovementIcon(item.effectiveMovementClass)}
                                {item.effectiveMovementClass}
                                {item.isUserClassified && <span title="تصنيف يدوي">*</span>}
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-center font-medium">
                            {item.totalQtyDispatched.toLocaleString('ar-SA')}
                          </td>
                          <td className="p-3 text-center">
                            {item.transactionCount.toLocaleString('ar-SA')}
                          </td>
                          <td className="p-3 text-center">
                            <span className="inline-flex items-center gap-1">
                              <span title="عدد التشغيلات">{item.batchCount}</span>
                              {item.uniqueExpiryDates > 0 && (
                                <span className="text-gray-400 text-xs" title="تواريخ انتهاء مختلفة">
                                  ({item.uniqueExpiryDates})
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`${item.currentStock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {item.currentStock.toLocaleString('ar-SA')}
                            </span>
                          </td>
                          <td className="p-3 text-center text-gray-600 text-xs">
                            {item.lastDispatchDate
                              ? new Date(item.lastDispatchDate).toLocaleDateString('ar-SA')
                              : '-'
                            }
                          </td>
                          <td className="p-3 text-center">
                            {editingItem === item.genericItemNumber ? (
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleSaveClassification(item.genericItemNumber)}
                                  className="text-green-600"
                                >
                                  <Save className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={cancelEditing}
                                  className="text-red-600"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditing(item)}
                                title="تعديل التصنيف"
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* الصفحات */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    السابق
                  </Button>
                  <span className="text-sm text-gray-500">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    التالي
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* تبويب الإعدادات */}
      {activeTab === 'settings' && (
        <MovementSettings system={system} />
      )}
    </div>
  )
}
