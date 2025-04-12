const isValidString = (value) => {
    return typeof value === 'string' && value.trim() !== '';
  }
  
const isNumber = (value) => {
  return typeof value === 'number' && !isNaN(value);
}

const isValidPassword = (value) => {
  const passwordPattern = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,16}/
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

module.exports = {
  isValidString,
  isNumber,
  isValidPassword,
  isUndefined,
  isNotValidString,
  isNotValidInteger
}



  
