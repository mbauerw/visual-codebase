import React from 'react';
import { cn } from '../utils/classnames';
import { useTheme } from '../hooks/useTheme';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
}

export function Button({ children, variant = 'primary', onClick }: ButtonProps) {
  const { theme } = useTheme();

  return (
    <button
      className={cn(
        'px-4 py-2 rounded-lg font-medium',
        variant === 'primary' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800',
        theme === 'dark' && 'ring-1 ring-gray-700'
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
