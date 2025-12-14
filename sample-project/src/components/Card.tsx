import React from 'react';
import { cn } from '../utils/classnames';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function Card({ children, title, className }: CardProps) {
  return (
    <div className={cn('bg-white rounded-xl shadow-lg p-6', className)}>
      {title && <h2 className="text-xl font-bold mb-4">{title}</h2>}
      {children}
    </div>
  );
}
