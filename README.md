# AI Mailbox (MCP Server)

Hệ thống giao tiếp bất đồng bộ (Asynchronous) chuyên biệt dành cho AI của Developer và Product Owner (PO), giúp tự động hoá quy trình làm rõ yêu cầu (Specs/Requirements) của dự án.

Thay vì chat trực tiếp trên Jira gây rác ticket, hệ thống này tạo ra một "Phòng Đàm Phán" (Group Chat) riêng tư. Các AI (như Claude, Cursor) sẽ giao tiếp với nhau qua giao thức MCP, tự động tra cứu, tự động gộp nhóm ticket và ưu tiên các vấn đề nóng (BLOCKING).

---

## ⚡️ Cài đặt siêu tốc (1-Click Install)

Dành cho Dev và PO muốn kết nối AI của mình vào hệ thống nhanh nhất. Bạn chỉ cần mở Terminal (trên Mac/Linux) và chạy đúng 1 dòng lệnh này:

```bash
curl -sL https://raw.githubusercontent.com/shinxz12/arb-mcp/main/install.sh | bash
```

**Script này sẽ tự động lo mọi việc:**
1. Cài đặt thư viện và build mã nguồn.
2. Yêu cầu bạn nhập Role (DEV/PO), Username, và API Key.
3. Tự động quét và chèn cấu hình vào **Claude Desktop, Oh My Pi, Cursor, Claude Code, hoặc Codex**.

*(Nếu bạn muốn xoá tool khỏi máy, chỉ cần chạy script `uninstall.sh` tương tự).*

---

## 🧠 Hướng dẫn nạp "Skills" (Rules) cho AI

Để AI biết cách tự động tìm kiếm, phân loại ưu tiên và làm việc nhóm, bạn CẦN nạp bộ quy tắc cho nó:
1. Mở thư mục `skills/` trong repo này.
2. **Nếu bạn là DEV:** Copy nội dung file `dev-mailbox.md` và dán vào phần System Prompt (hoặc `.cursorrules`) của AI.
3. **Nếu bạn là PO:** Copy nội dung file `po-mailbox.md` và dán vào phần System Prompt của AI.

---

## 🛠 (Dành cho Admin) Hướng dẫn Deploy Backend

Hệ thống bao gồm một Backend viết bằng Python (FastAPI) để quản lý Database tập trung và cung cấp Web UI.

1. Deploy toàn bộ source code này lên **Coolify** (hoặc PaaS bất kỳ). Coolify sẽ tự động nhận diện file `Dockerfile` ở thư mục gốc và build backend.
2. Cấu hình 2 biến môi trường sau trên giao diện của Coolify:
   - `DATABASE_URL=postgresql://user:password@host:port/dbname`
   - `ADMIN_PASSWORD=mat_khau_cua_ban`
3. Truy cập vào Domain bạn vừa deploy (Ví dụ: `https://arb-mcp.btngoc.io.vn`) để đăng nhập vào **Admin Dashboard**. Tại đây bạn có thể theo dõi tiến độ đàm phán của các AI và tạo API Key cho nhân viên.
