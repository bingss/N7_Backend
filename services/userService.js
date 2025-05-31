const logger = require('../utils/logger')('userService')
const { dataSource } = require('../db/data-source')
const { Brackets } = require("typeorm");
const appError = require('../utils/appError')
const config = require('../config/index')
const { verifyJWT } = require('../utils/jwtUtils');
const { isRedirectUriAllowed } = require('../utils/validUtils');

const createOrBindGoogleAccount = async (req, accessToken, refreshToken, profile, cb) => {
    
    const accountAuthRepo = dataSource.getRepository('AccountAuth')
    const userRepo = dataSource.getRepository('User')

    const googleEmail = profile.emails[0].value;
    const currentProvider = profile.provider;
    const currentProviderId = profile.id;
    let redirectURL = null;

    try {
        const { state } = req.query;
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        const { mode,redirectUri } = stateData; // mode:'login' or 'bind'.
        if(!isRedirectUriAllowed(redirectUri)){
            return cb(null, false, { googleErrorRedirect: `${ config.get('google').signinupRedirectFrontUrl }?error=unlegal_redirectUri` } );
        }
        if (mode === 'bind') {
            redirectURL = redirectUri || config.get('google').bindRedirectFrontUrl

            const { token } = stateData;
            const verifyResult = await verifyJWT(token)
            req.user = await userRepo.findOneBy({ id: verifyResult.userId })
            if (!req.user) {
                throw appError(401, '使用者錯誤')
            }
            req.user.google_email = googleEmail
            //檢查這個GOOGLE有沒有被其他帳號綁定
            const existingBindedAccount = await accountAuthRepo.findOne({
                select:['user_id'],
                where: { provider:currentProvider, provider_id:currentProviderId }
            })
            
            if (existingBindedAccount) {
                if( existingBindedAccount.user_id === req.user.id ){
                    return cb( null, false, { googleErrorRedirect: `${redirectURL}?error=repeated_binded` } ); //已綁定過相同Google帳號
                }
                return cb(null, false, { googleErrorRedirect: `${redirectURL}?error=binded_other_user` } ); //此Google帳號已被其他使用者綁定
            }

            //檢查這個帳號是否已綁定GOOGLE
            const existingGoogleAuth = await accountAuthRepo.findOne({
                select:['user_id'],
                where: {  user_id: req.user.id, provider:currentProvider}
            })
            if (existingGoogleAuth) {
                return cb(null, false, { googleErrorRedirect: `${redirectURL}?error=already_binded` } ); //已綁定過Google帳號
            }

            const newAuth = accountAuthRepo.create({
                provider: currentProvider,
                provider_id: currentProviderId,
                user_id: req.user.id
            });
            await accountAuthRepo.save(newAuth);
            return cb(null, req.user, { state: 'bind',redirectURL:redirectURL }); // 綁定後繼續使用原本登入者

        }else {
            // 登入流程
            redirectURL = redirectUri || config.get('google').signinupRedirectFrontUrl
            const cbStateData = { state: 'login',redirectURL:redirectURL }
            const existingUsers = await userRepo
                .createQueryBuilder("user")
                .innerJoin("user.AccountAuth", "accountauth")
                .where("user.email=:email", { email : googleEmail })
                .orWhere(
                    new Brackets(qb => {
                        qb
                        .where("accountauth.provider = :provider", { provider: currentProvider })
                        .andWhere("accountauth.provider_id = :provider_id", { provider_id: currentProviderId });
                    })
                )
                .select([
                    "user.id AS id",
                    "user.name AS name",
                    "user.role AS role",
                    "accountauth.provider As provider",
                    "accountauth.provider_id As provider_id"
                ])
                .getRawMany();

            //帳號存在，若綁定相同GoogleId帳號，則登入；反之則註冊失敗
            if ( existingUsers.length !== 0) {
                const googleUser = existingUsers.find( ( user ) => user.provider === currentProvider && user.provider_id === currentProviderId)
                if( googleUser ){
                    return cb(null, googleUser, cbStateData);
                }
                return cb( null, false, { googleErrorRedirect: `${redirectURL}?error=email_used` } ); //Email已被使用，使用其他方式登入後，綁定Google帳號
            }

            //若不存在相同Email則創建Google帳號並登入
            const newUser = userRepo.create({
                name: profile.displayName,
                email: googleEmail
            });
            const savedUser = await userRepo.save(newUser);
            if (!savedUser) {
                return cb(null, false, { googleErrorRedirect: `${redirectURL}?error=signup_failed` } ); //註冊失敗
            }
            accountAuth = accountAuthRepo.create({
                provider: currentProvider,
                provider_id : currentProviderId,
                user_id : savedUser.id
            })
            await accountAuthRepo.save(accountAuth);
            return cb(null, savedUser, cbStateData);
        }
    } catch (err) {
        logger.error(`[createOrLoginGoogleAccount] google登入或綁定失敗: ${err}`)
        return cb(null, false, { googleErrorRedirect: `${redirectURL}?error=ERROR` } );
    }

}

const deleteGoogleAccount = async (userId) => {
    const accountAuthRepo = dataSource.getRepository('AccountAuth')

    //取得帳號之登入方式
    const existingAuths = await accountAuthRepo
        .createQueryBuilder("accountauth")
        .where("accountauth.user_id=:user_id", {user_id : userId })
        .select([
            "accountauth.id AS id",
            "accountauth.provider As provider"
        ])
        .getRawMany();

    if(existingAuths.length === 0){
        throw appError(400, '錯誤，查無任何登入方式')
    }

    const googleAuth = existingAuths.find(auth => auth.provider === 'google');

    if ( !googleAuth ) {
        throw appError(400, '尚未綁定Google帳號')
    }

    const hasOtherAuth = existingAuths.some(auth => auth.provider !== 'google');

    if ( !hasOtherAuth ) {
        throw appError(400, '僅有Google登入方式，請於更新密碼後再解除綁定')
    }

    //刪除綁定關係
    const delGoogleAuthResult = await accountAuthRepo.delete(googleAuth.id)
    if (delGoogleAuthResult.affected === 0) {
        throw appError(400, '解除綁定失敗')
    }
    return false; //返回false表示Google帳號已解除綁定
}


module.exports = {
    createOrBindGoogleAccount,
    deleteGoogleAccount
}