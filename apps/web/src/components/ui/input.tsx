import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-[2px] border-2 border-ink bg-white px-3 text-[0.9375rem] text-ink outline-none placeholder:text-grey/60 focus-visible:bg-mark-soft focus-visible:outline-none disabled:cursor-not-allowed disabled:border-rule disabled:text-grey aria-invalid:border-alarm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
