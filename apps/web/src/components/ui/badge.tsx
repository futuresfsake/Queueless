import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "inline-flex items-center rounded-[2px] border px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold uppercase leading-none",
  {
    variants: {
      variant: {
        default: "border-ink bg-ink text-white",
        secondary: "border-ink/40 text-grey",
        mark: "border-ink bg-mark text-ink",
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
