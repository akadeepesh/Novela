"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowCounterClockwiseIcon, CheckIcon, EraserIcon } from "@phosphor-icons/react/dist/ssr"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { paintOver, rasterToRgba, rgbaToRaster } from "@/lib/import/background/pixels"

type Box = { x0: number; y0: number; x1: number; y1: number }

/**
 * The background touch-up tool. Drag a box over anything that shouldn't be
 * there — a stray page number, a smudge — and it's painted out from the page
 * around it. The same routine the importer uses to remove page numbers
 * (pixels.ts), run right here on the picture so it's instant; saving sends
 * the result back. The original is kept, so "Reset" always works.
 */
export function TouchUp({
  jobId,
  version,
  touchedUp,
  onSaved,
  onClose,
}: {
  jobId: string
  version: number
  touchedUp: boolean
  onSaved: () => void
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const history = useRef<ImageData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [box, setBox] = useState<Box | null>(null)
  const [size, setSize] = useState({ w: 1, h: 1 })
  const dragStart = useRef<{ x: number; y: number } | null>(null)

  const load = useCallback(
    async (original: boolean) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/import/${jobId}/asset/background?${original ? "original=1&" : ""}v=${version}-${Date.now()}`, { cache: "no-store" })
        if (!res.ok) throw new Error(String(res.status))
        const bitmap = await createImageBitmap(await res.blob())
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0)
        setSize({ w: bitmap.width, h: bitmap.height })
        history.current = []
        setCanUndo(false)
        setBox(null)
      } catch {
        setError("Couldn’t open the picture to touch it up.")
      } finally {
        setLoading(false)
      }
    },
    [jobId, version]
  )

  useEffect(() => {
    void load(false)
  }, [load])

  const toImage = (e: React.PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect()
    return {
      x: Math.min(size.w, Math.max(0, ((e.clientX - rect.left) / rect.width) * size.w)),
      y: Math.min(size.h, Math.max(0, ((e.clientY - rect.top) / rect.height) * size.h)),
    }
  }

  function down(e: React.PointerEvent) {
    if (loading || busy) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = toImage(e)
    setBox(null)
  }
  function move(e: React.PointerEvent) {
    const s = dragStart.current
    if (!s) return
    const p = toImage(e)
    setBox({ x0: Math.min(s.x, p.x), y0: Math.min(s.y, p.y), x1: Math.max(s.x, p.x), y1: Math.max(s.y, p.y) })
  }
  function up() {
    dragStart.current = null
    setBox((b) => (b && b.x1 - b.x0 > 6 && b.y1 - b.y0 > 6 ? b : null))
  }

  function paint() {
    const canvas = canvasRef.current
    if (!canvas || !box) return
    const ctx = canvas.getContext("2d")!
    const before = ctx.getImageData(0, 0, canvas.width, canvas.height)
    history.current.push(before)
    const raster = rgbaToRaster(before.width, before.height, before.data)
    paintOver(raster, box)
    const after = ctx.createImageData(before.width, before.height)
    after.data.set(rasterToRgba(raster))
    ctx.putImageData(after, 0, 0)
    setBox(null)
    setDirty(true)
    setCanUndo(true)
  }

  function undo() {
    const canvas = canvasRef.current
    const last = history.current.pop()
    if (!canvas || !last) return
    canvas.getContext("2d")!.putImageData(last, 0, 0)
    setCanUndo(history.current.length > 0)
    setDirty(true)
  }

  async function save() {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!dirty) return onClose()
    setBusy(true)
    setError(null)
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
      if (!blob) throw new Error("encode")
      const res = await fetch(`/api/import/${jobId}/asset/background`, { method: "POST", body: blob, headers: { "Content-Type": "image/png" } })
      if (!res.ok) throw new Error(String(res.status))
      onSaved()
    } catch {
      setError("Couldn’t save your touch-ups — try again.")
    } finally {
      setBusy(false)
    }
  }

  async function reset() {
    setBusy(true)
    setError(null)
    try {
      await fetch(`/api/import/${jobId}/asset/background`, { method: "DELETE" })
      await load(true)
      setDirty(false)
      onSaved()
    } catch {
      setError("Couldn’t reset the picture.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed opacity-70">
        Drag a box around anything that shouldn’t be on the page — a stray number, a smudge. It’s filled in from the page around it.
      </p>

      <div
        ref={wrapRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={(e) => e.key === "Escape" && setBox(null)}
        tabIndex={0}
        aria-label="Picture to touch up. Drag to select an area."
        className={cn(
          "relative mx-auto w-full max-w-[400px] touch-none overflow-hidden rounded-md border border-current/15 shadow-[0_24px_40px_-24px_rgb(0_0_0/0.5)] outline-none focus-visible:ring-2 focus-visible:ring-ring",
          loading ? "cursor-progress" : "cursor-crosshair"
        )}
        style={{ aspectRatio: `${size.w} / ${size.h}` }}
      >
        <canvas ref={canvasRef} className="block size-full" />
        {box ? (
          <div
            className="pointer-events-none absolute border border-dashed border-primary bg-primary/15"
            style={{
              left: `${(box.x0 / size.w) * 100}%`,
              top: `${(box.y0 / size.h) * 100}%`,
              width: `${((box.x1 - box.x0) / size.w) * 100}%`,
              height: `${((box.y1 - box.y0) / size.h) * 100}%`,
            }}
          />
        ) : null}
        {loading ? <div className="absolute inset-0 animate-pulse bg-current/5" /> : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={paint} disabled={!box || busy}>
          <EraserIcon />
          Paint over selection
        </Button>
        <Button variant="outline" onClick={undo} disabled={!canUndo || busy}>
          <ArrowCounterClockwiseIcon />
          Undo
        </Button>
        <Button variant="ghost" onClick={reset} disabled={busy || (!touchedUp && !dirty)}>
          Reset to original
        </Button>
        <Button variant="secondary" className="ml-auto" onClick={save} disabled={busy}>
          <CheckIcon />
          {busy ? "Saving…" : dirty ? "Save touch-ups" : "Done"}
        </Button>
      </div>
    </div>
  )
}
