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

// 註冊 & 登入
router.post('/signup', handleErrorAsync(userController.postSignup));
router.post('/signin', handleErrorAsync(userController.postLogin));

// GET 所有使用者
router.get('/', userController.getAllUsers);

//  GET 取得使用者資料
router.post('/profile', isAuth, handleErrorAsync(userController.getProfile));

router.put('/profile', isAuth, handleErrorAsync(userController.putProfile));

router.put('/password', isAuth, handleErrorAsync(userController.putPassword));

<<<<<<< HEAD
// post 驗證登入狀態
router.post('/auth', isAuth, handleErrorAsync(userController.getAuth));
// router.get('/auth/refresh', isAuth, handleErrorAsync(userController.getRefresh));
// router.get('/auth/logout', isAuth, handleErrorAsync(userController.getLogout));
=======
router.get('/auth', isAuth, handleErrorAsync(userController.getAuth));
router.get('/auth/refresh', isAuth, handleErrorAsync(userController.getRefresh));
router.get('/auth/logout', isAuth, handleErrorAsync(userController.getLogout));
>>>>>>> origin/main

module.exports = router
