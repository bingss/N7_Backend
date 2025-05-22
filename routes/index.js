const express = require('express')
const config = require('../config/index')
const logger = require('../utils/logger')('index')
const router = express.Router()
const { dataSource } = require('../db/data-source')
const handleErrorAsync = require('../utils/handleErrorAsync')
const indexController = require('../controllers/index')


// 取得所有活動類型
router.get('/event-types', handleErrorAsync(indexController.getEventTypes))


module.exports = router