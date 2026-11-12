import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-[2px] border-2 border-ink font-semibold outline-none transition-colors duration-100 active:translate-y-px disabled:pointer-events-none disabled:border-rule disabled:bg-transparent disabled:text-grey/70",
  {
    variants: {
      variant: {
        default: "bg-ink text-white hover:bg-white hover:text-ink",
        // the marker: one per screen
        accent: "bg-mark text-ink hover:bg-ink hover:text-mark",
        outline: "bg-white text-ink hover:bg-ink hover:text-white",
        ghost: "border-transparent text-ink hover:border-ink",
        // plain underlined text
        quiet: "border-transparent px-0 font-medium text-grey underline underline-offset-4 hover:text-ink",
        destructive: "bg-white text-alarm !border-alarm hover:bg-alarm hover:text-white",
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
