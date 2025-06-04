const { dataSource } = require('./db/data-source');
const { v4: uuidv4 } = require('uuid'); // 若你要自訂 UUID
const AppError = require('./utils/appError'); // 如果你有自訂錯誤格式
const ERROR_STATUS_CODE = 500; // 可以自訂你的 error status code

const getEventByIdSimple = async (eventId) => {
    try {
        const event = await dataSource.getRepository('Event')
            .createQueryBuilder('event')
            .innerJoin('event.Type', 'type')
            .select([
                'event.id AS id',
                'event.title AS title',
                'event.cover_image_url AS cover_image_url',
                'event.description AS description',
                'DATE(event.start_at) AS start_at',
                'type.name AS type',
                'event.city AS city'
            ])
            .where('event.id = :id', { id: eventId })
            .andWhere('event.status = :status', { status: 'approved' })
            .getRawOne();

        if (!event) {
            throw AppError(404, '找不到該活動');
        }

        return event;
    } catch (error) {
        console.error('發生錯誤:', error);
        throw AppError(500, '發生錯誤');
    }
};

(async () => {
    try {
        await dataSource.initialize();
        console.log('資料庫連線成功');

        const testEventId = '550e8400-e29b-41d4-a716-446655440000'; // 先以假資料'550e8400-e29b-41d4-a716-446655440000'測試，真實資料要替換為真實存在的活動 UUID
        const event = await getEventByIdSimple(testEventId);
        console.log('取得的活動資料:', event);
    } catch (err) {
        console.error(err);
    } finally {
        await dataSource.destroy();
        console.log('已關閉資料庫連線');
    }
})();