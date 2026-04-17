/**
 * Input Validation Utilities
 * التحقق من صحة المدخلات
 */

/**
 * تطهير النص من الأحرف الخطرة
 */
export function sanitizeText(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') return ''
  
  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // إزالة < و >
    .replace(/javascript:/gi, '') // إزالة javascript:
    .replace(/on\w+=/gi, '') // إزالة event handlers
    .trim()
}

/**
 * التحقق من صحة رقم الصفحة
 */
export function validatePageNum(page: string | null): number {
  const num = parseInt(page || '1', 10)
  return isNaN(num) || num < 1 ? 1 : Math.min(num, 10000)
}

/**
 * التحقق من صحة رقم الحد
 */
export function validateLimit(limit: string | null, maxLimit: number = 1000): number {
  const num = parseInt(limit || '100', 10)
  return isNaN(num) || num < 1 ? 100 : Math.min(num, maxLimit)
}

/**
 * التحقق من صحة اسم النظام
 */
export function validateSystem(system: string | null): 'hoz' | 'mwsal' {
  return system === 'mwsal' ? 'mwsal' : 'hoz'
}

/**
 * التحقق من صحة رقم البند
 */
export function validateItemNumber(itemNumber: string | null): string | null {
  if (!itemNumber || typeof itemNumber !== 'string') return null
  
  // إزالة المسافات والأحرف غير المرغوبة
  const cleaned = itemNumber.trim().replace(/[^a-zA-Z0-9\-_]/g, '')
  
  if (cleaned.length === 0 || cleaned.length > 50) return null
  
  return cleaned
}

/**
 * التحقق من صحة البحث
 */
export function validateSearchQuery(query: string | null, maxLength: number = 100): string {
  if (!query || typeof query !== 'string') return ''
  
  return query
    .slice(0, maxLength)
    .replace(/[%_*]/g, '') // إزالة أحرف SQL wildcards
    .trim()
}

/**
 * التحقق من صحة التاريخ
 */
export function validateDate(date: string | null): Date | null {
  if (!date || typeof date !== 'string') return null
  
  const parsed = new Date(date)
  
  if (isNaN(parsed.getTime())) return null
  
  // التحقق من أن التاريخ معقول (ليس في المستقبل البعيد أو الماضي البعيد)
  const now = new Date()
  const minDate = new Date('2020-01-01')
  const maxDate = new Date(now.getFullYear() + 10, 11, 31)
  
  if (parsed < minDate || parsed > maxDate) return null
  
  return parsed
}

/**
 * التحقق من صحة اسم المستخدم
 */
export function validateUsername(username: string | null): { valid: boolean; value: string; error?: string } {
  if (!username || typeof username !== 'string') {
    return { valid: false, value: '', error: 'اسم المستخدم مطلوب' }
  }
  
  const cleaned = username.trim().toLowerCase()
  
  if (cleaned.length < 3) {
    return { valid: false, value: cleaned, error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' }
  }
  
  if (cleaned.length > 30) {
    return { valid: false, value: cleaned, error: 'اسم المستخدم طويل جداً' }
  }
  
  // اسم المستخدم يجب أن يحتوي على أحرف وأرقام فقط
  if (!/^[a-z0-9_]+$/.test(cleaned)) {
    return { valid: false, value: cleaned, error: 'اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام فقط' }
  }
  
  return { valid: true, value: cleaned }
}

/**
 * التحقق من صحة كلمة المرور
 */
export function validatePassword(password: string | null): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'كلمة المرور مطلوبة' }
  }
  
  if (password.length < 4) {
    return { valid: false, error: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' }
  }
  
  if (password.length > 100) {
    return { valid: false, error: 'كلمة المرور طويلة جداً' }
  }
  
  return { valid: true }
}

/**
 * التحقق من صحة الاسم
 */
export function validateName(name: string | null): { valid: boolean; value: string; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, value: '', error: 'الاسم مطلوب' }
  }
  
  const cleaned = name.trim()
  
  if (cleaned.length < 2) {
    return { valid: false, value: cleaned, error: 'الاسم يجب أن يكون حرفين على الأقل' }
  }
  
  if (cleaned.length > 100) {
    return { valid: false, value: cleaned, error: 'الاسم طويل جداً' }
  }
  
  return { valid: true, value: cleaned }
}

/**
 * التحقق من صحة ID
 */
export function validateId(id: string | null): string | null {
  if (!id || typeof id !== 'string') return null
  
  // CUID format: يبدأ بـ 'c' ويتبعه 24 حرف
  const cleaned = id.trim()
  
  if (!/^[a-z0-9]{20,30}$/i.test(cleaned)) return null
  
  return cleaned
}

/**
 * تنظيف كائن من القيم الفارغة
 */
export function cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: any = {}
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== '') {
      cleaned[key] = value
    }
  }
  
  return cleaned
}
