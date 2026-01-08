// Badge component for status indicators

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'bg-white/10 text-white',
        live:
          'bg-red-500 text-white animate-pulse',
        final:
          'bg-white/20 text-white',
        scheduled:
          'bg-blue-500/20 text-blue-300',
        success:
          'bg-green-500/20 text-green-300',
        warning:
          'bg-yellow-500/20 text-yellow-300',
        error:
          'bg-red-500/20 text-red-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };





