const express = require('express')
const config = require('../config/index')
const logger = require('../utils/logger')('User')
const router = express.Router()
const { dataSource } = require('../db/data-source')
const handleErrorAsync = require('../utils/handleErrorAsync')
const googleController = require('../controllers/google')
const { generateJWT } = require('../utils/jwtUtils');
const { createOrBindGoogleAccount } = require('../services/userService')

const { isValidString } = require('../utils/validUtils');
const { isValidUrl } = require('../utils/validUtils');
const { isUndefined } = require('../utils/validUtils');
const isAuth = require('../middlewares/auth')({
  secret: config.get('secret').jwtSecret,
  userRepository: dataSource.getRepository('User'),
  logger
})

const passport = require('passport');
const GoogleStrategy = require( 'passport-google-oauth20' ).Strategy;
passport.use(new GoogleStrategy({
    clientID: config.get('google').clientID,
    clientSecret: config.get('google').clientSecret,
    callbackURL: `${ config.get('google').callbackUrl }`,
    passReqToCallback: true
  },
  createOrBindGoogleAccount
));

//測試用
// router.get('/', (req, res) => { 
//   res.render('index', { title: 'Express', Host: `http://localhost:8080/api/v1/google/signin-or-signup` } );
// });

router.get('/signin-or-signup' , passport.authenticate('google', {
  scope: [ 'email', 'profile'],
  state: 'login'
}));

router.get('/bind', isAuth, passport.authenticate('google', {
  scope: ['email', 'profile'],
  state: 'bind'
}));

router.get('/callback',  googleController.googleCallback)

router.delete('/bind', isAuth, handleErrorAsync(googleController.unbindGoogleAccount));

module.exports = router

