export const DEFAULT_CHAT_MODEL: string = 'chat-model';

interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model',
    name: 'GPT-4o',
    description: 'OpenAI GPT-4o model',
  },
  {
    id: 'chat-model-mini',
    name: 'GPT-4o-mini',
    description: 'OpenAI GPT-4o-mini model',
  },
];
