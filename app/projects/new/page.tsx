import type { Metadata } from "next"
import { connectDB } from "@/lib/db"
import { Project } from "@/lib/models/project"
import { requireUserId } from "@/lib/projects"
import { LIMITS, limitMessage } from "@/lib/limits"
import { LimitReached } from "@/components/project/limit-reached"
import { CreationCanvas } from "./creation-canvas"

export const metadata: Metadata = { title: "New" }

export default async function NewProjectPage() {
  const userId = await requireUserId()
  await connectDB()
  if ((await Project.countDocuments({ ownerId: userId })) >= LIMITS.projects) {
    return <LimitReached message={limitMessage("projects")} backHref="/dashboard" backLabel="Dashboard" />
  }
  return <CreationCanvas />
}
