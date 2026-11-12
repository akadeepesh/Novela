"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useLiveQuery } from "dexie-react-hooks"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/store/db"
import { isStoragePersisted, requestPersistentStorage } from "@/lib/store/persist"

const MB = 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * MB) return `${(bytes / (1024 * MB)).toFixed(1)} GB`
  if (bytes >= MB) return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

async function countEverything() {
  const d = db()
  const [projects, chapters, images] = await Promise.all([
    d.projects.toArray(),
    d.chapters.toArray(),
    d.assets.count(),
  ])
  return {
    books: projects.filter((p) => !p.deletedAt).length,
    chapters: chapters.filter((c) => !c.deletedAt).length,
    words: chapters.filter((c) => !c.deletedAt).reduce((sum, c) => sum + (c.wordCount ?? 0), 0),
    images,
  }
}

export function StoragePanel() {
  const counts = useLiveQuery(countEverything, [])
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null)

  useEffect(() => {
    void isStoragePersisted().then(setPersisted)
    navigator.storage
      ?.estimate?.()
      .then((e) => setEstimate({ usage: e.usage ?? 0, quota: e.quota ?? 0 }))
      .catch(() => {})
  }, [])

  async function askToKeep() {
    setPersisted(await requestPersistentStorage())
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">On this device</CardTitle>
          <CardDescription>
            Your books live in this browser&apos;s storage. Another browser or device won&apos;t see them.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {counts ? (
            <p className="text-foreground">
              {counts.books} {counts.books === 1 ? "book" : "books"} · {counts.chapters}{" "}
              {counts.chapters === 1 ? "chapter" : "chapters"} · {counts.words.toLocaleString()} words ·{" "}
              {counts.images} {counts.images === 1 ? "image" : "images"}
            </p>
          ) : null}
          {estimate && estimate.quota > 0 ? (
            <p className="text-muted-foreground">
              Using {formatBytes(estimate.usage)} of the {formatBytes(estimate.quota)} this browser allows.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Keep my data safe</CardTitle>
          <CardDescription>
            Browsers can clear site data when the disk gets full. Asking for persistent storage tells
            the browser not to.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3 text-sm">
          {persisted === null ? null : persisted ? (
            <p className="text-foreground">This browser has agreed to keep your data.</p>
          ) : (
            <>
              <p className="text-muted-foreground">
                Not granted yet. Some browsers only agree once the app is installed or used often.
              </p>
              <Button size="sm" variant="outline" onClick={() => void askToKeep()}>
                Ask the browser to keep my data
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backups</CardTitle>
          <CardDescription>
            Full backups and project files are coming next. Until then, export each book from its{" "}
            <span className="font-medium text-foreground">Export</span> page to keep a copy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" variant="outline" render={<Link href="/dashboard" />} nativeButton={false}>
            Go to your books
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
