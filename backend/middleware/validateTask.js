/**

* Validation middleware for task creation and update
* Validates priority and status fields before hitting the database
*
*/

const VALID_PRIORITIES = ['basse', 'moyenne', 'haute']
const VALID_STATUSES = ['à faire', 'en cours', 'terminé']

function validateTask(req, res, next) {
  const { priority, status } = req.body

  if (priority && !VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({
      message: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`
    })
  }

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
    })
  }

  next()
}

module.exports = validateTask