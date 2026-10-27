const express = require('express');
const db = require('./db');
const authenticateToken = require('./middleware');
const ordering = require('./ordering');

const router = express.Router();
function todayDateKey() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
}
// Reject invalid types before they reach trim(), SQL bindings, or date comparisons.
router.use(authenticateToken, (req, res, next) => {
    const body = req.body || {};
    for (const key of ['name', 'title', 'description', 'content', 'email']) {
        if (body[key] !== undefined && (typeof body[key] !== 'string' || body[key].length > (key === 'description' || key === 'content' ? 10000 : 255))) {
            return res.status(400).json({ error: `Invalid ${key}` });
        }
    }
    if (body.due_date !== undefined && body.due_date !== null && body.due_date !== '') {
        const date = body.due_date;
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) {
            return res.status(400).json({ error: 'Due date must be a valid YYYY-MM-DD date' });
        }
        if (date < todayDateKey()) {
            return res.status(400).json({ error: 'Due date cannot be before today' });
        }
    }
    for (const key of ['q', 'priority', 'assignee_id', 'mine']) {
        if (req.query[key] !== undefined && typeof req.query[key] !== 'string') return res.status(400).json({ error: `Invalid ${key}` });
    }
    next();
});

// Get all boards belonging to the logged-in user
router.get('/', authenticateToken, (req, res) => {
    try {
        const boards = db.prepare(`
            SELECT DISTINCT b.*, (SELECT COUNT(*) FROM tasks t WHERE t.board_id = b.id) AS task_count
            FROM boards b
            LEFT JOIN board_members bm ON b.id = bm.board_id
            WHERE b.owner_id = ? OR bm.user_id = ?
            ORDER BY b.created_at DESC
        `).all(req.user.id, req.user.id);

        res.json(boards);
    } catch (error) {
        console.error('Get boards error:', error);
        res.status(500).json({
            error: 'Could not retrieve boards'
        });
    }
});

// Create a new board
router.post('/', authenticateToken, (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                error: 'Board name is required'
            });
        }

        // Start a database transaction
        const createBoard = db.transaction(() => {
            // Create the board
            const result = db.prepare(`
                INSERT INTO boards (name, description, owner_id)
                VALUES (?, ?, ?)
            `).run(
                name.trim(),
                description ? description.trim() : '',
                req.user.id
            );

            const boardId = result.lastInsertRowid;

            // Add the creator as the board owner
            db.prepare(`
                INSERT INTO board_members (board_id, user_id, role)
                VALUES (?, ?, 'owner')
            `).run(boardId, req.user.id);

            // Create the default columns
            const insertColumn = db.prepare(`
                INSERT INTO columns (board_id, name, position)
                VALUES (?, ?, ?)
            `);

            insertColumn.run(boardId, 'To Do', 0);
            insertColumn.run(boardId, 'In Progress', 1);
            insertColumn.run(boardId, 'Done', 2);

            return boardId;
        });

        const boardId = createBoard();

        return res.status(201).json({
            message: 'Board created successfully',
            boardId,
            name: name.trim(),
            columns: ['To Do', 'In Progress', 'Done']
        });

    } catch (error) {
        console.error('Create board error:', error);

        return res.status(500).json({
            error: 'Could not create board'
        });
    }
});

// Get one board with its columns and tasks
router.get('/:id', authenticateToken, (req, res) => {
    try {
        const boardId = Number(req.params.id);

        if (!Number.isInteger(boardId) || boardId <= 0) {
            return res.status(400).json({
                error: 'Invalid board ID'
            });
        }

        // Check whether the user has access to this board
        const board = db.prepare(`
            SELECT DISTINCT b.*
            FROM boards b
            LEFT JOIN board_members bm ON b.id = bm.board_id
            WHERE b.id = ?
              AND (b.owner_id = ? OR bm.user_id = ?)
        `).get(boardId, req.user.id, req.user.id);

        if (!board) {
            return res.status(404).json({
                error: 'Board not found'
            });
        }

        // Get the board's columns
        const columns = db.prepare(`
            SELECT id, name, position
            FROM columns
            WHERE board_id = ?
            ORDER BY position, id
        `).all(boardId);

        // Get the board's tasks
        const tasks = db.prepare(`
            SELECT id, column_id, title, description,
                   priority, due_date, assignee_id,
                   created_by, position, created_at, updated_at
            FROM tasks
            WHERE board_id = ?
            ORDER BY position, id
        `).all(boardId);

        return res.json({
            board,
            columns,
            tasks
        });

    } catch (error) {
        console.error('Get board error:', error);

        return res.status(500).json({
            error: 'Could not retrieve board'
        });
    }
});

