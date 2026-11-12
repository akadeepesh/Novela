import type { Metadata } from "next"
import { CreationCanvas } from "./creation-canvas"

export const metadata: Metadata = { title: "New" }

export default function NewProjectPage() {
  return <CreationCanvas />
}
