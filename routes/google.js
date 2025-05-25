const express = require('express')
const config = require('../config/index')
const logger = require('../utils/logger')('User')
const router = express.Router()
const { dataSource } = require('../db/data-source')
const handleErrorAsync = require('../utils/handleErrorAsync')
const userController = require('../controllers/user')
const { generateJWT } = require('../utils/jwtUtils');
const { createOrLoginGoogleAccount } = require('../services/userService')

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
    callbackURL: `${ config.get('google').callbackUrl }/api/v1/google/callback`,
    passReqToCallback: true
  },
  createOrLoginGoogleAccount
));

router.get('/', (req, res) => {
  res.render('index', { title: 'Express', Host: `${ config.get('google').callbackUrl }/api/v1/users/google/signin-or-signup` } );
});

router.get('/signin-or-signup', passport.authenticate('google', {
  scope: [ 'email', 'profile'],
  state: 'login'
}));

router.get('/bind', isAuth , passport.authenticate('google', {
  scope: ['email', 'profile'],
  state: 'bind'
}));

// router.post('/google/signin-or-signup', passport.authenticate('google', {
//   scope: [ 'email', 'profile'],
//   state: 'login'
// }));

// router.post('/google/bind', isAuth , passport.authenticate('google', {
//   scope: ['email', 'profile'],
//   state: 'bind'
// }));


router.get('/callback',
  passport.authenticate('google', { session: false }),
  handleErrorAsync(userController.googleCallback))

module.exports = router
