/**
 * Asks the browser to keep this site's storage even when the disk is
 * nearly full. Without it, IndexedDB is "best effort" and may be evicted.
 * Browsers decide on their own (Chrome grants it to installed or often-used
 * sites, Firefox may ask), so this is a request, not a guarantee.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/** Whether the browser has already agreed to keep this site's data. */
export async function isStoragePersisted(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persisted) return false
  try {
    return await navigator.storage.persisted()
  } catch {
    return false
  }
}
