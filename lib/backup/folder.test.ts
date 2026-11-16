import { describe, expect, it, vi } from "vitest"
import { fullBackupFileName } from "./download"
import { KEEP_DAYS, writeFolderBackup } from "./folder"
import { getMeta } from "./status"

vi.mock("./status", async (importOriginal) => {
  const original = await importOriginal<typeof import("./status")>()
  return {
    ...original,
    getMeta: vi.fn(),
    setMeta: vi.fn(),
    deleteMeta: vi.fn(),
    recordBackup: vi.fn(),
  }
})

describe("daily backup filenames", () => {
  it("keeps the existing ASCII app prefix and local date", () => {
    expect(fullBackupFileName(new Date(2026, 0, 2))).toBe("novela-backup-2026-01-02.novela")
  })

  it("still prunes only our daily files beyond the retention limit", async () => {
    const names = [
      ...Array.from({ length: KEEP_DAYS + 1 }, (_, i) => fullBackupFileName(new Date(2026, 0, i + 1))),
      "東京物語.novela",
      "novela-backup-not-a-date.novela",
      "other-backup-2026-01-01.novela",
    ]
    const write = vi.fn()
    const close = vi.fn()
    const handle = {
      queryPermission: vi.fn().mockResolvedValue("granted"),
      getFileHandle: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue({ write, close }),
      }),
      async *keys() { yield* names },
      removeEntry: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(getMeta).mockResolvedValue(handle)

    expect(await writeFolderBackup()).toEqual({ ok: true })
    expect(handle.getFileHandle).toHaveBeenCalledWith(fullBackupFileName(), { create: true })
    expect(write).toHaveBeenCalledWith(expect.any(Blob))
    expect(close).toHaveBeenCalledOnce()
    expect(handle.removeEntry.mock.calls).toEqual([["novela-backup-2026-01-01.novela"]])
  })
})
