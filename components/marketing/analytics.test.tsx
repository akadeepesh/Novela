import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { filterEvent } from "./analytics"

describe("Analytics", () => {
  it("never sends events from the writing app", () => {
    for (const p of ["/dashboard", "/projects/abc/chapters/def", "/settings", "/read/abc?chapter=1"]) {
      expect(filterEvent({ type: "pageview", url: `https://novela.akadeepesh.com${p}` })).toBeNull()
    }
  })

  it("keeps public pages, without query strings or fragments", () => {
    expect(filterEvent({ type: "pageview", url: "https://novela.akadeepesh.com/kdp-formatting-free?ref=hn#faq" })).toEqual({
      type: "pageview",
      url: "https://novela.akadeepesh.com/kdp-formatting-free",
    })
    expect(filterEvent({ type: "pageview", url: "/" })).toEqual({ type: "pageview", url: "/" })
  })

  it("is used only by the public pages' layout, never by the writing app", () => {
    const users: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.tsx?$/.test(name) && /marketing\/analytics|@vercel\/analytics/.test(readFileSync(full, "utf8"))) users.push(path.relative("app", full))
      }
    }
    walk("app")
    expect(users.map((u) => u.replace(/\\/g, "/"))).toEqual(["(marketing)/layout.tsx"])
  })
})
