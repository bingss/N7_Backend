const FORBIDDEN_MESSAGE = '使用者權限不足';
const AUTH_FAILED_MESSAGE = '尚未登入';
const PERMISSION_DENIED_STATUS_CODE = 401;
const { USER_ROLE } = require('../enums/index');
const appError = require('../utils/appError');

  /**
 * 檢查使用者是否具有指定角色
 * @param {[USER_ROLE.GENERAL, USER_ROLE.ORGANIZER, USER_ROLE.ADMIN]} allowedRoles - 允許的角色陣列
 */
module.exports = ({
    allowedRoles = [],
    logger = console
}) => {
    return (req, res, next) => {
        try {
            if (!req.user || !req.user.role) {
                logger.warn('[AuthRole] 角色驗證失敗，使用者未登入或角色不存在')
                next(appError(PERMISSION_DENIED_STATUS_CODE, AUTH_FAILED_MESSAGE))
                return;
            }


            if (!allowedRoles.includes(req.user.role)) {
                logger.warn('[AuthRole] 角色驗證失敗，使用者角色不符合要求')
                next(appError(PERMISSION_DENIED_STATUS_CODE, FORBIDDEN_MESSAGE));
                return;
            }
            next();
        }
        catch (error) {
            logger.error(`[AuthRole]${error.message}`);
            next(error);
            return;
        }
    };
};