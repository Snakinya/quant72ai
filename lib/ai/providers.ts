import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { groq } from '@ai-sdk/groq';
import { xai } from '@ai-sdk/xai';
import { openai } from '@ai-sdk/openai';
import { deepseek } from './deepseek';
import { isTestEnvironment } from '../constants';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
        'deepseek-chat': deepseek('deepseek-v3'),
      },
    })
  : customProvider({
      languageModels: {
        // 对于常规对话，使用 GPT-4o
        'chat-model': openai('gpt-4o'),
        // 对于轻量级对话（如市场分析等数据密集型任务），使用较小的模型
        'chat-model-mini': openai('gpt-4o-mini'),
        // 推理任务使用 Deepseek 模型，节省 OpenAI 令牌消耗
        'chat-model-reasoning': wrapLanguageModel({
          model: groq('deepseek-r1-distill-llama-70b'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        // DeepSeek Chat 模型
        'deepseek-chat': deepseek('deepseek-v3'),
        // 对于分析型任务，使用更小的模型以减少令牌消耗
        'title-model': openai('gpt-4o-mini'),
        'artifact-model': openai('gpt-4o-mini'), // 对于处理文档类任务，可以使用小型模型
        'analysis-model': openai('gpt-3.5-turbo'), // 为数据分析、K线分析等任务新增专门的轻量级模型
      },
      imageModels: {
        'small-model': xai.image('grok-2-image'),
      },
    });
