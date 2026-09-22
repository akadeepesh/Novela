import { TitleFlightProvider } from "@/components/project/title-flight"

// Sits above both /projects/new and /projects/[id], so the title-flight
// layer survives the navigation between them.
export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <TitleFlightProvider>{children}</TitleFlightProvider>
}
