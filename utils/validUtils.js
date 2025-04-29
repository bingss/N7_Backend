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


module.exports = {
  isValidString,
  isNumber,
  isValidPassword,
  isUndefined,
  isNotValidString,
  isNotValidInteger,
  isValidName
}




