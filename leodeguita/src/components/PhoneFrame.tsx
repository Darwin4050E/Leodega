import type { ReactNode } from 'react'

/**
 * Centers the app inside a phone-sized column on wide screens. On an actual
 * phone (or installed as a PWA) it just fills the viewport.
 */
export default function PhoneFrame({
  children,
  footer,
}: {
  children: ReactNode
  /** Pinned below the content, e.g. the tenant bottom navigation. */
  footer?: ReactNode
}) {
  return (
    <div className="min-h-dvh w-full bg-[#ECEDF3] flex justify-center">
      <div className="w-full max-w-[430px] min-h-dvh bg-white shadow-xl flex flex-col">
        {children}
        {footer}
      </div>
    </div>
  )
}
