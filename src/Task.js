import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Typography } from '@mui/material';
import { api } from './api';

function localDateKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function validateDueDate(value) {
    return !value || value >= localDateKey() ? '' : 'Due date cannot be before today';
}

function dueWarning(dueDate, todayKey, completed) {
    if (!dueDate || completed) return null;
    const [year, month, day] = dueDate.split('-').map(Number);
    const due = new Date(year, month - 1, day);
    const today = new Date(Number(todayKey.slice(0, 4)), Number(todayKey.slice(5, 7)) - 1, Number(todayKey.slice(8, 10)));
    const days = Math.round((due - today) / 86400000);
    if (days < 0) return { level: 'overdue', label: 'Overdue' };
    if (days === 0) return { level: 'today', label: 'Due today' };
    if (days <= 3) return { level: 'urgent', label: `Due in ${days} days` };
    if (days <= 7) return { level: 'soon', label: `Due in ${days} days` };
    return null;
}

export function TaskEditor({ task, columns, members, onSave, onClose, boardId, user, owner }) {
    const [values, setValues] = useState({ title: task.title, description: task.description || '',
        priority: task.priority, due_date: task.due_date || '', assignee_id: task.assignee_id || '', column_id: task.column_id });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsError, setCommentsError] = useState('');
    const [content, setContent] = useState('');
    const [dueDateError, setDueDateError] = useState('');
    const url = useMemo(() => `/boards/${boardId}/tasks/${task.id}/comments`, [boardId, task.id]);
    useEffect(() => {
        if (!boardId) return;
        let current = true;
        setComments([]);
        setCommentsError('');
        setCommentsLoading(true);
        api(url).then(result => { if (current) setComments(result); })
            .catch(err => { if (current) setCommentsError(err.message); })
            .finally(() => { if (current) setCommentsLoading(false); });
        return () => { current = false; };
    }, [boardId, task.id, url]);
    const field = key => ({ value: values[key], onChange: e => setValues({ ...values, [key]: e.target.value }) });
    const save = async e => {
        e.preventDefault();
        const dueDateError = validateDueDate(values.due_date);
        if (dueDateError) { setDueDateError(dueDateError); return; }
        setBusy(true); setError('');
        try {
            await onSave({ ...values, title: values.title.trim(), due_date: values.due_date || null,
                assignee_id: values.assignee_id ? Number(values.assignee_id) : null, column_id: Number(values.column_id) });
            onClose();
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    };
    const comment = async (method, id) => {
        setBusy(true); setError('');
        try {
            await api(id ? `${url}/${id}` : url, { method, ...(id ? {} : { body: { content } }) });
            setComments(await api(url)); setContent('');
            setCommentsError('');
        } catch (err) { setCommentsError(err.message); }
        finally { setBusy(false); }
    };
    return <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="task-dialog-title">
        <Box component="form" onSubmit={save}>
            <DialogTitle id="task-dialog-title">Task details</DialogTitle>
            <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
                {error && <Alert severity="error">{error}</Alert>}
                <TextField label="Title" required {...field('title')} />
                <TextField label="Description" multiline rows={3} {...field('description')} />
                <TextField select label="Priority" slotProps={{ select: { native: true }, inputLabel: { shrink: true } }} {...field('priority')}>
                    {['Low', 'Medium', 'High'].map(p => <option key={p}>{p}</option>)}
                </TextField>
                <TextField label="Due date" type="date" inputProps={{ min: localDateKey() }} error={!!dueDateError} helperText={dueDateError} onChange={e => { setDueDateError(''); field('due_date').onChange(e); }} slotProps={{ inputLabel: { shrink: true } }} value={values.due_date} />
                <TextField select label="Assignee" slotProps={{ select: { native: true }, inputLabel: { shrink: true } }} {...field('assignee_id')}>
                    <option value="">Unassigned</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </TextField>
                <TextField select label="Column" slotProps={{ select: { native: true }, inputLabel: { shrink: true } }} {...field('column_id')}>
                    {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </TextField>
                {boardId && <Box>
                    <Typography variant="h6">Comments</Typography>
                    {commentsLoading && <Typography role="status" color="text.secondary">Loading comments...</Typography>}
                    {commentsError && <Alert severity="error">{commentsError}</Alert>}
                    {!commentsLoading && !commentsError && !comments.length && <Typography color="text.secondary">No comments yet.</Typography>}
                    {!commentsLoading && comments.map(c => <Box key={c.id} sx={{ borderBottom: 1, borderColor: 'divider', py: 1 }}>
                        <Typography variant="caption">{c.user_name} · {new Date(c.created_at.replace(' ', 'T') + 'Z').toLocaleString()}</Typography>
                        <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.content}</Typography>
                        {(c.user_id === user?.id || owner) && <Button type="button" disabled={busy} color="error" onClick={() => comment('DELETE', c.id)}>Delete comment</Button>}
                    </Box>)}
                    <TextField fullWidth label="New comment" multiline value={content} onChange={e => setContent(e.target.value)} sx={{ mt: 2 }} />
                    <Button type="button" disabled={busy || !content.trim()} onClick={() => comment('POST')}>Add comment</Button>
                </Box>}
            </Stack></DialogContent>
            <DialogActions><Button type="button" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="contained" type="submit" disabled={busy || !values.title.trim()}>Save task</Button></DialogActions>
        </Box>
    </Dialog>;
}

