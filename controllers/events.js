
const config = require('../config/index')
const logger = require('../utils/logger')('Organizer')
const appError = require('../utils/appError')
const { getComingEventsData, getTrendEventsData, getAllEventsData } = require('../services/eventService')
const ERROR_STATUS_CODE = 400;


const getAllEvents = async (req, res) => {
    const { total, events } = await getAllEventsData();

    res.status(200).json({
        status: true,
        message: '取得所有活動(approved)',
        total,
        data: events
    })
}

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

const getEventID = async (req, res, next) => {
    //取得活動尚未結束且瀏覽數最高之16個活動
    const events = await getTrendEventsData()

    res.status(200).json({
        status: true,
        message: `取得資料成功`,
        data: events
    })
}

module.exports = {
    getAllEvents,
    getComingEvents,
    getTrendEvents,
    getEventID
}