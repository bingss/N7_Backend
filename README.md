## LumiTix 活動票務系統後端
![Hero-desktop](https://github.com/user-attachments/assets/00567602-fb1b-4668-a08e-dff414564473)

### 專案簡介
LumiTix 是一個現代化的活動票務管理系統，採用前後端分離架構。此專案為後端部分，使用 Node.js + PostgreSQL 技術，提供完整的票務管理功能，包含活動建立、票券銷售、訂單處理、驗票等功能。

### 功能特色
* 三種使用者角色：
  * 一般使用者：瀏覽活動、購買票券、管理訂單
  * 活動方：建立和管理活動、驗票
  * 平台方：審核活動、管理使用者
* 完整票務流程：
  * 活動建立與審核
  * 分區座位管理
  * 線上購票與支付整合
  * 電子票券與 QR Code 驗票
* 第三方整合：
  * Google OAuth 登入
  * 藍新金流支付
  * Firebase 圖片儲存
### 使用技術
* 後端：
  * Node.js (v20+)
  * Express.js
  * TypeORM
  * JWT 驗證
* 資料庫：
  * PostgreSQL
* 環境建立：
  * Docker
  * Docker Compose

## 快速開始
### 前置需求
* Node.js (v20+)
* PostgreSQL
* Docker (可選)
### 安裝步驟
1. 複製專案：
```Bash Run
git clone https://github.com/your-repo/lumitix-backend.git
cd lumitix-backend
```
2. 安裝依賴套件：
```Bash Run
npm install
```
3. 設定環境變數：
複製 .env.example 為 .env 並填入適當值：
```Env Apply
# PostgreSQL 設定
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_db_password
POSTGRES_DB=your_db_name

# 資料庫主機、埠號 、帳號、密碼、名稱、是否同步資料庫結構設定
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_password
DB_DATABASE=your_db_name
DB_SYNCHRONIZE=true
# API 服務埠號
PORT=8080
# JWT 密鑰設定
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_DAY=30d

# Firebase Admin SDK 的 JSON 字串（請用一行表示）
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"demo-app",...}
# Firebase Storage Bucket 名稱
FIREBASE_STORAGE_BUCKET=demo-app.appspot.com

# 藍新提供的加密參數
NEWPAY_HASHKEY=1234567890ABCDEF1234567890ABCDEF
NEWPAY_HASHIV=ABCDEF1234567890
# 商店代號
NEWPAY_MERCHANTID=MS123456789
# 金流 API 版本
NEWPAY_VERSION=1.6
# API 主機網址（正式環境或測試環境）
NEWPAY_HOST=https://ccore.newebpay.com
# 用戶付款完成導回頁面
NEWPAY_RETURNURL=https://yourdomain.com/payment/return
# 藍新後台通知網址（付款結果通知）
NEWPAY_NOTIFYURL=https://yourdomain.com/payment/notify
# 回傳格式（通常為 JSON）
NEWPAY_RESPONDTYPE=JSON

# Google OAuth 應用程式設定
GOOGLE_AUTH_CLIENTID=1234567890-abc123def456.apps.googleusercontent.com
GOOGLE_AUTH_CLIENT_SECRET=GOCSPX-abcdefg1234567890
GOOGLE_AUTH_CALLBACKURL=https://yourdomain.com/auth/google/callback
# 前端導向設定
GOOGLE_SIGNINUP_REDIRECTFRONTURL=https://frontend.yourdomain.com/signup-success
GOOGLE_BIND_REDIRECTFRONTURL=https://frontend.yourdomain.com/bind-success
# 允許的前端網域
GOOGLE_REDIRECT_ALLOWDOMAIN=yourdomain.com
```

4. 啟動服務：

使用 Docker：
```Bash Run
npm run start
```
啟動Docker後即可執行：
```Bash Run
npm run dev
```
或部署於Render執行：
```Bash Run
npm run start2
```

### API 文件
API 端點文件請參考 [API 文件連結](https://www.notion.so/1af6a246851881dfa483f8d3d4b4c595?v=1af6a246851881fea119000c86ad2ccc)
主要 API 路由：
* /api/v1/users - 使用者相關
* /api/v1/organizer - 活動方相關
* /api/v1/events - 活動相關
* /api/v1/orders - 訂單相關
* /api/v1/admin - 平台管理相關

### 專案結構
```Apply
bingss-n7_backend.git/
├── config/          # 設定檔
├── controllers/     # 控制器
├── db/              # 資料庫連線設定
├── entities/        # 資料庫實體
├── enums/           # 列舉常數
├── middlewares/     # 中介層
├── routes/          # 路由
├── services/        # 業務邏輯
├── utils/           # 工具函式
├── app.js           # 主應用程式
├── docker-compose.yml
└── Dockerfile
```

貢獻指南
歡迎提交 Pull Request。對於重大變更，請先開 Issue 討論。
