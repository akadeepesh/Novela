import Image from "next/image"

/** The Novela quill, from public/logo-mark.png. Decorative: the app name always sits beside it. */
export function BrandMark({ size = 20, className }: { size?: number; className?: string }) {
  return <Image src="/logo-mark.png" alt="" width={size} height={size} className={className} priority />
}
