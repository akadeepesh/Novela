import type { Metadata } from "next"
import { PageShell } from "@/components/layout/page-shell"
import { NewProjectForm } from "./new-project-form"

export const metadata: Metadata = { title: "New Project" }

export default function NewProjectPage() {
  return (
    <PageShell width="prose">
      <NewProjectForm />
    </PageShell>
  )
}
