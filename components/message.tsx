'use client';

import type { UIMessage } from 'ai';
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useState } from 'react';
import type { Vote } from '@/lib/db/schema';
import { DocumentToolCall, DocumentToolResult } from './document';
import { PencilEditIcon, SparklesIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from './weather';
import { TokenInfo } from './token-info';
import equal from 'fast-deep-equal';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { MessageEditor } from './message-editor';
import { DocumentPreview } from './document-preview';
import { MessageReasoning } from './message-reasoning';
import { UseChatHelpers } from '@ai-sdk/react';
import { KlineChart } from './kline-chart';
import Image from 'next/image';
import { RiskProfileCard } from './risk-profile-card';
import { AllocationSuggestion } from './allocation-suggestion';
import { BacktestResult } from './backtest-result';

// 钱包信息组件
const WalletInfo = ({ walletInfo }: { walletInfo: any }) => {
  // 确定网络和样式
  const isBaseNetwork = walletInfo.network === 'base' || walletInfo.network === 'base-sepolia';
  const isBscNetwork = walletInfo.network === 'bsc';
  
  // 根据网络选择样式 - 更优雅简约的配色
  const accentColor = isBaseNetwork 
    ? 'text-blue-600 dark:text-blue-400' 
    : (isBscNetwork ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400');
  const iconColor = isBaseNetwork 
    ? 'text-blue-500 dark:text-blue-400' 
    : (isBscNetwork ? 'text-amber-500 dark:text-amber-400' : 'text-indigo-500 dark:text-indigo-400');
  const bgColor = 'bg-slate-100 dark:bg-slate-800';
  const textColor = 'text-slate-800 dark:text-slate-100';
  
  return (
    <div className={`flex flex-col gap-2 rounded-lg p-3 border ${bgColor} max-w-[400px]`}>
      <div className="flex items-center gap-2">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className={iconColor}
        >
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <path d="M16 14v1a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-1" />
        </svg>
        <div className={`text-sm font-medium ${accentColor}`}>
          Wallet Info
          <span className="ml-2 text-xs px-1.5 py-0.5 rounded uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
            {walletInfo.network}
          </span>
        </div>
      </div>

      <div className="mt-1 flex flex-col gap-1">
        <div className="text-xs text-slate-500 dark:text-slate-400">Address</div>
        <div className={`text-xs font-mono ${textColor} break-all`}>{walletInfo.walletAddress}</div>
      </div>

      {walletInfo.error && (
        <div className="mt-1 text-xs text-red-500 dark:text-red-400">
          Error: {walletInfo.error}
        </div>
      )}
    </div>
  );
};

// 代币余额组件
const TokenBalance = ({ balanceInfo }: { balanceInfo: any }) => {
  const networkId = balanceInfo.network?.networkId || 'base-sepolia';
  const isBaseNetwork = networkId.includes('base');
  const isBscNetwork = networkId.includes('bsc');
  
  // 根据网络选择样式 - 更优雅简约的配色
  const accentColor = isBaseNetwork 
    ? 'text-blue-600 dark:text-blue-400' 
    : (isBscNetwork ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400');
  const iconColor = isBaseNetwork 
    ? 'text-blue-500 dark:text-blue-400' 
    : (isBscNetwork ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-500 dark:text-emerald-400');
  const bgColor = 'bg-slate-100 dark:bg-slate-800';
  const textColor = 'text-slate-800 dark:text-slate-100';
  
  return (
    <div className={`flex flex-col gap-2 rounded-lg p-3 border ${bgColor} max-w-[400px]`}>
      <div className="flex items-center gap-2">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className={iconColor}
        >
          <circle cx="12" cy="12" r="8" />
          <line x1="9.5" y1="9.5" x2="14.5" y2="14.5" />
          <line x1="14.5" y1="9.5" x2="9.5" y2="14.5" />
        </svg>
        <div className={`text-sm font-medium ${accentColor}`}>
          Token Balance
          <span className="ml-2 text-xs px-1.5 py-0.5 rounded uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
            {networkId}
          </span>
        </div>
      </div>

      <div className="mt-1 flex flex-col gap-1">
        <div className="text-xs text-slate-500 dark:text-slate-400">Address</div>
        <div className={`text-xs font-mono ${textColor} break-all`}>{balanceInfo.address}</div>
      </div>

      <div className="mt-1 flex flex-col gap-1">
        <div className="text-xs text-slate-500 dark:text-slate-400">Native Balance</div>
        <div className={`text-xs font-mono ${textColor}`}>{balanceInfo.nativeBalance || '0 WEI'}</div>
      </div>
      
      {balanceInfo.tokens && balanceInfo.tokens.length > 0 && (
        <div className="mt-1 flex flex-col gap-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Other Tokens</div>
          <div className="grid grid-cols-2 gap-1">
            {balanceInfo.tokens.map((token: any, index: number) => (
              <div key={index} className="flex justify-between items-center">
                <span className={`text-xs ${textColor}`}>{token.symbol}</span>
                <span className={`text-xs font-mono ${textColor}`}>{token.balance}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// 转账结果组件
const TransactionResult = ({ transactionData }: { transactionData: any }) => {
  const isSuccess = transactionData.success;
  
  // 根据交易状态选择样式 - 更优雅简约的配色
  const accentColor = isSuccess ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  const iconColor = isSuccess ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
  const bgColor = 'bg-slate-100 dark:bg-slate-800';
  const textColor = 'text-slate-800 dark:text-slate-100';
  const labelColor = 'text-slate-500 dark:text-slate-400';
  
  return (
    <div className={`flex flex-col gap-2 rounded-lg p-3 border ${bgColor} max-w-[400px]`}>
      <div className="flex items-center gap-2">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className={iconColor}
        >
          {isSuccess ? (
            <>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </>
          ) : (
            <>
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6" />
              <path d="m9 9 6 6" />
            </>
          )}
        </svg>
        <div className={`text-sm font-medium ${accentColor}`}>
          {isSuccess ? 'Transaction Successful' : 'Transaction Failed'}
        </div>
      </div>

      {isSuccess && transactionData.transaction ? (
        <div className="mt-1 flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-slate-500 dark:text-slate-400">Transaction Hash</div>
            <div className={`text-xs font-mono ${textColor} break-all`}>{transactionData.transaction.hash}</div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">From</div>
              <div className={`text-xs font-mono ${textColor} truncate`}>{transactionData.transaction.from}</div>
            </div>
            
            <div className="flex flex-col gap-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">To</div>
              <div className={`text-xs font-mono ${textColor} truncate`}>{transactionData.transaction.to}</div>
            </div>
          </div>
          
          <div className="flex flex-col gap-1">
            <div className="text-xs text-slate-500 dark:text-slate-400">Amount</div>
            <div className={`text-xs font-mono ${textColor}`}>{transactionData.transaction.amount} WEI</div>
          </div>
          
          {transactionData.transaction.explorerLink && (
            <div className="flex justify-end mt-1">
              <a 
                href={transactionData.transaction.explorerLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className={`text-xs py-1 px-2 rounded ${accentColor} hover:underline`}
              >
                View on Explorer
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-1 flex flex-col gap-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Error</div>
          <div className="text-xs text-red-500 dark:text-red-400">{transactionData.error}</div>
        </div>
      )}
    </div>
  );
};

// MCP工具调用结果组件
const MCPToolResult = ({ toolName, result }: { toolName: string, result: any }) => {
  // 获取简化的工具名称
  const simplifiedToolName = toolName.replace(/_/g, ' ').split(' ').map(
    word => word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  
  // 确定是哪类工具以选择合适的样式
  const isBlockchainInfo = toolName.startsWith('get_block') || toolName === 'get_latest_block' || toolName === 'get_chain_info';
  const isContractInteraction = toolName.startsWith('read_contract') || toolName.startsWith('write_contract');
  const isTokenOperation = toolName.includes('token') || toolName.includes('erc20') || toolName.includes('native_balance');
  const isNftOperation = toolName.includes('nft') || toolName.includes('erc1155') || toolName.includes('erc721');
  const isTransaction = toolName.includes('transaction') || toolName === 'estimate_gas';
  const isGnfdOperation = toolName.startsWith('gnfd_');
  
  // 选择合适的颜色 - 更优雅简约的配色
  let bgColor = 'bg-slate-100 dark:bg-slate-800';
  let textColor = 'text-slate-800 dark:text-slate-100';
  let accentColor = 'text-slate-600 dark:text-slate-300';
  let iconColor = 'text-slate-500 dark:text-slate-400';
  
  if (isBlockchainInfo) {
    accentColor = 'text-blue-600 dark:text-blue-400';
    iconColor = 'text-blue-500 dark:text-blue-400';
  } else if (isContractInteraction) {
    accentColor = 'text-violet-600 dark:text-violet-400';
    iconColor = 'text-violet-500 dark:text-violet-400';
  } else if (isTokenOperation) {
    accentColor = 'text-emerald-600 dark:text-emerald-400';
    iconColor = 'text-emerald-500 dark:text-emerald-400';
  } else if (isNftOperation) {
    accentColor = 'text-rose-600 dark:text-rose-400';
    iconColor = 'text-rose-500 dark:text-rose-400';
  } else if (isTransaction) {
    accentColor = 'text-amber-600 dark:text-amber-400';
    iconColor = 'text-amber-500 dark:text-amber-400';
  } else if (isGnfdOperation) {
    accentColor = 'text-indigo-600 dark:text-indigo-400';
    iconColor = 'text-indigo-500 dark:text-indigo-400';
  }

  return (
    <div className={`flex items-center gap-3 rounded-lg p-3 border ${bgColor} max-w-[400px]`}>
      <div className="flex-shrink-0">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className={iconColor}
        >
          {isBlockchainInfo ? (
            <>
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </>
          ) : isContractInteraction ? (
            <>
              <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z" />
            </>
          ) : isTokenOperation ? (
            <>
              <circle cx="12" cy="12" r="8" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </>
          ) : isNftOperation ? (
            <>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </>
          ) : isTransaction ? (
            <>
              <path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
              <path d="M16 2v4" />
              <path d="M8 2v4" />
              <path d="M3 10h18" />
            </>
          ) : (
            <>
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </>
          )}
        </svg>
      </div>
      <div className="flex flex-col">
        <div className={`text-sm font-medium ${accentColor}`}>{simplifiedToolName}</div>
        <div className={`text-xs ${textColor}`}>Successfully executed on BSC network</div>
      </div>
    </div>
  );
};

// GraphQL查询结果组件
export function GraphQLResult({ content }: { content: any }) {
  // Parse content
  const parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
  
  // Format GraphQL query to look like JSON
  const formatQuery = (query: string) => {
    // Simple formatting to make GraphQL query look more like JSON
    try {
      // Remove line breaks and extra spaces
      let formattedQuery = query.trim();
      
      // Add proper indentation for nested structures
      formattedQuery = formattedQuery
        .replace(/\{/g, '{\n  ')
        .replace(/\}/g, '\n}')
        .replace(/\s{2,}/g, ' ')
        .replace(/,\s/g, ',\n  ');
      
      return formattedQuery;
    } catch (e) {
      return query; // Return original if formatting fails
    }
  };
  
  // Check for errors
  if (parsedContent.error) {
    return (
      <div className="rounded-md bg-red-50 p-4 my-4 border border-red-200">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">GraphQL Query Failed</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{parsedContent.error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Display multi-step query results
  if (parsedContent.steps && Array.isArray(parsedContent.steps)) {
    return (
      <div className="rounded-md bg-purple-50 p-4 my-4 border border-purple-200">
        <h3 className="text-sm font-medium text-purple-800 mb-2">GraphQL Multi-step Query Executed Successfully</h3>
        
        <div className="space-y-4">
          {parsedContent.steps.map((step: any, index: number) => (
            <div key={index} className="border-t border-purple-200 pt-2">
              <h4 className="text-sm font-medium text-purple-700">Step {index + 1}: {step.description}</h4>
              
              <div className="mt-2 px-3 py-2 bg-white dark:bg-gray-700 rounded-md border border-purple-100 dark:border-purple-900 overflow-x-auto">
                <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{formatQuery(step.query)}</span>
              </div>
              
              {step.error ? (
                <div className="mt-2 text-sm text-red-600">
                  <p>Error: {step.error}</p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Compatible with single-step query display
  return (
    <div className="rounded-md bg-purple-50 p-4 my-4 border border-purple-200">
      <h3 className="text-sm font-medium text-purple-800">GraphQL Query Executed Successfully</h3>
      
      <div className="mt-2 px-3 py-2 bg-white dark:bg-gray-700 rounded-md border border-purple-100 dark:border-purple-900 overflow-x-auto">
        <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{formatQuery(parsedContent.query)}</span>
      </div>
    </div>
  );
}

// 添加预处理函数来清理多余的换行符
function cleanupMessageText(text: string): string {
  // 将3个或更多连续的换行符替换为2个换行符
  return text.replace(/\n{2,}/g, '\n');
}

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  reload,
  isReadonly,
}: {
  chatId: string;
  message: UIMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  return (
    <AnimatePresence>
      <motion.div
        data-testid={`message-${message.role}`}
        className="w-full mx-auto max-w-3xl px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        <div
          className={cn(
            'flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl',
            {
              'w-full': mode === 'edit',
              'group-data-[role=user]/message:w-fit': mode !== 'edit',
            },
          )}
        >
          {message.role === 'assistant' && (
            <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background overflow-hidden">
              <Image 
                src="/images/quant72_logo.jpg" 
                alt="Quant72 Logo" 
                width={48} 
                height={48}
                className="object-cover"
              />
            </div>
          )}

          <div className="flex flex-col gap-4 w-full">
            {message.experimental_attachments && (
              <div
                data-testid={`message-attachments`}
                className="flex flex-row justify-end gap-2"
              >
                {message.experimental_attachments.map((attachment) => (
                  <PreviewAttachment
                    key={attachment.url}
                    attachment={attachment}
                  />
                ))}
              </div>
            )}

            {message.parts?.map((part, index) => {
              const { type } = part;
              const key = `message-${message.id}-part-${index}`;

              if (type === 'reasoning') {
                return (
                  <MessageReasoning
                    key={key}
                    isLoading={isLoading}
                    reasoning={part.reasoning}
                  />
                );
              }

              if (type === 'text') {
                if (mode === 'view') {
                  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      {message.role === 'user' && !isReadonly && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              data-testid="message-edit-button"
                              variant="ghost"
                              className="px-2 h-fit rounded-full text-muted-foreground opacity-0 group-hover/message:opacity-100"
                              onClick={() => {
                                setMode('edit');
                              }}
                            >
                              <PencilEditIcon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit message</TooltipContent>
                        </Tooltip>
                      )}

                      <div
                        data-testid="message-content"
                        className={cn('flex flex-col gap-2', {
                          'bg-primary text-primary-foreground px-3 py-2 rounded-xl':
                            message.role === 'user',
                        })}
                      >
                        <div className="max-w-full overflow-hidden">
                          <Markdown>{cleanupMessageText(part.text)}</Markdown>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (mode === 'edit') {
                  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      <div className="size-8" />

                      <MessageEditor
                        key={message.id}
                        message={message}
                        setMode={setMode}
                        setMessages={setMessages}
                        reload={reload}
                      />
                    </div>
                  );
                }
              }

              if (type === 'tool-invocation') {
                const { toolInvocation } = part;
                const { toolName, toolCallId, state } = toolInvocation;

                if (state === 'call') {
                  const { args } = toolInvocation;

                  if (toolName === 'getTokenInfo') {
                    return (
                      <div key={key} className="flex flex-col gap-4">
                        <div className="text-sm text-muted-foreground">
                          Getting token info...
                        </div>
                      </div>
                    );
                  }
                  
                  if (toolName === 'analyzeKline') {
                    return (
                      <div key={key} className="flex flex-col gap-4">
                        <div className="text-sm text-muted-foreground">
                          Getting K-line data...
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={toolCallId}
                      className={cx({
                        skeleton: ['getWeather'].includes(toolName),
                      })}
                    >
                      {toolName === 'getWeather' ? (
                        <Weather />
                      ) : toolName === 'createDocument' ? (
                        <DocumentPreview isReadonly={isReadonly} args={args} />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolCall
                          type="update"
                          args={args}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolCall
                          type="request-suggestions"
                          args={args}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'getMyWalletAddress' || toolName === 'getBSCWalletAddress' ? (
                        <WalletInfo walletInfo={args} />
                      ) : toolName === 'getMyTokenBalance' || toolName === 'getTokenBalance' ? (
                        <TokenBalance balanceInfo={
                          // 处理可能是字符串的情况
                          typeof args === 'string' ? 
                          // 尝试解析字符串为JSON对象
                          (() => {
                            try {
                              return JSON.parse(args);
                            } catch (e) {
                              // 如果解析失败，创建一个基本的对象结构
                              return {
                                address: args.match(/Address: (0x[a-fA-F0-9]+)/)?.[1] || "Unknown",
                                network: {
                                  networkId: args.match(/Network ID: ([a-z-]+)/)?.[1] || "base-mainnet"
                                },
                                nativeBalance: args.match(/Native Balance: ([0-9]+ WEI)/)?.[1] || "0 WEI",
                                error: "Data format error"
                              };
                            }
                          })() : args
                        } />
                      ) : toolName === 'transferTokens' ? (
                        <div className="text-sm text-muted-foreground">
                          Processing transaction...
                        </div>
                      ) : null}
                    </div>
                  );
                }

                if (state === 'result') {
                  const { result } = toolInvocation;

                  if (toolName === 'getTokenInfo' && result.pools?.[0]) {
                    return (
                      <div key={key} className="flex flex-col gap-4">
                        <TokenInfo data={result.pools[0]} />
                      </div>
                    );
                  }
                  
                  if (toolName === 'analyzeKline') {
                    const tokenSymbol = result.tokenSymbol || 'Unknown';
                    const timeBucket = result.timeBucket || '15s';
                    
                    // 准备风险评估所需的数据
                    const riskData = {
                      symbol: tokenSymbol,
                      price: result.analysis.indicators.price,
                      priceChange24h: result.analysis.indicators.priceChange24h,
                      rsi: result.analysis.indicators.rsi,
                      // 基于RSI和MACD估算波动性
                      volatility: result.analysis.indicators.rsi > 70 || result.analysis.indicators.rsi < 30 ? 0.7 : 0.4,
                      // 基于趋势判断市场状态
                      marketTrend: result.analysis.trend.toLowerCase()
                    };
                    
                    // 确定风险水平
                    let riskLevel: 'low' | 'medium' | 'high';
                    if (riskData.rsi < 30 || riskData.rsi > 70) {
                      // RSI处于极端区域，高风险
                      riskLevel = 'high';
                    } else if (Math.abs(riskData.priceChange24h) > 8) {
                      // 价格变化较大，中等风险
                      riskLevel = 'medium';
                    } else {
                      // 相对稳定，低风险
                      riskLevel = 'low';
                    }
                    
                    return (
                      <div key={key} className="flex flex-col gap-4">
                        <KlineChart 
                          data={result} 
                          tokenSymbol={tokenSymbol}
                          timeBucket={timeBucket}
                        />
                        
                        <RiskProfileCard tokenData={riskData} />
                      </div>
                    );
                  }
                  
                  if (toolName === 'backtestRSIStrategy') {
                    return (
                      <div key={key} className="flex flex-col gap-4">
                        <BacktestResult data={result} />
                      </div>
                    );
                  }

                  return (
                    <div key={toolCallId}>
                      {toolName === 'getWeather' ? (
                        <Weather weatherAtLocation={result} />
                      ) : toolName === 'createDocument' ? (
                        <DocumentPreview
                          isReadonly={isReadonly}
                          result={result}
                        />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolResult
                          type="update"
                          result={result}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolResult
                          type="request-suggestions"
                          result={result}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'getMyWalletAddress' || toolName === 'getBSCWalletAddress' ? (
                        <WalletInfo walletInfo={result} />
                      ) : toolName === 'getMyTokenBalance' || toolName === 'getTokenBalance' ? (
                        <TokenBalance balanceInfo={
                          // 处理可能是字符串的情况
                          typeof result === 'string' ? 
                          // 尝试解析字符串为JSON对象
                          (() => {
                            try {
                              return JSON.parse(result);
                            } catch (e) {
                              // 如果解析失败，创建一个基本的对象结构
                              return {
                                address: result.match(/Address: (0x[a-fA-F0-9]+)/)?.[1] || "Unknown",
                                network: {
                                  networkId: result.match(/Network ID: ([a-z-]+)/)?.[1] || "base-mainnet"
                                },
                                nativeBalance: result.match(/Native Balance: ([0-9]+ WEI)/)?.[1] || "0 WEI",
                                error: "Data format error"
                              };
                            }
                          })() : result
                        } />
                      ) : toolName === 'transferTokens' ? (
                        <TransactionResult transactionData={result} />
                      ) : toolName === 'getMorphoVaults' ? (
                        <div className="rounded-md border p-4 bg-background">
                          <div className="flex flex-row items-center justify-between mb-3">
                            <div className="text-lg font-medium">Morpho Vaults</div>
                            <div className="bg-primary/10 text-primary px-2 py-1 rounded-md text-sm">
                              {(() => {
                                // 尝试解析结果
                                let parsedResult;
                                try {
                                  // 如果结果是字符串，尝试解析JSON
                                  parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
                                  return `Found: ${parsedResult.vaultsCount || 0} vaults`;
                                } catch (e) {
                                  console.error("Failed to parse Morpho result:", e);
                                  return "Found: 0 vaults";
                                }
                              })()}
                            </div>
                          </div>
                          
                          {(() => {
                            // 尝试解析结果
                            let parsedResult;
                            try {
                              // 如果结果是字符串，尝试解析JSON
                              parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
                              
                              if (parsedResult.vaults && parsedResult.vaults.length > 0) {
                                return (
                                  <>
                                    <div className="space-y-4">
                                      {parsedResult.vaults.slice(0, 3).map((vault: any, index: number) => (
                                        <div key={index} className="border rounded-lg p-3 bg-card">
                                          <div className="flex justify-between items-center mb-2">
                                            <div className="font-medium">{vault.name}</div>
                                            <div className="text-sm bg-secondary/50 px-2 py-0.5 rounded text-secondary-foreground">
                                              {vault.tvlUsd}
                                            </div>
                                          </div>
                                          
                                          <div className="text-xs text-muted-foreground mb-1.5">
                                            {vault.metadata?.description || ""}
                                          </div>
                                          
                                          <div className="flex flex-wrap gap-2 text-xs">
                                            <div className="bg-muted px-2 py-0.5 rounded-full font-mono">
                                              {vault.address.substring(0, 6)}...{vault.address.substring(vault.address.length - 4)}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                      
                                      {parsedResult.vaults.length > 3 && (
                                        <div className="text-center text-sm text-muted-foreground pt-2">
                                          + {parsedResult.vaults.length - 3} more vaults
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="mt-3 flex justify-end">
                                      <div className="text-xs text-muted-foreground">
                                        Network: {parsedResult.network}
                                      </div>
                                    </div>
                                  </>
                                );
                              } else {
                                return (
                                  <div className="text-center py-6 text-muted-foreground">
                                    No vaults found matching your criteria.
                                  </div>
                                );
                              }
                            } catch (e) {
                              console.error("Failed to render Morpho vaults:", e);
                              return (
                                <div className="text-center py-6 text-muted-foreground">
                                  Error parsing vault data. Please try again.
                                </div>
                              );
                            }
                          })()}
                        </div>
                      ) : toolName === 'graphQueryAgent' ? (
                        <GraphQLResult content={result} />
                      ) : [
                        'get_block_by_hash', 'get_block_by_number', 'get_latest_block', 'is_contract',
                        'read_contract', 'write_contract', 'get_chain_info', 'get_supported_networks',
                        'resolve_ens', 'get_erc20_token_info', 'get_native_balance', 'get_erc20_balance',
                        'get_transaction', 'get_transaction_receipt', 'estimate_gas', 'transfer_native_token',
                        'approve_token_spending', 'transfer_nft', 'transfer_erc1155', 'transfer_erc20',
                        'get_address_from_private_key', 'get_nft_info', 'check_nft_ownership', 'get_erc1155_token_uri',
                        'get_nft_balance', 'get_erc1155_balance', 'gnfd_get_account_balance', 'gnfd_get_module_accounts',
                        'gnfd_get_all_sps', 'gnfd_create_bucket', 'gnfd_create_file', 'gnfd_create_folder',
                        'gnfd_list_buckets', 'gnfd_list_objects', 'gnfd_delete_object', 'gnfd_delete_bucket',
                        'gnfd_get_bucket_info', 'gnfd_get_object_info', 'gnfd_download_object'
                      ].includes(toolName) ? (
                        <MCPToolResult toolName={toolName} result={result} />
                      ) : (
                        <pre>{JSON.stringify(result, null, 2)}</pre>
                      )}
                    </div>
                  );
                }
              }
            })}

            {!isReadonly && (
              <MessageActions
                key={`action-${message.id}`}
                chatId={chatId}
                message={message}
                vote={vote}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;

    return true;
  },
);

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="w-full mx-auto max-w-3xl px-4 group/message "
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cx(
          'flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl',
          {
            'group-data-[role=user]/message:bg-muted': true,
          },
        )}
      >
      <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background overflow-hidden">
        <Image 
          src="/images/quant72_logo.jpg" 
          alt="Quant72 Logo" 
          width={32} 
          height={32}
          className="object-cover opacity-50"
        />
      </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            Hmm...
          </div>
        </div>
      </div>
    </motion.div>
  );
};
