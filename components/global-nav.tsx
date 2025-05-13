'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ChainSwitch } from './chain-switch';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './theme-toggle';

export function GlobalNav() {
  const pathname = usePathname();
  
  // Only show on specific pages
  if (pathname.includes('/login') || pathname.includes('/register')) {
    return null;
  }

  return (
    <div className="fixed top-0 right-0 z-50 flex items-center gap-3 p-3 m-4 bg-background/80 backdrop-blur-md rounded-full shadow-md border border-border">
      <ThemeToggle />
      <div className="h-4 w-px bg-border" />
      <ChainSwitch />
    </div>
  );
} 