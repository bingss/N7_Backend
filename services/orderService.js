const config = require('../config/index')
const logger = require('../utils/logger')('TicketsService')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const { generateTicketQRCode } = require('../utils/qrcodeUtils')
const { PAYMENT_METHOD,EVENT_STAUSUS  } = require('../enums/index')
const ERROR_STATUS_CODE = 400;

const createTestOrder = async (orderData, userId) => {
    return dataSource.transaction(async (manager) => {
        const eventRepository = manager.getRepository('Event')
        const orderRepository = manager.getRepository('Order')
        const seatRepository = manager.getRepository('Seat')
        const ticketRepository = manager.getRepository('Ticket')
        const sectionRepository = manager.getRepository('Section')
        
        //欄位檢查，正式版需再增加
        if(orderData.tickets.length === 0){
            throw appError(ERROR_STATUS_CODE, '訂單欄位錯誤')
        }

        const eventStatus = await eventRepository.findOne({
                    where: {  id: orderData.event_id },
                    select: [ 'status' ],
                });

        if (!eventStatus) {
            throw appError(ERROR_STATUS_CODE, `訂單資訊輸入錯誤`)
        }

        if(eventStatus.status != EVENT_STAUSUS.APPROVED){
            throw appError(ERROR_STATUS_CODE, `活動尚未審核通過`)
        }

        //1. 新增訂單資料
        const newOrder = orderRepository.create({
            user_id: userId,
            event_id: orderData.event_id,
            payment_method: orderData.payment_method,
        })

        const savedOrder = await orderRepository.save(newOrder)
        if (!savedOrder) {
            throw appError(ERROR_STATUS_CODE, '新增訂單失敗')
        }


        // 2. 統計每個 section 所需票券數量
        const orderTickets = orderData.tickets
        const sectionDemandMap = new Map(); // Map<sectionId, count>

        for (const ticket of orderTickets) {
            sectionDemandMap.set(
                ticket.section_id,
                (sectionDemandMap.get(ticket.section_id) || 0) + 1
            );
        }


        // 3. 一次查出每個 section 的 available seats
        const seatAssignments = new Map(); // Map<sectionId, Seat[]>
        for (const [sectionId, count] of sectionDemandMap.entries()) {

            const sectionData = await sectionRepository.findOne({
                        where: {  id: sectionId },
                        select: [ 'section' ],
                    });
            if (!sectionData) {
                throw appError(ERROR_STATUS_CODE, `區域資訊輸入錯誤`)
            }

            const availableSeats = await seatRepository
                .createQueryBuilder('seat')
                .setLock('pessimistic_write')  // 加入悲觀鎖
                .where('seat.status = :status', { status: 'available' })
                .andWhere('seat.section_id = :sectionId', { sectionId: sectionId })
                .orderBy('seat.seat_number', 'ASC')
                .take(count)
                .getMany();

            if (availableSeats.length < count) {
                throw appError(ERROR_STATUS_CODE, `${sectionData.section}區，不足${count}個座位`)
            }
            seatAssignments.set(sectionId, availableSeats);
        }
        // 4. 配對 ticket 對應的 seat
        const updatedSeats = [];
        const newTickets = [];

        for (const ticket of orderTickets) {
            const availableSeats = seatAssignments.get(ticket.section_id);
            const seat = availableSeats.shift(); // 拿第一張 seat

            seat.status = 'sold';
            updatedSeats.push(seat);

            const newTicket = ticketRepository.create({
                price_paid: ticket.price_paid,
                type: ticket.type,
                qrcode_img: '',
                seat_id: seat.id,
                order_id: savedOrder.id,
            });
            newTickets.push(newTicket);
        }
        await seatRepository.save(updatedSeats);
        await ticketRepository.save(newTickets);

        return { order: savedOrder, tickets: newTickets };
    });
}

const getOrdersData = async ( userId ) => {
    try {
        const orderRepository = dataSource.getRepository('Order')
        const orders = await orderRepository
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
                //若有任一張票為'unused'，顯示為'unused'，全為'used'才設為'used'
                "CASE WHEN MIN(CASE WHEN ticket.status = 'unused' THEN 0 ELSE 1 END) = 0 THEN 'unused' ELSE 'used' END AS ticket_status", 
            ])
            .groupBy("event.id")
            .addGroupBy("order.id")
            .getRawMany();
    
        return orders
    }catch (error) {
        if (error.status) {
            throw error;
        }
        logger.error(`[getTicketsData] 取得票券列表失敗: ${error}`)
        throw appError(ERROR_STATUS_CODE, '發生錯誤')
    }
} 

const getOneOrderData = async ( userId, orderId ) => {
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

                "event.id AS event_id",
                "event.title AS event_title",
                "event.location AS event_location",
                "event.address AS event_address",
                "event.start_at AS event_start_at",
                "event.end_at AS event_end_at",
                "event.cover_image_url AS event_cover_image_url",

                "ticket.id AS ticket_id",
                "ticket.serialNo AS ticket_no",
                "section.section AS section_name",
                "seat.seat_number AS seat_no",
                "ticket.price_paid AS ticket_price",
                "ticket.type AS ticket_type",
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
            tickets: await Promise.all(rawTicket
                // .filter(row => row.status === 'unused')
                .map(async (ticket) => ({
                        ticket_no: ticket.ticket_no,
                        seat_no: `${ticket.section_name}區${ticket.seat_no}號`,
                        price: ticket.ticket_price,
                        type: ticket.ticket_type,
                        status:ticket.status,
                        qrcode_image: await generateTicketQRCode({
                            ticket_id: ticket.ticket_id,
                            user_id: userId,
                            event_id: base.event_id,}),
                }))),
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
    getOrdersData,
    getOneOrderData,
    createTestOrder
}