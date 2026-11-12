import { cookies } from "next/headers"
import { ChaptersView } from "./chapters-view"

export default async function ChaptersPage() {
  const cookieStore = await cookies()
  const defaultView = cookieStore.get("chapters-view")?.value === "board" ? "board" : "list"
  return <ChaptersView defaultView={defaultView} />
}
