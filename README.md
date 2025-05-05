# Code Reviewer MCP Server

A GitHub Pull Request Code Review server using Model Context Protocol

This MCP server provides automated code review capabilities for GitHub pull requests by integrating with OpenRouter's AI models.

## Features

- Automated code reviews for GitHub pull requests
- Detailed feedback on code quality, style and potential issues
- Integration with OpenRouter's AI models (currently using Gemini 2.5 Pro)
- Comprehensive logging for debugging

## Requirements

-   A GitHub Personal Access Token (PAT) with `repo` scope for private repositories or `public_repo` scope for public repositories. This PAT is required to fetch pull request data.
-   An OpenRouter API Key.

## Current Limitations

⚠️ **Important**: Currently this server only works with:
- Open pull requests (not draft PRs)

## Installation

1. Clone this repository:
```bash
git clone https://github.com/joaomj/code-reviewer-mcp.git
cd code-reviewer-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Set required environment variables:
```bash
export GITHUB_PAT=your_github_personal_access_token
export OPENROUTER_API_KEY=your_openrouter_api_key
```

4. Build the server:
```bash
npm run build
```

## Usage

To start the MCP server:
```bash
node build/index.js
```

The server will be available to any MCP-compatible client (like Claude Desktop).

## Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "code-reviewer-mcp": {
      "command": "node",
      "args": ["/path/to/code-reviewer-mcp/build/index.js"],
      "env": {
        "GITHUB_PAT": "your_github_token",
        "OPENROUTER_API_KEY": "your_openrouter_key"
      }
    }
  }
}
```

## Development

For development with auto-rebuild:
```bash
npm run watch
```

To run tests:
```bash
npm test
```

## Debugging

Use the built-in logging which outputs to stderr with detailed information about:
- GitHub API requests
- OpenRouter API calls
- Processing steps
- Any errors encountered

For more advanced debugging, use the MCP Inspector:
```bash
npm run inspector
```

## Next Steps

Planned improvements and features:

- [ ] Draft pull request analysis
- [ ] Customizable review templates
- [ ] Support for multiple AI models (OpenAI, Claude, etc.)
- [ ] File-specific feedback
- [ ] Rate limiting and caching

## Development Guide

### Project Setup

#### Initial Configuration
1. Bootstrap project using npm:
```bash
npx @modelcontextprotocol/create-mcp-server code-reviewer-mcp
cd code-reviewer-mcp
```

2. Installed additional dependencies:
```bash
npm install @octokit/rest axios
npm install typescript @types/node --save-dev
```

3. Set up TypeScript configuration (`tsconfig.json`):
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### Core Implementation

#### Key Components
1. **GitHub Integration**:
   - Used Octokit library for GitHub API access
   - Implemented PR diff retrieval with error handling
   - Added support for public repositories only (initial limitation)

2. **OpenRouter Integration**:
   - Configured Gemini 2.5 Pro model for code reviews
   - Implemented prompt engineering for effective code analysis
   - Added timeout and error handling

3. **MCP Server Setup**:
   - Implemented tool registration
   - Added request validation
   - Configured error handling and logging

### Development Challenges & Solutions

#### Challenge 1: GitHub API Limitations
**Problem**: Initial implementation failed with private repositories  
**Solution**: 
- Added explicit error handling
- Documented limitation in README
- Future work: Implement GitHub App authentication

#### Challenge 2: OpenRouter Response Format
**Problem**: Inconsistent response structure from API  
**Solution**:
- Added comprehensive response validation
- Implemented detailed error logging
- Added response structure checks

#### Challenge 3: Large Diff Handling
**Problem**: Large PR diffs caused API timeouts  
**Solution**:
- Implemented diff filtering (only +/- lines)
- Added size limitation (5000 characters)
- Added warning logs for large diffs

### Testing Process

1. **Unit Testing**:
```bash
npm test
```

2. **Manual Testing**:
- Tested with public repositories
- Verified error handling
- Tested various PR sizes

3. **Debugging Tools**:
```bash
npm run inspector
```

### Deployment Steps

1. Build the project:
```bash
npm run build
```

2. Set environment variables:
```bash
export GITHUB_PAT=your_token
export OPENROUTER_API_KEY=your_key
```

3. Run the server:
```bash
node build/index.js
```

### Known Issues

1. **Private Repositories**: Currently unsupported
2. **Draft PRs**: Not processed
3. **Rate Limiting**: Basic implementation only
4. **Large PRs**: Partial diff analysis

### Future Improvements

See [Next Steps in README.md](./README.md#next-steps) for planned features.

### Troubleshooting

#### Common Errors
1. **GitHub API Errors**:
   - Verify PAT permissions
   - Check rate limits
   - Validate repository visibility

2. **OpenRouter Errors**:
   - Check API key validity
   - Verify model availability
   - Review response format handling

3. **MCP Connection Issues**:
   - Validate server configuration
   - Check port availability
   - Review transport layer

## Contributing

Suggestions are welcome. **Please open an issue first** to discuss what you would like to change.