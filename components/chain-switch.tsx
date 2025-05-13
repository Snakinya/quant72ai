'use client';

import { useChain } from '@/lib/context/chain-context';
import { useState } from 'react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { toast } from 'sonner';
import Image from 'next/image';
import { CheckIcon } from '@radix-ui/react-icons';

export function ChainSwitch() {
  const { currentChain, setCurrentChain } = useChain();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Chain configuration
  const chains = {
    base: {
      name: 'Base',
      icon: '/images/base.jpeg',
      description: 'Base Chain',
    },
    bsc: {
      name: 'BSC',
      icon: '/images/bn.png',
      description: 'BNB Smart Chain',
    },
  };

  const currentChainInfo = chains[currentChain];

  // Handle chain switching
  const handleChainChange = async (chain: 'base' | 'bsc') => {
    if (chain === currentChain) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    
    try {
      // Update server state
      const response = await fetch('/api/update-chain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chain }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to switch chain');
      }

      // Update local state
      setCurrentChain(chain);
      toast.success(`Switched to ${chains[chain].name} chain`);
    } catch (error) {
      console.error('Chain switch error:', error);
      toast.error('Failed to switch chain, please try again');
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2 flex items-center gap-2 rounded-full"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2"></div>
              <span>Switching...</span>
            </div>
          ) : (
            <>
              <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                <Image 
                  src={currentChainInfo.icon} 
                  alt={currentChainInfo.name} 
                  width={20} 
                  height={20}
                  className="object-cover"
                />
              </div>
              <span className="text-sm font-medium">{currentChainInfo.name}</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px]">
        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground border-b">
          Select Blockchain Network
        </div>
        {Object.entries(chains).map(([id, chain]) => (
          <DropdownMenuItem
            key={id}
            className="flex items-center gap-2 px-2 py-2 cursor-pointer"
            onClick={() => handleChainChange(id as 'base' | 'bsc')}
            disabled={isLoading}
          >
            <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
              <Image 
                src={chain.icon} 
                alt={chain.name} 
                width={24} 
                height={24}
                className="object-cover"
              />
            </div>
            <div className="flex flex-col flex-grow">
              <span className="font-medium">{chain.name}</span>
              <span className="text-xs text-muted-foreground">{chain.description}</span>
            </div>
            {currentChain === id && (
              <CheckIcon className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 