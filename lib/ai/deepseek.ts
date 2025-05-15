import { createDeepSeek } from '@ai-sdk/deepseek';

export const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEE_API_KEY ?? '',
  baseURL: 'https://api.lkeap.tencentcloud.com/v1',

}); 