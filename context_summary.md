# Project Context Summary: Code Reviewer MCP Server

This document summarizes the current context and status of the Code Reviewer MCP Server project, based on existing documentation and the current codebase.

## Project Purpose and Features

The Code Reviewer MCP Server is an automated code review system for GitHub pull requests. It utilizes the Model Context Protocol (MCP) and integrates with AI models via OpenRouter to provide automated, standardized code reviews.

Core features include:
- GitHub PR analysis
- AI-powered code review
- MCP server implementation
- OpenRouter integration
- Detailed feedback on code quality, style, and potential issues
- Comprehensive logging for debugging

## Current Focus and Recent Changes

The current focus of development is on:
- Enhancing PR review to post specific comments on GitHub
- Public repo support
- Basic PR review functionality
- Error handling

Recent changes include:
- Added diff filtering
- Improved error logging
- Updated documentation
- Attempted integration of posting specific review comments to GitHub using `github-mcp`, encountered persistent TypeScript errors.

## Problem Solving

- Encountered persistent TypeScript errors when attempting to integrate the `github-mcp` tool call for posting review comments.
- Specific errors included:
    - Issues with the `Client` constructor arguments ("Expected 2 arguments, but got 1", "Expected 1 arguments, but got 0").
    - Scope-related problems where variables (`response`, `llmResponseContent`, `owner`, `repo`, `pull_number`) were not accessible in the expected scope.
    - Complex type errors related to the `setRequestHandler` for `CallToolRequestSchema`.
    - Errors indicating missing properties or unexpected tokens, suggesting structural issues in the code after modifications.
- Attempts to fix these errors using `replace_in_file` with precise blocks and `write_to_file` as a fallback were unsuccessful. The root cause of these errors, particularly the conflicting `Client` constructor errors and scope issues within the server handler, remains unclear with the available tools and information.

## Progress and Pending Tasks

**Completed:**
- Basic MCP server setup
- GitHub API integration
- OpenRouter connection
- Diff processing
- Review generation

**Pending:**
- Private repo authentication
- Draft PR support
- Advanced configuration
- Performance optimizations

**Test Results:**
- Public repo tests: PASS
- Error handling: PASS
- Large PR handling: PARTIAL

## System Architecture and Data Flow

The system architecture consists of:
- MCP Server (implemented in TypeScript)
- GitHub API integration (using Octokit)
- OpenRouter AI gateway (using Axios)

Key components include:
1. GitHub PR Fetcher
2. Diff Processor
3. AI Prompt Builder
4. Review Generator

The data flow is as follows:
Pull Request -> GitHub API -> Diff Processing -> AI Analysis -> Review Generation -> Response

## Technical Stack and Dependencies

The core technologies used are:
- Node.js
- TypeScript
- MCP SDK (`@modelcontextprotocol/sdk`)
- Octokit (`@octokit/rest`)
- Axios (`axios`)

Required environment:
- Node 18+
- npm 9+
- TypeScript 5+

Required environment variables:
- `GITHUB_PAT`: GitHub Personal Access Token
- `OPENROUTER_API_KEY`: OpenRouter API Key

## Current Limitations and Next Steps

**Current Limitations:**
- Only works with open pull requests (not draft PRs).

**Planned Next Steps:**
- Investigate and resolve the persistent TypeScript errors blocking the integration of posting specific review comments to GitHub using the `github-mcp` server. This may require further debugging or external assistance.
- Improve the review logic (using an LLM) to cover more aspects like logic errors, security vulnerabilities, style guide adherence, and anti-patterns (dependent on resolving the posting issue).
- Add configuration options to control the review's depth or strictness (dependent on resolving the posting issue).
- Create a new `summarize_pull_request` tool to automatically generate and update PR descriptions with summaries.
- (Future Task): Implement automatic triggering of PR reviews using GitHub Actions or Webhooks.
