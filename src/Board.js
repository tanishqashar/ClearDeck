import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, Avatar, Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Paper, Stack, TextField, Typography } from '@mui/material';
import Column from './Column';
import { api } from './api';
import AppShell from './AppShell';

function columnColor(name, index) {
    const normalized = name.toLowerCase();
    if (normalized === 'to do') return 'todo';
    if (normalized === 'in progress') return 'progress';
    if (normalized === 'done') return 'done';
    return `custom-${index % 4}`;
}

function Board({ board, boards = [], onBack, onSelectBoard, user, onLogout }) {
    const [data, setData] = useState({ board, columns: [], tasks: [] });
    const [members, setMembers] = useState([]);
    const [search, setSearch] = useState('');
    const [priority, setPriority] = useState('');
    const [assignee, setAssignee] = useState('');
    const [columnName, setColumnName] = useState('');
    const [membersOpen, setMembersOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [dragId, setDragId] = useState(null);
    const [createRequest, setCreateRequest] = useState(null);
    const owner = data.board.owner_id === user?.id;
    const root = `/boards/${board.id}`;
    const load = useCallback(async () => {
        const [result, people] = await Promise.all([api(`/boards/${board.id}`), api(`/boards/${board.id}/members`)]);
        setData(result); setMembers(people);
    }, [board.id]);
    useEffect(() => {
        load().catch(err => setError(err.message)).finally(() => setLoading(false));
    }, [load]);
    // Return errors to task editors/quick-add forms; they retain unsaved input.
    const mutate = async (path, method, body) => {
        setBusy(true); setError(''); setNotice('');
        try {
            const result = await api(root + path, { method, body });
            await load(); setNotice('Changes saved.');
            return result;
        } catch (err) { setError(err.message); throw err; }
        finally { setBusy(false); }
    };
    const safely = promise => promise.catch(() => {});
    const addColumn = async e => {
        e.preventDefault();
        try { await mutate('/columns', 'POST', { name: columnName }); setColumnName(''); } catch {}
    };
    const move = async (id, columnId, position) => {
        setDragId(null);
        await mutate(`/tasks/${id}/move`, 'PUT', { column_id: columnId, position });
    };
    const filtered = data.tasks.filter(t =>
        `${t.title} ${t.description || ''}`.toLowerCase().includes(search.toLowerCase()) &&
        (!priority || t.priority === priority) &&
        (!assignee || t.assignee_id === Number(assignee)));
    const filtering = !!(search || priority || assignee);
    const stats = useMemo(() => {
        const byName = name => data.columns.find(column => column.name.trim().toLowerCase() === name)?.id;
        const todoId = byName('to do');
        const progressId = byName('in progress');
        const doneId = data.columns[data.columns.length - 1]?.id;
        const count = id => id == null ? 0 : data.tasks.filter(task => task.column_id === id).length;
        const done = count(doneId);
        return { total: data.tasks.length, todo: count(todoId), progress: count(progressId), done, percent: data.tasks.length ? Math.round((done / data.tasks.length) * 100) : 0 };
    }, [data.columns, data.tasks]);
    const reorder = (index, delta) => {
        const ids = data.columns.map(c => c.id);
        [ids[index], ids[index+delta]] = [ids[index+delta], ids[index]];
        safely(mutate('/columns/reorder', 'PUT', { columnIds: ids }));
    };
    return <AppShell user={user} boards={boards} active="boards" onLogout={onLogout} onNavigate={(target, item) => {
        if (target === 'home' || target === 'boards') onBack();
        if (target === 'board' && item && item.id !== board.id) onSelectBoard?.(item);
    }}>
      <Box className="page-container board-page">
        <Box className="board-heading">
            <Button className="back-button" variant="text" onClick={onBack} aria-label="Back to boards">←</Button>
            <Box className="board-heading-copy">
                <Typography variant="h4" sx={{ overflowWrap: 'anywhere' }}>{data.board.name}</Typography>
                {data.board.description && <Typography color="text.secondary">{data.board.description}</Typography>}
            </Box>
            <Stack className="board-member-controls" direction="row" alignItems="center" spacing={1}>
                <Stack direction="row" className="member-avatars">
                    {members.slice(0, 4).map(m => <Avatar key={m.id} title={m.name}>{m.name.split(/\s+/).map(n => n[0]).join('').slice(0,2)}</Avatar>)}
                    {members.length > 4 && <Avatar className="member-overflow">+{members.length - 4}</Avatar>}
                </Stack>
                <Button variant="outlined" onClick={() => setMembersOpen(true)}>Members · {members.length}</Button>
            </Stack>
        </Box>
        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
        {notice && <Alert severity="success" role="status" sx={{ mb: 2 }}>{notice}</Alert>}
        <Paper className="stats-strip">
            {[['total', stats.total, 'Total Tasks'], ['todo', stats.todo, 'To Do'], ['progress', stats.progress, 'In Progress'], ['done', stats.done, 'Done']].map(([key, value, label]) => (
                <Box className={`stat-item stat-${key}`} key={key}><Typography className="stat-value">{value}</Typography><Typography className="stat-label">{label}</Typography></Box>
            ))}
            <Box className="progress-stat"><Box className="progress-track"><Box className="progress-value" sx={{ width: `${stats.percent}%` }} /></Box><Typography>{stats.percent}% complete</Typography></Box>
        </Paper>
        <Paper className="filter-bar"><Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
            <TextField className="task-search" fullWidth label="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} InputProps={{ startAdornment: <span className="search-glyph" aria-hidden="true">⌕</span> }} />
            <TextField fullWidth select label="Priority" value={priority} onChange={e => setPriority(e.target.value)} slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}>
                <option value="">All priorities</option>{['Low','Medium','High'].map(p => <option key={p}>{p}</option>)}
            </TextField>
            <TextField fullWidth select label="Assignee" value={assignee} onChange={e => setAssignee(e.target.value)} slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}>
                <option value="">All assignees</option>{members.map(m => <option key={m.id} value={m.id}>{m.id === user?.id ? `My tasks (${m.name})` : m.name}</option>)}
            </TextField>
            <Button className="add-task-top-button" variant="contained" disabled={busy || !data.columns.length} onClick={() => setCreateRequest(data.columns[0]?.id)}>+ Add Task</Button>
        </Stack>{filtering && <Button onClick={() => { setSearch(''); setPriority(''); setAssignee(''); }}>Clear filters</Button>}</Paper>
        {filtering && <Typography sx={{ mb: 2 }}>Clear filters to drag and reorder cards. The Move to control still works.</Typography>}
        {loading ? <Typography role="status">Loading board...</Typography> : <Box className="board-columns">
            {data.columns.map((column, index) => <Paper className="kanban-column" data-column-color={columnColor(column.name, index)} key={column.id} sx={{ p: 2, minWidth: 0 }}>
                <Column column={column} createRequest={createRequest} onCreateRequestHandled={() => setCreateRequest(null)} tasks={filtered} allTasks={data.tasks} columns={data.columns} members={members} user={user} boardId={board.id}
                    owner={owner} busy={busy} index={index} lastColumnId={data.columns.at(-1)?.id}
                    onEditTask={(id, values) => mutate(`/tasks/${id}`, 'PUT', values)}
                    onDeleteTask={id => safely(mutate(`/tasks/${id}`, 'DELETE'))}
                    onAddTask={async values => {
                        const { comment, ...taskValues } = values;
                        const created = await mutate('/tasks', 'POST', { ...taskValues, column_id: column.id });
                        if (!comment) return created;
                        try {
                            await api(`${root}/tasks/${created.taskId}/comments`, { method: 'POST', body: { content: comment } });
                            await load();
                            return created;
                        } catch (err) {
                            await load();
                            const failure = new Error(`Task created, but the initial comment could not be saved: ${err.message}`);
                            failure.taskCreated = true;
                            setNotice('');
                            setError(failure.message);
                            throw failure;
                        }
                    }}
                    onRename={() => { const name = window.prompt('Column name', column.name); if (name?.trim()) safely(mutate(`/columns/${column.id}`, 'PUT', { name })); }}
                    onDelete={() => { if (window.confirm(`Delete empty column "${column.name}"? Columns with tasks cannot be deleted.`)) safely(mutate(`/columns/${column.id}`, 'DELETE')); }}
                    onReorder={delta => reorder(index, delta)} onMove={move}
                    dragId={dragId} onDragStart={(e, id) => { e.dataTransfer.setData('text/plain', String(id)); e.dataTransfer.effectAllowed = 'move'; setDragId(id); }}
                    onDragEnd={() => setDragId(null)} dragEnabled={!filtering && !busy} />
            </Paper>)}
            {owner && <Paper component="form" onSubmit={addColumn} className="add-column-card" sx={{ p: 2, minWidth: 0 }}>
                <TextField label="New column" fullWidth required value={columnName} onChange={e => setColumnName(e.target.value)} />
                <Button type="submit" disabled={busy || !columnName.trim()}>Add column</Button>
            </Paper>}
            {!data.columns.length && <Typography>No columns yet. The owner can add a column.</Typography>}
        </Box>}
        <Dialog open={membersOpen} onClose={() => setMembersOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>Board members</DialogTitle><DialogContent>
                {error && <Alert severity="error">{error}</Alert>}
                {members.map(m => <Stack key={m.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1 }}>
                    <Typography>{m.name} ({m.role})</Typography>
                    {owner && m.role !== 'owner' && <Button color="error" disabled={busy} onClick={() => { if (window.confirm(`Remove ${m.name} from this board?`)) safely(mutate(`/members/${m.id}`, 'DELETE')); }}>Remove</Button>}
                </Stack>)}
                {owner && <Box component="form" onSubmit={async e => { e.preventDefault(); try { await mutate('/members', 'POST', { email }); setEmail(''); } catch {} }} sx={{ mt: 2 }}>
                    <TextField label="Existing user email" type="email" fullWidth required value={email} onChange={e => setEmail(e.target.value)} />
                    <Button type="submit" disabled={busy || !email.trim()}>Add member</Button>
                </Box>}
            </DialogContent><DialogActions><Button onClick={() => setMembersOpen(false)}>Close</Button></DialogActions>
        </Dialog>
      </Box>
    </AppShell>;
}
export default Board;
