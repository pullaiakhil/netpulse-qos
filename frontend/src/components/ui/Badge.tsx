import React, { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'critical' | 'info';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  size = 'md',
  children,
  ...props
}) => {
  const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-[11px]',
    md: 'px-2.5 py-0.5 text-xs',
  };

  const variantStyles = {
    default: 'bg-surface-secondary text-text-primary border border-border',
    secondary: 'bg-surface-secondary text-text-secondary',
    outline: 'bg-transparent border border-border text-text-secondary',
    success: 'bg-success-bg text-success-text border border-success/20',
    warning: 'bg-warning-bg text-warning-text border border-warning/20',
    critical: 'bg-critical-bg text-critical-text border border-critical/20',
    info: 'bg-info-bg text-info-text border border-info/20',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full select-none',
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
