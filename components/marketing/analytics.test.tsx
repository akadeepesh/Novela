import { afterEach, describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { Analytics } from "./analytics"

const ENV = ["NEXT_PUBLIC_ANALYTICS_SRC", "NEXT_PUBLIC_ANALYTICS_DOMAIN"] as const

afterEach(() => {
  for (const k of ENV) delete process.env[k]
})

describe("Analytics", () => {
  it("loads nothing unless both variables are set", () => {
    expect(Analytics()).toBeNull()
    process.env.NEXT_PUBLIC_ANALYTICS_SRC = "https://plausible.io/js/script.js"
    expect(Analytics()).toBeNull()
  })

  it("passes the site as data-domain, or as Umami's website id", () => {
    process.env.NEXT_PUBLIC_ANALYTICS_SRC = "https://plausible.io/js/script.js"
    process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN = "example.com"
    expect(Analytics()?.props).toMatchObject({ src: "https://plausible.io/js/script.js", "data-domain": "example.com" })
    process.env.NEXT_PUBLIC_ANALYTICS_SRC = "https://cloud.umami.is/script.js"
    process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN = "abc-123"
    expect(Analytics()?.props).toMatchObject({ "data-website-id": "abc-123" })
  })

  it("is used only by the public pages' layout, never by the writing app", () => {
    const users: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.tsx?$/.test(name) && /marketing\/analytics/.test(readFileSync(full, "utf8"))) users.push(path.relative("app", full))
      }
    }
    walk("app")
    expect(users.map((u) => u.replace(/\\/g, "/"))).toEqual(["(marketing)/layout.tsx"])
  })
})
