const appError = require('../utils/appError')
const config = require('../config/index')
const passport = require('passport');
const { generateJWT } = require('../utils/jwtUtils');
const { google } = require('googleapis');
const { deleteGoogleAccount } = require('../services/userService')
const { isRedirectUriAllowed } = require('../utils/validUtils');


const googleCallback = async (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, user, info) => {
        const mode = info?.state
        const redirectURL = info?.redirectURL || ( (mode === 'bind') ? config.get('google').bindRedirectFrontUrl : config.get('google').signinupRedirectFrontUrl )
        
        if (err || !user) {
            const redirectErrorUrl = info?.googleErrorRedirect || `${ redirectURL }?error=unauthorized`;
            return res.redirect(redirectErrorUrl);
        }
        if (mode === 'bind'){
            res.redirect(`${ redirectURL }?state=success&google_email=${user.google_email}&name=${encodeURIComponent( user.name )}`);
        }else{
            const token = generateJWT({ userId: user.id });
            // res.cookie('token', token, {
            //     httpOnly: true,
            //     secure: true, // 若你使用 HTTPS
            //     sameSite: 'None' // 跨域支援
            // });
            
            res.redirect(`${ redirectURL }?state=success&token=${token}&name=${ encodeURIComponent( user.name ) }`);
        }
    })(req, res, next);
}

const unbindGoogleAccount = async (req, res, next) => {
    const userId = req.user.id

    const isBinding = await deleteGoogleAccount(userId)

    res.status(200).json({
        status: true,
        message: "解除綁定成功",
        data: {
            google_bind : isBinding
        }
    })
}

const generateAuthUrl = async (req, res, next) => {
    try {
    // 產生 Google 授權 URL
    const oauth2Client = new google.auth.OAuth2(
        config.get('google').clientID,
        config.get('google').clientSecret,
        config.get('google').callbackUrl // callback endpoint
    );
    const { redirectUri } = req.query || null;
    if(!isRedirectUriAllowed(redirectUri)){
        next( appError(400, '重導網址未合法或錯誤') )
        return
    }
    const stateData = {
        mode: 'bind',
        token: generateJWT({ userId: req.user.id }),
        redirectUri: redirectUri
        // timestamp: Date.now() // 可選：加入時間戳防止重放攻擊
    };

    const authUrl = oauth2Client.generateAuthUrl({
        scope: ['email','profile'],
        state: Buffer.from(JSON.stringify(stateData)).toString('base64'),
    });

    res.status(200).json({
        status: true,
        message: "產生導向連結成功",
        data: {
            redirectUrl : authUrl
        }
    })
    } catch (err) {
        throw appError(400, '產生導向連結成功錯誤')
    }
}

const signinOrSignup = async (req, res, next) => {
    const { redirectUri } = req.query || null;
    if(!isRedirectUriAllowed(redirectUri)){
        return res.redirect(`${ config.get('google').signinupRedirectFrontUrl }?error=unlegal_redirectUri`);
    }
    const stateData = {
        mode: 'login',
        redirectUri: redirectUri
    };
    passport.authenticate('google', {
        scope: [ 'email','profile'],
        state: Buffer.from(JSON.stringify(stateData)).toString('base64')
    })(req, res, next);
}
module.exports = {
    googleCallback,
    unbindGoogleAccount,
    generateAuthUrl,
    signinOrSignup
}
