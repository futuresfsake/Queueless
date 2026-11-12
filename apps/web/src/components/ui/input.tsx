import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-line-strong bg-white/70 px-3 text-[0.9375rem] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-soft/70 hover:border-ink/60 focus-visible:border-ink focus-visible:shadow-[0_0_0_3px_var(--color-accent-soft)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-alarm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
