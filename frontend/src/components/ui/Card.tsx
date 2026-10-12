import React, { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, noPadding = false, children, ...props }) => {
  return (
    <div
      className={cn(
        'bg-surface border border-border rounded-lg shadow-sm',
        !noPadding && 'p-5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div className={cn('flex items-center justify-between pb-3 border-b border-border mb-4', className)} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<HTMLAttributes<HTMLHeadingElement>> = ({ className, children, ...props }) => (
  <h3 className={cn('text-sm font-semibold text-text-primary tracking-tight', className)} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<HTMLAttributes<HTMLParagraphElement>> = ({ className, children, ...props }) => (
  <p className={cn('text-xs text-text-secondary mt-0.5', className)} {...props}>
    {children}
  </p>
);
