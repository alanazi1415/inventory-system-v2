/**
 * Authentication Utilities
 * تشفير كلمات المرور والتحقق منها
 */

import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

/**
 * تشفير كلمة المرور
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * التحقق من كلمة المرور
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

/**
 * التحقق مما إذا كانت كلمة المرور مشفرة
 * كلمات المرور المشفرة بـ bcrypt تبدأ بـ $2a$ أو $2b$
 */
export function isPasswordHashed(password: string): boolean {
  return password.startsWith('$2a$') || password.startsWith('$2b$')
}

/**
 * توليد معرّف جلسة آمن
 */
export function generateSessionToken(): string {
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('') + 
         Date.now().toString(36)
}

/**
 * التحقق من قوة كلمة المرور
 */
export function validatePasswordStrength(password: string): {
  valid: boolean
  message: string
  score: number
} {
  if (password.length < 6) {
    return { valid: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', score: 0 }
  }
  
  let score = 0
  
  // طول كافٍ
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  
  // أحرف متنوعة
  if (/[a-z]/.test(password)) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  
  if (score < 3) {
    return { valid: true, message: 'كلمة المرور ضعيفة - يُنصح بإضافة أحرف متنوعة', score }
  } else if (score < 5) {
    return { valid: true, message: 'كلمة المرور متوسطة القوة', score }
  } else {
    return { valid: true, message: 'كلمة مرور قوية', score }
  }
}
