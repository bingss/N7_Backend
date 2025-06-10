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


// 19.提交新增活動
router.post('/propose-event',isAuth, authRole, handleErrorAsync(organizerController.postEvent));



// 20.提交編輯活動
router.put('/events/:eventId',isAuth, authRole, handleErrorAsync(organizerController.putEvent));

// 21.上傳照片
router.post('/upload_image',isAuth, authRole, checkImage, handleErrorAsync(organizerController.postImage));

// 22.取得活動方活動列表
router.get('/events',isAuth, authRole, handleErrorAsync(organizerController.getEvents));

// 24.1.取得特定活動狀態列表供驗票使用
router.get('/events/by-status',isAuth, authRole, handleErrorAsync(organizerController.getStatusEvents));

// 25.取得編輯之活動資訊
router.get('/events/edit/:eventId',isAuth, authRole, handleErrorAsync(organizerController.getEditEvent));

// 23.取得單一活動詳細內容
router.get('/events/:eventId',isAuth, authRole, handleErrorAsync(organizerController.getEvent));

// 24.更新票券使用狀態(驗票)
router.patch('/events/:orgEventId/verify',isAuth, authRole, handleErrorAsync(organizerController.patchTicket));

// 24.更新票券使用狀態(驗票)
router.delete('/events/:eventId',isAuth, authRole, handleErrorAsync(organizerController.deleteEvent));



module.exports = router