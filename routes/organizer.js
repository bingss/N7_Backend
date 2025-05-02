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

// 上傳照片
router.post('/uploadimage',isAuth, authRole, checkImage, handleErrorAsync(organizerController.postImage));

module.exports = router