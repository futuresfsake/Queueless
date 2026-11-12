import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "inline-flex items-center rounded-sm px-1.5 py-0.5 font-num text-[0.8125rem] font-semibold uppercase leading-none tracking-[0.1em]",
  {
    variants: {
      variant: {
        default: "bg-ink text-paper",
        secondary: "bg-sunken text-ink-soft",
        go: "bg-go text-white",
        accent: "bg-accent-soft text-accent-deep",
        warn: "bg-warn-soft text-warn",
      },
    },
    defaultVariants: { variant: "secondary" },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
