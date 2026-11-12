import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/** Status pill. Always carries text (and usually an icon), never colour alone. */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5 [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "border-line bg-subtle text-text-2",
        brand: "border-brand-line bg-brand-soft text-brand",
        ok: "border-ok-line bg-ok-soft text-ok",
        warn: "border-warn-line bg-warn-soft text-warn",
        danger: "border-danger-line bg-danger-soft text-danger",
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
