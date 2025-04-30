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

## Contributing

Suggestions are welcome. **Please open an issue first** to discuss what you would like to change.
