'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type ChainType = 'base' | 'bsc';

interface ChainContextType {
  currentChain: ChainType;
  setCurrentChain: (chain: ChainType) => void;
}

const ChainContext = createContext<ChainContextType | undefined>(undefined);

export function ChainProvider({ children }: { children: React.ReactNode }) {
  // Default to Base chain
  const [currentChain, setCurrentChain] = useState<ChainType>('base');

  // Load previously selected chain from local storage
  useEffect(() => {
    const savedChain = localStorage.getItem('selectedChain');
    if (savedChain === 'base' || savedChain === 'bsc') {
      setCurrentChain(savedChain);
    }
  }, []);

  // Save selection to local storage
  const handleSetChain = (chain: ChainType) => {
    setCurrentChain(chain);
    localStorage.setItem('selectedChain', chain);
  };

  return (
    <ChainContext.Provider value={{ currentChain, setCurrentChain: handleSetChain }}>
      {children}
    </ChainContext.Provider>
  );
}

export function useChain() {
  const context = useContext(ChainContext);
  if (context === undefined) {
    throw new Error('useChain must be used within a ChainProvider');
  }
  return context;
} 