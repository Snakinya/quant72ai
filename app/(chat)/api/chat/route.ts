import {
  UIMessage,
  appendResponseMessages,
  createDataStreamResponse,
  smoothStream,
  streamText,
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
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
// 引入 AgentKit 相关依赖
import { 
  AgentKit, 
  CdpWalletProvider, 
  basenameActionProvider,
  morphoActionProvider,
  walletActionProvider,
  cdpWalletActionProvider,
  cdpApiActionProvider,
} from '@coinbase/agentkit';
import { base, baseSepolia } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';

// 创建 AgentKit 实例
let agentKitInstance: any = null;

// 异步初始化 AgentKit 实例
async function getAgentKit() {
  if (agentKitInstance) return agentKitInstance;

  try {
    // 获取环境变量
    const apiKeyName = process.env.COINBASE_API_KEY_NAME;
    const privateKey = process.env.COINBASE_API_PRIVATE_KEY;
    const seedPhrase = process.env.SEED_PHRASE;
    const chainId = process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : base.id;
    
    if (!apiKeyName || !privateKey || !seedPhrase) {
      throw new Error('Missing required environment variables for AgentKit');
    }

    // 配置钱包提供者
    const cdpWalletProvider = await CdpWalletProvider.configureWithWallet({
      mnemonicPhrase: seedPhrase,
      apiKeyName,
      apiKeyPrivateKey: privateKey,
      networkId: chainId === baseSepolia.id ? 'base-sepolia' : 'base-mainnet',
    });

    // 初始化 AgentKit
    agentKitInstance = await AgentKit.from({
      cdpApiKeyName: apiKeyName,
      cdpApiKeyPrivateKey: privateKey,
      walletProvider: cdpWalletProvider,
      actionProviders: [
        basenameActionProvider(),
        morphoActionProvider(),
        walletActionProvider(),
        cdpWalletActionProvider({
          apiKeyName,
          apiKeyPrivateKey: privateKey,
        }),
        cdpApiActionProvider({
          apiKeyName,
          apiKeyPrivateKey: privateKey,
        }),
      ],
    });

    return agentKitInstance;
  } catch (error) {
    console.error('Failed to initialize AgentKit:', error);
    throw error;
  }
}

export const maxDuration = 60;

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
        // 获取 AgentKit 工具
        let agentKitTools = {};
        try {
          const agentKit = await getAgentKit();
          
          // 为避免类型错误，使用更安全的方法获取工具
          // agentKit 的类型声明可能滞后于实际 API
          if (typeof agentKit.getVercelAiTools === 'function') {
            agentKitTools = agentKit.getVercelAiTools();
          } else if (typeof agentKit.tools === 'function') {
            const toolsResult = agentKit.tools();
            if (toolsResult.vercelAiTools) {
              agentKitTools = toolsResult.vercelAiTools;
            } else {
              agentKitTools = toolsResult;
            }
          }
          
          console.log('Loaded AgentKit tools:', Object.keys(agentKitTools));
        } catch (error) {
          console.error('Failed to initialize AgentKit tools:', error);
          // 继续执行，但不使用 AgentKit 工具
        }

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel }),
          messages,
          maxSteps: 5,
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                  // AgentKit 工具会自动通过 tools 参数传递进去，不需要手动添加
                ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_generateMessageId: generateUUID,
          tools: {
            ...agentKitTools, // 添加 AgentKit 工具
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
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
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });
  } catch (error) {
    return new Response('An error occurred while processing your request!', {
      status: 404,
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
