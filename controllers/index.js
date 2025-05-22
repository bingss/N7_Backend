
const config = require('../config/index')
const logger = require('../utils/logger')('Organizer')
const appError = require('../utils/appError')
const { getEventTypesData } = require('../services/eventTypesService')
const ERROR_STATUS_CODE = 400;


const getEventTypes = async (req, res, next) => {
    const eventTypes = await getEventTypesData()

    res.status(200).json({
        status: true,
        message: `取得資料成功`,
        data: eventTypes
    })
}

module.exports = {
    getEventTypes
}