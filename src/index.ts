import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as db from "./db.js";

const USERNAME = process.env.MAILBOX_USERNAME;
const ROLE = process.env.MAILBOX_ROLE;

if (!USERNAME || !ROLE) {
  console.error("Missing MAILBOX_USERNAME or MAILBOX_ROLE in environment.");
  process.exit(1);
}

const server = new Server(
  { name: "ai-mailbox", version: "3.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_users",
        description: "Returns registered users and their current status (ACTIVE or OOO/Out-Of-Office).",
        inputSchema: { type: "object", properties: { role: { type: "string" } } },
      },
      {
        name: "start_conversation",
        description: "Starts a new chat thread. Can link multiple Jira tickets.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short title" },
            tickets: { type: "array", items: { type: "string" } },
            participants: { type: "array", items: { type: "string" } },
            initialMessage: { type: "string" }
          },
          required: ["title", "tickets", "participants", "initialMessage"],
        },
      },
      {
        name: "get_active_conversations",
        description: "Lists OPEN conversations you are in. Returns priority tags.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "read_conversation",
        description: "Reads the full message history of a specific conversation.",
        inputSchema: { type: "object", properties: { convId: { type: "number" } }, required: ["convId"] },
      },
      {
        name: "send_message",
        description: "Sends a message to an existing conversation thread.",
        inputSchema: { type: "object", properties: { convId: { type: "number" }, content: { type: "string" } }, required: ["convId", "content"] },
      },
      {
        name: "resolve_conversation",
        description: "Marks a conversation as RESOLVED once a decision is reached.",
        inputSchema: { type: "object", properties: { convId: { type: "number" } }, required: ["convId"] },
      },
      // --- NEW WORKFLOW TOOLS ---
      {
        name: "search_past_decisions",
        description: "Searches past conversation titles and contents to see if a similar issue was already resolved.",
        inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      },
      {
        name: "escalate_conversation",
        description: "Changes the priority of a conversation ('NORMAL', 'HIGH', 'BLOCKING') to grab attention.",
        inputSchema: { type: "object", properties: { convId: { type: "number" }, priority: { type: "string" } }, required: ["convId", "priority"] },
      },
      {
        name: "set_my_status",
        description: "Sets your status. If going on leave, set 'OOO' and provide a delegate_to username. System will auto-route new mentions.",
        inputSchema: { type: "object", properties: { status: { type: "string", description: "'ACTIVE' or 'OOO'" }, delegateTo: { type: "string" } }, required: ["status"] },
      },
      {
        name: "add_participant",
        description: "Pulls a new user into an existing conversation thread mid-way.",
        inputSchema: { type: "object", properties: { convId: { type: "number" }, username: { type: "string" } }, required: ["convId", "username"] },
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "list_users") {
      const users = await db.getUsers(args?.role ? String(args.role) : undefined);
      return { content: [{ type: "text", text: JSON.stringify(users, null, 2) }] };
    }
    if (name === "start_conversation") {
      const res = await db.startConversation(String(args?.title), args?.tickets as string[], args?.participants as string[], String(args?.initialMessage));
      let msg = `Conversation started successfully. ID: ${res.conversation_id}`;
      if (res.routed) msg += `\n[NOTE] Some participants were Out-Of-Office and auto-routed to their delegates. Read the chat history to see who.`;
      return { content: [{ type: "text", text: msg }] };
    }
    if (name === "get_active_conversations") {
      const convs = await db.getMyConversations();
      return { content: [{ type: "text", text: convs.length ? JSON.stringify(convs, null, 2) : "No active conversations." }] };
    }
    if (name === "read_conversation") {
      const history = await db.getConversationHistory(Number(args?.convId));
      return { content: [{ type: "text", text: JSON.stringify(history, null, 2) }] };
    }
    if (name === "send_message") {
      await db.sendMessage(Number(args?.convId), String(args?.content));
      return { content: [{ type: "text", text: `Message sent to conversation ${args?.convId}.` }] };
    }
    if (name === "resolve_conversation") {
      await db.resolveConversation(Number(args?.convId));
      return { content: [{ type: "text", text: `Conversation ${args?.convId} marked as RESOLVED.` }] };
    }
    if (name === "search_past_decisions") {
      const results = await db.searchConversations(String(args?.query));
      return { content: [{ type: "text", text: results.length ? JSON.stringify(results, null, 2) : "No matching past decisions found." }] };
    }
    if (name === "escalate_conversation") {
      await db.updatePriority(Number(args?.convId), String(args?.priority).toUpperCase());
      return { content: [{ type: "text", text: `Priority updated successfully.` }] };
    }
    if (name === "set_my_status") {
      await db.updateStatus(String(args?.status).toUpperCase(), args?.delegateTo ? String(args.delegateTo) : undefined);
      return { content: [{ type: "text", text: `Status updated successfully.` }] };
    }
    if (name === "add_participant") {
      await db.addParticipant(Number(args?.convId), String(args?.username));
      return { content: [{ type: "text", text: `User added to conversation successfully.` }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`AI Mailbox MCP Server v3 running as ${USERNAME} (${ROLE})`);
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
