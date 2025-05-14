// app/tools/graphQueryAgent.ts - LLM+GraphQL 自动查询工具 for Vercel

import { tool } from 'ai';
import { z } from 'zod';
import { createClient, gql } from '@urql/core';
import { cacheExchange, fetchExchange } from '@urql/core';

// Create GraphQL client
const client = createClient({
  url: 'https://gateway.thegraph.com/api/subgraphs/id/HMuAwufqZ1YCRmzL2SfHTVkzZovC9VL2UAKhjvRqKiR1',
  fetchOptions: {
    headers: {
      Authorization: `Bearer ${process.env.THEGRAPH_API_KEY}`,
    },
  },
  exchanges: [cacheExchange, fetchExchange],
});

// Generate query plan from natural language
async function generateQueryPlan(nlQuery: string): Promise<{ steps: Array<{ description: string, query: string, variables?: any }> }> {
  try {
    console.log("📊 GraphQL Tool: Generating query plan...");
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a GraphQL expert for Uniswap V3 subgraph. Break down complex queries into logical steps.

Main entities and fields in the Uniswap V3 subgraph:
- pools: id, token0, token1, feeTier, liquidity, sqrtPrice, tick, totalValueLockedUSD, volumeUSD, createdAtTimestamp
- tokens: id, symbol, name, decimals, volume, totalValueLocked
- swaps: id, timestamp, pool, token0, token1, sender, recipient, origin, amount0, amount1, amountUSD
- positions: id, owner, pool, liquidity, depositedToken0, depositedToken1
- ticks: id, poolAddress, tickIdx, liquidityGross, liquidityNet

Important notes:
- There are no transactions.user or transactions.volumeUSD fields
- Use amount0 instead of amount0In
- Use correct field names and filters in your queries

For each step, provide a description and the corresponding GraphQL query.
Reply in JSON format,not include any other text like "\`\`\`json" or "\`\`\`":
{
  "steps": [
    {
      "description": "Step 1 description",
      "query": "GraphQL query for step 1",
      "variables": {} 
    },
    {
      "description": "Step 2 description",
      "query": "GraphQL query for step 2 (may use results from step 1)",
      "variables": {}
    }
  ]
}

Example query:
{ pools(first: 5, orderBy: createdAtTimestamp, orderDirection: desc) { id token0 { symbol } token1 { symbol } } }
`
          },
          {
            role: 'user',
            content: nlQuery,
          },
        ],
        temperature: 0,
      }),
    });

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content?.trim();
    console.log("📊 GraphQL Tool: OpenAI response:", text);
    
    // Handle non-JSON responses
    if (!text || text.startsWith("I'm sorry") || text.startsWith("{") === false) {
      console.error("📊 GraphQL Tool: Non-JSON response from OpenAI:", text);
      return {
        steps: [
          {
            description: "Default query for latest pools",
            query: `{ pools(first: 5, orderBy: createdAtTimestamp, orderDirection: desc) { id token0 { symbol } token1 { symbol } totalValueLockedUSD } }`,
            variables: {}
          }
        ]
      };
    }
    
    try {
      const parsed = JSON.parse(text);
      return parsed;
    } catch (parseError) {
      console.error("📊 GraphQL Tool: JSON parse error:", parseError);
      // Try to extract JSON part
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error("📊 GraphQL Tool: Failed to extract JSON:", e);
        }
      }
      
      // Return default query plan
      return {
        steps: [
          {
            description: "Default query for latest pools",
            query: `{ pools(first: 5, orderBy: createdAtTimestamp, orderDirection: desc) { id  token1 { symbol } totalValueLockedUSD } }`,
            variables: {}
          }
        ]
      };
    }
  } catch (error) {
    console.error("📊 GraphQL Tool: Failed to generate query plan:", error);
    return {
      steps: [
        {
          description: "Default query for latest pools",
          query: `{ pools(first: 5, orderBy: createdAtTimestamp, orderDirection: desc) { id  token1 { symbol } totalValueLockedUSD } }`,
          variables: {}
        }
      ]
    };
  }
}

// Execute a single GraphQL query
async function executeQuery(query: string, variables: any = {}) {
  console.log("📊 GraphQL Tool: Executing query:", query);
  console.log("📊 GraphQL Tool: With variables:", variables);
  
  try {
    // Validate query format
    if (!query.trim().startsWith('{') && !query.trim().toLowerCase().startsWith('query')) {
      console.error("📊 GraphQL Tool: Invalid query format:", query);
      throw new Error("Invalid GraphQL query format. Query must start with '{' or 'query'");
    }
    
    const gqlQuery = gql`${query}`;
    
    // Log request details
    console.log("📊 GraphQL Tool: Sending request to:", 'https://gateway.thegraph.com/api/subgraphs/id/HMuAwufqZ1YCRmzL2SfHTVkzZovC9VL2UAKhjvRqKiR1');
    console.log("📊 GraphQL Tool: Using API key:", process.env.THEGRAPH_API_KEY ? "Available" : "Not available");
    
    const result = await client.query(gqlQuery, variables).toPromise();
    
    if (result.error) {
      console.error("📊 GraphQL Tool: Query error:", result.error);
      throw new Error(result.error.message);
    }
    
    console.log("📊 GraphQL Tool: Query successful, result:", JSON.stringify(result.data).substring(0, 200) + "...");
    return result.data;
  } catch (error: any) {
    console.error("📊 GraphQL Tool: Query execution failed:", error);
    throw new Error(`GraphQL query failed: ${error.message || String(error)}`);
  }
}

// Define types for step results
interface StepResult {
  description: string;
  query: string;
  variables: Record<string, any>;
  result?: any;
  error?: string;
}

export const graphQueryAgent = tool({
  description: 'Query Uniswap V3 Base subgraph with GraphQL, handling complex multi-step queries',
  parameters: z.object({
    question: z.string().describe('Natural language question like "Find the top 10 buyers in the latest pools"')
  }),
  execute: async ({ question }) => {
    try {
      console.log("📊 GraphQL Tool: Processing complex query:", question);
      
      // Generate multi-step query plan
      const plan = await generateQueryPlan(question);
      console.log("📊 GraphQL Tool: Query plan generated with", plan.steps.length, "steps");
      
      // Execute each step in sequence
      const stepResults: StepResult[] = [];
      let context: Record<string, any> = {};
      
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        console.log(`📊 GraphQL Tool: Executing step ${i+1}: ${step.description}`);
        
        try {
          // Execute the query for this step
          const stepResult = await executeQuery(step.query, step.variables);
          
          // Store result in context for potential use in subsequent steps
          context[`step${i+1}Result`] = stepResult;
          
          // Add to results
          stepResults.push({
            description: step.description,
            query: step.query,
            variables: step.variables || {},
            result: stepResult
          });
          
          console.log(`📊 GraphQL Tool: Step ${i+1} completed successfully`);
        } catch (stepError: any) {
          console.error(`📊 GraphQL Tool: Error in step ${i+1}:`, stepError);
          stepResults.push({
            description: step.description,
            query: step.query,
            variables: step.variables || {},
            error: stepError.message || String(stepError)
          });
          
          // Continue with next step even if this one failed
        }
      }
      
      // Return the complete multi-step results
      const finalResult = stepResults.length > 0 && stepResults[stepResults.length - 1]?.result 
        ? stepResults[stepResults.length - 1].result 
        : null;
        
      return {
        query: plan.steps.map(step => step.query).join('\n\n'),
        // steps: stepResults,
        finalResult: finalResult
      };
    } catch (err: any) {
      console.error("📊 GraphQL Tool: Execution failed:", err);
      return {
        error: err.message || String(err),
        query: "Query plan generation failed",
        steps: []
      };
    }
  }
});
