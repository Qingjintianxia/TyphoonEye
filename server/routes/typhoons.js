const express = require('express')
const router = express.Router()
const { typhoons } = require('../data/mock-data')

router.get('/', (req, res) => {
  const { status } = req.query
  let result = [...typhoons]
  if (status) {
    result = result.filter(t => t.status === status)
  }
  const list = result.map(t => {
    const { path, ...rest } = t
    if (t.status === 'active') {
      return { ...rest, path }
    }
    return { ...rest, pathLength: path.length, latestPath: path[path.length - 1] }
  })
  res.json({ code: 200, data: list, total: list.length })
})

router.get('/:id', (req, res) => {
  const typhoon = typhoons.find(t => t.id === req.params.id)
  if (!typhoon) {
    return res.status(404).json({ code: 404, message: '台风不存在' })
  }
  res.json({ code: 200, data: typhoon })
})

module.exports = router
