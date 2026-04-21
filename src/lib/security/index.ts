/**
 * Security Module Index
 * تصدير جميع الوحدات الأمنية
 */

// Crypto utilities
export {
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
  hash,
  createHMAC,
  verifyHMAC,
  generateSecureToken,
  generateSecureNumber,
  maskSensitiveData,
  maskPhoneNumber,
  maskEmail,
  SESSION_EXPIRY_SECONDS,
  SECURE_TOKEN_LENGTH
} from './crypto'

// RBAC
export {
  Role,
  Permission,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getRolePermissions,
  roleHasPermission,
  mapUserPermissions,
  determineUserRole,
  createUserWithPermissions,
  checkApiPermission,
  getAvailablePermissions,
  type UserWithPermissions
} from './rbac'

// Audit logging
export {
  AuditAction,
  AuditSeverity,
  logAuditEvent,
  logLoginSuccess,
  logLoginFailed,
  logLogout,
  logPasswordChange,
  logUserCreated,
  logUserDeleted,
  logDataUpload,
  logDataExport,
  logSuspiciousActivity,
  logUnauthorizedAccess,
  getAuditLogs,
  cleanupOldAuditLogs,
  type AuditLogEntry
} from './audit'

// Validation
export {
  sanitizeString,
  sanitizeHTML,
  sanitizeForJS,
  stripDangerousChars,
  isValidId,
  isValidUsername,
  validatePasswordStrength,
  isValidEmail,
  isValidPhone,
  isValidURL,
  detectSQLInjection,
  detectXSS,
  detectPathTraversal,
  validateInput,
  commonSchemas,
  createSearchSchema
} from './validation'

// Middleware
export {
  securityMiddleware,
  secureResponse,
  createCSRFToken,
  checkPathPermission,
  getSessionFromCookies
} from './middleware'
