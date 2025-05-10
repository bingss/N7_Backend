const config = require('../config/index')
const logger = require('../utils/logger')('Organizer')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const { moveFinalImage } = require('../utils/imageUtils')
const { formatDatabaseDate } = require('../utils/timeUtils')
const { compareChangedData,generateSectionAndSeat } = require('./utils/eventUtils')
const { EVENT_STAUSUS } = require('../enums/index')
const ERROR_STATUS_CODE = 400;


const createNewEvent = async (newEventData, userId) => {
    return dataSource.transaction(async (manager) => {
        const eventRepository = manager.getRepository('Event')
        const sectionRepository = manager.getRepository('Section')
        const seatRepository = manager.getRepository('Seat')

        //儲存活動資料
        const newEvent = eventRepository.create({
            user_id: userId,
            title:newEventData.title,
            location: newEventData.location,
            address: newEventData.address,
            start_at: newEventData.start_at,
            end_at: newEventData.end_at,
            sale_start_at: newEventData.sale_start_at,
            sale_end_at: newEventData.sale_end_at,
            performance_group: newEventData.performance_group,
            description: newEventData.description,
            type: newEventData.type
        })
        const savedEvent = await eventRepository.save(newEvent)
        if (!savedEvent) {
            throw appError(ERROR_STATUS_CODE, '新增活動失敗')
        }

        // 儲存分區資料
        const savedEventId = savedEvent.id
        
        const {savedSections,savedSeats} = await generateSectionAndSeat(manager, newEventData, savedEventId);
        
        //沒更新活動資料又沒更新分區資料成功
        if ( !savedSections || !savedSeats ) {
            throw appError(ERROR_STATUS_CODE, '新增活動失敗')
        }

        // 移動圖片位置並儲存圖片資料
        let newCoverImgUrl = null
        let newSectionImgUrl = null
        if(newEventData.cover_image_url) {
            try {
                newCoverImgUrl = await moveFinalImage(newEventData.cover_image_url, savedEventId)
            }catch (error) {
                newCoverImgUrl = null
            }
        }
        if(newEventData.section_image_url) {
            try {
                newSectionImgUrl = await moveFinalImage(newEventData.section_image_url, savedEventId)
            }catch (error) {
                newSectionImgUrl = null
            }
        }
        const updatedEvent = await eventRepository.update({
                id: savedEventId
            }, {
                cover_image_url: newCoverImgUrl,
                section_image_url: newSectionImgUrl
            })
    
        return {
            savedEvent: savedEvent,
            newCoverImgUrl: newCoverImgUrl,
            newSectionImgUrl: newSectionImgUrl
        }
    });
} 

const updateEvent = async (newEventData, eventId, userId) => {
    return dataSource.transaction(async (manager) => {
        const eventRepository = manager.getRepository('Event')
        const sectionRepository = manager.getRepository('Section')
        const seatRepository = manager.getRepository('Seat')
        //比對更新資料
        const originalEventData = await eventRepository.findOne({
            select: [
                'title',
                'location',
                'address',
                'start_at',
                'end_at',
                'sale_start_at',
                'sale_end_at',
                'cover_image_url',
                'section_image_url',
                'performance_group',
                'description',
                'type',
                'status'],
            where: {
                id : eventId,
                user_id : userId
            }
        })

        if (!originalEventData) {
            throw appError(ERROR_STATUS_CODE, '活動不存在')
        }
        
        if (originalEventData.status === EVENT_STAUSUS.APPROVED ) {
            throw appError(ERROR_STATUS_CODE, '活動已審核通過，不得編輯')
        }

        originalEventData.start_at = formatDatabaseDate(originalEventData.start_at)
        originalEventData.end_at = formatDatabaseDate(originalEventData.end_at)
        originalEventData.sale_start_at = formatDatabaseDate(originalEventData.sale_start_at)
        originalEventData.sale_end_at = formatDatabaseDate(originalEventData.sale_end_at)

        const changedData = await compareChangedData(originalEventData, newEventData, eventId)

        let updatedEventResult = 0
        if (Object.keys(changedData).length > 0) {
            updatedEventResult = await eventRepository.update(
              { id: eventId },
              changedData
            );
            if (updatedEventResult.affected === 0) {
                throw appError(ERROR_STATUS_CODE, '更新活動失敗')
            }
        }

        //刪除所有分區再擺上去，Seat連帶被刪除
        const delSectionResult = await sectionRepository.delete({ event_id : eventId })
        if (delSectionResult.affected === 0) {
            throw appError(ERROR_STATUS_CODE, '更新活動失敗')
        }
        // 儲存分區資料
        const {savedSections,savedSeats} = await generateSectionAndSeat(manager, newEventData, eventId);


        //沒更新活動資料又沒更新分區資料成功
        if ( !savedSections || !savedSeats ) {
            throw appError(ERROR_STATUS_CODE, '更新活動失敗')
        }

        const savedEvent = await eventRepository.findOne({
            select: [
                'id',
                'title',
                'location',
                'cover_image_url',
                'section_image_url',
                'created_at',
                'updated_at'
            ],
            where: {
                id : eventId
            }
        })
    
        return {
            savedEvent: savedEvent
        }
    });
} 

