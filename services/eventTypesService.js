const config = require('../config/index')
const logger = require('../utils/logger')('TicketsService')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const ERROR_STATUS_CODE = 400;


const getEventTypesData = async () => {
    try {

        const eventTypes = await dataSource.getRepository('Type').find({
            select: ['id', 'name']
        });
    
        
        return eventTypes
    }catch (error) {
        if (error.status) {
            throw error;
        }
        logger.error(`[getEventTypesData] 取得活動類型失敗: ${error}`)
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
}

module.exports = {
    getEventTypesData 
}