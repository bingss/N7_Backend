const express = require('express')
const config = require('../config/index')
const logger = require('../utils/logger')('User')
const router = express.Router()
const { dataSource } = require('../db/data-source')
const handleErrorAsync = require('../utils/handleErrorAsync')
const userController = require('../controllers/user')
const { generateJWT } = require('../utils/jwtUtils');
const { createOrLoginGoogleAccount } = require('../services/userService')
const isAuth = require('../middlewares/auth')({
  secret: config.get('secret').jwtSecret,
  userRepository: dataSource.getRepository('User'),
  logger
})

const passport = require('passport');
const GoogleStrategy = require( 'passport-google-oauth20' ).Strategy;
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_AUTH_CLIENTID,
    clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET,
    callbackURL: `${ process.env.GOOGLE_AUTH_CALLBACKURL }/api/v1/users/google/callback`,
    passReqToCallback: true
  },
  createOrLoginGoogleAccount
));

// 註冊 & 登入
router.post('/signup', handleErrorAsync(userController.postSignup));
router.post('/signin', handleErrorAsync(userController.postLogin));

// GET 所有使用者
router.get('/', userController.getAllUsers);

//  GET 取得使用者資料
router.get('/profile', isAuth, handleErrorAsync(userController.getProfile));

router.put('/profile', isAuth, handleErrorAsync(userController.putProfile));

router.put('/password', isAuth, handleErrorAsync(userController.putPassword));

router.post('/auth', isAuth, handleErrorAsync(userController.postAuth));
// router.get('/auth/refresh', isAuth, handleErrorAsync(userController.getRefresh));
// router.get('/auth/logout', isAuth, handleErrorAsync(userController.getLogout));

router.get('/google/signin-or-signup', passport.authenticate('google', {
  scope: [ 'email', 'profile'],
  state: 'login'
}));

router.get('/google/bind', isAuth , passport.authenticate('google', {
  scope: ['email', 'profile'],
  state: 'bind'
}));

router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  handleErrorAsync(userController.googleCallback))

module.exports = router
