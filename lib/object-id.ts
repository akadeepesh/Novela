const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/

/**
 * True only for a real 24-character hex ObjectId string. Stricter than
 * mongoose's isValidObjectId, which also accepts any 12-character string
 * (so "hello world!" would pass).
 */
export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && OBJECT_ID_RE.test(value)
}

/** Returns the id if it is a valid ObjectId string, otherwise null. */
export function parseObjectId(value: unknown): string | null {
  return isObjectId(value) ? value : null
}
