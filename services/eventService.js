const config = require('../config/index')
const logger = require('../utils/logger')('Organizer')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const { moveFinalImage } = require('../utils/imageUtils')


const createNewEvent = async (newEventData, userId) => {
    return dataSource.transaction(async (manager) => {
        const eventRepository = manager.getRepository('Event')
        const sectionRepository = manager.getRepository('Section')
        //儲存活動資料
        const newEvent = eventRepository.create({
            user_id: userId,
            name:newEventData.name,
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
            throw appError(400, '新增活動失敗')
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

const updateEvent = async (newEventData, eventId) => {
    return dataSource.transaction(async (manager) => {
        const eventRepository = manager.getRepository('Event')
        const sectionRepository = manager.getRepository('Section')

        //比對更新資料
        const originalEventData = await eventRepository.findOne({
            select: [
                'name',
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
                id : eventId
            }
        })

        if (!originalEventData) {
            throw appError(400, '更新活動失敗')
        }

        originalEventData.start_at = formatDatabaseDate(originalEventData.start_at)
        originalEventData.end_at = formatDatabaseDate(originalEventData.end_at)
        originalEventData.sale_start_at = formatDatabaseDate(originalEventData.sale_start_at)
        originalEventData.sale_end_at = formatDatabaseDate(originalEventData.sale_end_at)

        const changedData = await getChangedData(originalEventData, newEventData, eventId)

        
        let updatedEventResult = 0
        if (Object.keys(changedData).length > 0) {
            console.log(`更新活動欄位: ${Object.keys(changedData).join(', ')}`);
            updatedEventResult = await eventRepository.update(
              { id: eventId },
              changedData
            );
            if (updatedEventResult.affected === 0) {
                throw appError(400, '更新活動失敗')
            }
        }

        //刪除所有分區再擺上去
        const delSectionResult = await sectionRepository.delete({ event_id : eventId })
        if (delSectionResult.affected === 0) {
            throw appError(400, '更新活動失敗')
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
            throw appError(400, '更新活動失敗')
        }

        const savedEvent = await eventRepository.findOne({
            select: [
                'id',
                'name',
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

async function getChangedData(originalData, newData, eventId) {
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

function formatDatabaseDate(dbDateString) {
    // 資料庫的日期字串:"Thu May 01 2025 20:00:00 GMT+0800 (台北標準時間)"
    //轉為前端傳來的格式 "2025-05-01 20:00"
    const date = new Date(dbDateString); 

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); 
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

module.exports = {
    createNewEvent,
    updateEvent,
}