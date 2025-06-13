const config = require('../config/index')
const logger = require('../utils/logger')('OrdersService')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const { generateTicketQrcode } = require('../utils/qrcodeUtils')
const { PAYMENT_METHOD,EVENT_STATUS,SEAT_STATUS,PAYMENT_STATUS  } = require('../enums/index')
const cron = require('node-cron');
const { getNowGMT8Time } = require('../utils/timeUtils')
const ERROR_STATUS_CODE = 400;

const createOrder = async (orderData, userId) => {
    return dataSource.transaction(async (manager) => {
        const eventRepository = manager.getRepository('Event')
        const orderRepository = manager.getRepository('Order')
        const seatRepository = manager.getRepository('Seat')
        const ticketRepository = manager.getRepository('Ticket')
        const sectionRepository = manager.getRepository('Section')
        
        
        //欄位檢查，正式版需再增加，檢查活動起訖時間、價錢檢查等
        const orderEvent = await eventRepository.findOne({
                    where: {  id: orderData.event_id },
                    select: [ 'title', 'status','sale_start_at','sale_end_at' ],
                });

        if (!orderEvent) {
            throw appError(ERROR_STATUS_CODE, `找無訂單輸入之活動`)
        }
        if(orderEvent.status != EVENT_STATUS.APPROVED){
            throw appError(ERROR_STATUS_CODE, `活動尚未審核通過`)
        }
        if(isNotSaling(orderEvent)){
            throw appError(ERROR_STATUS_CODE, `非屬販售時間`)
        }

        const eventTitle = orderEvent.title
        //1. 新增訂單資料
        const newOrder = orderRepository.create({
            user_id: userId,
            event_id: orderData.event_id
        })

        const savedOrder = await orderRepository.save(newOrder)
        if (!savedOrder) {
            throw appError(ERROR_STATUS_CODE, '新增訂單失敗')
        }
        const orderNo = savedOrder.serialNo

        // 2. 彙整 section 所需票券數量，避免前端重複傳相同sectionId
        const orderTickets = orderData.tickets
        const sectionDemandMap = new Map(); // Map<sectionId, count>
        for (const ticket of orderTickets) {
            sectionDemandMap.set(
                ticket.section_id,
                (sectionDemandMap.get(ticket.section_id) || 0) + ticket.quantity
            );
        }


        // 3. 一次查出每個 section 的 available seats
        const seatAssignments = new Map(); // Map<sectionId, { seats: Seat[], price: number }>
        for (const [sectionId, count] of sectionDemandMap.entries()) {

            const sectionData = await sectionRepository.findOne({
                        where: {  id: sectionId, event_id : orderData.event_id },
                        select: [ 'section', 'price_default' ],
                    });
            if (!sectionData) {
                throw appError(ERROR_STATUS_CODE, `活動或資訊輸入錯誤`)
            }

            const availableSeats = await seatRepository
                .createQueryBuilder('seat')
                .where('seat.status = :status', { status: 'available' })
                .andWhere('seat.section_id = :sectionId', { sectionId: sectionId })
                .orderBy('seat.seat_number', 'ASC')
                .take(count)
                .setLock('pessimistic_write')  // 加入悲觀鎖
                .getMany();

            if (availableSeats.length < count) {
                throw appError(ERROR_STATUS_CODE, `${sectionData.section}區，不足${count}個座位`)
            }
            seatAssignments.set(sectionId, { seats: availableSeats, price: sectionData.price_default});
            console.log(`Section ${sectionData.section} 區，已取得 ${availableSeats.length} 個可用座位，每張票價為 ${sectionData.price_default} 元`);
        }
        // 4. 配對 ticket 對應的 seat
        const updatedSeats = [];
        const newTickets = [];
        let orderPrice = 0;
        
        for (const ticket of orderTickets) {

            const assignment = seatAssignments.get(ticket.section_id);
            const price = assignment.price;
            for (let i = 0; i < ticket.quantity; i++) {
                const seat = assignment.seats.shift(); // 拿一個可用 seat
                seat.status = SEAT_STATUS.RESERVED;
                updatedSeats.push(seat);

                const newTicket = ticketRepository.create({
                    price_paid: price,
                    type: '全票',
                    seat_id: seat.id,
                    order_id: savedOrder.id,
                });
                newTickets.push(newTicket);
                orderPrice += price;
            }
        }
        await seatRepository.save(updatedSeats);
        await ticketRepository.save(newTickets);

        return { eventTitle , orderNo, orderPrice  };
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
            .andWhere("order.payment_status = :paymentStatus", { paymentStatus: PAYMENT_STATUS.PAID })
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
                "order.payment_status AS payment_status",

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
                // "ticket.qrcode_img AS qrcode_img",

                "ticket.status AS status"
            ])
            .getRawMany();
            
        if (rawTicket.length === 0) throw appError(ERROR_STATUS_CODE, '訂單不存在');
        if (rawTicket[0].payment_status === PAYMENT_STATUS.PENDING) throw appError(ERROR_STATUS_CODE, '訂單尚未付款');
        if (rawTicket[0].payment_status === PAYMENT_STATUS.EXPIRED) throw appError(ERROR_STATUS_CODE, '訂單已過期');

        const base = rawTicket[0];
        const formatTicket = {
            order_no: base.order_no,
            payment_status: base.payment_status,
            user: {
                name: base.user_name,
                email: base.user_email
            },
            event: {
                id: base.event_id,
                title: base.event_title,
                location: base.event_location,
                address: base.event_address,
                start_at: base.event_start_at,
                end_at: base.event_end_at,
                cover_image_url: base.event_cover_image_url
            },
            tickets: await Promise.all(rawTicket
                // .filter(row => row.status === TICKET_STATUS.UNUSED)
                .map(async (ticket) => ({
                        ticket_no: ticket.ticket_no,
                        seat_no: `${ticket.section_name}區${ticket.seat_no}號`,
                        price: ticket.ticket_price,
                        type: ticket.ticket_type,
                        status:ticket.status,
                        qrcode_image: await generateTicketQrcode({
                            ticket_id: ticket.ticket_id,
                            user_id: userId,  
                            event_id: base.event_id,
                        }),
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

const updateOrderStatus = async ( orderNo, paymentType ) => {
    return dataSource.transaction(async (manager) => {
        const orderRepository = manager.getRepository('Order')
        const seatRepository = manager.getRepository('Seat')
        const order = await orderRepository.findOne({
            where: { serialNo: orderNo },
            relations: ['Ticket', 'Ticket.Seat']
        });
        if (!order) {
            throw appError(ERROR_STATUS_CODE, `找無訂單編號：${orderNo}`)
        }
        // 更新訂單狀態為已付款
        order.payment_status = PAYMENT_STATUS.PAID;
        order.payment_method = paymentType || null; // 預設為現金支付
        await orderRepository.save(order);

        // 更新座位狀態為已售出
        const seats = order.Ticket.map(ticket => ticket.Seat);
        for (const seat of seats) {
            seat.status = SEAT_STATUS.SOLD;
        }
        await seatRepository.save(seats);

        return;
    })
}

const cleanExpiredOrderJob = () => {
  cron.schedule('0,32 * * * *', async () => {
        logger.info('[CRON] 開始清理過期訂單');
        const orderRepository = dataSource.getRepository('Order')
        const seatRepository = dataSource.getRepository('Seat')
        const ticketRepository = dataSource.getRepository('Ticket')
        // 找到過期未付款的訂單
        const expiredOrders = await orderRepository
            .createQueryBuilder('order')
            .leftJoinAndSelect('order.Ticket', 'ticket')
            .leftJoinAndSelect('ticket.Seat', 'seat')
            .where('order.payment_status = :status', { status: PAYMENT_STATUS.PENDING })
            .andWhere("order.created_at + interval '16 minutes' < NOW()") //都用UTC不用轉換
            .getMany();


        if (expiredOrders.length === 0) {
            logger.info('[CRON] 沒有過期訂單需要清理');
            return;
        }
        // 將座位釋放
        for (const order of expiredOrders) {
            for (const ticket of order.Ticket) {
                if (ticket.Seat) {
                    ticket.Seat.status = SEAT_STATUS.AVAILABLE;
                    await seatRepository.save(ticket.Seat);
                }
            }
            // 刪除過期訂單Ticket
            await ticketRepository.remove(order.Ticket);
            // 將訂單標記為 expired
            order.payment_status = PAYMENT_STATUS.EXPIRED;
            
        }
        await orderRepository.save(expiredOrders);
        if (expiredOrders.length > 0) {
            logger.info(`[CRON] 清理 ${expiredOrders.length} 筆過期訂單`);
        }
    });
}

module.exports = {
    getOrdersData,
    getOneOrderData,
    createOrder,
    updateOrderStatus,
    cleanExpiredOrderJob
}


function isNotSaling(event) {
    const nowGMT8 = getNowGMT8Time()
    const saleStartAt = new Date(event.sale_start_at);
    const saleEndAt = new Date(event.sale_end_at);
    if (saleStartAt <= nowGMT8 && nowGMT8 <= saleEndAt) {
        return false; // 正在銷售中
    } else {
        return true; // 非屬銷售中
    }
}


// const createTestOrder = async (orderData, userId) => {
//     return dataSource.transaction(async (manager) => {
//         const eventRepository = manager.getRepository('Event')
//         const orderRepository = manager.getRepository('Order')
//         const seatRepository = manager.getRepository('Seat')
//         const ticketRepository = manager.getRepository('Ticket')
//         const sectionRepository = manager.getRepository('Section')
        
//         //欄位檢查，正式版需再增加，檢查活動起訖時間、價錢檢查等
//         if(orderData.tickets.length === 0){
//             throw appError(ERROR_STATUS_CODE, '訂單欄位錯誤')
//         }
//         const orderEvent = await eventRepository.findOne({
//                     where: {  id: orderData.event_id },
//                     select: [ 'status','sale_start_at','sale_end_at' ],
//                 });
//         if (!orderEvent) {
//             throw appError(ERROR_STATUS_CODE, `找無訂單輸入之活動`)
//         }
//         if(orderEvent.status != EVENT_STATUS.APPROVED){
//             throw appError(ERROR_STATUS_CODE, `活動尚未審核通過`)
//         }          
//         const now = new Date();
//         const saleStart = new Date( orderEvent.sale_start_at );
//         const saleEnd = new Date( orderEvent.sale_end_at );
//         if (saleEnd < now) {
//             throw appError(ERROR_STATUS_CODE, `超過販售時間`)
//         } else if(now < saleStart){
//             throw appError(ERROR_STATUS_CODE, `未達販售時間`)
//         }


//         //1. 新增訂單資料
//         const newOrder = orderRepository.create({
//             user_id: userId,
//             event_id: orderData.event_id
//         })

//         const savedOrder = await orderRepository.save(newOrder)
//         if (!savedOrder) {
//             throw appError(ERROR_STATUS_CODE, '新增訂單失敗')
//         }


//         // 2. 統計每個 section 所需票券數量
//         const orderTickets = orderData.tickets
//         const sectionDemandMap = new Map(); // Map<sectionId, count>

//         for (const ticket of orderTickets) {
//             sectionDemandMap.set(
//                 ticket.section_id,
//                 (sectionDemandMap.get(ticket.section_id) || 0) + 1
//             );
//         }


//         // 3. 一次查出每個 section 的 available seats
//         const seatAssignments = new Map(); // Map<sectionId, Seat[]>
//         for (const [sectionId, count] of sectionDemandMap.entries()) {

//             const sectionData = await sectionRepository.findOne({
//                         where: {  id: sectionId, event_id : orderData.event_id },
//                         select: [ 'section' ],
//                     });
//             if (!sectionData) {
//                 throw appError(ERROR_STATUS_CODE, `活動或資訊輸入錯誤`)
//             }

//             const availableSeats = await seatRepository
//                 .createQueryBuilder('seat')
//                 .where('seat.status = :status', { status: 'available' })
//                 .andWhere('seat.section_id = :sectionId', { sectionId: sectionId })
//                 .orderBy('seat.seat_number', 'ASC')
//                 .take(count)
//                 .setLock('pessimistic_write')  // 加入悲觀鎖
//                 .getMany();

//             if (availableSeats.length < count) {
//                 throw appError(ERROR_STATUS_CODE, `${sectionData.section}區，不足${count}個座位`)
//             }
//             seatAssignments.set(sectionId, availableSeats);
//         }
//         // 4. 配對 ticket 對應的 seat
//         const updatedSeats = [];
//         const newTickets = [];

//         for (const ticket of orderTickets) {
//             const availableSeats = seatAssignments.get(ticket.section_id);
//             const seat = availableSeats.shift(); // 拿第一張 seat

//             seat.status = 'sold';
//             updatedSeats.push(seat);

//             const newTicket = ticketRepository.create({
//                 price_paid: ticket.price_paid,
//                 type: ticket.type,
//                 qrcode_img: '',
//                 seat_id: seat.id,
//                 order_id: savedOrder.id,
//             });
//             newTickets.push(newTicket);
//         }
//         await seatRepository.save(updatedSeats);
//         await ticketRepository.save(newTickets);

//         return { order: savedOrder, tickets: newTickets };
//     });
// }