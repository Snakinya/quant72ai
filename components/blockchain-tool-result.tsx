'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface BlockchainToolResultProps {
  type: string;
  result: any;
}

export function BlockchainToolResult({ type, result }: BlockchainToolResultProps) {
  // 简化的组件，可以根据需要扩展
  const isSuccess = result.success || result.txHash || result.transactionHash;
  const txHash = result.txHash || result.transactionHash || '';
  
  // 根据类型和结果渲染适当的 UI
  switch (type) {
    case 'wallet-details':
      return (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-900">
          <h3 className="text-lg font-medium mb-2">钱包详情</h3>
          <div>
            <div>地址: {result.address}</div>
            <div>网络: {result.network?.networkId || '未知'}</div>
            <div>余额: {result.balance} {result.symbol}</div>
          </div>
        </div>
      );
      
    case 'token-balance':
      return (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-900">
          <h3 className="text-lg font-medium mb-2">代币余额</h3>
          <div>
            <div>代币: {result.token || result.contractAddress}</div>
            <div>余额: {result.balance || result.amount || '0'} {result.symbol || ''}</div>
          </div>
        </div>
      );
      
    case 'transfer':
      return (
        <div className={`border rounded-lg p-4 ${isSuccess ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}`}>
          <h3 className="text-lg font-medium mb-2">
            {isSuccess ? '转账成功' : '转账失败'}
          </h3>
          {isSuccess ? (
            <div>
              <div>接收方: {result.to || result.recipient || result.toAddress}</div>
              <div>金额: {result.amount || result.value} {result.symbol || ''}</div>
              {txHash && (
                <div className="mt-2">
                  <div>交易哈希:</div>
                  <div className="flex items-center">
                    <span className="mr-1 font-mono">{txHash.substring(0, 10)}...{txHash.substring(txHash.length - 8)}</span>
                    <Link href={getBlockExplorerUrl(txHash)} target="_blank" className="text-blue-500 hover:text-blue-700">
                      <ExternalLink size={14} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-red-600 dark:text-red-400">
              {result.error || '交易失败，请稍后重试。'}
            </div>
          )}
        </div>
      );
      
    // 默认情况：直接以 JSON 形式展示结果
    default:
      return (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-900 overflow-auto">
          <h3 className="text-lg font-medium mb-2">区块链操作结果</h3>
          <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
        </div>
      );
  }
}

// 根据交易哈希获取区块浏览器 URL
function getBlockExplorerUrl(txHash: string): string {
  if (!txHash) return '#';
  
  // 根据环境变量确定当前网络
  const isBaseSepolia = process.env.NEXT_PUBLIC_CHAIN_ID === '84532';
  
  if (isBaseSepolia) {
    return `https://sepolia.basescan.org/tx/${txHash}`;
  } else {
    return `https://basescan.org/tx/${txHash}`;
  }
} 