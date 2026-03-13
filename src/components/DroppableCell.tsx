'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

interface DroppableCellProps {
  id: string;
  children?: React.ReactNode;
}

export const DroppableCell = ({ id, children }: DroppableCellProps) => {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "border-r border-zinc-100 dark:border-zinc-800 last:border-0 relative h-20 transition-colors",
        isOver ? "bg-blue-500/5 ring-2 ring-blue-500/20 ring-inset" : ""
      )}
    >
      {children}
    </div>
  );
};
