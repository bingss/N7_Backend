const logger = require('../utils/logger')('userService')
const { dataSource } = require('../db/data-source')
const { Brackets } = require("typeorm");
const appError = require('../utils/appError')
  
const createOrLoginGoogleAccount = async (req, accessToken, refreshToken, profile, cb) => {
    const mode = req.query.state; // 'login' or 'bind'
    const accountAuthRepo = dataSource.getRepository('AccountAuth')
    const userRepo = dataSource.getRepository('User')

    const googleEmail = profile.emails[0].value;
    const currentProvider = profile.provider;
    const currentProviderId = profile.id;
    try {
        if (mode === 'bind') {
            if (!req.user) {
                return cb( appError( 401, '尚未登入'));
            }
            const loginUserId = req.user.id

            //檢查這個GOOGLE有沒有被其他帳號綁定
            const existingBindedAccount = await accountAuthRepo.findOne({
                select:['user_id'],
                where: { provider:currentProvider, provider_id:currentProviderId }
            })
            
            if (existingBindedAccount) {
                if( existingBindedAccount.user_id === loginUserId ) return cb( appError( 400, '已綁定過相同Google帳號') );
                return cb( appError( 400, '此Google帳號已被其他使用者綁定') );
            }

            //檢查這個帳號是否已綁定GOOGLE
            const existingGoogleAuth = await accountAuthRepo.findOne({
                select:['user_id'],
                where: { provider:currentProvider, user_id: loginUserId}
            })
            if (existingGoogleAuth) {
                return cb( appError( 400, '已綁定過Google帳號') );
            }

            const newAuth = accountAuthRepo.create({
                provider: currentProvider,
                provider_id: currentProviderId,
                user_id: loginUserId
            });
            await accountAuthRepo.save(newAuth);
            req.user.google_email = googleEmail
            return cb(null, req.user, { state: 'bind' }); // 綁定後繼續使用原本登入者

        }else {
            // 登入流程
            
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
                    return cb(null, googleUser, { state: 'login' });
                }
                return cb( appError(409, '註冊失敗，Email已被使用，使用其他方式登入後，綁定Google帳號' ) );
            }

            //若不存在相同Email則創建Google帳號並登入
            const newUser = userRepo.create({
                name: profile.displayName,
                email: googleEmail
            });
            const savedUser = await userRepo.save(newUser);
            if (!savedUser) {
                return cb(appError(400, '註冊失敗' ));
            }
            accountAuth = accountAuthRepo.create({
                provider: currentProvider,
                provider_id : currentProviderId,
                user_id : savedUser.id
            })
            await accountAuthRepo.save(accountAuth);
            return cb(null, savedUser, { state: 'login' });
        }
    } catch (err) {
        logger.error(`[createOrLoginGoogleAccount] google登入或綁定失敗: ${err}`)
        return cb(appError(400, '發生錯誤'));
    }

}

module.exports = {
    createOrLoginGoogleAccount
}