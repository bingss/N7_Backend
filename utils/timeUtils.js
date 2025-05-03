

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

function toDate (val) {
    return new Date(val.replace(' ', 'T'));
}

module.exports = { 
    formatDatabaseDate,
    toDate
  };
  