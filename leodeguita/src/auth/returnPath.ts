const LOGIN_PATH = /^\/login(?:[/?#]|$)/

// Browsers normalize backslashes and control characters into slashes, which
// would turn a "local" path into an off-origin URL.
function hasUnsafeChar(value: string): boolean {
  for (const ch of value) {
    const code = ch.charCodeAt(0)
    if (code <= 0x1f || code === 0x7f || ch === '\\') return true
  }
  return false
}

/** Returns `value` only when it is an app-internal path, otherwise null. */
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  if (hasUnsafeChar(value)) return null
  if (LOGIN_PATH.test(value)) return null
  return value
}
