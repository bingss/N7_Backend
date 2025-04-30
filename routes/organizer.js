const express = require('express')
const config = require('../config/index')
const logger = require('../utils/logger')('Organizer')
const router = express.Router()
const { dataSource } = require('../db/data-source')
const handleErrorAsync = require('../utils/handleErrorAsync')
const organizerController = require('../controllers/organizer')
const { USER_ROLE } = require('../enums/index')
const isRole = require('../middlewares/isRole')({
  allowedRoles: [USER_ROLE.ORGANIZER],
  logger
})

const isAuth = require('../middlewares/auth')({
  secret: config.get('secret').jwtSecret,
  userRepository: dataSource.getRepository('User'),
  logger
})


// 上傳照片
router.post('/uploadimage',isAuth, isRole, handleErrorAsync(organizerController.postImage));

module.exports = router