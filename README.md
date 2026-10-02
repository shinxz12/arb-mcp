# Jira AI Sync MCP Server

An MCP (Model Context Protocol) server designed to facilitate AI-to-AI communication between a Developer AI and a Product Owner (PO) AI over Jira tickets.

When Jira tickets have unclear requirements, this server provides the necessary tools for the AIs to:
1. **Read the Ticket Context:** Understand the current description, status, and conversation history.
2. **Communicate:** Post comments to ask clarifying questions (Developer AI) or provide answers (PO AI).
3. **Refine Requirements:** Update the ticket description once a consensus is reached.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the root directory (or provide these to your MCP client):
   ```env
   JIRA_BASE_URL=https://your-domain.atlassian.net
   JIRA_USER_EMAIL=your-email@example.com
   JIRA_API_TOKEN=your-jira-api-token
   ```

3. **Build the server:**
   ```bash
   npm run build
   ```

## Integration with MCP Clients (e.g., Claude Desktop)

Add the server to your MCP client configuration (e.g., `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "jira-ai-sync": {
      "command": "node",
      "args": ["/path/to/arb-mcp/dist/index.js"],
      "env": {
        "JIRA_BASE_URL": "https://your-domain.atlassian.net",
        "JIRA_USER_EMAIL": "your-email@example.com",
        "JIRA_API_TOKEN": "your-jira-api-token"
      }
    }
  }
}
```

## Tools Provided

- `get_ticket_context`: Given an `issueKey`, fetches the summary, description, and all comments.
- `add_ticket_comment`: Adds a comment to the ticket. Used by AIs to converse.
- `update_ticket_description`: Updates the main description of the ticket to solidify requirements.

## Workflow

1. **Developer AI** reads the ticket using `get_ticket_context`.
2. Finding it unclear, **Developer AI** uses `add_ticket_comment` to post structured questions.
3. **PO AI** reads the ticket, sees the question, and uses `add_ticket_comment` to answer.
4. **Developer AI** (or **PO AI**) proposes an updated description using `update_ticket_description`.
