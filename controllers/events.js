
const config = require('../config/index')
const logger = require('../utils/logger')('Organizer')
const appError = require('../utils/appError')
const { getComingEventsData, getTrendEventsData } = require('../services/eventService')
const ERROR_STATUS_CODE = 400;


const getComingEvents = async (req, res, next) => {
    const events = await getComingEventsData()

    res.status(200).json({
        status: true,
        message: `取得資料成功`,
        data: events
    })
}

const getTrendEvents = async (req, res, next) => {
    //取得活動尚未結束且瀏覽數最高之16個活動
    const events = await getTrendEventsData()

    res.status(200).json({
        status: true,
        message: `取得資料成功`,
        data: events
    })
}

module.exports = {
    getComingEvents,
    getTrendEvents 
}