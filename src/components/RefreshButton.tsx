'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RefreshButtonProps {
  onRefresh?: () => Promise<void> | void;
  className?: string;
}

export const RefreshButton = ({ onRefresh, className }: RefreshButtonProps) => {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    try {
      // 1. Refresh Next.js server components/actions cache
      router.refresh();
      
      // 2. Call local refresh if provided (for client-side state)
      if (onRefresh) {
        await onRefresh();
      }
      
      // small delay to ensure animation is visible if data fetch was instant
      await new Promise(resolve => setTimeout(resolve, 600));
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={cn(
        "group relative flex items-center justify-center p-2.5 rounded-xl transition-all duration-300",
        "bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 dark:border-white/10",
        "shadow-lg shadow-black/5 hover:shadow-blue-500/10 hover:border-blue-500/30",
        "active:scale-95 disabled:opacity-80 disabled:cursor-wait",
        className
      )}
      title="Aggiorna dati"
    >
      <RefreshCw 
        size={18} 
        className={cn(
          "text-zinc-600 dark:text-zinc-400 group-hover:text-blue-500 transition-all duration-500",
          isRefreshing && "animate-spin text-blue-500"
        )} 
      />
      
      {/* Subtle glow effect on hover */}
      <div className={cn(
        "absolute inset-0 rounded-xl bg-blue-500/0 group-hover:bg-blue-500/5 transition-all duration-500",
        isRefreshing && "bg-blue-500/10 animate-pulse"
      )} />
    </button>
  );
};
