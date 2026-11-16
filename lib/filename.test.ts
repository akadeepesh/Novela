import { describe, expect, it } from "vitest"
import { slugify } from "./filename"

describe("filename slug", () => {
  it.each([
    ["कोरा कागज", "कोरा-कागज"],
    ["東京物語", "東京物語"],
    ["كتاب جديد", "كتاب-جديد"],
    ["Новая книга", "новая-книга"],
    ["My Book: Part 1?", "my-book-part-1"],
    ["  chapter １２３  ", "chapter-１２３"],
    ["Cafe\u0301", "café"],
    ['A\\B/C:D*E?F"G<H>I|J', "a-b-c-d-e-f-g-h-i-j"],
    ["   ", "book"],
    ["...?!", "book"],
  ])("keeps a recognizable, safe filename for %j", (title, expected) => {
    expect(slugify(title)).toBe(expected)
  })

  it("caps long titles at 100 characters", () => {
    expect(slugify("a".repeat(300))).toBe("a".repeat(100))
  })

  it("keeps the manuscript fallback for exports", () => {
    expect(slugify("   ", "manuscript")).toBe("manuscript")
  })

  it("does not leave a trailing separator when truncating", () => {
    expect(slugify("a".repeat(99) + " long title")).toBe("a".repeat(99))
  })

  it("does not split a supplementary Unicode character at the limit", () => {
    expect(slugify("𐐀".repeat(300))).toBe("𐐨".repeat(100))
  })
})
