import * as React from "react"
import { cn } from "cn"

/** A plain bordered panel. Sections of a screen, not decoration. */
function Card({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="card"
      className={cn("rounded-md border border-line bg-surface", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex items-center justify-between gap-3 border-b border-line px-4 py-3", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 data-slot="card-title" className={cn("text-sm font-semibold", className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("mt-0.5 text-[0.8125rem] text-text-2", className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-4", className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent }
