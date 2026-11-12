import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium outline-none transition-[background-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  {
    variants: {
      variant: {
        // ink: the everyday button
        default: "bg-ink text-paper hover:bg-[#33312b]",
        // vermilion: at most one per screen, the thing you came to do
        accent: "bg-accent text-white shadow-[0_2px_0_var(--color-accent-deep)] hover:bg-accent-deep active:shadow-none",
        outline: "border border-line-strong bg-surface text-ink hover:border-ink hover:bg-white",
        ghost: "text-ink hover:bg-sunken",
        // underlined text, for low-stakes actions that should not shout
        quiet: "px-0 text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink",
        destructive: "border border-line-strong bg-surface text-alarm hover:border-alarm hover:bg-white",
      },
      size: {
        sm: "h-8 px-3 text-[0.8125rem]",
        default: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
