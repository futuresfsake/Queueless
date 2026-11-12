import * as React from "react"
import { cn } from "cn"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn("text-[0.8125rem] font-semibold text-ink", className)}
      {...props}
    />
  )
}

export { Label }
