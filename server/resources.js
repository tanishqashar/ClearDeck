// Assignment-style resource URLs delegate to the existing board handlers.
// Membership/ownership remains checked by those handlers on every request.
const express = require('express');
const db = require('./db');
const boards = require('./boards');
const auth = require('./middleware');
const router = express.Router();
router.use(auth);
function forward(req, res, next, route) {
    req.url = route;
    boards(req, res, next);
}
function findTask(req, res) {
    const task = db.prepare(`SELECT t.* FROM tasks t JOIN boards b ON b.id = t.board_id
        WHERE t.id = ? AND (b.owner_id = ? OR EXISTS
        (SELECT 1 FROM board_members bm WHERE bm.board_id = b.id AND bm.user_id = ?))`).get(Number(req.params.id), req.user.id, req.user.id);
    if (!task) res.status(404).json({ error: 'Task not found' });
    return task;
}
router.get('/tasks/:id', (req, res) => {
    const task = findTask(req, res); if (!task) return;
    const comments = db.prepare(`SELECT c.*, u.name AS user_name FROM comments c JOIN users u ON u.id = c.user_id
        WHERE task_id = ? ORDER BY c.created_at, c.id`).all(task.id);
    res.json({ ...task, comments });
});
for (const method of ['put', 'delete']) router[method]('/tasks/:id', (req, res, next) => {
    const task = findTask(req, res); if (!task) return;
    forward(req, res, next, `/${task.board_id}/tasks/${task.id}`);
});
router.patch('/tasks/:id/move', (req, res, next) => {
    const task = findTask(req, res); if (!task) return;
    req.method = 'PUT';
    req.body = { ...req.body, column_id: req.body.column_id ?? req.body.columnId };
    forward(req, res, next, `/${task.board_id}/tasks/${task.id}/move`);
});
router.post('/tasks/:id/comments', (req, res, next) => {
    const task = findTask(req, res); if (!task) return;
    forward(req, res, next, `/${task.board_id}/tasks/${task.id}/comments`);
});
router.delete('/comments/:id', (req, res, next) => {
    const comment = db.prepare('SELECT c.id, c.task_id, t.board_id FROM comments c JOIN tasks t ON t.id = c.task_id WHERE c.id = ?').get(Number(req.params.id));
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    forward(req, res, next, `/${comment.board_id}/tasks/${comment.task_id}/comments/${comment.id}`);
});
router.post('/columns/:id/tasks', (req, res, next) => {
    const column = db.prepare('SELECT id, board_id FROM columns WHERE id = ?').get(Number(req.params.id));
    if (!column) return res.status(404).json({ error: 'Column not found' });
    req.body = { ...req.body, column_id: column.id };
    forward(req, res, next, `/${column.board_id}/tasks`);
});
for (const method of ['put','delete']) router[method]('/columns/:id', (req, res, next) => {
    const column = db.prepare('SELECT id, board_id FROM columns WHERE id = ?').get(Number(req.params.id));
    if (!column) return res.status(404).json({ error: 'Column not found' });
    if (method === 'put' && req.body.position !== undefined) {
        const { position } = req.body;
        const ids = db.prepare('SELECT id FROM columns WHERE board_id = ? AND id != ? ORDER BY position,id').all(column.board_id, column.id).map(c => c.id);
        if (!Number.isInteger(position) || position < 0 || position > ids.length || req.body.name !== undefined) {
            return res.status(400).json({ error: 'Send either a name or a valid position' });
        }
        ids.splice(position, 0, column.id); req.body = { columnIds: ids };
        return forward(req, res, next, `/${column.board_id}/columns/reorder`);
    }
    forward(req, res, next, `/${column.board_id}/columns/${column.id}`);
});
module.exports = router;
