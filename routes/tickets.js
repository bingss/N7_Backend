const express = require('express')
const config = require('../config/index')
const logger = require('../utils/logger')('Tickets')
const router = express.Router()
const { dataSource } = require('../db/data-source')
const handleErrorAsync = require('../utils/handleErrorAsync')
const ticketsController = require('../controllers/tickets')
const { USER_ROLE } = require('../enums/index')

const authRole = require('../middlewares/authRole')({
  allowedRoles: [USER_ROLE.GENERAL],
  logger
})

const isAuth = require('../middlewares/auth')({
  secret: config.get('secret').jwtSecret,
  userRepository: dataSource.getRepository('User'),
  logger
})

router.post

// 使用者取得票券列表
router.get('/',isAuth, authRole, handleErrorAsync(ticketsController.getTickets));

// 使用者取得單一票券詳情
router.get('/:orderId',isAuth, authRole, handleErrorAsync(ticketsController.getSingleTicket));


module.exports = router