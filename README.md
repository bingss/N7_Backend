# N7_Backend

- 初始化流程參考
1. 加入.env檔
2. npm install
3. npm run start
4. npm run dev
---
- .env檔範例
```
# PostgreSQL 容器設定
POSTGRES_USER=testHexschool
POSTGRES_PASSWORD=pgStartkit4test
POSTGRES_DB=test

# API 伺服器設定
# DB_HOST=postgres
# 本地連接請改成localhost
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=testHexschool
DB_PASSWORD=pgStartkit4test
DB_DATABASE=test
DB_SYNCHRONIZE=true
DB_ENABLE_SSL=false
PORT=8080
LOG_LEVEL=debug
JWT_EXPIRES_DAY=30d
JWT_SECRET=hexschool666
```
--------------
