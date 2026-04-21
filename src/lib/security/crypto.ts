/**
 * Security Crypto Module
 * وحدة التشفير الأمني للبيانات الحساسة
 * 
 * تستخدم Node.js crypto API للتشفير الآمن
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash, createHmac, timingSafeEqual } from 'crypto'

// مفتاح التشفير من متغير البيئة (يجب أن يكون 32 بايت للـ AES-256)
const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    // في بيئة التطوير، استخدم مفتاح مؤقت (يجب تعيين ENCRYPTION_KEY في الإنتاج)
    console.warn('⚠️ ENCRYPTION_KEY not set, using development key. Set ENCRYPTION_KEY in production!')
    return createHash('sha256').update('dev-key-please-change-in-production').digest()
  }
  return Buffer.from(key, 'hex').length === 32 
    ? Buffer.from(key, 'hex') 
    : createHash('sha256').update(key).digest()
}

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * تشفير نص عادي
 * Encrypt plaintext string
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return ''
  
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * فك تشفير النص المشفر
 * Decrypt encrypted string
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return ''
  
  try {
    const key = getEncryptionKey()
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':')
    
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid encrypted data format')
    }
    
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Decryption failed:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * تشفير كائن JSON
 * Encrypt JSON object
 */
export function encryptObject<T>(obj: T): string {
  return encrypt(JSON.stringify(obj))
}

/**
 * فك تشفير كائن JSON
 * Decrypt JSON object
 */
export function decryptObject<T>(encryptedData: string): T {
  const decrypted = decrypt(encryptedData)
  return JSON.parse(decrypted) as T
}

/**
 * إنشاء hash آمن للكلمة
 * Create secure hash (one-way)
 */
export function hash(value: string, salt?: string): string {
  const actualSalt = salt || process.env.HASH_SALT || 'default-salt-change-in-production'
  return createHash('sha256')
    .update(value + actualSalt)
    .digest('hex')
}

/**
 * إنشاء HMAC للتحقق من سلامة البيانات
 * Create HMAC for data integrity
 */
export function createHMAC(data: string, secret?: string): string {
  const key = secret || process.env.HMAC_SECRET || 'default-hmac-secret'
  return createHmac('sha256', key)
    .update(data)
    .digest('hex')
}

/**
 * التحقق من HMAC
 * Verify HMAC signature
 */
export function verifyHMAC(data: string, signature: string, secret?: string): boolean {
  const expectedSignature = createHMAC(data, secret)
  
  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  } catch {
    return false
  }
}

/**
 * توليد رمز عشوائي آمن
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex')
}

/**
 * توليد رقم عشوائي آمن
 * Generate secure random number
 */
export function generateSecureNumber(min: number, max: number): number {
  const range = max - min
  const bytesNeeded = Math.ceil(Math.log2(range + 1) / 8)
  const maxValid = Math.pow(256, bytesNeeded) - 1
  const limit = maxValid - (maxValid % (range + 1))
  
  let randomValue: number
  do {
    randomValue = parseInt(randomBytes(bytesNeeded).toString('hex'), 16)
  } while (randomValue > limit)
  
  return min + (randomValue % (range + 1))
}

/**
 * تشفير بيانات حساسة للعرض (إخفاء جزئي)
 * Mask sensitive data for display
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (!data || data.length <= visibleChars) {
    return '****'
  }
  const visible = data.slice(-visibleChars)
  const masked = '*'.repeat(Math.min(data.length - visibleChars, 8))
  return masked + visible
}

/**
 * تشفير رقم الهاتف
 * Mask phone number
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 7) return '****'
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

/**
 * تشفير البريد الإلكتروني
 * Mask email address
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '****'
  const [localPart, domain] = email.split('@')
  const maskedLocal = localPart.slice(0, 2) + '***'
  return maskedLocal + '@' + domain
}

/**
 * ثابت: وقت انتهاء الجلسة (24 ساعة بالثواني)
 */
export const SESSION_EXPIRY_SECONDS = 24 * 60 * 60

/**
 * ثابت: طول التوكن الآمن
 */
export const SECURE_TOKEN_LENGTH = 32
