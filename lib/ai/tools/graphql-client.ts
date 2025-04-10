// 模拟GraphQL客户端实现
import { GraphQLClient as ActualGraphQLClient, RequestDocument } from 'graphql-request';
import { MorphoVault } from './morpho/types';

// 创建Morpho API客户端
export class MorphoGraphQLClient {
  private client: ActualGraphQLClient;
  private endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.client = new ActualGraphQLClient(endpoint);
    console.log(`初始化GraphQL客户端，连接到: ${endpoint}`);
  }

  async request<T>(query: RequestDocument, variables?: Record<string, any>): Promise<T> {
    try {
      console.log(`发送GraphQL请求到: ${this.endpoint}`);
      console.log('变量:', variables);
      
      const result = await this.client.request<T>(query, variables);
      console.log(`GraphQL请求成功`);
      return result;
    } catch (error) {
      console.error(`GraphQL请求失败:`, error);
      
      // 如果真实API失败，返回模拟数据作为备份
      if (query.toString().includes('VaultsQuery')) {
        console.warn('使用模拟数据作为备份');
        
      }
      
      throw error;
    }
  }
  
  
}
