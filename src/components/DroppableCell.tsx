'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

interface DroppableCellProps {
  id: string;
  children?: React.ReactNode;
  className?: string;
  /**
   * Piano di sovrapposizione della cella. Nel calendario serve uno z-index DECRESCENTE
   * (le righe del mattino sopra le successive): una card lunga deve coprire le righe
   * sottostanti, mentre la colonna degli orari (`sticky left-0 z-[70]`) deve restare
   * sopra tutte le card, altrimenti le card semitrasparenti (15%) le passano sopra e i
   * numeri diventano illeggibili.
   * Lo z-index va QUI e non sulla riga: una riga con z-index crea uno stacking context
   * e la colonna orari (figlia della riga) non può più salire sopra le altre righe.
   */
  zIndex?: number;
}

export const DroppableCell = ({ id, children, className, zIndex }: DroppableCellProps) => {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  });

  return (
    <div 
      ref={setNodeRef}
      style={zIndex !== undefined ? { zIndex } : undefined}
      className={cn(
        "border-r border-zinc-200 dark:border-zinc-800 last:border-0 relative h-10 transition-colors",
        isOver ? "bg-blue-500/5 ring-2 ring-blue-500/20 ring-inset" : "",
        className
      )}
    >
      {children}
    </div>
  );
};
