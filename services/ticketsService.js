const config = require('../config/index')
const logger = require('../utils/logger')('TicketsService')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const ERROR_STATUS_CODE = 400;





const getTicketsData = async ( userId ) => {
    try {
        const orderRepository = dataSource.getRepository('Order')
        const tickets = await orderRepository
            .createQueryBuilder("order")
            .leftJoin("order.Event", "event")
            .leftJoin("order.Ticket", "ticket")
            .where("order.user_id = :userId", { userId: userId })
            .select([
                "order.id AS order_id",
                "event.title AS title",
                "event.location AS location",
                "event.start_at AS start_at",
                "event.end_at AS end_at",
                "event.cover_image_url AS cover_image_url",
                "ticket.status AS ticket_status",
            ])
            .getRawMany();
        
    
        return tickets
    }catch (error) {
        if (error.status) {
            throw error;
        }
        logger.error(`[getTicketsData] 取得票券列表失敗: ${error}`)
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
} 

const getSingleTicketData = async ( userId, orderId ) => {
    try {
        const orderRepository = dataSource.getRepository('Order')
        const rawTicket = await orderRepository
            .createQueryBuilder("order")
            .leftJoin("order.Event", "event")
            .leftJoin("order.User", "user")
            .leftJoin("order.Ticket", "ticket")
            .leftJoin("ticket.Seat", "seat")
            .leftJoin("seat.Section", "section")
            .where("order.id = :orderId", { orderId: orderId })
            .andWhere("order.user_id = :userId", { userId: userId })
            .select([
                "order.serialNo AS order_no",

                "user.name AS user_name",
                "user.email AS user_email",

                "event.title AS title",
                "event.location AS location",
                "event.address AS address",
                "event.start_at AS start_at",
                "event.end_at AS end_at",
                "event.cover_image_url AS cover_image_url",

                "ticket.serialNo AS ticket_no",
                "section.section AS section_name",
                "seat.seat_number AS seat_no",
                "ticket.price_paid AS ticket_price",
                "ticket.type AS type",
                "ticket.qrcode_img AS qrcode_img",

                "ticket.status AS status"
            ])
            .getRawMany();
            
        if (rawTicket.length === 0) throw appError(ERROR_STATUS_CODE, '訂單不存在');

        const base = rawTicket[0];
        const formatTicket = {
            order_no: base.order_no,
            user: {
                name: base.user_name,
                email: base.user_email
            },
            event: {
                title: base.event_title,
                location: base.event_location,
                address: base.event_address,
                start_at: base.event_start_at,
                end_at: base.event_end_at,
                cover_image_url: base.event_cover_image_url
            },
            tickets: rawTicket
                .filter(row => row.status === 'unused')
                .map((ticket) => ({
                        ticket_no: ticket.ticket_no,
                        seat_no: `${ticket.section_name}區${ticket.seat_no}號`,
                        price: ticket.ticket_price,
                        type: ticket.ticket_type,
                        qrcode_image_url: ticket.qrcode_image_url
                })),
        };

        return formatTicket
    }catch (error) {
        if (error.status) {
            throw error;
        }
        logger.error(`[getSingleTicketData] 取得票券失敗: ${error}`)
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
} 

module.exports = {
    getTicketsData,
    getSingleTicketData
}