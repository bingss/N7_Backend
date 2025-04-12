const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { generateJWT } = require('../utils/jwtUtils')

const router = express.Router()
const { dataSource } = require('../db/data-source')
const logger = require('../utils/logger')('Users')
const appError = require('../utils/appError')
const { isValidString, isValidPassword } = require('../utils/validUtils')
const isAuth = require('../middleware/isAuth')
const handleErrorAsync = require('../utils/handleErrorAsync')
const userController = require('../controllers/user')

const saltRounds = 10

// 新增使用者
router.post('/signup', handleErrorAsync(userController.postSignup));

router.post('/login', handleErrorAsync(userController.postLogin));

router.get('/profile', isAuth, handleErrorAsync(userController.getProfile));

router.put('/profile', isAuth, handleErrorAsync(userController.putProfile));

router.put('/password', isAuth, handleErrorAsync(userController.putPassword));

module.exports = router
