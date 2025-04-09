import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { groq } from '@ai-sdk/groq';
import { xai } from '@ai-sdk/xai';
import { openai } from '@ai-sdk/openai';
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
        'chat-model-agentkit': chatModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': openai('gpt-4o'),
        'chat-model-mini': openai('gpt-4o-mini'),
        'chat-model-reasoning': wrapLanguageModel({
          model: groq('deepseek-r1-distill-llama-70b'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'chat-model-agentkit': openai('gpt-4o'),
        'title-model': openai('gpt-4o'),
        'artifact-model': openai('gpt-4o'),
      },
      imageModels: {
        'small-model': xai.image('grok-2-image'),
      },
    });
