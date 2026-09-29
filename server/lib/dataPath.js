'use strict'

/**
 * 数据文件路径唯一入口
 *
 * 之前 auth / tickets / notify 各自 `path.join(__dirname, '..', 'data', ...)`，
 * 同一件事写了 3 份；改成统一入口后顺带支持 DATA_DIR 覆盖 ——
 * 功能测试即可用临时目录跑全链路而不污染演示数据。
 */
const path = require('path')
const config = require('../config')

function dataPath(name) {
  return path.join(config.dataDir, name)
}

module.exports = dataPath
