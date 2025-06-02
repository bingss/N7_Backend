const logger = require('../utils/logger')('userService')
const { dataSource } = require('../db/data-source')
const { Brackets } = require("typeorm");
const appError = require('../utils/appError')
const config = require('../config/index')
const { verifyJWT } = require('../utils/jwtUtils');
const { isRedirectUriAllowed } = require('../utils/validUtils');
const { USER_ROLE, USER_STATUS } = require('../enums/index')
const ERROR_STATUS_CODE = 400;
const accountAuthRepository = dataSource.getRepository('AccountAuth')
const userRepository = dataSource.getRepository('User')

const createOrBindGoogleAccount = async (req, accessToken, refreshToken, profile, cb) => {
    


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
            req.user = await userRepository.findOneBy({ id: verifyResult.userId })
            if (!req.user) {
                throw appError(401, '使用者錯誤')
            }
            req.user.google_email = googleEmail
            //檢查這個GOOGLE有沒有被其他帳號綁定
            const existingBindedAccount = await accountAuthRepository.findOne({
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
            const existingGoogleAuth = await accountAuthRepository.findOne({
                select:['user_id'],
                where: {  user_id: req.user.id, provider:currentProvider}
            })
            if (existingGoogleAuth) {
                return cb(null, false, { googleErrorRedirect: `${redirectURL}?error=already_binded` } ); //已綁定過Google帳號
            }

            const newAuth = accountAuthRepository.create({
                provider: currentProvider,
                provider_id: currentProviderId,
                user_id: req.user.id
            });
            await accountAuthRepository.save(newAuth);
            return cb(null, req.user, { state: 'bind',redirectURL:redirectURL }); // 綁定後繼續使用原本登入者

        }else {
            // 登入流程
            redirectURL = redirectUri || config.get('google').signinupRedirectFrontUrl
            const cbStateData = { state: 'login',redirectURL:redirectURL }
            const existingUsers = await userRepository
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
                    if(googleUser.status === USER_STATUS.BLOCKED){
                        throw new error('使用者已被封鎖，無法登入');
                    }
                    return cb(null, googleUser, cbStateData);
                }
                return cb( null, false, { googleErrorRedirect: `${redirectURL}?error=email_used` } ); //Email已被使用，使用其他方式登入後，綁定Google帳號
            }

            //若不存在相同Email則創建Google帳號並登入
            const newUser = userRepository.create({
                name: profile.displayName,
                email: googleEmail
            });
            const savedUser = await userRepository.save(newUser);
            if (!savedUser) {
                return cb(null, false, { googleErrorRedirect: `${redirectURL}?error=signup_failed` } ); //註冊失敗
            }
            accountAuth = accountAuthRepository.create({
                provider: currentProvider,
                provider_id : currentProviderId,
                user_id : savedUser.id
            })
            await accountAuthRepository.save(accountAuth);
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

const getUsersData = async () => {
    try{
        const users = await userRepository
                .createQueryBuilder("user")
                .leftJoin("user.Order", "order")
                .leftJoin("order.Ticket", "ticket")
                .where("user.role=:role", { role: USER_ROLE.GENERAL })
                .select([
                    "user.id AS id",
                    "user.serialNo AS serialNo",
                    "user.name AS name",
                    // "user.role AS role",
                    "COUNT(ticket.id) AS count",
                    "(CASE WHEN user.status = 'active' THEN false ELSE true END) AS isBlocked"
                ])
                .groupBy("user.id")
                .addGroupBy("user.serialNo")
                .addGroupBy("user.name")
                .addGroupBy("user.role")
                .getRawMany();
        const formatUsers = users.map(user => ({
                id: user.id,
                serialNo: user.serialNo,
                name: user.name,
                // role: user.role,
                count: parseInt(user.count, 10),
                isBlocked: user.isBlocked === 'true' ? true : false
            }))
        return formatUsers
    }catch (err) {
        logger.error(`[getUsersData]${err}`)
        if (err.status) {
            throw err
        }
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
}

const getOneUserData = async (userId) => {
    try{
        const userWithInfos = await userRepository
                .createQueryBuilder("user")
                .leftJoin("user.Order", "order")
                .leftJoin("order.Ticket", "ticket")
                .leftJoin("order.Event", "event")
                .where("user.id=:id", { id: userId })
                .select([
                    "user.id AS user_id",
                    "user.serialNo AS user_serialNo",
                    "user.name AS user_name",
                    "user.email AS user_email",
                    "user.role AS user_role",
                    "(CASE WHEN user.status = 'active' THEN false ELSE true END) AS isBlocked",

                    "order.id AS order_id",
                    "event.title AS event_title",
                    "COUNT(ticket.id) AS ticket_puchased",
                    "SUM(CASE WHEN ticket.status = 'used' THEN 1 ELSE 0 END) AS ticket_used",
                    "SUM(ticket.price_paid) AS total_price",
                    "order.payment_method AS payment_method",
                    "order.payment_status AS payment_status",
                ])
                .groupBy('user.id, order.id, event.id')
                .orderBy("event.start_at", "ASC")
                .getRawMany();
            
            if (userWithInfos.length === 0) throw appError(400, '使用者不存在');

            const base = userWithInfos[0];
            const formatUser = {
                user: {
                    id: base.user_id,
                    serialNo: base.user_serialNo,
                    name: base.user_name,
                    email: base.user_email,
                    role: base.user_role,
                    isBlocked: base.isBlocked,
                },
                orders: base.order_id === null ? [] : userWithInfos.map(order => ({
                            order_id: order.order_id,
                            event_title: order.event_title,
                            ticket_puchased: parseInt(order.ticket_puchased, 10),
                            ticket_used: parseInt(order.ticket_used, 10),
                            total_price: parseFloat(order.total_price),
                            payment_method: order.payment_method,
                            payment_status: order.payment_status,
                        }))
            };

        return formatUser
    }catch (err) {
        if (err.status) {
            throw err
        }
        logger.error(`[getOneUserData]${err}`)
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
}

const updateUserStatus = async(userId) => {
    try{
        const user = await userRepository.findOne({ where: { id: userId } });
        if (!user) {
            next( appError(ERROR_STATUS_CODE, '查無使用者') )
        }
        if(user.role !== USER_ROLE.GENERAL){
            next( appError(ERROR_STATUS_CODE, '僅能封鎖一般使用者') )
        }

        user.status = user.status === USER_STATUS.ACTIVE ? USER_STATUS.BLOCKED : USER_STATUS.ACTIVE;
        const savedUser = await userRepository.save(user);

        const isBlocked = savedUser.status === USER_STATUS.BLOCKED ? true : false
        return isBlocked
    }catch (err) {
        logger.error(`[getUsersData]${err}`)
        if (err.status) {
            throw err
        }
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
}

module.exports = {
    createOrBindGoogleAccount,
    deleteGoogleAccount,
    getUsersData,
    getOneUserData,
    updateUserStatus 
}
