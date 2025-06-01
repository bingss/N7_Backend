const express = require('express')
const config = require('../config/index')
const logger = require('../utils/logger')('index')
const router = express.Router()
const { dataSource } = require('../db/data-source')
const handleErrorAsync = require('../utils/handleErrorAsync')
const eventsController = require('../controllers/events')

// 取得所有活動列表
router.get('/', handleErrorAsync(eventsController.getAllEvents))

// 取得即將登場活動列表
router.get('/coming-soon', handleErrorAsync(eventsController.getComingEvents))


// 取得即將登場活動列表
router.get('/trend', handleErrorAsync(eventsController.getTrendEvents))

// 取得單一活動列表
router.get('/:event_id', handleErrorAsync(eventsController.getEventId))

module.exports = router