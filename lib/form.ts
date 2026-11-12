/**
 * Read a text field from a FormData.
 *  - field present but empty  -> "" (so the update CLEARS the stored value)
 *  - field not in the form    -> undefined (so the update leaves it alone)
 *
 * The old pattern `formData.get(x) || undefined` silently refused to
 * clear a field, because an undefined value means "leave it alone".
 */
export function formString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}
