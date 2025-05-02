const { z } = require('zod');
const dayjs = require('dayjs');

const isValidString = (value) => {
  return typeof value === 'string' && value.trim() !== '';
}

const isNumber = (value) => {
  return typeof value === 'number' && !isNaN(value);
}

const isValidPassword = (value) => {
  const passwordPattern = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,32}/
  return passwordPattern.test(value);
}

const isUndefined = (value) => {
  return value === undefined;
}

const isNotValidString = (value) => {
  return typeof value !== 'string' || value.trim().length === 0 || value === ''
}

const isNotValidInteger = (value) => {
  return typeof value !== 'number' || value < 0 || value % 1 !== 0
}

const isValidName = (value) => {
  const regex = /^[a-zA-Z0-9\u4e00-\u9fa5]{2,10}$/;
  return regex.test(value);
}

const toDate = (val) => {
  return new Date(val.replace(' ', 'T'));
}

const isValidDateTime = (value) => {
  const timeFormatRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
  if (!timeFormatRegex.test(value)) return false;
  const date = toDate(value);
  return !isNaN(date);
}

const isValidUrl = (value) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// 基本活動提交欄位驗證
const proposeEventValid  = z.object({
  name: z.string({
    required_error: '活動名稱未填寫正確',invalid_type_error: '活動名稱未填寫正確'
  }).min(1, '活動名稱未填寫正確'),
  location: z.string({
    required_error: '地點未填寫正確',invalid_type_error: '地點未填寫正確'
  }).min(1, '地點未填寫正確'),
  address: z.string({
    required_error: '地址未填寫正確', invalid_type_error: '地址未填寫正確'
  }).min(1, '地址未填寫正確'),
  start_at: z.string({
    required_error: '活開始時間未填寫正確', invalid_type_error: '開始時間未填寫正確'
  }).refine(isValidDateTime, {
    message: '開始時間未填寫正確'
  }),
  end_at: z.string({
    required_error: '結束時間未填寫正確', invalid_type_error: '結束時間未填寫正確'
  }).refine(isValidDateTime, {
    message: '結束時間未填寫正確'
  }),
  sale_start_at: z.string({
    required_error: '售票開始時間未填寫正確', invalid_type_error: '售票開始時間未填寫正確'
  }).refine(isValidDateTime, {
    message: '售票開始時間未填寫正確'
  }),
  sale_end_at: z.string({
    required_error: '售票結束時間未填寫正確', invalid_type_error: '售票結束時間未填寫正確'
  }).refine(isValidDateTime, {
    message: '售票結束時間未填寫正確'
  }),
  performance_group: z.string({
    required_error: '表演人員未填寫正確',invalid_type_error: '表演人員未填寫正確'
  }).min(1, '表演人員未填寫正確'),
  description: z.string({
    required_error: '活活動介紹未填寫正確', invalid_type_error: '活動介紹未填寫正確'
  }).min(1, '活動介紹未填寫正確'),
  type: z.array(z.string({
    required_error: '活動類型未填寫正確', invalid_type_error: '活動類型未填寫正確'
  })).min(1, '活動類型未填寫正確'),
  cover_image_url: z
    .any()
    .refine(
      val => isUndefined(val) || (isValidString(val) && isValidUrl(val)),
      { message: '封面圖未填寫正確' }
    ),
  section_image_url: z
    .any()
    .refine(
      val => isUndefined(val) || (isValidString(val) && isValidUrl(val)),
      { message: '場地圖未填寫正確' }
    ),
  sections: z.array(z.object({
    section_name: z.string({
      required_error: '分區名稱未填寫正確', invalid_type_error: '分區名稱未填寫正確'
    }).min(1, '分區名稱未填寫正確'),
    price: z.number({
      required_error: '票價未填寫正確', invalid_type_error: '票價未填寫正確'
      }).int().nonnegative('票價未填寫正確'),
    ticket_total: z.number({
      required_error: '票數未填寫正確', invalid_type_error: '票數未填寫正確'
      }).int().positive('票數未填寫正確'),
  })).min(1, '分區設定未填寫正確'),
  }).refine((data) => toDate(data.start_at) < toDate(data.end_at), {
    path: ['start_at'],
    message: '開始時間必須早於結束時間',
  }).refine((data) => toDate(data.sale_start_at) < toDate(data.sale_end_at), {
    path: ['sale_start_at'],
    message: '販售開始時間必須早於販售結束時間',
  }).refine((data) => toDate(data.sale_end_at) <= toDate(data.start_at), {
    path: ['sale_end_at'],
    message: '販售結束時間必須晚於活動開始時間',
  }).refine((data) => {
    // 檢查分區名稱是否重複
    const sectionNames = data.sections.map(section => section.section_name);
    const uniqueNames = new Set(sectionNames);
    return uniqueNames.size == sectionNames.length;
  }, {
    path: ['section_name'],
    message: '分區名稱未填寫正確重複',
  });


module.exports = {
  isValidString,
  isNumber,
  isValidPassword,
  isUndefined,
  isNotValidString,
  isNotValidInteger,
  isValidName,
  proposeEventValid
}




