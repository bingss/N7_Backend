const appError = require('../utils/appError')
const config = require('../config/index')
const passport = require('passport');
const { generateJWT } = require('../utils/jwtUtils');
const { google } = require('googleapis');
const { deleteGoogleAccount } = require('../services/userService')

const googleCallback = async (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, user, info) => {
        const mode = info?.state
        const redirectUrlURL = (mode === 'bind') ? config.get('google').bindRedirectFrontUrl : config.get('google').signinupRedirectFrontUrl
        if (err || !user) {
            const redirectErrorUrl = info?.googleErrorRedirect || `${ redirectUrlURL }?error=unauthorized`;
            return res.redirect(redirectErrorUrl);
        }
        if (mode === 'bind'){
            res.redirect(`${ redirectUrlURL }?state=success&google_email=${user.google_email}`);
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
    const stateData = {
        mode: 'bind',
        token: generateJWT({ userId: req.user.id }),
        // timestamp: Date.now() // 可選：加入時間戳防止重放攻擊
    };

    const authUrl = oauth2Client.generateAuthUrl({
      scope: ['profile', 'email'],
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


module.exports = {
    googleCallback,
    unbindGoogleAccount,
    generateAuthUrl
}
