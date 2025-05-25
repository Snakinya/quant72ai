import { openai } from '@ai-sdk/openai';
import { experimental_createMCPClient } from 'ai';
import 'dotenv/config';

async function main() {
  // ✅ 使用 Cloud Run 托管地址（SSE 模式）
  const mcpClient = await experimental_createMCPClient({
    transport: {
      type: 'sse',
      url: 'https://bnbmcp-1050777029418.asia-south1.run.app/sse',
      headers: {
        // 如果需要认证，例如 Bearer Token，可添加：
        // Authorization: `Bearer ${process.env.MCP_TOKEN}`
      },
    },
  });

  console.log('✅ Connected to Cloud Run SSE MCP service');

  // 拉取工具（Tool Calls）
  const tools = await mcpClient.tools();
  console.log(`🛠️ 加载了 ${tools.length} 个工具：`);
  
  // 列出工具信息
  console.log('可用工具列表：');
  console.log(JSON.stringify(tools, null, 2));

  await mcpClient.close();
  console.log('✅ MCP connection closed');
}

main().catch((err) => {
  console.error('❌ Error during MCP test:', err);
});
