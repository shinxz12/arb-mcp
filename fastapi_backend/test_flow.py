import requests

BASE_URL = "http://localhost:8000"

def print_step(title, res):
    print(f"\n--- {title} ---")
    try:
        print(f"Response: {res.json()}")
    except:
        print(f"Response: {res.text}")

print("=== STARTING AI MAILBOX SIMULATION ===")

# 1. ADMIN: Tạo 2 User
res = requests.post(f"{BASE_URL}/admin/register", data={"username": "dev_hung", "role": "DEV", "api_key": "sk_dev_hung"})
print_step("ADMIN: Đăng ký Dev (dev_hung)", res)

res = requests.post(f"{BASE_URL}/admin/register", data={"username": "po_tuan", "role": "PO", "api_key": "sk_po_tuan"})
print_step("ADMIN: Đăng ký PO (po_tuan)", res)

# Headers đóng giả làm DEV
dev_headers = {"Authorization": "Bearer sk_dev_hung"}
# Headers đóng giả làm PO
po_headers = {"Authorization": "Bearer sk_po_tuan"}

# 2. DEV: Lấy danh sách PO để biết ai mà hỏi
res = requests.get(f"{BASE_URL}/users?role=PO", headers=dev_headers)
print_step("DEV: Tìm danh sách PO", res)

# 3. DEV: Gửi câu hỏi cho PO Tuấn
question_payload = {
    "ticket_id": "PROJ-123",
    "to_user": "po_tuan",
    "content": "Sếp ơi, phần quên mật khẩu user chưa login thì verify qua OTP SMS hay Email vậy?"
}
res = requests.post(f"{BASE_URL}/messages", json=question_payload, headers=dev_headers)
print_step("DEV: Gửi câu hỏi cho PO Tuấn", res)
message_id = res.json().get("id")

# 4. PO: Mở máy kiểm tra Inbox
res = requests.get(f"{BASE_URL}/messages/inbox", params={"username": "po_tuan"}, headers=po_headers)
print_step("PO: Kiểm tra hộp thư đến (Inbox)", res)
pending_messages = res.json()

# 5. PO: Trả lời câu hỏi
if pending_messages:
    reply_payload = {
        "content": "Dùng Email trước cho tiết kiệm nhé, SMS để phase sau."
    }
    res = requests.post(f"{BASE_URL}/messages/{message_id}/reply", json=reply_payload, headers=po_headers)
    print_step(f"PO: Trả lời câu hỏi ID {message_id}", res)

# 6. PO: Kiểm tra lại Inbox xem đã hết tin nhắn chờ chưa
res = requests.get(f"{BASE_URL}/messages/inbox", params={"username": "po_tuan"}, headers=po_headers)
print_step("PO: Kiểm tra lại Inbox (Đã giải quyết xong)", res)
