import type { Metadata } from "next"
import { requireUserId } from "@/lib/projects"
import { ImportIntake } from "./import-intake"

export const metadata: Metadata = { title: "Import a book" }

// Intake reads the whole PDF back and inspects every page; a 110-page book
// is comfortably fast, but a scan-heavy one that gets image-probed is not
// sub-second, so don't inherit a short default.
export const maxDuration = 60

export default async function ImportBookPage() {
  const userId = await requireUserId()
  return <ImportIntake userId={userId} />
}
