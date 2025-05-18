const EVENT_STATUS = Object.freeze({
    CHECKING: 'checking',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    FINISHED: 'finished',
    HOLDING:'holding'
  });
  
const EVENT_CHINESE_STATUS = Object.freeze({
    checking: '審核中',
    approved: '審核通過',
    rejected: '被拒絕',
    finished: '已結束',
    holding:'舉辦中',
    undefined:'全部'
  });


module.exports = {
  EVENT_STATUS,
  EVENT_CHINESE_STATUS
};