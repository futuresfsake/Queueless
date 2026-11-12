import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-line-strong bg-surface px-3 text-[0.9375rem] text-text shadow-card outline-none transition-[border-color,box-shadow] placeholder:text-text-3 hover:border-text-3 focus-visible:border-brand focus-visible:shadow-[0_0_0_3px_var(--color-brand-soft)] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-subtle disabled:text-text-3 aria-invalid:border-danger",
        className
      )}
      {...props}
    />
  )
}

/** A native select with the same chrome as Input, so it works everywhere (including old phones). */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-[0.9375rem] text-text shadow-card outline-none hover:border-text-3 focus-visible:border-brand focus-visible:shadow-[0_0_0_3px_var(--color-brand-soft)]",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export { Input, Select }
