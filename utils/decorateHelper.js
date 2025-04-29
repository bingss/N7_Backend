// 參考：https://github.com/typeorm/typeorm/issues/2305

const decorateHelper = (decorators, target) => {
    decorators = Array.isArray(decorators) ? decorators : [decorators]
    decorators.forEach(decorator => decorator(target))
    return target
}

module.exports = decorateHelper
