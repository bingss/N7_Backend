const TAIWAN_CITIES = [
    "基隆市", "台北市", "新北市", "連江縣", "宜蘭縣", "新竹市",
    "新竹縣", "桃園市", "苗栗縣", "台中市", "彰化縣", "南投縣",
    "嘉義市", "嘉義縣", "雲林縣", "台南市", "高雄市", "澎湖縣",
    "金門縣", "屏東縣", "台東縣", "花蓮縣"
];

// 將臺轉為台
function normalizeCityName(city){
    return city.replace(/^臺/, "台");
}

// 從地址中擷取縣市並驗證
function extractAndValidateCity(address){
    if (!address || address.length < 3) return null;

    const rawCity = address.substring(0, 3);
    const normalizedCity = normalizeCityName(rawCity);

    return TAIWAN_CITIES.includes(normalizedCity) ? normalizedCity : null;
}

module.exports = {
    extractAndValidateCity
}