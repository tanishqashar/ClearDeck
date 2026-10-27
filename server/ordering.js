const db = require('./db');
// Deterministic integer positions; repair only columns touched by a user action.
function renumber(boardId, columnId, ids) {
    const rows = ids || db.prepare('SELECT id FROM tasks WHERE board_id = ? AND column_id = ? ORDER BY position, id').all(boardId, columnId).map(t => t.id);
    const update = db.prepare('UPDATE tasks SET position = ? WHERE id = ? AND board_id = ? AND column_id = ?');
    rows.forEach((id, position) => update.run(position, id, boardId, columnId));
}
const move = db.transaction((boardId, taskId, targetColumnId, position) => {
    const source = db.prepare('SELECT column_id FROM tasks WHERE id = ? AND board_id = ?').get(taskId, boardId);
    if (!source) throw new Error('Task not found');
    const target = db.prepare('SELECT id FROM tasks WHERE board_id = ? AND column_id = ? AND id != ? ORDER BY position, id').all(boardId, targetColumnId, taskId).map(t => t.id);
    // position means final index after removing the moving card.
    const index = Math.min(position, target.length);
    target.splice(index, 0, taskId);
    db.prepare('UPDATE tasks SET column_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND board_id = ?').run(targetColumnId, taskId, boardId);
    if (source.column_id !== targetColumnId) renumber(boardId, source.column_id);
    renumber(boardId, targetColumnId, target);
    return index;
});
module.exports = { move, renumber };