function TaskComments({ boardId, taskId, user, owner }) {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [content, setContent] = useState('');
    const url = useMemo(() => `/boards/${boardId}/tasks/${taskId}/comments`, [boardId, taskId]);
    const load = useCallback(async () => {
        setLoading(true); setError('');
        try { setComments(await api(url)); }
        catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }, [url]);
    useEffect(() => { load(); }, [load]);
    const comment = async (method, id) => {
        setError('');
        try {
            await api(id ? `${url}/${id}` : url, { method, ...(id ? {} : { body: { content } }) });
            setContent('');
            await load();
        } catch (err) { setError(err.message); }
    };
    return <Box sx={{ mt: 1, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
        <Typography variant="subtitle2">Comments</Typography>
        {loading && <Typography role="status" color="text.secondary">Loading comments...</Typography>}
        {error && <Alert severity="error">{error}</Alert>}
        {!loading && !error && !comments.length && <Typography color="text.secondary">No comments yet.</Typography>}
        {!loading && comments.map(c => <Box key={c.id} sx={{ borderBottom: 1, borderColor: 'divider', py: 0.75 }}>
            <Typography variant="caption">{c.user_name} · {new Date(c.created_at.replace(' ', 'T') + 'Z').toLocaleString()}</Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.content}</Typography>
            {(c.user_id === user?.id || owner) && <Button type="button" size="small" color="error" onClick={() => comment('DELETE', c.id)}>Delete comment</Button>}
        </Box>)}
        <TextField fullWidth size="small" label="New comment" multiline value={content}
            onChange={e => setContent(e.target.value)} sx={{ mt: 1 }} />
        <Button type="button" size="small" disabled={!content.trim()} onClick={() => comment('POST')}>Add comment</Button>
    </Box>;
}

function Task({ task, onEdit, onDelete, columns = [], members = [], boardId, user, owner, lastColumnId, onMove, onDragStart, onDragEnd }) {
    const [editing, setEditing] = useState(false);
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [todayKey, setTodayKey] = useState(localDateKey);
    const assignee = members.find(m => m.id === task.assignee_id);
    useEffect(() => {
        const timer = setInterval(() => setTodayKey(localDateKey()), 60000);
        return () => clearInterval(timer);
    }, []);
    const columnIndex = columns.findIndex(c => c.id === task.column_id);
    const columnName = columns[columnIndex]?.name?.toLowerCase();
    const columnColor = columnName === 'to do' ? 'todo' : columnName === 'in progress' ? 'progress' :
        columnName === 'done' ? 'done' : `custom-${Math.max(columnIndex, 0) % 4}`;
    const warning = dueWarning(task.due_date, todayKey, task.column_id === lastColumnId);
    const completed = task.column_id === lastColumnId;
    return <>
        <Card className="task-card" data-column-color={columnColor} data-priority={task.priority.toLowerCase()}
            draggable={!!onDragStart && !completed} onDragStart={completed ? undefined : onDragStart} onDragEnd={onDragEnd}
            sx={{ mb: 1.5, cursor: 'grab' }}>
            <CardContent>
                {warning && <Box className={`task-due-warning task-due-warning--${warning.level}`} role="img" aria-label={warning.label} title={warning.label}>!</Box>}
                <Typography variant="h6" sx={{ fontSize: '1rem', overflowWrap: 'anywhere' }}>{task.title}</Typography>
                <Chip size="small" label={task.priority} color={{ Low: 'success', Medium: 'warning', High: 'error' }[task.priority]} sx={{ my: 1 }} />
                {task.description && <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{task.description}</Typography>}
                {task.due_date && <Typography color={warning ? 'error' : 'text.secondary'}>Due: {task.due_date}{warning ? ` · ${warning.label}` : ''}</Typography>}
                {assignee && <Typography title={assignee.name}>Assignee: {assignee.name.split(/\s+/).map(n => n[0]).join('').slice(0,2)} · {assignee.name}</Typography>}
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    {!completed && <Button size="small" onClick={() => setEditing(true)}>Edit</Button>}
                    <Button size="small" color="error" onClick={() => { if (window.confirm(`Delete task "${task.title}"?`)) onDelete(); }}>Delete</Button>
                    {boardId && <Button size="small" type="button" onClick={() => setCommentsOpen(open => !open)}>
                        {commentsOpen ? 'Hide comments' : 'View comments'}
                    </Button>}
                </Stack>
                {commentsOpen && <TaskComments boardId={boardId} taskId={task.id} user={user} owner={owner} />}
                {onMove && !completed && <TextField select fullWidth size="small" label="Move to" value={task.column_id} slotProps={{ select: { native: true }, inputLabel: { shrink: true } }} onChange={e => onMove(Number(e.target.value))} sx={{ mt: 1 }}>
                    {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </TextField>}
            </CardContent>
        </Card>
        {editing && !completed && <TaskEditor task={task} columns={columns} members={members} onSave={onEdit} onClose={() => setEditing(false)} boardId={boardId} user={user} owner={owner} />}
    </>;
}
export default Task;
