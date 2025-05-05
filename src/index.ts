#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
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
  private githubMcpClient: Client;

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

    this.githubMcpClient = new Client(new StdioClientTransport());

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

Provide a detailed code review. For each specific comment, include the file path and the line number(s) the comment applies to. Use the format \`FILE_PATH:LINE_NUMBER(S): COMMENT_TEXT\`. If a comment applies to multiple lines, use a range like \`LINE_START-LINE_END\`. If a comment applies to the entire file or is a general comment, use \`GENERAL: COMMENT_TEXT\`.

Example:
\`src/index.ts:10: This line needs adjustment.\`
\`src/utils.ts:25-30: This block of code can be refactored.\`
\`GENERAL: Overall, the changes look good.\`

Ensure each comment is on a new line.`;

        // Call OpenRouter API with enhanced error handling
        console.error('[Debug] Sending request to OpenRouter API');
        let llmResponseContent: string;
        try {
          const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
              model: "google/gemini-2.5-pro-preview-03-25", // Or another suitable model
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
                "HTTP-Referer": "https://github.com/joaomj/case_brasil_paralelo" // Replace with actual repo URL if needed
              },
              timeout: 60000 // Increased timeout for potentially longer LLM responses
            }
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

          llmResponseContent = response.data.choices[0].message.content;

          // Parse LLM response and format for GitHub comments
          const comments: { path: string; position?: number; line?: number; start_line?: number; body: string; side?: 'LEFT' | 'RIGHT'; start_side?: 'LEFT' | 'RIGHT' }[] = [];
          const lines = llmResponseContent.split('\n');

          let generalCommentBody = '';

          for (const line of lines) {
              const commentMatch = line.match(/^([^:]+):([^:]+):(.*)$/);
              if (commentMatch) {
                  const filePath = commentMatch[1].trim();
                  const lineNumberInfo = commentMatch[2].trim();
                  const commentText = commentMatch[3].trim();

                  if (filePath === 'GENERAL') {
                      generalCommentBody += commentText + '\n';
                  } else {
                      // Attempt to parse line number(s)
                      const rangeMatch = lineNumberInfo.match(/^(\d+)-(\d+)$/);
                      const singleLineMatch = lineNumberInfo.match(/^(\d+)$/);

                      if (rangeMatch) {
                          const startLine = parseInt(rangeMatch[1], 10);
                          const endLine = parseInt(rangeMatch[2], 10);
                          // For multi-line comments, GitHub API uses start_line and line
                          comments.push({
                              path: filePath,
                              body: commentText,
                              start_line: startLine,
                              line: endLine,
                              side: 'RIGHT', // Assuming comments are on the new code (RIGHT side of diff)
                              start_side: 'RIGHT' // Assuming comments are on the new code (RIGHT side of diff)
                          });
                      } else if (singleLineMatch) {
                          const lineNumber = parseInt(singleLineMatch[1], 10);
                           // For single-line comments, GitHub API uses line and position (relative to diff)
                           // We don't have position here, so we'll use line. GitHub might infer position.
                          comments.push({
                              path: filePath,
                              body: commentText,
                              line: lineNumber,
                              side: 'RIGHT' // Assuming comments are on the new code (RIGHT side of diff)
                          });
                      } else {
                          console.error(`[Warning] Could not parse line number info: ${lineNumberInfo} for file ${filePath}`);
                          // If line number parsing fails, add as a general comment
                          generalCommentBody += `File: ${filePath}, Line Info: ${lineNumberInfo}: ${commentText}\n`;
                      }
                  }
              } else {
                  // If the line doesn't match the expected format, treat it as part of a general comment
                  generalCommentBody += line + '\n';
              }
          }

          // Post review comments to GitHub
          console.error('[Debug] Posting review comments to GitHub');
          try {
              // Use the github-mcp tool to create a pull request review
              const reviewBody = generalCommentBody.trim() || 'Automated code review';
              await this.githubMcpClient.callTool('github-mcp', 'create_pull_request_review', {
                  owner,
                  repo,
                  pullNumber: pull_number,
                  event: 'COMMENT', // Or 'REQUEST_CHANGES' if appropriate
                  body: reviewBody,
                  comments: comments
              });

               return {
                content: [{
                  type: "text",
                  text: `Code review completed and comments posted to GitHub PR #${pull_number}.`
                }]
              };


          } catch (githubPostError) {
              console.error('[Error] Failed to post review comments to GitHub:', githubPostError);
              throw new Error(`Failed to post review comments to GitHub: ${githubPostError instanceof Error ? githubPostError.message : 'Unknown error'}`);
          }


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
