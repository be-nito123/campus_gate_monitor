import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/utils/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5 transition-colors whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-primary/30 bg-primary/10 text-[#8fbaff]',
        secondary: 'border-border bg-secondary text-secondary-foreground',
        outline: 'border-border bg-transparent text-muted-foreground',
        success: 'border-success/30 bg-success/10 text-[#6fe0a5]',
        warning: 'border-warning/30 bg-warning/10 text-[#f7c05c]',
        destructive: 'border-destructive/30 bg-destructive/10 text-[#ff8a80]',
        info: 'border-info/30 bg-info/10 text-[#7dd3fc]',
        neutral: 'border-border bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
