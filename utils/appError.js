const appError = (status, errMessage) => {
    const error = new Error(errMessage);
    error.status = status;
    return error;
  }
  
  module.exports = appError;