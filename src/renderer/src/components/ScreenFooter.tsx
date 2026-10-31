import { cn } from 'cn'

/** The bottom bar every screen ends on — border, background and padding are fixed, `className`
 * only tunes per-screen gap/alignment. */
export function ScreenFooter({
  className,
  children
}: {
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-3 border-t border-black/[0.06] dark:border-white/[0.08] bg-[#f6f6f8]/80 dark:bg-[#1e1e1e]/80 backdrop-blur-md px-4 py-1.5 text-[11px]',
        className
      )}
    >
      {children}
    </div>
  )
}
