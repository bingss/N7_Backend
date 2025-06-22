const config = require('../config/index')
const logger = require('../utils/logger')('Organizer')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const { moveFinalImage } = require('../utils/imageUtils')
const { formatDatabaseDate } = require('../utils/timeUtils')
const { compareChangedData, generateSectionAndSeat } = require('./utils/eventUtils')
const { EVENT_STATUS, PAYMENT_STATUS } = require('../enums/index')
const { getNowGMT8Time } = require('../utils/timeUtils')
const ERROR_STATUS_CODE = 400;


const createNewEvent = async (newEventData, userId) => {
    return dataSource.transaction(async (manager) => {
        const eventRepository = manager.getRepository('Event')
        const typeRepository = manager.getRepository('Type')

        const eventType = await typeRepository.findOne({
            select: ['name'],
            where: { id: newEventData.type_id }
        })
        if (!eventType) {
            throw appError(ERROR_STATUS_CODE, '活動類型未填寫正確')
        }


        //儲存活動資料
        const newEvent = eventRepository.create({
            user_id: userId,
            title: newEventData.title,
            location: newEventData.location,
            address: newEventData.address,
            city: newEventData.city,
            start_at: newEventData.start_at,
            end_at: newEventData.end_at,
            sale_start_at: newEventData.sale_start_at,
            sale_end_at: newEventData.sale_end_at,
            performance_group: newEventData.performance_group,
            description: newEventData.description,
            type_id: newEventData.type_id
        })
        const savedEvent = await eventRepository.save(newEvent)
        if (!savedEvent) {
            throw appError(ERROR_STATUS_CODE, '新增活動失敗')
        }

        // 儲存分區資料
        const savedEventId = savedEvent.id

        const { savedSections, savedSeats } = await generateSectionAndSeat(manager, newEventData, savedEventId);

        //沒更新活動資料又沒更新分區資料成功
        if (!savedSections || !savedSeats) {
            throw appError(ERROR_STATUS_CODE, '新增活動失敗')
        }

        // 移動圖片位置並儲存圖片資料
        let newCoverImgUrl = null
        let newSectionImgUrl = null
        if (newEventData.cover_image_url) {
            try {
                newCoverImgUrl = await moveFinalImage(newEventData.cover_image_url, savedEventId)
            } catch (error) {
                newCoverImgUrl = null
            }
        }
        if (newEventData.section_image_url) {
            try {
                newSectionImgUrl = await moveFinalImage(newEventData.section_image_url, savedEventId)
            } catch (error) {
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
        const typeRepository = manager.getRepository('Type')

        const eventType = await typeRepository.findOne({
            select: ['name'],
            where: { id: newEventData.type_id }
        })
        if (!eventType) {
            throw appError(ERROR_STATUS_CODE, '活動類型未填寫正確')
        }

        //比對更新資料
        const originalEventData = await eventRepository.findOne({
            select: [
                'title',
                'location',
                'address',
                'city',
                'start_at',
                'end_at',
                'sale_start_at',
                'sale_end_at',
                'cover_image_url',
                'section_image_url',
                'performance_group',
                'description',
                'type_id',
                'status'],
            where: {
                id: eventId,
                user_id: userId
            }
        })

        if (!originalEventData) {
            throw appError(ERROR_STATUS_CODE, '活動不存在')
        }

        if (originalEventData.status === EVENT_STATUS.APPROVED) {
            throw appError(ERROR_STATUS_CODE, '活動已審核通過，不得編輯')
        }

        if (originalEventData.status === EVENT_STATUS.REJECTED) {
            newEventData.status = EVENT_STATUS.CHECKING
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
        const delSectionResult = await sectionRepository.delete({ event_id: eventId })
        if (delSectionResult.affected === 0) {
            throw appError(ERROR_STATUS_CODE, '更新活動失敗')
        }
        // 儲存分區資料
        const { savedSections, savedSeats } = await generateSectionAndSeat(manager, newEventData, eventId);


        //沒更新活動資料又沒更新分區資料成功
        if (!savedSections || !savedSeats) {
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
                id: eventId
            }
        })

        return {
            savedEvent: savedEvent
        }
    });
}

const getEditEventData = async (orgUserId, eventId) => {
    try {
        const eventRepository = dataSource.getRepository('Event')
        const eventWithSections = await eventRepository
            .createQueryBuilder('event')
            .innerJoin('event.Type', 'type')
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
                'type.name AS type',
                'event.cover_image_url AS cover_image_url',
                'event.section_image_url AS section_image_url',
                'event.status AS status',

                'section.id AS section_id',
                'section.section AS section_name',
                'section.price_default AS price',
                'COUNT(seat.id) AS ticket_total'
            ])
            .orderBy('section.display_order', 'ASC')
            .groupBy('event.id, section.id, type.id')
            .getRawMany();

        if (!eventWithSections || eventWithSections.length === 0) {
            throw appError(ERROR_STATUS_CODE, '活動不存在')
        }
        // console.log(eventWithSections)
        if (eventWithSections[0].status === EVENT_STATUS.APPROVED) {
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
    } catch (error) {
        if (error.status) {
            throw error;
        }
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
}

const getOrgEventsData = async (orgUserId) => {
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
                "SUM(CASE WHEN seat.status != 'available' THEN 1 ELSE 0 END) AS ticket_purchaced"
            ])
            .groupBy("event.id")
            .getRawMany();

        // 依照結束時間、status分類          
        const classifiedOrders = orgEvents.reduce((result, event) => {

            const { status, ...rest } = event;
            const noStatusOrders = {
                ...rest,
                ticket_total: parseInt(event.ticket_total, 10),
                ticket_purchaced: parseInt(event.ticket_purchaced, 10)
            }
            const nowGMT8 = getNowGMT8Time()
            const end = new Date(noStatusOrders.end_at);

            // 判斷狀態分類
            if (status === EVENT_STATUS.CHECKING) {
                result.checking.push(noStatusOrders);
            } else if (status === EVENT_STATUS.REJECTED) {
                result.rejected.push(noStatusOrders);
            } else if (status === EVENT_STATUS.APPROVED) {
                if (end > nowGMT8) {
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
    } catch (error) {
        if (error.status) {
            throw error;
        }
        logger.error(`[getOrganizerOrders] 取得活動列表失敗: ${error}`)
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
}

const getOneOrgEventData = async (orgUserId, eventId) => {
    try {
        const eventWithSections = await dataSource
            .getRepository('Event')
            .createQueryBuilder('event')
            .innerJoin('event.Type', 'type')
            .leftJoin('event.Section', 'section')
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
                'type.name AS type',
                'event.cover_image_url AS cover_image_url',
                'event.section_image_url AS section_image_url',
                'event.status AS status',

                'section.id AS section_id',
                'section.section AS section_name',
                'section.price_default AS price',
                "COUNT(seat.id) AS ticket_total",
                "SUM(CASE WHEN seat.status != 'available' THEN 1 ELSE 0 END) AS ticket_purchaced"
            ])
            .orderBy('section.display_order', 'ASC')
            .groupBy('event.id, section.id, type.id')
            .getRawMany();

        if (eventWithSections.length === 0) {
            throw appError(ERROR_STATUS_CODE, '活動不存在')
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
            status: eventWithSections[0].status,
            sections: eventWithSections.map(row => ({
                id: row.section_id,
                section_name: row.section_name,
                price: row.price,
                ticket_total: parseInt(row.ticket_total),
                ticket_purchaced: parseInt(row.ticket_purchaced, 10)
            }))
        };

        return eventInfo
    } catch (error) {
        if (error.status) {
            throw error;
        }
        logger.error(`[getOneOrgEventData] 取得單一活動列表失敗: ${error}`)
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
}

const getStausOrgEventsData = async (orgUserId, queryStatus) => {
    try {
        const eventRepository = dataSource.getRepository('Event')
        const queryBuilder = eventRepository.createQueryBuilder("event").where("event.user_id = :orgUserId", { orgUserId: orgUserId })

        const nowGMT8 = getNowGMT8Time()
        if (queryStatus === EVENT_STATUS.FINISHED) {
            queryBuilder.andWhere("event.status = :status AND event.end_at < :now", { status: EVENT_STATUS.APPROVED, now: nowGMT8 })
        } else if (queryStatus === EVENT_STATUS.HOLDING) {
            queryBuilder.andWhere("event.status = :status AND event.end_at > :now", { status: EVENT_STATUS.APPROVED, now: nowGMT8 })
        } else if (queryStatus === undefined) {
            //do nothing
        }
        else {
            queryBuilder.andWhere("event.status = :status", { status: queryStatus })
        }

        const orgEvents = await queryBuilder
            .select([
                "event.id AS id",
                "event.title AS title"
            ])
            .orderBy("event.start_at", "ASC")
            .getRawMany()

        return orgEvents
    } catch (error) {
        if (error.status) {
            throw error;
        }
        logger.error(`[getStausOrgEventsData] 取得${queryStatus}狀態活動失敗: ${error}`)
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
}

const getComingEventsData = async () => {
    try {
        const nowGMT8 = getNowGMT8Time()
        const comingEvents = await dataSource.getRepository('Event')
            .createQueryBuilder("event")
            .innerJoin('event.Type', 'type')
            .select([
                "event.id AS id",
                "event.title AS title",
                "event.cover_image_url AS cover_image_url",
                "event.start_at AS start_at",
                "type.name AS type",
                "event.city AS city"
            ])
            .where("event.start_at > :now", {now : nowGMT8}) // 活動尚未開始
            .andWhere("event.status=:status", { status: EVENT_STATUS.APPROVED })
            // .andWhere("event.ticket_sale_start_at > NOW()")
            .orderBy("event.start_at", "ASC") // 最接近活動時間排前面
            .addOrderBy("event.sale_start_at", "ASC") // 再依售票開始時間排序
            .limit(8) // 只取 8 筆
            .getRawMany();

        return comingEvents

    } catch (error) {
        logger.error(`[getComingEventsData] 取得即將到來活動失敗: ${error}`)
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
}

const getTrendEventsData = async () => {
    try {
        const nowGMT8 = getNowGMT8Time()
        const trendEvents = await dataSource.getRepository('Event')
            .createQueryBuilder("event")
            .innerJoin('event.Type', 'type')
            .select([
                "event.id AS id",
                "event.title AS title",
                "event.cover_image_url AS cover_image_url",
                "event.start_at AS start_at",
                "event.city AS city",
                "event.view_count AS view_count",
                "type.name AS type"
            ])
            .where("event.end_at >:now", {now : nowGMT8}) // 活動尚未結束
            .andWhere("event.status=:status", { status: EVENT_STATUS.APPROVED })
            .orderBy("event.view_count", "DESC") // 瀏覽數高到低
            .addOrderBy("event.start_at", "ASC") // 瀏覽數相同則再依開始時間排序
            .limit(15) // 只取 15 筆
            .getRawMany();


        return trendEvents
    } catch (error) {
        logger.error(`[getTrendEventsData] 取得熱門推薦活動失敗: ${error}`)
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
}

const getAllEventsData = async () => {
    try {
        const nowGMT8 = getNowGMT8Time()
        const eventsData = dataSource.getRepository('Event')
            .createQueryBuilder('event')
            .innerJoin('event.Type', 'type')
            .select([
                "event.id AS id",
                "event.title AS title",
                "event.cover_image_url AS cover_image_url",
                "DATE(event.start_at) AS start_at",
                "type.name AS type",
                "event.city AS city"
            ])
            .where("event.status = :status", { status: 'approved' })
            .andWhere("event.end_at >:now", {now : nowGMT8}) // 活動尚未結束
            .orderBy("event.start_at", "ASC")
        const events = await eventsData.getRawMany();
        const total = await eventsData.getCount();

        return {
            total,
            events
        };
    } catch (error) {
        if (error.status) {
            throw error
        }
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
}

// 含座位
const getEventById = async (eventId) => {
    try {

        const event = await dataSource.getRepository('Event')
            .createQueryBuilder('event')
            .leftJoinAndSelect('event.Type', 'type')
            .leftJoinAndSelect('event.Section', 'section')
            .leftJoinAndSelect('section.Seat', 'seat')
            // .leftJoinAndSelect('seat.Ticket', 'ticket')
            .where('event.id = :id', { id: eventId })
            .andWhere('event.status = :status', { status: 'approved' })
            .orderBy('section.display_order', 'ASC')
            .getOne(); // ⚠️ 回傳巢狀物件而非 raw flat 結果

        // console.log('🧪 SQL:', queryBuilder.getSql());
        // console.log('🧪 Params:', queryBuilder.getParameters());

        if (!event) {
            throw appError(404, '找不到該活動');
        }

        // // 計算每個區域的剩餘座位 (status 為 'available')
        // event.Section.forEach(section => {
        //     section.remainingSeats = section.Seat.filter(seat => seat.status === 'available').length;
        // });

        event.Section.forEach(section => {
            // 只保留剩餘座位數，不返回 seat 的資料

            section.remainingSeats = section.Seat ? section.Seat.filter(seat => seat.status === 'available').length : 0;
            delete section.Seat;
        });

        // console.log(event.Section)

        // 增加瀏覽次數
        await dataSource.getRepository('Event')
            .increment({ id: eventId }, 'view_count', 1);

        return event;
    } catch (error) {
        if (error.status) {
            throw error;
        }
        console.error('getEventById error:', error);
        throw appError(400, '發生錯誤');
    }
};

const getAdminEvents = async () => {
    try {
        const eventRepository = dataSource.getRepository('Event')
        const adminEvents = await eventRepository
            .createQueryBuilder("event")
            .leftJoin("event.Section", "section")
            .leftJoin('section.Seat', 'seat')
            .where("event.status != :status", { status: EVENT_STATUS.REJECTED })
            .select([
                "event.id AS id",
                "event.title AS title",
                "event.cover_image_url AS cover_image_url",
                "event.location AS location",
                "event.start_at AS start_at",
                "event.end_at AS end_at",
                "event.status AS status",
                "event.sale_start_at AS sale_start_at",
                "event.sale_end_at AS sale_end_at",
                "COUNT(seat.id) AS ticket_total",
                "SUM(CASE WHEN seat.status != 'available' THEN 1 ELSE 0 END) AS ticket_purchaced"
            ])
            .groupBy("event.id")
            .orderBy("event.start_at", "ASC")
            .getRawMany();

        const formatEvents = {
            events: adminEvents.length === 0 ? [] : adminEvents.map(event => (
                {
                    id: event.id,
                    title: event.title,
                    cover_image_url: event.cover_image_url,
                    location: event.location,
                    start_at: formatDatabaseDate(event.start_at),
                    end_at: formatDatabaseDate(event.end_at),
                    sale_status: getSaleStatus(event),
                    sale_rate: parseInt(event.ticket_purchaced, 10) / parseInt(event.ticket_total, 10)
                }))
        };

        return formatEvents
    } catch (error) {
        logger.error(`[getAdminEvents] 取得活動列表失敗: ${error}`)
        if (error.status) {
            throw error
        }
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
}

const getCheckingEvent = async (eventId) => {
    try {
        const eventWithSections = await dataSource.getRepository('Event')
            .createQueryBuilder("event")
            .leftJoin("event.Type", "type")
            .leftJoin("event.User", "user")
            .leftJoin("event.Section", "section")
            .leftJoin("section.Seat", "seat")
            .where("event.id = :eventId", { eventId })
            .select([
                "user.id AS organizer_id",
                "user.name AS organizer",

                "event.id AS event_id",
                "event.title AS title",
                "event.cover_image_url AS cover_image_url",
                "event.section_image_url AS section_image_url",
                "event.address AS address",
                "event.location AS location",
                "event.start_at AS start_at",
                "event.end_at AS end_at",
                "event.performance_group AS performance_group",
                "event.description AS description",
                "type.name AS type",
                "event.status AS status",
                "event.sale_start_at AS sale_start_at",
                "event.sale_end_at AS sale_end_at",
                "event.status AS status",

                'section.section AS section_name',
                'section.price_default AS price',
                'COUNT(seat.id) AS quantity',
                'SUM(CASE WHEN seat.status != \'available\' THEN 1 ELSE 0 END) AS sold_seats',
                // 'SUM(CASE WHEN seat.status = \'reserved\' THEN 1 ELSE 0 END) AS reserved_seats',
                'SUM(CASE WHEN seat.status = \'available\' THEN 1 ELSE 0 END) AS available_seats'
            ])
            .orderBy('section.display_order', 'ASC')
            .groupBy('event.id, user.id, section.id, type.id')
            .getRawMany();

        if (!eventWithSections || eventWithSections.length === 0) {
            throw appError(ERROR_STATUS_CODE, '活動不存在')
        }

        // if (eventWithSections[0].status !== EVENT_STATUS.CHECKING) {
        //     throw appError(ERROR_STATUS_CODE, '非屬審核中活動狀態')
        // }

        let totalSeats = 0;
        let totalSold = 0;
        eventWithSections.forEach(row => {
            totalSeats += parseInt(row.quantity);
            totalSold += parseInt(row.sold_seats);
        })

        const eventInfo = {
            organizer_id: eventWithSections[0].organizer_id,
            organizer: eventWithSections[0].organizer,
            event_id: eventWithSections[0].event_id,
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
            status: eventWithSections[0].status,
            sale_rate: totalSold / totalSeats,
            sections: eventWithSections.map(row => ({
                section_name: row.section_name,
                price: row.price,
                quantity: parseInt(row.quantity, 10),
                sold_seats: parseInt(row.sold_seats, 10),
                // reserved_seats: parseInt(row.reserved_seats, 10),
                available_seats: parseInt(row.available_seats, 10)
            }))
        };

        return eventInfo

    } catch (error) {
        logger.error(`[getAdminEvent] 取得單一活動失敗: ${error}`)
        if (error.status) {
            throw error
        }
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
}

const updateEventStatus = async (eventId, isApproved) => {
    try {
        const eventRepository = dataSource.getRepository('Event')
        const nowEvent = await eventRepository.findOne({
            select: ['status'],
            where: { id: eventId }
        })
        if (!nowEvent) {
            throw appError(ERROR_STATUS_CODE, '活動不存在')
        }

        let newStatus;
        let check_at = null;

        if (isApproved) {
            if (nowEvent.status === EVENT_STATUS.APPROVED) {
                throw appError(ERROR_STATUS_CODE, '活動已審核通過')
            }
            newStatus = EVENT_STATUS.APPROVED
            check_at = new Date();
        } else {
            newStatus = EVENT_STATUS.REJECTED
        }

        const updatedEvent = await eventRepository.update(
            { id: eventId },
            { status: newStatus, check_at: check_at }
        );

        if (updatedEvent.affected === 0) {
            throw appError(ERROR_STATUS_CODE, '更新活動狀態失敗')
        }

        const event = await eventRepository.findOne({
            select: ['id', 'status', 'check_at'],
            where: { id: eventId }
        })

        return event
    } catch (error) {
        logger.error(`[updateEventStatus] 更新活動狀態失敗: ${error}`)
        if (error.status) {
            throw error
        }
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
}

const deleteEventData = async (orgUserId, eventId) => {
    const eventRepository = dataSource.getRepository('Event')
    const deleteEvent = await eventRepository
        .createQueryBuilder("event")
        .leftJoinAndSelect("event.Order", "order")
        .where("event.id = :eventId", { eventId })
        .andWhere("event.user_id = :orgUserId", { orgUserId: orgUserId })
        .getOne();

    if (!deleteEvent) {
        throw appError(ERROR_STATUS_CODE, '活動不存在或無權限刪除')
    }
    if (deleteEvent.status === EVENT_STATUS.APPROVED) {
        throw appError(ERROR_STATUS_CODE, '活動已審核通過，不得刪除')
    }
    if (deleteEvent.Order) {
        console.log(deleteEvent.Order)
        if (deleteEvent.Order.some(order => order.payment_status !== PAYMENT_STATUS.EXPIRED)) {
            throw appError(ERROR_STATUS_CODE, '活動有未過期訂單存在，無法刪除')
        }
    }
    const deleteResult = await eventRepository.remove(deleteEvent);
    if (deleteResult === 0) {
        throw appError(ERROR_STATUS_CODE, '刪除活動失敗')
    }
    return
}

const formatDateTime = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
};


const getAdminEventsRevenue = async (eventId) => {
    try {
        // 查出 event + Section + Seat
        const event = await dataSource.getRepository('Event')
            .createQueryBuilder('event')
            .leftJoinAndSelect('event.Type', 'type')
            .leftJoinAndSelect('event.Section', 'section')
            .leftJoinAndSelect('section.Seat', 'seat')
            .where('event.id = :id', { id: eventId })
            .andWhere('event.status = :status', { status: 'approved' })
            .orderBy('section.display_order', 'ASC')
            .getOne();

        if (!event) {
            throw appError(404, '找不到該活動');
        }

        // 計算 event_status
        const now = getNowGMT8Time();
        const saleStart = new Date(event.sale_start_at);
        const saleEnd = new Date(event.sale_end_at);

        let event_status = '';
        if (now < saleStart) {
            event_status = '尚未開賣';
        } else if (now >= saleStart && now <= saleEnd) {
            event_status = '銷售中';
        } else {
            event_status = '已結束';
        }

        // 處理 section 資料 + 每個 section 查出 orders
        const sections = [];

        for (const section of event.Section) {
            const quantity = section.Seat ? section.Seat.length : 0;
            const sold = section.Seat ? section.Seat.filter(seat => seat.status === 'sold').length : 0;
            const sale_rate = quantity > 0 ? ((sold / quantity) * 100).toFixed(1) + '%' : '0%';
            const revenue = sold * section.price_default;

            // 查詢該 section 的 orders
            const sectionOrdersRaw = await dataSource.getRepository('Order')
                .createQueryBuilder('order')
                .leftJoin('order.Ticket', 'ticket')
                .leftJoin('ticket.Seat', 'seat')
                .where('order.event_id = :eventId', { eventId })
                .andWhere('seat.section_id = :sectionId', { sectionId: section.id })
                .andWhere('order.payment_status = :paymentStatus', { paymentStatus: 'paid' })
                .select([
                    'order.id AS order_id',
                    'order.created_at AS created_at',
                    'COUNT(ticket.id) AS quantity'
                ])
                .groupBy('order.id, order.created_at')
                .orderBy('order.created_at', 'ASC')
                .getRawMany();

            const sectionOrders = sectionOrdersRaw.map(order => ({
                order_id: order.order_id,
                created_at: formatDateTime(new Date(order.created_at.getTime() + 8 * 60 * 60 * 1000)),
                quantity: parseInt(order.quantity, 10)
            }));

            // 塞入 sections
            sections.push({
                section_name: section.section,
                price: section.price_default,
                quantity: quantity,
                sold: sold,
                sale_rate: sale_rate,
                revenue: revenue,
                orders: sectionOrders // <== 每個 section 自己的 orders
            });
        }

        // 回傳
        return {
            event_id: event.id,
            event_status: event_status,
            cover_image_url: event.cover_image_url,
            title: event.title,
            location: event.location,
            start_at: formatDateTime(event.start_at),
            end_at: formatDateTime(event.end_at),
            sale_start_at: formatDateTime(event.sale_start_at),
            sale_end_at: formatDateTime(event.sale_end_at),
            sections: sections
        };

    } catch (error) {
        if (error.status) {
            throw error;
        }
        console.error('getAdminEventsRevenue error:', error);
        throw appError(400, '發生錯誤');
    }
};


module.exports = {
    createNewEvent,
    getEditEventData,
    updateEvent,
    getOrgEventsData,
    getOneOrgEventData,
    getStausOrgEventsData,
    getComingEventsData,
    getTrendEventsData,
    getAllEventsData,
    getEventById,
    getAdminEvents,
    getCheckingEvent,
    updateEventStatus,
    deleteEventData,
    getAdminEventsRevenue
}


function getSaleStatus(event) {
    const nowGMT8 = getNowGMT8Time();
    const saleStartAt = new Date(event.sale_start_at);
    const saleEndAt = new Date(event.sale_end_at);
    if (event.status === EVENT_STATUS.CHECKING) {
        return '待審核';
    }else if (saleStartAt <= nowGMT8 && nowGMT8 <= saleEndAt) {
        return '銷售中';
    } else if (nowGMT8 > saleEndAt) {
        return '銷售結束';
    } else {
        return '尚未銷售';
    }
}
