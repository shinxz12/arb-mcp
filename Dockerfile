# Sử dụng base image Python tối ưu
FROM python:3.11-slim

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Cài đặt thư viện
COPY fastapi_backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ code backend
COPY fastapi_backend/ .

# Mở port 8000
EXPOSE 8000

# Lệnh chạy Backend API
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
