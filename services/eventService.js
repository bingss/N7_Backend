const config = require('../config/index')
const logger = require('../utils/logger')('Organizer')
const appError = require('../utils/appError')
const { dataSource } = require('../db/data-source')
const { moveFinalImage } = require('../utils/imageUtils')


const createNewEvent = async (eventData, userId) => {
    return dataSource.transaction(async (manager) => {
        const eventRepository = manager.getRepository('Event')
        const sectionRepository = manager.getRepository('Section')
        //儲存活動資料
        const newEvent = eventRepository.create({
            user_id: userId,
            title:eventData.name,
            location: eventData.location,
            address: eventData.address,
            start_at: eventData.start_at,
            end_at: eventData.end_at,
            sale_start_at: eventData.sale_start_at,
            sale_end_at: eventData.sale_end_at,
            perform_group: eventData.performance_group,
            description: eventData.description,
            type: eventData.type.join(',')
        })
        const savedEvent = await eventRepository.save(newEvent)
        if (!savedEvent) {
            throw appError(400, '新增活動失敗')
        }
        // 儲存分區資料
        const savedEventId = savedEvent.id
        const newSections = eventData.sections.map((section) => {
            return sectionRepository.create({
              section: section.section_name,
              total_seats: section.ticket_total,
              price_default: section.price,
              event_id: savedEventId,
            });
        });
        await sectionRepository.save(newSections);
    
        // 移動圖片位置並儲存圖片資料
        let newCoverImgUrl = null
        let newSectionImgUrl = null
        if(eventData.cover_image_url) {
            try {
                newCoverImgUrl = await moveFinalImage(eventData.cover_image_url, savedEventId)
            }catch (error) {
                newCoverImgUrl = null
            }
        }
        if(eventData.section_image_url) {
            try {
                newSectionImgUrl = await moveFinalImage(eventData.section_image_url, savedEventId)
            }catch (error) {
                newSectionImgUrl = null
            }
        }
        const updatedEvent = await eventRepository.update({
            id: savedEventId
        }, {
            cover_image: newCoverImgUrl,
            section_image: newSectionImgUrl
        })
    
        return {
            savedEvent: savedEvent,
            newCoverImgUrl: newCoverImgUrl,
            newSectionImgUrl: newSectionImgUrl
        }
    });
} 

module.exports = {
    createNewEvent
}