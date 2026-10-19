import type { Metadata } from "next"
import { connectDB } from "@/lib/db"
import { Project } from "@/lib/models/project"
import { requireUserId } from "@/lib/projects"
import { getLimit } from "@/lib/entitlements"
import { limitMessage } from "@/lib/plans"
import { LimitReached } from "@/components/project/limit-reached"
import { CreationCanvas } from "./creation-canvas"

export const metadata: Metadata = { title: "New" }

export default async function NewProjectPage() {
  const userId = await requireUserId()
  await connectDB()
  const { plan, limit } = await getLimit(userId, "projects")
  if ((await Project.countDocuments({ ownerId: userId, deletedAt: null })) >= limit) {
    return (
      <LimitReached
        message={limitMessage("projects", plan)}
        showUpgrade={plan === "free"}
        backHref="/dashboard"
        backLabel="Dashboard"
      />
    )
  }
  return <CreationCanvas />
}
