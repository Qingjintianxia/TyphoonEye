'use strict'

/**
 * 数据文件路径入口。支持 DATA_DIR 覆盖，
 * 功能测试可用临时目录跑全链路而不污染演示数据。
 */
const path = require('path')
const config = require('../config')

function dataPath(name) {
  return path.join(config.dataDir, name)
}

module.exports = dataPath