// Create a task on a board
router.post('/:id/tasks', authenticateToken, (req, res) => {
    const boardId = Number(req.params.id);

    const {
        title,
        description,
        priority,
        due_date,
        assignee_id,
        column_id
    } = req.body;

    if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({
            error: 'Task title is required'
        });
    }

    if (
        priority !== undefined &&
        !['Low', 'Medium', 'High'].includes(priority)
    ) {
        return res.status(400).json({
            error: 'Priority must be Low, Medium, or High'
        });
    }

    if (
        assignee_id !== undefined &&
        assignee_id !== null &&
        !Number.isInteger(assignee_id)
    ) {
        return res.status(400).json({
            error: 'Assignee ID must be a valid integer'
        });
    }

    const board = db.prepare(`
        SELECT id FROM boards
        WHERE id = ?
        AND (
            owner_id = ?
            OR id IN (
                SELECT board_id FROM board_members
                WHERE user_id = ?
            )
        )
    `).get(boardId, req.user.id, req.user.id);

    if (!board) {
        return res.status(404).json({
            error: 'Board not found or access denied'
        });
    }

    if (!Number.isInteger(column_id) || column_id <= 0) return res.status(400).json({ error: 'A valid column_id is required' });

    const selectedColumn = db.prepare(`
        SELECT id FROM columns
        WHERE id = ? AND board_id = ?
    `).get(column_id, boardId);

    if (!selectedColumn) {
        return res.status(400).json({
            error: 'Invalid column for this board'
        });
    }

    if (assignee_id !== undefined && assignee_id !== null) {
        const member = db.prepare(`
            SELECT user_id FROM board_members
            WHERE board_id = ? AND user_id = ?
        `).get(boardId, assignee_id);

        if (!member) {
            return res.status(400).json({
                error: 'Assignee must be a member of this board'
            });
        }
    }

    const result = db.transaction(() => {
        ordering.renumber(boardId, column_id);
        return db.prepare(`
        INSERT INTO tasks (
            board_id, column_id, title, description,
            priority, due_date, assignee_id, created_by, position
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        boardId,
        column_id,
        title.trim(),
        description || '',
        priority || 'Medium',
        due_date || null,
        assignee_id ?? null,
        req.user.id,
        db.prepare('SELECT COUNT(*) AS n FROM tasks WHERE board_id = ? AND column_id = ?').get(boardId, column_id).n
    );

    })();

    return res.status(201).json({
        message: 'Task created successfully',
        taskId: result.lastInsertRowid
    });
});

 // Edit an existing task
router.put('/:id/tasks/:taskId', authenticateToken, (req, res) => {
    try {
        const boardId = Number(req.params.id);
        const taskId = Number(req.params.taskId);

        const {
            title,
            description,
            priority,
            due_date,
            assignee_id,
            column_id
        } = req.body;

        if (
            !Number.isInteger(boardId) || boardId <= 0 ||
            !Number.isInteger(taskId) || taskId <= 0
        ) {
            return res.status(400).json({
                error: 'Invalid board or task ID'
            });
        }

        if (typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({
                error: 'Task title is required'
            });
        }

        const taskPriority = priority || 'Medium';

        if (!['Low', 'Medium', 'High'].includes(taskPriority)) {
            return res.status(400).json({
                error: 'Priority must be Low, Medium or High'
            });
        }

        const columnId = Number(column_id);

        if (!Number.isInteger(columnId) || columnId <= 0) {
            return res.status(400).json({
                error: 'A valid column_id is required'
            });
        }

        if (
            assignee_id !== undefined &&
            assignee_id !== null &&
            (!Number.isInteger(assignee_id) || assignee_id <= 0)
        ) {
            return res.status(400).json({
                error: 'Assignee ID must be a valid integer'
            });
        }

        const board = db.prepare(`
            SELECT id FROM boards
            WHERE id = ?
            AND (
                owner_id = ?
                OR id IN (
                    SELECT board_id FROM board_members
                    WHERE user_id = ?
                )
            )
        `).get(boardId, req.user.id, req.user.id);

        if (!board) {
            return res.status(404).json({
                error: 'Board not found'
            });
        }

        const task = db.prepare(`
            SELECT id, column_id FROM tasks
            WHERE id = ? AND board_id = ?
        `).get(taskId, boardId);

        if (!task) {
            return res.status(404).json({
                error: 'Task not found'
            });
        }

        const finalColumn = db.prepare(`
            SELECT id FROM columns
            WHERE board_id = ?
            ORDER BY position DESC, id DESC
            LIMIT 1
        `).get(boardId);
        if (finalColumn && task.column_id === finalColumn.id) {
            return res.status(400).json({
                error: 'Tasks in the Done column cannot be edited'
            });
        }

        const column = db.prepare(`
            SELECT id FROM columns
            WHERE id = ? AND board_id = ?
        `).get(columnId, boardId);

        if (!column) {
            return res.status(400).json({
                error: 'Invalid column for this board'
            });
        }

        if (assignee_id !== undefined && assignee_id !== null) {
            const member = db.prepare(`
                SELECT user_id FROM board_members
                WHERE board_id = ? AND user_id = ?
            `).get(boardId, assignee_id);

            if (!member) {
                return res.status(400).json({
                    error: 'Assignee must be a member of this board'
                });
            }
        }

        db.transaction(() => {
            if (task.column_id !== column.id) ordering.move(boardId, taskId, column.id, Number.MAX_SAFE_INTEGER);
        db.prepare(`
            UPDATE tasks
            SET title = ?,
                description = ?,
                priority = ?,
                due_date = ?,
                assignee_id = ?,
                column_id = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND board_id = ?
        `).run(
            title.trim(),
            description || '',
            taskPriority,
            due_date || null,
            assignee_id ?? null,
            column.id,
            taskId,
            boardId
        );

        })();

        return res.json({
            message: 'Task updated successfully',
            taskId
        });

    } catch (error) {
        console.error('Update task error:', error);

        return res.status(500).json({
            error: 'Could not update task'
        });
    }
});

 // Delete a task
router.delete('/:id/tasks/:taskId', authenticateToken, (req, res) => {
    try {
        const boardId = Number(req.params.id);
        const taskId = Number(req.params.taskId);

        if (!Number.isInteger(boardId) || boardId <= 0 ||
            !Number.isInteger(taskId) || taskId <= 0) {
            return res.status(400).json({
                error: 'Invalid board or task ID'
            });
        }

        // Check whether the user can access the board
        const board = db.prepare(`
            SELECT id FROM boards
            WHERE id = ?
              AND (
                  owner_id = ?
                  OR id IN (
                      SELECT board_id FROM board_members
                      WHERE user_id = ?
                  )
              )
        `).get(boardId, req.user.id, req.user.id);

        if (!board) {
            return res.status(404).json({
                error: 'Board not found'
            });
        }

        // Check whether the task belongs to this board
        const task = db.prepare(`
            SELECT id, column_id FROM tasks
            WHERE id = ? AND board_id = ?
        `).get(taskId, boardId);

        if (!task) {
            return res.status(404).json({
                error: 'Task not found'
            });
        }

        db.transaction(() => {
        db.prepare(`
            DELETE FROM tasks
            WHERE id = ? AND board_id = ?
        `).run(taskId, boardId);
        ordering.renumber(boardId, task.column_id);
        })();

        return res.json({
            message: 'Task deleted successfully',
            taskId
        });

    } catch (error) {
        console.error('Delete task error:', error);

        return res.status(500).json({
            error: 'Could not delete task'
        });
    }
});

 // Rename a board
router.put('/:id', authenticateToken, (req, res) => {
    try {
        const boardId = Number(req.params.id);
        const { name, description } = req.body;

        if (!Number.isInteger(boardId) || boardId <= 0) {
            return res.status(400).json({
                error: 'Invalid board ID'
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                error: 'Board name is required'
            });
        }

        // Only the board owner can rename it
        const board = db.prepare(`
            SELECT id FROM boards
            WHERE id = ? AND owner_id = ?
        `).get(boardId, req.user.id);

        if (!board) {
            return res.status(404).json({
                error: 'Board not found or you are not the owner'
            });
        }

        db.prepare(`
            UPDATE boards
            SET name = ?, description = ?
            WHERE id = ?
        `).run(
            name.trim(),
            description || null,
            boardId
        );

        return res.json({
            message: 'Board renamed successfully',
            boardId
        });

    } catch (error) {
        console.error('Rename board error:', error);

        return res.status(500).json({
            error: 'Could not rename board'
        });
    }
});

 // Delete a board (owner only)
router.delete('/:id', authenticateToken, (req, res) => {
    try {
        const boardId = Number(req.params.id);

        if (!Number.isInteger(boardId) || boardId <= 0) {
            return res.status(400).json({
                error: 'Invalid board ID'
            });
        }

        const board = db.prepare(`
            SELECT id FROM boards
            WHERE id = ? AND owner_id = ?
        `).get(boardId, req.user.id);

        if (!board) {
            return res.status(404).json({
                error: 'Board not found or you are not the owner'
            });
        }

        db.prepare(`
            DELETE FROM boards
            WHERE id = ? AND owner_id = ?
        `).run(boardId, req.user.id);

        return res.json({
            message: 'Board deleted successfully',
            boardId
        });

    } catch (error) {
        console.error('Delete board error:', error);

        return res.status(500).json({
            error: 'Could not delete board'
        });
    }
});

 // Create a new column on a board
router.post('/:id/columns', authenticateToken, (req, res) => {
    try {
        const boardId = Number(req.params.id);
        const { name } = req.body;

        if (!Number.isInteger(boardId) || boardId <= 0) {
            return res.status(400).json({
                error: 'Invalid board ID'
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                error: 'Column name is required'
            });
        }

        // Only the board owner can manage columns
        const board = db.prepare(`
            SELECT id FROM boards
            WHERE id = ? AND owner_id = ?
        `).get(boardId, req.user.id);

        if (!board) {
            return res.status(404).json({
                error: 'Board not found or you are not the owner'
            });
        }

        const position = db.prepare(`
            SELECT COALESCE(MAX(position), -1) + 1 AS nextPosition
            FROM columns
            WHERE board_id = ?
        `).get(boardId).nextPosition;

        const result = db.prepare(`
            INSERT INTO columns (board_id, name, position)
            VALUES (?, ?, ?)
        `).run(boardId, name.trim(), position);

        return res.status(201).json({
            message: 'Column created successfully',
            columnId: result.lastInsertRowid,
            name: name.trim(),
            position
        });

    } catch (error) {
        console.error('Create column error:', error);

        return res.status(500).json({
            error: 'Could not create column'
        });
    }
});

 // Reorder columns on a board
router.put('/:id/columns/reorder', authenticateToken, (req, res) => {
    try {
        const boardId = Number(req.params.id);
        const { columnIds } = req.body;

        if (!Number.isInteger(boardId) || boardId <= 0) {
            return res.status(400).json({
                error: 'Invalid board ID'
            });
        }

        if (!Array.isArray(columnIds) ||
            columnIds.some(id => !Number.isInteger(id) || id <= 0) ||
            new Set(columnIds).size !== columnIds.length) {
            return res.status(400).json({
                error: 'Invalid column IDs'
            });
        }

        const board = db.prepare(`
            SELECT id FROM boards
            WHERE id = ? AND owner_id = ?
        `).get(boardId, req.user.id);

        if (!board) {
            return res.status(404).json({
                error: 'Board not found or you are not the owner'
            });
        }

        const existingColumns = db.prepare(`
            SELECT id FROM columns WHERE board_id = ?
        `).all(boardId);

        if (existingColumns.length !== columnIds.length ||
            !existingColumns.every(column => columnIds.includes(column.id))) {
            return res.status(400).json({
                error: 'Provide every column ID for this board exactly once'
            });
        }

        const updatePosition = db.prepare(`
            UPDATE columns SET position = ?
            WHERE id = ? AND board_id = ?
        `);

        const reorder = db.transaction(() => {
            columnIds.forEach((columnId, index) => {
                updatePosition.run(index, columnId, boardId);
            });
        });

        reorder();

        return res.json({
            message: 'Columns reordered successfully',
            columnIds
        });
    } catch (error) {
        console.error('Reorder columns error:', error);
        return res.status(500).json({
            error: 'Could not reorder columns'
        });
    }
});

 // Rename a column
router.put('/:id/columns/:columnId', authenticateToken, (req, res) => {
    try {
        const boardId = Number(req.params.id);
        const columnId = Number(req.params.columnId);
        const { name } = req.body;

        if (!Number.isInteger(boardId) || boardId <= 0 ||
            !Number.isInteger(columnId) || columnId <= 0) {
            return res.status(400).json({
                error: 'Invalid board or column ID'
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                error: 'Column name is required'
            });
        }

        const board = db.prepare(`
            SELECT id FROM boards
            WHERE id = ? AND owner_id = ?
        `).get(boardId, req.user.id);

        if (!board) {
            return res.status(404).json({
                error: 'Board not found or you are not the owner'
            });
        }

        const column = db.prepare(`
            SELECT id FROM columns
            WHERE id = ? AND board_id = ?
        `).get(columnId, boardId);

        if (!column) {
            return res.status(404).json({
                error: 'Column not found'
            });
        }

        db.prepare(`
            UPDATE columns
            SET name = ?
            WHERE id = ? AND board_id = ?
        `).run(name.trim(), columnId, boardId);

        return res.json({
            message: 'Column renamed successfully',
            columnId,
            name: name.trim()
        });

    } catch (error) {
        console.error('Rename column error:', error);

        return res.status(500).json({
            error: 'Could not rename column'
        });
    }
});

 // Delete a column
router.delete('/:id/columns/:columnId', authenticateToken, (req, res) => {
    try {
        const boardId = Number(req.params.id);
        const columnId = Number(req.params.columnId);

        if (!Number.isInteger(boardId) || boardId <= 0 ||
            !Number.isInteger(columnId) || columnId <= 0) {
            return res.status(400).json({
                error: 'Invalid board or column ID'
            });
        }

        const board = db.prepare(`
            SELECT id FROM boards
            WHERE id = ? AND owner_id = ?
        `).get(boardId, req.user.id);

        if (!board) {
            return res.status(404).json({
                error: 'Board not found or you are not the owner'
            });
        }

        const column = db.prepare(`
            SELECT id FROM columns
            WHERE id = ? AND board_id = ?
        `).get(columnId, boardId);

        if (!column) {
            return res.status(404).json({
                error: 'Column not found'
            });
        }

        const taskCount = db.prepare(`
            SELECT COUNT(*) AS total
            FROM tasks
            WHERE column_id = ?
        `).get(columnId).total;

        if (taskCount > 0) {
            return res.status(400).json({
                error: 'Cannot delete a column containing tasks'
            });
        }

        db.prepare(`
            DELETE FROM columns
            WHERE id = ? AND board_id = ?
        `).run(columnId, boardId);

        return res.json({
            message: 'Column deleted successfully',
            columnId
        });

    } catch (error) {
        console.error('Delete column error:', error);

        return res.status(500).json({
            error: 'Could not delete column'
        });
    }
});

// Combined search/filter endpoint from the assignment. The original routes remain supported.
router.get('/:id/tasks', authenticateToken, (req, res) => {
    const boardId = Number(req.params.id);
    const allowed = db.prepare(`SELECT id FROM boards WHERE id = ? AND
        (owner_id = ? OR EXISTS (SELECT 1 FROM board_members WHERE board_id = boards.id AND user_id = ?))`).get(boardId, req.user.id, req.user.id);
    if (!allowed) return res.status(404).json({ error: 'Board not found' });
    const { q = '', priority, assignee, assignee_id } = req.query;
    const selected = assignee ?? assignee_id;
    if (typeof q !== 'string' || (priority && !['Low','Medium','High'].includes(priority)) ||
        (selected !== undefined && (typeof selected !== 'string' || !/^\d+$/.test(selected) || Number(selected) <= 0))) {
        return res.status(400).json({ error: 'Invalid search or filter' });
    }
    let sql = 'SELECT * FROM tasks WHERE board_id = ? AND (title LIKE ? OR description LIKE ?)';
    const params = [boardId, `%${q}%`, `%${q}%`];
    if (priority) { sql += ' AND priority = ?'; params.push(priority); }
    if (selected !== undefined) { sql += ' AND assignee_id = ?'; params.push(Number(selected)); }
    res.json(db.prepare(sql + ' ORDER BY column_id, position, id').all(...params));
});

 // Search tasks on a board
router.get('/:id/tasks/search', authenticateToken, (req, res) => {
    try {
        const boardId = Number(req.params.id);
        const search = (req.query.q || '').trim();

        if (!Number.isInteger(boardId) || boardId <= 0) {
            return res.status(400).json({
                error: 'Invalid board ID'
            });
        }

        const board = db.prepare(`
            SELECT id FROM boards
            WHERE id = ?
              AND (
                  owner_id = ?
                  OR id IN (
                      SELECT board_id FROM board_members
                      WHERE user_id = ?
                  )
              )
        `).get(boardId, req.user.id, req.user.id);

        if (!board) {
            return res.status(404).json({
                error: 'Board not found'
            });
        }

        const tasks = db.prepare(`
            SELECT id, column_id, title, description,
                   priority, due_date, assignee_id,
                   created_by, position, created_at, updated_at
            FROM tasks
            WHERE board_id = ?
              AND (title LIKE ? OR description LIKE ?)
            ORDER BY position, id
        `).all(boardId, `%${search}%`, `%${search}%`);

        return res.json(tasks);

    } catch (error) {
        console.error('Search tasks error:', error);
        return res.status(500).json({
            error: 'Could not search tasks'
        });
    }
});

 // Filter tasks by priority and/or assignee
router.get('/:id/tasks/filter', authenticateToken, (req, res) => {
    try {
        const boardId = Number(req.params.id);
        const { priority, assignee_id, mine } = req.query;

        if (!Number.isInteger(boardId) || boardId <= 0) {
            return res.status(400).json({
                error: 'Invalid board ID'
            });
        }

        if (priority && !['Low', 'Medium', 'High'].includes(priority)) {
            return res.status(400).json({
                error: 'Priority must be Low, Medium or High'
            });
        }

        if (
            assignee_id !== undefined &&
            (!/^\d+$/.test(assignee_id) || Number(assignee_id) <= 0)
        ) {
            return res.status(400).json({
                error: 'Invalid assignee ID'
            });
        }

        if (mine !== undefined && !['true', 'false'].includes(mine)) {
            return res.status(400).json({
                error: 'mine must be true or false'
            });
        }

        const board = db.prepare(`
            SELECT id FROM boards
            WHERE id = ?
            AND (
                owner_id = ?
                OR id IN (
                    SELECT board_id FROM board_members
                    WHERE user_id = ?
                )
            )
        `).get(boardId, req.user.id, req.user.id);

        if (!board) {
            return res.status(404).json({
                error: 'Board not found'
            });
        }

        let sql = `
            SELECT id, column_id, title, description,
                   priority, due_date, assignee_id,
                   created_by, position, created_at, updated_at
            FROM tasks
            WHERE board_id = ?
        `;

        const params = [boardId];

        if (priority) {
            sql += ' AND priority = ?';
            params.push(priority);
        }

        if (assignee_id !== undefined) {
            sql += ' AND assignee_id = ?';
            params.push(Number(assignee_id));
        }

        if (mine === 'true') {
            sql += ' AND assignee_id = ?';
            params.push(req.user.id);
        }

        sql += ' ORDER BY position';

        const tasks = db.prepare(sql).all(...params);

        return res.json(tasks);

    } catch (error) {
        console.error('Filter tasks error:', error);
        return res.status(500).json({
            error: 'Could not filter tasks'
        });
    }
});

 // Get comments for a task
router.get('/:id/tasks/:taskId/comments', authenticateToken, (req, res) => {
    try {
        const boardId = Number(req.params.id);
        const taskId = Number(req.params.taskId);

        if (!Number.isInteger(boardId) || boardId <= 0 ||
            !Number.isInteger(taskId) || taskId <= 0) {
            return res.status(400).json({
                error: 'Invalid board or task ID'
            });
        }

        const task = db.prepare(`
            SELECT t.id
            FROM tasks t
            JOIN boards b ON b.id = t.board_id
            LEFT JOIN board_members bm ON bm.board_id = b.id
            WHERE t.id = ? AND b.id = ?
              AND (b.owner_id = ? OR bm.user_id = ?)
        `).get(taskId, boardId, req.user.id, req.user.id);

        if (!task) {
            return res.status(404).json({
                error: 'Task not found'
            });
        }

        const comments = db.prepare(`
            SELECT c.id, c.content, c.created_at,
                   c.user_id, u.name AS user_name
            FROM comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.task_id = ?
            ORDER BY c.created_at ASC, c.id ASC
        `).all(taskId);

        return res.json(comments);

    } catch (error) {
        console.error('Get comments error:', error);
        return res.status(500).json({
            error: 'Could not retrieve comments'
        });
    }
});

// Add a comment to a task
router.post('/:id/tasks/:taskId/comments', authenticateToken, (req, res) => {
    try {
        const boardId = Number(req.params.id);
        const taskId = Number(req.params.taskId);
        const { content } = req.body;

        if (!Number.isInteger(boardId) || boardId <= 0 ||
            !Number.isInteger(taskId) || taskId <= 0) {
            return res.status(400).json({
                error: 'Invalid board or task ID'
            });
        }

        if (typeof content !== 'string' || !content.trim()) {
            return res.status(400).json({
                error: 'Comment content is required'
            });
        }

        const task = db.prepare(`
            SELECT t.id
            FROM tasks t
            JOIN boards b ON b.id = t.board_id
            LEFT JOIN board_members bm ON bm.board_id = b.id
            WHERE t.id = ? AND b.id = ?
              AND (b.owner_id = ? OR bm.user_id = ?)
        `).get(taskId, boardId, req.user.id, req.user.id);

        if (!task) {
            return res.status(404).json({
                error: 'Task not found'
            });
        }

        const result = db.prepare(`
            INSERT INTO comments (task_id, user_id, content)
            VALUES (?, ?, ?)
        `).run(taskId, req.user.id, content.trim());

        return res.status(201).json({
            message: 'Comment added successfully',
            commentId: result.lastInsertRowid
        });

    } catch (error) {
        console.error('Add comment error:', error);
        return res.status(500).json({
            error: 'Could not add comment'
        });
    }
});

 // Delete a comment as its author or the board owner
router.delete('/:id/tasks/:taskId/comments/:commentId', authenticateToken, (req, res) => {
    try {
        const boardId = Number(req.params.id);
        const taskId = Number(req.params.taskId);
        const commentId = Number(req.params.commentId);

        if (!Number.isInteger(boardId) || boardId <= 0 ||
            !Number.isInteger(taskId) || taskId <= 0 ||
            !Number.isInteger(commentId) || commentId <= 0) {
            return res.status(400).json({
                error: 'Invalid board, task or comment ID'
            });
        }

        const comment = db.prepare(`
            SELECT c.id
            FROM comments c
            JOIN tasks t ON t.id = c.task_id
            JOIN boards b ON b.id = t.board_id
            WHERE c.id = ?
              AND t.id = ?
              AND b.id = ?
              AND (c.user_id = ? OR b.owner_id = ?)
              AND (b.owner_id = ? OR EXISTS (
                  SELECT 1 FROM board_members bm
                  WHERE bm.board_id = b.id
                    AND bm.user_id = ?
              ))
        `).get(
            commentId, taskId, boardId,
            req.user.id, req.user.id, req.user.id, req.user.id
        );

        if (!comment) {
            return res.status(404).json({
                error: 'Comment not found or you are not allowed to delete it'
            });
        }

        db.prepare(`
            DELETE FROM comments
            WHERE id = ?
        `).run(commentId);

        return res.json({
            message: 'Comment deleted successfully',
            commentId
        });

    } catch (error) {
        console.error('Delete comment error:', error);
        return res.status(500).json({
            error: 'Could not delete comment'
        });
    }
});

 // Invite an existing user to a board
router.post('/:id/members', authenticateToken, (req, res) => {
    try {
        const boardId = Number(req.params.id);
        const { email } = req.body;

        if (!Number.isInteger(boardId) || boardId <= 0) {
            return res.status(400).json({
                error: 'Invalid board ID'
            });
        }

        if (typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({
                error: 'User email is required'
            });
        }

        const board = db.prepare(`
            SELECT id FROM boards
            WHERE id = ? AND owner_id = ?
        `).get(boardId, req.user.id);

        if (!board) {
            return res.status(404).json({
                error: 'Board not found or you are not the owner'
            });
        }

        const user = db.prepare(`
            SELECT id, name, email
            FROM users
            WHERE email = ?
        `).get(email.trim().toLowerCase());

        if (!user) {
            return res.status(404).json({
                error: 'No registered user found with that email'
            });
        }

        if (user.id === req.user.id) {
            return res.status(400).json({
                error: 'You are already the board owner'
            });
        }

        const existingMember = db.prepare(`
            SELECT id FROM board_members
            WHERE board_id = ? AND user_id = ?
        `).get(boardId, user.id);

        if (existingMember) {
            return res.status(409).json({
                error: 'User is already a board member'
            });
        }

        db.prepare(`
            INSERT INTO board_members (board_id, user_id, role)
            VALUES (?, ?, 'member')
        `).run(boardId, user.id);

        return res.status(201).json({
            message: 'User added to board successfully',
            member: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: 'member'
            }
        });

    } catch (error) {
        console.error('Invite member error:', error);
        return res.status(500).json({
            error: 'Could not add board member'
        });
    }
});

 // Get all members of a board
router.get('/:id/members', authenticateToken, (req, res) => {
    try {
        const boardId = Number(req.params.id);

        if (!Number.isInteger(boardId) || boardId <= 0) {
            return res.status(400).json({
                error: 'Invalid board ID'
            });
        }

        const board = db.prepare(`
            SELECT id FROM boards
            WHERE id = ?
              AND (
                  owner_id = ?
                  OR id IN (
                      SELECT board_id FROM board_members
                      WHERE user_id = ?
                  )
              )
        `).get(boardId, req.user.id, req.user.id);

        if (!board) {
            return res.status(404).json({
                error: 'Board not found'
            });
        }

        const members = db.prepare(`
            SELECT u.id, u.name, u.email, bm.role
            FROM board_members bm
            JOIN users u ON u.id = bm.user_id
            WHERE bm.board_id = ?
            ORDER BY
                CASE bm.role WHEN 'owner' THEN 0 ELSE 1 END,
                u.name
        `).all(boardId);

        return res.json(members);

    } catch (error) {
        console.error('Get board members error:', error);
        return res.status(500).json({
            error: 'Could not retrieve board members'
        });
    }
});

 // Remove a member from a board
router.delete('/:id/members/:userId', authenticateToken, (req, res) => {
    try {
        const boardId = Number(req.params.id);
        const userId = Number(req.params.userId);

        if (!Number.isInteger(boardId) || boardId <= 0 ||
            !Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({
                error: 'Invalid board or user ID'
            });
        }

        const board = db.prepare(`
            SELECT id FROM boards
            WHERE id = ? AND owner_id = ?
        `).get(boardId, req.user.id);

        if (!board) {
            return res.status(404).json({
                error: 'Board not found or you are not the owner'
            });
        }

        if (userId === req.user.id) {
            return res.status(400).json({
                error: 'The owner cannot remove themselves'
            });
        }

        const member = db.prepare(`
            SELECT id FROM board_members
            WHERE board_id = ? AND user_id = ? AND role = 'member'
        `).get(boardId, userId);

        if (!member) {
            return res.status(404).json({
                error: 'Board member not found'
            });
        }

        db.transaction(() => {
        db.prepare(`
            DELETE FROM board_members
            WHERE board_id = ? AND user_id = ? AND role = 'member'
        `).run(boardId, userId);
        db.prepare('UPDATE tasks SET assignee_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE board_id = ? AND assignee_id = ?').run(boardId, userId);
        })();

        return res.json({
            message: 'Board member removed successfully',
            userId
        });

    } catch (error) {
        console.error('Remove board member error:', error);
        return res.status(500).json({
            error: 'Could not remove board member'
        });
    }
});

router.put('/:id/tasks/:taskId/move', authenticateToken, (req, res) => {
    const boardId = Number(req.params.id);
    const taskId = Number(req.params.taskId);
    const { column_id, position } = req.body;

    if (
        !Number.isInteger(column_id) ||
        !Number.isInteger(position) ||
        position < 0
    ) {
        return res.status(400).json({
            error: 'A valid column_id and non-negative position are required'
        });
    }

    const board = db.prepare(`
        SELECT id FROM boards
        WHERE id = ?
        AND (
            owner_id = ?
            OR id IN (
                SELECT board_id FROM board_members
                WHERE user_id = ?
            )
        )
    `).get(boardId, req.user.id, req.user.id);

    if (!board) {
        return res.status(404).json({
            error: 'Board not found or access denied'
        });
    }

    const task = db.prepare(`
        SELECT id, column_id FROM tasks
        WHERE id = ? AND board_id = ?
    `).get(taskId, boardId);

    if (!task) {
        return res.status(404).json({
            error: 'Task not found'
        });
    }

    const finalColumn = db.prepare(`
        SELECT id FROM columns
        WHERE board_id = ?
        ORDER BY position DESC, id DESC
        LIMIT 1
    `).get(boardId);
    if (finalColumn && task.column_id === finalColumn.id) {
        return res.status(400).json({
            error: 'Tasks in the Done column cannot be moved'
        });
    }

    const column = db.prepare(`
        SELECT id FROM columns
        WHERE id = ? AND board_id = ?
    `).get(column_id, boardId);

    if (!column) {
        return res.status(400).json({
            error: 'Target column does not belong to this board'
        });
    }

    const finalPosition = ordering.move(boardId, taskId, column_id, position);

    return res.json({
        message: 'Task moved successfully',
        taskId,
        column_id,
        position: finalPosition
    });
});

module.exports = router;