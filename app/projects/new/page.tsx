import { PageShell } from "@/components/layout/page-shell"
import { NewProjectForm } from "./new-project-form"

export default function NewProjectPage() {
  return (
    <PageShell width="prose">
      <NewProjectForm />
    </PageShell>
  )
}
