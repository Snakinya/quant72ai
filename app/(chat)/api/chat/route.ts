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
import { z } from 'zod';

export const maxDuration = 60;

// 全局变量存储AgentKit状态
let agentKitInitialized = false;
let initializing = false;
let cachedAgentKitTools: Record<string, any> = {};

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel,
    }: {
      id: string;
      messages: Array<UIMessage>;
      selectedChatModel: string;
    } = await request.json();

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

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
        
        // 确保AgentKit只在使用工具时初始化，而且只初始化一次
        let agentKitTools: Record<string, any> = {};
        
        if (shouldUseTools) {
          if (!agentKitInitialized && !initializing) {
            initializing = true;
            try {
              console.log("首次初始化AgentKit...");
              agentKitTools = await getAgentKitTools({ session, dataStream });
              cachedAgentKitTools = agentKitTools; // 缓存工具
              agentKitInitialized = true;
              console.log("可用工具列表:", Object.keys(agentKitTools));
            } catch (error) {
              console.error('首次加载AgentKit失败:', error);
              // 确保即使AgentKit初始化失败，也可以使用基本工具
              agentKitTools = { getMyWalletAddress, getMorphoVaults };
            } finally {
              initializing = false;
            }
          } else if (agentKitInitialized) {
            console.log("使用已初始化的AgentKit");
            agentKitTools = cachedAgentKitTools; // 使用缓存的工具
          } else {
            console.log("AgentKit正在初始化中，稍后再试");
            // 确保即使AgentKit正在初始化中，也可以使用基本工具
            agentKitTools = { getMyWalletAddress, getMorphoVaults };
          }
        }
        
        // 构建激活工具列表
        const baseTools = ['getWeather', 'createDocument', 'updateDocument', 'requestSuggestions', 'getMyWalletAddress', 'getMorphoVaults', 'getTokenInfo', 'analyzeKline', 'backtestRSIStrategy', 'transferTokens'];
        const agentKitToolNames = Object.keys(agentKitTools).filter(key => !baseTools.includes(key));
        const activeTools = [...baseTools, ...agentKitToolNames];
        
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel }),
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
            getMorphoVaults,
            getTokenInfo,
            analyzeKline,
            backtestRSIStrategy,
            ...agentKitTools,
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
