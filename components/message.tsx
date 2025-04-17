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
import { parseTransactionMessage } from '@/lib/utils';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { MessageEditor } from './message-editor';
import { DocumentPreview } from './document-preview';
import { MessageReasoning } from './message-reasoning';
import { UseChatHelpers } from '@ai-sdk/react';
import { KlineChart } from './kline-chart';
import { TransactionCard } from './transaction-card';
import Image from 'next/image';
import { RiskProfileCard } from './risk-profile-card';
import { AllocationSuggestion } from './allocation-suggestion';
import { BacktestResult } from './backtest-result';

// 钱包信息组件
const WalletInfo = ({ walletInfo }: { walletInfo: any }) => {
  return (
    <div className="flex flex-col gap-4 rounded-2xl p-4 bg-indigo-800 max-w-[500px]">
      <div className="flex flex-row justify-between items-center">
        <div className="flex flex-row gap-2 items-center">
          <div className="size-10 rounded-full bg-indigo-200 flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="text-indigo-800"
            >
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <path d="M16 14v1a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-1" />
            </svg>
          </div>
          <div className="text-2xl font-medium text-indigo-50">Wallet Info</div>
        </div>
        <div className="text-indigo-50 bg-indigo-700 px-2 py-1 rounded-lg">{walletInfo.network}</div>
      </div>

      <div className="flex flex-col gap-2 bg-indigo-700 rounded-xl p-3">
        <div className="text-indigo-200 text-sm">Wallet Address</div>
        <div className="text-indigo-50 font-mono text-sm break-all">{walletInfo.walletAddress}</div>
      </div>

      <div className="text-indigo-300 text-xs text-right">Powered by Coinbase AgentKit</div>
    </div>
  );
};

// 代币余额组件
const TokenBalance = ({ balanceInfo }: { balanceInfo: any }) => {
  return (
    <div className="flex flex-col gap-4 rounded-2xl p-4 bg-blue-800 max-w-[500px]">
      <div className="flex flex-row justify-between items-center">
        <div className="flex flex-row gap-2 items-center">
          <div className="size-10 rounded-full bg-blue-200 flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="text-blue-800"
            >
              <circle cx="12" cy="12" r="8" />
              <path d="M9.5 9.5 14.5 14.5" />
              <path d="M14.5 9.5 9.5 14.5" />
            </svg>
          </div>
          <div className="text-2xl font-medium text-blue-50">Token Balance</div>
        </div>
        <div className="text-blue-50 bg-blue-700 px-2 py-1 rounded-lg">{balanceInfo.network?.networkId || 'base-sepolia'}</div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 bg-blue-700 rounded-xl p-3">
          <div className="text-blue-200 text-sm">Wallet Address</div>
          <div className="text-blue-50 font-mono text-sm break-all">{balanceInfo.address}</div>
        </div>

        <div className="flex flex-col gap-2 bg-blue-700 rounded-xl p-3">
          <div className="text-blue-200 text-sm">Native Token Balance</div>
          <div className="text-blue-50 font-mono text-sm">{balanceInfo.nativeBalance || '0 WEI'}</div>
        </div>
        
        {balanceInfo.tokens && balanceInfo.tokens.length > 0 && (
          <div className="flex flex-col gap-2 bg-blue-700 rounded-xl p-3">
            <div className="text-blue-200 text-sm">Other Tokens</div>
            {balanceInfo.tokens.map((token: any, index: number) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-blue-50">{token.symbol}</span>
                <span className="text-blue-50 font-mono">{token.balance}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-blue-300 text-xs text-right">Powered by Coinbase AgentKit</div>
    </div>
  );
};

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
                // 检查文本是否包含转账信息
                const transactionInfo = parseTransactionMessage(part.text);
                
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
                        className={cn('flex flex-col gap-4', {
                          'bg-primary text-primary-foreground px-3 py-2 rounded-xl':
                            message.role === 'user',
                        })}
                      >
                        {/* 如果是转账信息，显示交易卡片 */}
                        {transactionInfo ? (
                          <>
                            <TransactionCard transaction={transactionInfo.data} />
                            {/* 显示原始文本（可选，您可以注释掉这部分来只显示卡片） */}
                            <Markdown>{part.text}</Markdown>
                          </>
                        ) : (
                          <Markdown>{part.text}</Markdown>
                        )}
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
                      ) : toolName === 'getMyWalletAddress' ? (
                        <WalletInfo walletInfo={args} />
                      ) : toolName === 'getMyTokenBalance' || toolName === 'getTokenBalance' ? (
                        <TokenBalance balanceInfo={args} />
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
                      ) : toolName === 'getMyWalletAddress' ? (
                        <WalletInfo walletInfo={result} />
                      ) : toolName === 'getMyTokenBalance' || toolName === 'getTokenBalance' ? (
                        <TokenBalance balanceInfo={result} />
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
