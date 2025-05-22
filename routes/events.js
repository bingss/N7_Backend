const express = require('express')
const config = require('../config/index')
const logger = require('../utils/logger')('index')
const router = express.Router()
const { dataSource } = require('../db/data-source')
const handleErrorAsync = require('../utils/handleErrorAsync')
const eventsController = require('../controllers/events')


// 取得即將登場活動列表
router.get('/coming-soon', handleErrorAsync(eventsController.getComingEvents))


// 取得即將登場活動列表
router.get('/trend', handleErrorAsync(eventsController.getTrendEvents))


module.exports = router