const getEditEventData = async ( orgUserId, eventId ) => {
    try {
        const eventRepository = dataSource.getRepository('Event')
        const eventWithSections = await eventRepository
            .createQueryBuilder('event')
            .leftJoin('event.Section', 'section')
            .leftJoin('section.Seat', 'seat')
            .where('event.id = :eventId', { eventId })
            .andWhere('event.user_id = :userId', { userId: orgUserId })
            .select([
                'event.id AS event_id',
                'event.title AS title',
                'event.location AS location',
                'event.address AS address',
                'event.start_at AS start_at',
                'event.end_at AS end_at',
                'event.sale_start_at AS sale_start_at',
                'event.sale_end_at AS sale_end_at',
                'event.performance_group AS performance_group',
                'event.description AS description',
                'event.type AS type',
                'event.cover_image_url AS cover_image_url',
                'event.section_image_url AS section_image_url',
                'event.status AS status',
            
                'section.id AS section_id',
                'section.section AS section_name',
                'section.price_default AS price',
                'COUNT(seat.id) AS ticket_total'
            ])
            .groupBy('event.id, section.id')
            .getRawMany();

        if (!eventWithSections || eventWithSections.length === 0) {
            throw appError(ERROR_STATUS_CODE, '活動不存在')
        }
        console.log(eventWithSections)
        if (eventWithSections[0].status === EVENT_STAUSUS.APPROVED ) {
            throw appError(ERROR_STATUS_CODE, '活動已審核通過，不得編輯')
        }

        const eventInfo = {
            id: eventWithSections[0].event_id,
            title: eventWithSections[0].title,
            location: eventWithSections[0].location,
            address: eventWithSections[0].address,
            start_at: eventWithSections[0].start_at,
            end_at: eventWithSections[0].end_at,
            sale_start_at: eventWithSections[0].sale_start_at,
            sale_end_at: eventWithSections[0].sale_end_at,
            performance_group: eventWithSections[0].performance_group,
            description: eventWithSections[0].description,
            type: eventWithSections[0].type,
            cover_image_url: eventWithSections[0].cover_image_url,
            section_image_url: eventWithSections[0].section_image_url,
            sections: eventWithSections.map(row => ({
              id: row.section_id,
              section_name: row.section_name,
              price: row.price,
              ticket_total: parseInt(row.ticket_total, 10)
            }))
          };

        return eventInfo
    }catch (error) {
        if (error.status) {
            throw error;
        }
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
} 

const getOrgEventsData = async ( orgUserId ) => {
    try {
        const eventRepository = dataSource.getRepository('Event')
        const orgEvents = await eventRepository
            .createQueryBuilder("event")
            .leftJoin("event.Section", "section")
            .leftJoin('section.Seat', 'seat')
            .where("event.user_id = :orgUserId", { orgUserId: orgUserId })
            .select([
                "event.id AS id",
                "event.title AS title",
                "event.start_at AS start_at",
                "event.end_at AS end_at",
                "event.status AS status",
                "COUNT(seat.id) AS ticket_total",
                "SUM(CASE WHEN seat.status = 'sold' THEN 1 ELSE 0 END) AS ticket_purchaced"
            ])
            .groupBy("event.id")
            .getRawMany();
    
        // 依照結束時間、status分類          
        const classifiedOrders = orgEvents.reduce((result, event) => {

            const { status, ...rest  } = event;
            const noStatusOrders = { 
                ...rest,
                ticket_total: parseInt(event.ticket_total, 10),
                ticket_purchaced: parseInt(event.ticket_purchaced, 10)
            }
            const now = new Date();
            const end = new Date( noStatusOrders.end_at );
    
            // 判斷狀態分類
            if (status === "checking") {
                result.checking.push(noStatusOrders);
            } else if (status === "rejected") {
                result.rejected.push(noStatusOrders);
            } else if (status === "approved") {
                if (end > now) {
                    result.holding.push(noStatusOrders);
                } else {
                    result.finished.push(noStatusOrders);
                }
            }
            return result;
            }, {
                holding: [],
                finished: [],
                checking: [],
                rejected: []
            });
        return classifiedOrders
    }catch (error) {
        if (error.status) {
            throw error;
        }
        logger.error(`[getOrganizerOrders] 取得訂單列表失敗: ${error}`)
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
} 

const getOneOrgEventData = async ( orgUserId, eventId ) => {
    try {
        const eventWithSections = await dataSource
        .getRepository('Section')
        .createQueryBuilder('section')
        .leftJoin('section.Event', 'event')
        .leftJoin('section.Seat', 'seat')
        .where('event.id = :eventId', { eventId })
        .andWhere('event.user_id = :orgUserId', { orgUserId })
        .select([
            'event.id AS event_id',
            'event.title AS title',
            'event.location AS location',
            'event.address AS address',
            'event.start_at AS start_at',
            'event.end_at AS end_at',
            'event.sale_start_at AS sale_start_at',
            'event.sale_end_at AS sale_end_at',
            'event.performance_group AS performance_group',
            'event.description AS description',
            'event.type AS type',
            'event.cover_image_url AS cover_image_url',
            'event.section_image_url AS section_image_url',
            'event.status AS status',

            'section.id AS section_id',
            'section.section AS section_name',
            'section.price_default AS price',
            "COUNT(seat.id) AS ticket_total",
            "SUM(CASE WHEN seat.status = 'sold' THEN 1 ELSE 0 END) AS ticket_purchaced"
        ])
        .groupBy('event.id, section.id')
        .getRawMany();

        const eventInfo = {
            id: eventWithSections[0].event_id,
            title: eventWithSections[0].title,
            location: eventWithSections[0].location,
            address: eventWithSections[0].address,
            start_at: eventWithSections[0].start_at,
            end_at: eventWithSections[0].end_at,
            sale_start_at: eventWithSections[0].sale_start_at,
            sale_end_at: eventWithSections[0].sale_end_at,
            performance_group: eventWithSections[0].performance_group,
            description: eventWithSections[0].description,
            type: eventWithSections[0].type,
            cover_image_url: eventWithSections[0].cover_image_url,
            section_image_url: eventWithSections[0].section_image_url,
            status:eventWithSections[0].status,
            sections: eventWithSections.map(row => ({
              id: row.section_id,
              section_name: row.section_name,
              price: row.price,
              ticket_total: parseInt(row.ticket_total),
              ticket_purchaced: parseInt(row.ticket_purchaced, 10)
            }))
        };

        return eventInfo
    }catch (error) {
        if (error.status) {
            throw error;
        }
        logger.error(`[getOrganizerOrders] 取得訂單列表失敗: ${error}`)
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
} 



module.exports = {
    createNewEvent,
    getEditEventData,
    updateEvent,
    getOrgEventsData,
    getOneOrgEventData
}