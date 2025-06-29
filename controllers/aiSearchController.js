require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { Like, In, Between } = require("typeorm"); // 引入 Between
const { dataSource } = require("../db/data-source");
const dayjs = require("dayjs"); // 引入 dayjs 來處理日期

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

/**
 * 輔助函式 1：呼叫 LLM API 來解析使用者的查詢
 */
async function parseSearchQuery(userQuery) {
  // 動態取得今天的日期，並插入到 Prompt 中
  const today = dayjs().format("YYYY-MM-DD");

  // 升級後的 Prompt，增加了對時間的解析要求
  const prompt = `
    你是一個專門解析活動搜尋條件的 JSON 引擎。請嚴格根據以下規則，解析使用者的句子。

    <rules>
      - 你的任務是從句子中提取「地點(location)」、「活動類型(category)」、「開始日期(start_date)」、「結束日期(end_date)」。
      - 如果句子的主要目的看起來是在詢問一個「特定的活動名稱」，請優先將它提取到 title 欄位。
      - 如果提取了 title，就可以忽略其他條件。
      - **最重要規則：如果句子中完全沒有提到任何與「時間」或「日期」相關的詞彙（例如：今天、明天、週末、下個月、六月、日期...等），你「絕對不能」回傳 start_date 和 end_date 這兩個欄位。**
      - category 的值必須是「演唱會」、「音樂會」、「舞台劇」、「其他」之一。如果句子中的類型不符，請忽略 category 欄位。
      - 地點請標準化為台灣的縣市名稱。
      - 今天的日期是 ${today}，所有時間計算都以此為基準。
    </rules>

    <example>
      句子："我想找山城奇遇記的活動"
      JSON輸出: {"title": "山城奇遇記"}
    </example>

    <example>
      句子："我想找兩個月內在台中的舞台劇"
      JSON輸出: {"location": "台中市", "category": "舞台劇", "start_date": "${today}", "end_date": "${dayjs()
    .add(60, "day")
    .format("YYYY-MM-DD")}"}
    </example>
    
    <example>
      句子："台北市有沒有演唱會？"
      JSON輸出: {"location": "台北市", "category": "演唱會"}
    </example>

    請解析以下句子：
    <sentence>
      ${userQuery}
    </sentence>
  `;

  const response = await axios.post(`${GEMINI_API_URL_BASE}?key=${GEMINI_API_KEY}`, {
    contents: [{ parts: [{ text: prompt }] }],
    // 增加 generationConfig 來讓回傳更穩定
    generationConfig: {
      responseMimeType: "application/json", // 要求直接回傳 JSON MIME 類型
      temperature: 0.2, // 降低隨機性，讓模型更遵循指示
    },
  });

  // 因為我們要求了 JSON 回應，所以可以直接解析
  const resultJson = response.data.candidates[0].content.parts[0].text;
  return JSON.parse(resultJson);
}

/**
 * 輔助函式 2：根據解析後的條件，查詢您的資料庫
 */
async function queryEventsFromDB(criteria) {
  console.log("用以下條件查詢資料庫:", criteria);
  const eventRepo = dataSource.getRepository("Event");
  const queryBuilder = eventRepo
    .createQueryBuilder("event")
    .leftJoinAndSelect("event.Type", "type")
    .where("event.status = :status", { status: "approved" })
    .andWhere("event.start_at > :now", { now: new Date() });

  // --- 新增的標題搜尋邏輯 ---
  // 如果 AI 解析出標題，就優先用標題來搜尋
  if (criteria.title) {
    // 使用 Like 進行模糊搜尋，例如 "山城" 也能找到 "《山城奇遇記》"
    queryBuilder.andWhere("event.title LIKE :title", { title: `%${criteria.title}%` });
  } else {
    // 如果沒有標題，才使用地點、類型、日期的複合查詢
    if (criteria.location) {
      queryBuilder.andWhere("(event.city = :location OR event.location LIKE :locationLike)", {
        location: criteria.location,
        locationLike: `%${criteria.location}%`,
      });
    }
    if (criteria.category) {
      queryBuilder.andWhere("type.name = :category", { category: criteria.category });
    }
    if (criteria.start_date && criteria.end_date) {
      queryBuilder.andWhere("event.start_at BETWEEN :start AND :end", {
        start: criteria.start_date,
        end: dayjs(criteria.end_date).endOf("day").toDate(),
      });
    }
  }

  const events = await queryBuilder.orderBy("event.start_at", "ASC").take(10).getMany();
  return events;
}

/**
 * 輔助函式 3：呼叫 LLM API 來為查詢結果產生一段總結
 */
async function summarizeResults(userQuery, foundEvents) {
  if (foundEvents.length === 0) {
    return "不好意思，根據您的需求，目前找不到完全符合的活動耶。要不要換個關鍵字試試看？";
  }
  const eventTitles = foundEvents.map((e) => e.title).join("、");
  const prompt = `
        請你扮演一個親切的活動推薦小助手。使用者剛剛查詢了「${userQuery}」，而我找到了「${eventTitles}」這幾個活動。
        請用自然、口語化的方式回覆使用者，告訴他找到了幾個活動，並簡單推薦一下。字數請控制在50字以內。
    `;
  const response = await axios.post(`${GEMINI_API_URL_BASE}?key=${GEMINI_API_KEY}`, {
    contents: [{ parts: [{ text: prompt }] }],
  });
  return response.data.candidates[0].content.parts[0].text.trim();
}

// --- 主要的 Controller 函式 ---
const aiSearch = async (req, res, next) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ status: false, message: "缺少查詢內容" });
  }

  // 使用 try...catch 包裹所有可能出錯的非同步操作
  try {
    // 步驟一：解析使用者意圖
    const criteria = await parseSearchQuery(query);

    // 步驟二：查詢自家資料庫
    const events = await queryEventsFromDB(criteria);

    // 步驟三：潤飾結果
    const summaryMessage = await summarizeResults(query, events);

    // 步驟四：回傳最終結果
    res.json({
      status: true,
      message: summaryMessage,
      data: events,
    });
  } catch (error) {
    // 當上述任何一個步驟失敗時，捕捉錯誤
    console.error("AI Search Error:", error);
    res.status(500).json({ status: false, message: "AI 搜尋服務暫時無法使用，請稍後再試。" });
  }
};

module.exports = {
  aiSearch,
};
