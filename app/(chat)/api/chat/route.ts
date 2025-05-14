import {
  UIMessage,
  appendResponseMessages,
  createDataStreamResponse,
  smoothStream,
  streamText,
  tool,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  getTrailingMessageId,
} from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { getTokenInfo, analyzeKline } from '@/lib/ai/tools/get-token-info';
import { backtestRSIStrategy } from '@/lib/ai/tools/backtest-strategy';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { getAgentKitTools, getMyWalletAddress, transferTokens } from '@/lib/ai/tools/agentkit';
import { getMorphoVaults } from '@/lib/ai/tools/morpho';
import { getBSCToolkit, cleanupBSCToolkit } from '@/lib/ai/tools/bsctoolkit';
import { graphQueryAgent } from '@/lib/ai/tools/graphqlagent';
import { z } from 'zod';
import { cookies } from 'next/headers';

export const maxDuration = 60;

// 全局变量存储工具状态
let agentKitInitialized = false;
let initializing = false;
let cachedAgentKitTools: Record<string, any> = {};

// 使用Map存储用户级别的缓存，确保在服务器重启后也能保持
const userAgentKitCache = new Map<string, {
  initialized: boolean;
  tools: Record<string, any>;
}>();

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel,
      selectedChain = 'base',
    }: {
      id: string;
      messages: Array<UIMessage>;
      selectedChatModel: string;
      selectedChain?: 'base' | 'bsc';
    } = await request.json();

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userId = session.user.id;

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message: userMessage,
      });

      await saveChat({ id, userId: session.user.id, title });
    } else {
      if (chat.userId !== session.user.id) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: userMessage.id,
          role: 'user',
          parts: userMessage.parts,
          attachments: userMessage.experimental_attachments ?? [],
          createdAt: new Date(),
        },
      ],
    });

    return createDataStreamResponse({
      execute: async (dataStream) => {
        // 根据选择的模型确定是否使用工具
        const shouldUseTools = selectedChatModel !== 'chat-model-reasoning';
        
        // 确保AgentKit和BSCToolkit只在使用工具时并且选择了相应的链时初始化
        let agentKitTools: Record<string, any> = {};
        let bscTools: Record<string, any> = {};
        
        try {
          if (shouldUseTools) {
            // 根据当前选择的链初始化相应的工具
            if (selectedChain === 'base') {
              // 检查用户特定的缓存
              const userCache = userAgentKitCache.get(userId);
              
              if (userCache?.initialized) {
                // 使用用户缓存的工具
                console.log(`使用用户 ${userId} 的缓存AgentKit工具`);
                agentKitTools = userCache.tools;
              } else if (!initializing) {
                // 初始化Base链工具
                initializing = true;
                try {
                  console.log(`为用户 ${userId} 初始化AgentKit...`);
                  agentKitTools = await getAgentKitTools({ session, dataStream });
                  
                  // 保存到用户缓存
                  userAgentKitCache.set(userId, {
                    initialized: true,
                    tools: agentKitTools
                  });
                  
                  console.log(`用户 ${userId} 的AgentKit工具初始化完成`);
                } catch (error) {
                  console.error(`用户 ${userId} 的AgentKit初始化失败:`, error);
                  // 确保即使AgentKit初始化失败，也可以使用基本工具
                  agentKitTools = { getMyWalletAddress, getMorphoVaults, transferTokens };
                } finally {
                  initializing = false;
                }
              } else {
                console.log("AgentKit正在初始化中，稍后再试");
                // 确保即使AgentKit正在初始化中，也可以使用基本工具
                agentKitTools = { getMyWalletAddress, getMorphoVaults, transferTokens };
              }
            } else if (selectedChain === 'bsc') {
              // 简化BSC链工具初始化逻辑，直接使用bsctoolkit.ts中的缓存机制
              try {
                console.log("获取BSCToolkit...");
                // 直接调用getBSCToolkit，它会内部处理缓存逻辑
                bscTools = await getBSCToolkit();
                console.log(`获取到BSC工具，包含${Object.keys(bscTools).length}个工具`);
              } catch (error) {
                console.error('加载BSCToolkit失败:', error);
                bscTools = {}; // 出错时使用空对象
              }
            }
          }
          
          // 构建激活工具列表
          const baseTools = ['getWeather', 'createDocument', 'updateDocument', 'requestSuggestions', 'getTokenInfo', 'analyzeKline', 'backtestRSIStrategy', 'graphQueryAgent'];

          // 根据选择的链添加不同的工具
          let chainTools: string[] = [];
          if (selectedChain === 'base') {
            chainTools = ['getMyWalletAddress', 'getMorphoVaults', 'transferTokens', ...Object.keys(agentKitTools)];
          } else if (selectedChain === 'bsc') {
            chainTools = [...Object.keys(bscTools)];
          }

          const activeTools = [...baseTools, ...chainTools.filter(key => !baseTools.includes(key))];
          
          console.log(`当前链: ${selectedChain}, 可用工具列表:`, activeTools);
          
          // 增强系统提示以说明当前链
          const chainInfo = selectedChain === 'base' 
            ? '用户当前在Base链上操作。Base是一个以太坊L2网络，速度快、费用低。'
            : '用户当前在BSC链上操作。BSC (BNB Smart Chain) 是币安智能链，支持智能合约并与以太坊兼容。';
            
          const enhancedPrompt = systemPrompt({ selectedChatModel }) + '\n\n' + chainInfo;
          
          const result = streamText({
            model: myProvider.languageModel(selectedChatModel),
            system: enhancedPrompt,
            messages,
            maxSteps: 5,
            experimental_activeTools: !shouldUseTools ? [] : activeTools as any,
            experimental_transform: smoothStream({ chunking: 'word' }),
            experimental_generateMessageId: generateUUID,
            tools: {
              getWeather,
              createDocument: createDocument({ session, dataStream }),
              updateDocument: updateDocument({ session, dataStream }),
              requestSuggestions: requestSuggestions({
                session,
                dataStream,
              }),
              getTokenInfo,
              analyzeKline,
              backtestRSIStrategy,
              graphQueryAgent,
              ...(selectedChain === 'base' ? { getMorphoVaults, transferTokens, ...agentKitTools } : {}),
              ...(selectedChain === 'bsc' ? bscTools : {}),
            },
            onFinish: async ({ response }) => {
              if (session.user?.id) {
                try {
                  const assistantId = getTrailingMessageId({
                    messages: response.messages.filter(
                      (message) => message.role === 'assistant',
                    ),
                  });

                  if (!assistantId) {
                    throw new Error('No assistant message found!');
                  }

                  const [, assistantMessage] = appendResponseMessages({
                    messages: [userMessage],
                    responseMessages: response.messages,
                  });

                  await saveMessages({
                    messages: [
                      {
                        id: assistantId,
                        chatId: id,
                        role: assistantMessage.role,
                        parts: assistantMessage.parts,
                        attachments:
                          assistantMessage.experimental_attachments ?? [],
                        createdAt: new Date(),
                      },
                    ],
                  });
                } catch (_) {
                  console.error('Failed to save chat');
                }
              }
            },
            experimental_telemetry: {
              isEnabled: isProductionEnvironment,
              functionId: 'stream-text',
            },
          });

          result.consumeStream();

          result.mergeIntoDataStream(dataStream, {
            sendReasoning: true,
          });
        } finally {
          // 如果使用的是BSC链，在响应结束时清理MCP客户端
          if (selectedChain === 'bsc') {
            try {
              console.log("清理BSCToolkit MCP客户端...");
              // 注意：不传用户ID，避免清理缓存的工具，只清理当前会话的MCP客户端
              // await cleanupBSCToolkit(); 
              // 上面的代码会清理所有用户的连接，可能影响性能，因此我们通常不在每次请求后清理
              // 实际部署时，可以考虑在应用关闭时或在定时任务中清理长时间未使用的连接
            } catch (cleanupError) {
              console.error("清理BSCToolkit时出错:", cleanupError);
            }
          }
        }
      },
      onError: (error) => {
        console.error('Stream error:', error);
        return 'Oops, an error occurred!';
      },
    });
  } catch (error) {
    console.error("API错误:", error);
    return new Response('服务器处理请求时发生错误', {
      status: 500,
    });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request!', {
      status: 500,
    });
  }
}
