import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/** Status tag: a small flat label. Always carries text, never colour alone. */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs font-medium leading-4 [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "bg-subtle text-text-2",
        brand: "bg-brand-soft text-brand",
        ok: "bg-ok-soft text-ok",
        warn: "bg-warn-soft text-warn",
        danger: "bg-danger-soft text-danger",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
)

function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />
}

export { Badge, badgeVariants }
