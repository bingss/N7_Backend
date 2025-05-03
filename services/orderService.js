const config = require('../config/index')
const logger = require('../utils/logger')('Organizer')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const ERROR_STATUS_CODE = 400;

const getOrdersData = async ( orgUserId ) => {
    try {
        const eventRepository = dataSource.getRepository('Event')
        const eventWithOrders = await eventRepository
            .createQueryBuilder("event")
            .leftJoin("event.Order", "order")
            .leftJoin("order.Ticket", "ticket")
            .leftJoin("event.Section", "section")
            .where("event.user_id = :orgUserId", { orgUserId: orgUserId })
            .select([
                "event.id AS id",
                "event.title AS title",
                "event.start_at AS start_at",
                "event.end_at AS end_at",
                "event.status AS status",
                "SUM(section.total_seats) AS ticket_total",
                "COUNT(ticket.id) AS ticket_purchaced"
            ])
            .groupBy("event.id")
            .getRawMany();
    
        // 依照結束時間、status分類          
        const classifiedOrders = eventWithOrders.reduce((result, event) => {

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

const getSingleOrderData = async ( orgUserId, eventId ) => {
    try {
        const eventWithSections = await dataSource
        .getRepository('Section')
        .createQueryBuilder('section')
        .leftJoin('section.Event', 'event')
        .leftJoin('section.Seat', 'seat')
        .leftJoin('seat.Ticket', 'ticket')
        .where('event.id = :eventId', { eventId })
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

            'section.id AS section_id',
            'section.section AS section_name',
            'section.price_default AS price',
            'section.total_seats AS ticket_total',
            'COUNT(ticket.id) AS ticket_purchaced'
        ])
        .groupBy('event.id')
        .addGroupBy('section.id')
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
            sections: eventWithSections.map(row => ({
              id: row.section_id,
              section_name: row.section_name,
              price: row.price,
              ticket_total: row.ticket_total,
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
    getOrdersData,
    getSingleOrderData
}