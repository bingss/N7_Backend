const config = require('../config/index')
const logger = require('../utils/logger')('TicketsService')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const { generateTicketQRCode } = require('../utils/qrcodeUtils')
const { TICKET_STATUS  } = require('../enums/index')
const ERROR_STATUS_CODE = 400;


const verifyTicket = async (ticketInfo, orgEventId) => {
    return dataSource.transaction(async (manager) => {
        const eventRepository = manager.getRepository('Event')
        const ticketRepository = manager.getRepository('Ticket')

        const{ event_id: ticketEventId, user_id: ticketUserId, ticket_id: ticketId } = ticketInfo

        if(ticketEventId !== orgEventId){
            throw appError(ERROR_STATUS_CODE, `欲驗證之活動與票券活動不符`)
        }

        const ticketWithUserEvent = await eventRepository
            .createQueryBuilder("event")
            .leftJoin("event.User", "user")
            .leftJoin("event.Order", "order")
            .leftJoin("order.Ticket", "ticket")
            .where("user.id = :userId", { userId: ticketUserId })
            .andWhere("event.id = :eventId", { eventId: ticketEventId })
            .andWhere("ticket.id = :ticketId", { ticketId: ticketId })
            .select([
                "user.name AS user_name",
                "user.email AS user_email",

                "event.id AS event_id",
                "event.title AS event_title",
                "event.location AS event_location",
                "event.start_at AS event_start_at",
                "event.end_at AS event_end_at",

                "ticket.serialNo AS ticket_no",
                "ticket.status AS ticket_status"
            ])
            .getRawOne();

        if (!ticketWithUserEvent) {
            throw appError(ERROR_STATUS_CODE, `票券不存在`)
        }
        if(ticketWithUserEvent.ticket_status === TICKET_STATUS.USED){
            throw appError(ERROR_STATUS_CODE, `票券已使用`)
        }

        const now = new Date();
        const start = new Date( ticketWithUserEvent.event_start_at );
        const end = new Date( ticketWithUserEvent.event_end_at );
        const dayBeforeStart = new Date(start.getTime() - 24 * 60 * 60 * 1000); 
        if(now < dayBeforeStart){
            throw appError(ERROR_STATUS_CODE, `票券尚未開放驗證`)
        }
        if(end < now) {
            throw appError(ERROR_STATUS_CODE, `票券活動已結束`)
        }

        //更新票券狀態為used
        const updatedEventResult = await ticketRepository.update(
              { id: ticketId },
              { status: TICKET_STATUS.USED }
            );
        if (updatedEventResult.affected === 0) {
            throw appError(ERROR_STATUS_CODE, '驗證發生錯誤！請再次掃描')
        }

        const formatTicket = {
            ticket_no: ticketWithUserEvent.ticket_no,
            event: {
                title: ticketWithUserEvent.event_title,
                location: ticketWithUserEvent.event_location,
                start_at: ticketWithUserEvent.event_start_at,
                end_at: ticketWithUserEvent.event_end_at
            },
            user: {
                name: ticketWithUserEvent.user_name,
                email: ticketWithUserEvent.user_email
            }
        };
        return formatTicket;
    });
}
module.exports = {
    verifyTicket
}