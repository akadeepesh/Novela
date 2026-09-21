"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { submitFeedbackAction } from "@/app/actions/feedback"

export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname()
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setPending(true)
    const result = await submitFeedbackAction({ message, page: pathname })
    setPending(false)
    if (result.ok) {
      setSent(true)
      setMessage("")
    }
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) {
      // Reset shortly after the close animation finishes, not mid-fade.
      setTimeout(() => setSent(false), 200)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {sent ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <DialogTitle>Thanks — got it.</DialogTitle>
            <DialogDescription>We actually read these.</DialogDescription>
          </div>
        ) : (
          <>
            <DialogTitle>Send feedback</DialogTitle>
            <DialogDescription>
              Something broken, confusing, or missing? Tell us.
            </DialogDescription>
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What's on your mind…"
                rows={4}
                autoFocus
              />
              <Button type="submit" disabled={pending || !message.trim()} className="self-end">
                {pending ? "Sending…" : "Send"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
