import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function runSession(username: string, apiKey: string, role: string, actions: (client: Client) => Promise<void>) {
  console.log(`\n--- BẮT ĐẦU PHIÊN LÀM VIỆC CỦA ${username.toUpperCase()} ---`);
  
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    env: {
      ...process.env,
      MAILBOX_API_URL: "http://localhost:8000",
      MAILBOX_API_KEY: apiKey,
      MAILBOX_USERNAME: username,
      MAILBOX_ROLE: role
    }
  });

  const client = new Client(
    { name: `test-client-${username}`, version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  await actions(client);
  await transport.close();
}

async function runTest() {
  console.log("=== MÔ PHỎNG LUỒNG GIAO TIẾP DẠNG THEAD (CONVERSATION) ===");

  let currentConvId = -1;

  // 1. PHIÊN CỦA DEV HƯNG (Khởi tạo cuộc hội thoại)
  await runSession("dev_hung", "sk_dev_hung", "DEV", async (client) => {
    console.log("[DEV] Đang tạo Group Chat để hỏi về 2 Tickets...");
    const result = await client.callTool({
      name: "start_conversation",
      arguments: { 
        title: "Vướng mắc logic thanh toán chung",
        tickets: ["PROJ-101", "PROJ-102"], 
        participants: ["po_tuan"], 
        initialMessage: "Chào sếp, 2 ticket này logic tính thuế đang bị đá nhau. Mình ưu tiên logic của 101 hay 102 ạ?" 
      }
    });
    const responseText = result.content[0].text as string;
    console.log(`[DEV] Kết quả: ${responseText}`);
    
    const match = responseText.match(/ID: (\d+)/);
    if (match) {
      currentConvId = parseInt(match[1]);
    }
  });

  // 2. PHIÊN CỦA PO TUẤN (Đọc & Trả lời)
  await runSession("po_tuan", "sk_po_tuan", "PO", async (client) => {
    console.log("[PO] Mở máy, xem có conversation nào đang mở (Inbox)...");
    const inboxResult = await client.callTool({
      name: "get_active_conversations",
      arguments: {}
    });
    console.log(`[PO] Inbox hiện tại:\n${inboxResult.content[0].text}`);

    if (currentConvId !== -1) {
      console.log(`\n[PO] Đọc toàn bộ lịch sử chat của Conversation ${currentConvId}...`);
      const history = await client.callTool({
        name: "read_conversation",
        arguments: { convId: currentConvId }
      });
      console.log(`[PO] Lịch sử chat:\n${history.content[0].text}`);

      console.log(`\n[PO] Đang gửi tin nhắn trả lời vào Group...`);
      const replyResult = await client.callTool({
        name: "send_message",
        arguments: {
          convId: currentConvId,
          content: "Lấy theo 101 nhé, 102 mai anh update lại spec."
        }
      });
      console.log(`[PO] Kết quả: ${replyResult.content[0].text}`);
    }
  });

  // 3. PHIÊN CỦA DEV HƯNG LẦN 2 (Chốt vấn đề)
  await runSession("dev_hung", "sk_dev_hung", "DEV", async (client) => {
    if (currentConvId !== -1) {
      console.log("\n[DEV] Đọc lại lịch sử xem PO trả lời chưa...");
      const history = await client.callTool({
        name: "read_conversation",
        arguments: { convId: currentConvId }
      });
      console.log(`[DEV] Lịch sử chat mới nhất:\n${history.content[0].text}`);
      
      console.log("\n[DEV] Đã rõ ràng, đánh dấu Conversation là RESOLVED.");
      const resolveResult = await client.callTool({
        name: "resolve_conversation",
        arguments: { convId: currentConvId }
      });
      console.log(`[DEV] Kết quả: ${resolveResult.content[0].text}`);
    }
  });

  console.log("\n=== MÔ PHỎNG HOÀN TẤT ===");
}

runTest().catch(console.error);
