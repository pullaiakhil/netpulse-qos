import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-text-primary/30 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full max-w-lg rounded-lg border border-border bg-white p-6 shadow-md transition-all z-10',
          className
        )}
      >
        <div className="flex items-start justify-between pb-3 border-b border-border">
          <div>
            <h3 className="text-base font-semibold text-text-primary">{title}</h3>
            {description && <p className="text-xs text-text-secondary mt-1">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary rounded-md p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4">{children}</div>

        {footer && <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">{footer}</div>}
      </div>
    </div>
  );
};
