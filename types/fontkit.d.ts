// The small part of fontkit's API this app uses (the package ships no types).
declare module "fontkit" {
  export interface Font {
    numGlyphs: number
    familyName: string
    hasGlyphForCodePoint(codePoint: number): boolean
  }
  export interface FontCollection {
    fonts: Font[]
  }
  export function create(data: Uint8Array | Buffer, postscriptName?: string): Font | FontCollection
}
