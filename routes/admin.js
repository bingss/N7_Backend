const express = require('express')
const config = require('../config/index')
const logger = require('../utils/logger')('Admin')
const router = express.Router()
const { dataSource } = require('../db/data-source')
const handleErrorAsync = require('../utils/handleErrorAsync')
const adminController = require('../controllers/admin')
const { USER_ROLE } = require('../enums/index')
const { checkImage } = require('../utils/imageUtils')

const authRole = require('../middlewares/authRole')({
  allowedRoles: [USER_ROLE.ADMIN],
  logger
})

const isAuth = require('../middlewares/auth')({
  secret: config.get('secret').jwtSecret,
  userRepository: dataSource.getRepository('User'),
  logger
})

// 26.查看一般會員列表
router.get('/users',isAuth, authRole, handleErrorAsync(adminController.getUsers));

//27.取得單一活動資訊
router.get('/events/:eventId',isAuth, authRole, handleErrorAsync(adminController.getEvent));

//28.活動審核(修改狀態)
router.patch('/events/:eventId',isAuth, authRole, handleErrorAsync(adminController.patchEventStatus));

//29.取得所有活動列表
router.get('/events',isAuth, authRole, handleErrorAsync(adminController.getEvents));

// 30. 取得單一使用者資料
router.get('/users/:userId',isAuth, authRole, handleErrorAsync(adminController.getUser));

// 31.使用者審核(切換封鎖狀態)
router.patch('/users/:userId/toggle-block',isAuth, authRole, handleErrorAsync(adminController.patchUserStatus));




module.exports = router