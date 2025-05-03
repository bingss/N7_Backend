const config = require('../config/index')
const logger = require('../utils/logger')('Organizer')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const { moveFinalImage } = require('../utils/imageUtils')
const { formatDatabaseDate } = require('../utils/timeUtils')
const ERROR_STATUS_CODE = 400;

const createNewEvent = async (newEventData, userId) => {
    return dataSource.transaction(async (manager) => {
        const eventRepository = manager.getRepository('Event')
        const sectionRepository = manager.getRepository('Section')
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
        const newSections = newEventData.sections.map((section) => {
            return sectionRepository.create({
              section: section.section_name,
              total_seats: section.ticket_total,
              price_default: section.price,
              event_id: savedEventId,
            });
        });
        const savedSection = await sectionRepository.save(newSections);

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
                'type'],
            where: {
                id : eventId,
                user_id : userId
            }
        })

        if (!originalEventData) {
            throw appError(ERROR_STATUS_CODE, '活動不存在')
        }

        originalEventData.start_at = formatDatabaseDate(originalEventData.start_at)
        originalEventData.end_at = formatDatabaseDate(originalEventData.end_at)
        originalEventData.sale_start_at = formatDatabaseDate(originalEventData.sale_start_at)
        originalEventData.sale_end_at = formatDatabaseDate(originalEventData.sale_end_at)

        const changedData = await compareChangedData(originalEventData, newEventData, eventId)

        
        let updatedEventResult = 0
        if (Object.keys(changedData).length > 0) {
            console.log(`更新活動欄位: ${Object.keys(changedData).join(', ')}`);
            updatedEventResult = await eventRepository.update(
              { id: eventId },
              changedData
            );
            if (updatedEventResult.affected === 0) {
                throw appError(ERROR_STATUS_CODE, '更新活動失敗')
            }
        }

        //刪除所有分區再擺上去
        const delSectionResult = await sectionRepository.delete({ event_id : eventId })
        if (delSectionResult.affected === 0) {
            throw appError(ERROR_STATUS_CODE, '更新活動失敗')
        }
        // 儲存分區資料
        const newSections = newEventData.sections.map((section) => {
            return sectionRepository.create({
              section: section.section_name,
              total_seats: section.ticket_total,
              price_default: section.price,
              event_id: eventId,
            });
        });
        const savedSection = await sectionRepository.save(newSections);
        //沒更新活動資料又沒更新分區資料成功
        if ( !savedSection ) {
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
            
                'section.id AS section_id',
                'section.section AS section_name',
                'section.price_default AS price',
                'section.total_seats AS ticket_total'
            ])
            .getRawMany();
        if (!eventWithSections || eventWithSections.length === 0) {
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
            sections: eventWithSections.map(row => ({
              id: row.section_id,
              section_name: row.section_name,
              price: row.price,
              ticket_total: row.ticket_total
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

module.exports = {
    createNewEvent,
    getEditEventData,
    updateEvent,
}

async function compareChangedData(originalData, newData, eventId) {
    const changedData = {};

    // 遍歷新資料的所有欄位
    for (const key in newData) {
        // 確保該欄位在原資料中存在且值不同
        if (key in originalData && originalData[key] !== newData[key]) {
            if (key === 'cover_image_url' || key === 'section_image_url') {
                // 移動圖片位置並儲存圖片資料
                try {
                    changedData[key] = await moveFinalImage( newData[key], eventId)
                }catch (error) {
                    changedData[key] = null
                }
            }
            else{
                changedData[key] = newData[key];
            }
        }
    }

    return changedData;
}