const { dataSource } = require('../db/data-source')
const appError = require('../utils/appError')
const config = require('../config/index')
const bcrypt = require('bcryptjs');
const passport = require('passport');
const { generateJWT } = require('../utils/jwtUtils');
const { isValidPassword } = require('../utils/validUtils');
const { isValidString } = require('../utils/validUtils');
const { isValidName } = require('../utils/validUtils');
const { isUndefined } = require('../utils/validUtils');
const { USER_ROLE } = require('../enums/index')
const { createOrLoginGoogleAccount } = require('../services/userService')
const userRepository = dataSource.getRepository('User');

const googleCallback = async (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, user, info) => {
        const mode = info?.state
        const redirectUrlURL = (mode === 'bind') ? config.get('google').bindRedirectFrontUrl : config.get('google').signinupRedirectFrontUrl
        if (err || !user) {
            const redirectErrorUrl = info?.googleErrorRedirect || `${ redirectUrlURL }?error=unauthorized`;
            return res.redirect(redirectErrorUrl);
        }
        
        if (mode === 'bind'){
            res.redirect(`${ redirectUrlURL }?state=success`);
        }else{
            const token = generateJWT({ userId: user.id });
            // res.cookie('token', token, {
            //     httpOnly: true,
            //     secure: true, // 若你使用 HTTPS
            //     sameSite: 'None' // 跨域支援
            // });
            res.redirect(`${ redirectUrlURL }?state=success&token=${token}`);
        }

        // res.redirect(`${ redirectUrlURL }/api/v1/google`);
    })(req, res, next);
}



module.exports = {
    googleCallback
}
