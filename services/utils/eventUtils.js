const { moveFinalImage } = require('../../utils/imageUtils')



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

async function generateSectionAndSeat(manager, newEventData, eventId){
        // 儲存分區資料
        const newSections = newEventData.sections.map((section) => {
            return manager.getRepository('Section').create({
              section: section.section_name,
              total_seats: section.ticket_total,
              price_default: section.price,
              event_id: eventId,
            });
        });
        const savedSections = await manager.getRepository('Section').save(newSections);

        
        let allSeats = [];
        savedSections.forEach((section) => {
            
            const { ticket_total } = newEventData.sections.find( (eventSection) => eventSection.section_name === section.section)
            console.log(ticket_total)
            const seats = Array.from({ length: ticket_total }, (_, index) => {
                return manager.getRepository('Seat').create({
                    seat_number: String(index + 1),      // 從 1 開始編號
                    section_id: section.id,              // 對應 section
                });
            });
            allSeats.push(...seats);
        });
        const savedSeats = await manager.getRepository('Seat').save(allSeats);

        return {savedSections,savedSeats}
        // return {savedSections,savedSections}
}

module.exports ={
    compareChangedData,
    generateSectionAndSeat
}