const express = require('express')
const config = require('../config/index')
const logger = require('../utils/logger')('User')
const router = express.Router()
const { dataSource } = require('../db/data-source')
const handleErrorAsync = require('../utils/handleErrorAsync')
const userController = require('../controllers/user')

const isAuth = require('../middlewares/auth')({
    secret: config.get('secret').jwtSecret,
    userRepository: dataSource.getRepository('User'),
    logger
  })

//fakeLogin：req中加入user，假裝已經登入使用
const fakeLogin = require('../middlewares/fakeLogin')

// 新增使用者
// router.post('/signup', handleErrorAsync(userController.postSignup));

// router.post('/login', handleErrorAsync(userController.postLogin));

//取得使用者資料
// router.get('/profile', isAuth, handleErrorAsync(userController.getProfile));
router.get('/profile',
    fakeLogin(dataSource.getRepository('User'),'c2d905d7-a1b0-45dd-9f16-ac38a80ded7f',logger),
    handleErrorAsync(userController.getProfile));

// router.put('/profile', isAuth, handleErrorAsync(userController.putProfile));

// router.put('/password', isAuth, handleErrorAsync(userController.putPassword));

module.exports = router
