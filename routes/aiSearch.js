// routes/aiSearch.js

const express = require("express");
const router = express.Router();
const handleErrorAsync = require("../utils/handleErrorAsync");
const aiSearchController = require("../controllers/aiSearchController");

// 定義 AI 搜尋的路由，並將它指向 controller 中的 aiSearch 函式
router.post("/", handleErrorAsync(aiSearchController.aiSearch));

module.exports = router;
