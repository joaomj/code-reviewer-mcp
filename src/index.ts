#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode
} from "@modelcontextprotocol/sdk/types.js";
import { Octokit } from "@octokit/rest";
import axios from "axios";

const GITHUB_PAT = process.env.GITHUB_PAT;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!GITHUB_PAT) {
  throw new Error("GITHUB_PAT environment variable is required");
}
if (!OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY environment variable is required");
}

class CodeReviewerServer {
  private server: Server;
  private octokit: Octokit;

  constructor() {
    this.server = new Server(
      {
        name: "code-reviewer-mcp",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.octokit = new Octokit({
      auth: GITHUB_PAT,
    });

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "review_pull_request",
          description: "Perform code review on a GitHub pull request",
          inputSchema: {
            type: "object",
            properties: {
              owner: {
                type: "string",
                description: "Repository owner"
              },
              repo: {
                type: "string",
                description: "Repository name"
              },
              pull_number: {
                type: "number",
                description: "Pull request number"
              }
            },
            required: ["owner", "repo", "pull_number"]
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== "review_pull_request") {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      const args = request.params.arguments;
      if (!args || typeof args !== 'object') {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Invalid arguments object"
        );
      }

      const { owner, repo, pull_number } = args as {
        owner: string;
        repo: string;
        pull_number: number;
      };

      if (!owner || !repo || !pull_number) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Missing required parameters: owner, repo, pull_number"
        );
      }

      try {
        // Get PR diff with enhanced error handling
        console.error('[Debug] Fetching PR diff from GitHub');
        let diff: string;
        try {
          const { data } = await this.octokit.pulls.get({
            owner,
            repo,
            pull_number,
            mediaType: {
              format: "diff"
            }
          });
          
          if (typeof data !== 'string' || !data) {
            console.error('[Error] Invalid diff format received from GitHub');
            throw new Error('Received invalid diff format from GitHub API');
          }
          
          // Handle private repo diffs differently
          diff = data;
          if (diff.includes('diff --git') && diff.length > 5000) {
            console.error('[Info] Large diff detected, optimizing for OpenRouter');
            diff = diff.split('\n')
              .filter(line => line.startsWith('+') || line.startsWith('-'))
              .join('\n')
              .substring(0, 5000);
          }
        } catch (error: unknown) {
          const githubError = error as {response?: {status?: number, headers?: any, data?: any}, message?: string};
          console.error('[Error] GitHub API error:', {
            status: githubError.response?.status,
            headers: githubError.response?.headers,
            data: githubError.response?.data
          });
          throw new Error(`GitHub API error: ${githubError.message || 'Unknown error'}`);
        }

        // Prepare LLM prompt
        const prompt = `Please review the following GitHub pull request changes:
        
${diff}

Provide a detailed code review with:
1. Overall assessment of the changes
2. Specific feedback on code quality, style, and potential issues
3. Suggestions for improvements
4. Any security concerns
5. Performance considerations`;

        // Call OpenRouter API with enhanced error handling
        console.error('[Debug] Sending request to OpenRouter API');
        try {
          const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
              model: "google/gemini-2.5-pro-preview-03-25",
              messages: [
                {
                  role: "user",
                  content: prompt
                }
              ]
            },
            {
              headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/joaomj/case_brasil_paralelo"
              },
              timeout: 30000
            }
          );

          console.error('[Debug] Full OpenRouter API response:', JSON.stringify({
          status: response.status,
          headers: response.headers,
          data: response.data
        }, null, 2));

        if (!response.data?.choices?.[0]?.message?.content) {
          console.error('[Error] Invalid OpenRouter response structure:', {
            hasData: !!response.data,
            hasChoices: !!response.data?.choices,
            choicesLength: response.data?.choices?.length,
            hasMessage: !!response.data?.choices?.[0]?.message,
            hasContent: !!response.data?.choices?.[0]?.message?.content
          });
          throw new Error('Invalid response format from OpenRouter API');
        }

          return {
            content: [{
              type: "text",
              text: response.data.choices[0].message.content
            }]
          };
        } catch (apiError) {
          console.error('[Debug] OpenRouter API error:', apiError);
          throw apiError;
        }
      } catch (error: unknown) {
        console.error('[Error]', error);
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to review pull request: ${message}`
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Code Reviewer MCP server running on stdio');
  }
}

const server = new CodeReviewerServer();
server.run().catch(console.error);
