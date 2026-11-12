import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md border font-medium outline-none transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-brand bg-brand text-white shadow-card hover:border-brand-hover hover:bg-brand-hover",
        secondary: "border-line-strong bg-surface text-text shadow-card hover:bg-subtle",
        ghost: "border-transparent text-text-2 hover:bg-subtle hover:text-text",
        danger: "border-danger-line bg-surface text-danger hover:bg-danger-soft",
        link: "h-auto border-transparent px-0 text-brand underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-[0.8125rem]",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-5 text-base",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  }
)

function Button({
  className,
  variant = "secondary",
  size = "md",
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
