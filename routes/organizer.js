const express = require('express')
const config = require('../config/index')
const logger = require('../utils/logger')('Organizer')
const router = express.Router()
const { dataSource } = require('../db/data-source')
const handleErrorAsync = require('../utils/handleErrorAsync')
const organizerController = require('../controllers/organizer')
const { USER_ROLE } = require('../enums/index')
const { checkImage } = require('../utils/imageUtils')

const authRole = require('../middlewares/authRole')({
  allowedRoles: [USER_ROLE.ORGANIZER],
  logger
})

const isAuth = require('../middlewares/auth')({
  secret: config.get('secret').jwtSecret,
  userRepository: dataSource.getRepository('User'),
  logger
})


// 提交新增活動
router.post('/propose-event',isAuth, authRole, handleErrorAsync(organizerController.postEvent));

// 提交編輯活動
router.put('/edit-event/:eventId',isAuth, authRole, handleErrorAsync(organizerController.putEvent));

// 上傳照片
router.post('/uploadimage',isAuth, authRole, checkImage, handleErrorAsync(organizerController.postImage));

// 取得活動訂單列表
router.get('/orders',isAuth, authRole, handleErrorAsync(organizerController.getOrders));

// 取得單一活動詳細內容
router.get('/orders/:eventId',isAuth, authRole, handleErrorAsync(organizerController.getSingleOrder));

// 取得編輯之活動資訊
router.get('/edit-event/:eventId',isAuth, authRole, handleErrorAsync(organizerController.getEditEvent));

module.exports = router