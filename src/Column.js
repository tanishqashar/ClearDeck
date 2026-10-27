import React, { useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import Task from './Task';

const initialValues = { title: '', description: '', priority: 'Medium', due_date: '', assignee_id: '', comment: '' };

function Column({ column, tasks, allTasks, columns, members, user, boardId, owner, busy, index, lastColumnId, createRequest, onCreateRequestHandled,
    onEditTask, onDeleteTask, onAddTask, onRename, onDelete, onReorder, onMove,
    dragId, onDragStart, onDragEnd, dragEnabled }) {
    const [values, setValues] = useState(initialValues);
    const [error, setError] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [quickTitle, setQuickTitle] = useState('');
    const [quickError, setQuickError] = useState('');
    const [quickSaving, setQuickSaving] = useState(false);
    const [over, setOver] = useState(null);
    const columnTasks = tasks.filter(t => t.column_id === column.id).sort((a,b) => a.position-b.position || a.id-b.id);
    const total = allTasks.filter(t => t.column_id === column.id).length;
    const add = async e => {
        e.preventDefault(); setError('');
        if (!values.title.trim()) { setError('Task title is required'); return; }
        setSaving(true);
        try {
            await onAddTask({ ...values, title: values.title.trim(), comment: values.comment.trim(),
                due_date: values.due_date || null,
                assignee_id: values.assignee_id ? Number(values.assignee_id) : null });
            setValues(initialValues);
            setCreateOpen(false);
        }
        catch (err) {
            if (err.taskCreated) {
                setValues(initialValues);
                setCreateOpen(false);
            } else setError(err.message);
        }
        finally { setSaving(false); }
    };
    const openCreate = () => { setError(''); setValues(initialValues); setCreateOpen(true); };
    React.useEffect(() => {
        if (createRequest === column.id) {
            openCreate();
            onCreateRequestHandled?.();
        }
    }, [createRequest, column.id, onCreateRequestHandled]);
    const closeCreate = () => { if (!saving) { setError(''); setCreateOpen(false); } };
    const quickAdd = async e => {
        e.preventDefault();
        const title = quickTitle.trim();
        setQuickError('');
        if (!title) {
            setQuickError('Task title is required');
            return;
        }
        setQuickSaving(true);
        try {
            await onAddTask({
                title,
                description: '',
                priority: 'Medium',
                due_date: null,
                assignee_id: null,
                comment: ''
            });
            setQuickTitle('');
        } catch (err) {
            setQuickError(err.message || 'Could not create task');
        } finally {
            setQuickSaving(false);
        }
    };
    const field = key => ({ value: values[key], onChange: e => setValues({ ...values, [key]: e.target.value }) });
    // Drop before a card, or at the end. Adjust for removal in the same column.
    const drop = async (e, targetIndex) => {
        e.preventDefault(); e.stopPropagation(); setOver(null);
        if (!dragEnabled) return;
        const id = Number(e.dataTransfer.getData('text/plain')) || dragId;
        const source = allTasks.find(t => t.id === id);
        if (!source) return;
        const sourceIndex = columnTasks.findIndex(t => t.id === id);
        const position = sourceIndex >= 0 && sourceIndex < targetIndex ? targetIndex-1 : targetIndex;
        try { await onMove(id, column.id, position); } catch {}
    };
    const dropProps = position => ({
        onDragOver: e => { if (dragEnabled) { e.preventDefault(); e.stopPropagation(); setOver(position); } },
        onDrop: e => drop(e, position)
    });
    return <Box component="section" className="column-content" aria-label={`Column ${column.name}`}>
        <Box className="column-header">
            <Typography variant="h6" className="column-title">{column.name} <Typography component="span" className="column-count">({total})</Typography></Typography>
            {owner && <Stack direction="row" className="column-actions">
                <Button size="small" disabled={busy} onClick={onRename}>Rename</Button>
                <Button size="small" disabled={busy} color="error" onClick={onDelete}>Delete</Button>
                <Button size="small" aria-label={`Move ${column.name} left`} disabled={busy || index === 0} onClick={() => onReorder(-1)}>←</Button>
                <Button size="small" aria-label={`Move ${column.name} right`} disabled={busy || index === columns.length-1} onClick={() => onReorder(1)}>→</Button>
            </Stack>}
        </Box>
        <Box className="column-task-list">
            {columnTasks.map((task, i) => <Box key={task.id} {...dropProps(i)} className="task-drop-target" sx={{ borderTop: over === i ? '4px solid #52745f' : '4px solid transparent' }}>
                <Task task={task} columns={columns} members={members} boardId={boardId} user={user} owner={owner} lastColumnId={lastColumnId}
                    onEdit={values => onEditTask(task.id, values)} onDelete={() => onDeleteTask(task.id)}
                    onMove={task.column_id === lastColumnId ? undefined : async columnId => { try { await onMove(task.id, columnId, allTasks.filter(t => t.column_id === columnId && t.id !== task.id).length); } catch {} }}
                    onDragStart={dragEnabled && task.column_id !== lastColumnId ? e => onDragStart(e, task.id) : undefined} onDragEnd={e => { setOver(null); onDragEnd(e); }} />
            </Box>)}
            <Box {...dropProps(columnTasks.length)} className="column-drop-zone" sx={{ minHeight: 65 }}>
                <Typography>{!columnTasks.length ? (total ? 'No matching tasks' : 'No tasks yet') : 'Drop here to append'}</Typography>
            </Box>
        </Box>
        <Button className="new-task-button" size="small" variant="outlined" fullWidth disabled={busy} onClick={openCreate}>+ New Task</Button>
        <Box component="form" className="quick-add-form" onSubmit={quickAdd} sx={{ mt: 1 }}>
            {quickError && <Alert severity="error" sx={{ mb: 1 }}>{quickError}</Alert>}
            <Stack direction="row" spacing={1}>
                <TextField
                    fullWidth
                    size="small"
                    label="Quick add task"
                    placeholder="Task title"
                    value={quickTitle}
                    onChange={e => { setQuickTitle(e.target.value); if (quickError) setQuickError(''); }}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            quickAdd(e);
                        }
                    }}
                    disabled={quickSaving || busy}
                />
                <Button
                    type="submit"
                    size="small"
                    variant="contained"
                    disabled={quickSaving || busy || !quickTitle.trim()}
                >
                    {quickSaving ? 'Adding...' : 'Add'}
                </Button>
            </Stack>
        </Box>
        <Dialog open={createOpen} onClose={closeCreate} fullWidth maxWidth="sm" aria-labelledby={`create-task-title-${column.id}`}>
            <Box component="form" onSubmit={add}>
                <DialogTitle id={`create-task-title-${column.id}`}>Create task in {column.name}</DialogTitle>
                <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
                    {error && <Alert severity="error">{error}</Alert>}
                    <TextField label="Title" required autoFocus {...field('title')} />
                    <TextField label="Description" multiline minRows={2} {...field('description')} />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField select label="Priority" fullWidth slotProps={{ select: { native: true }, inputLabel: { shrink: true } }} {...field('priority')}>
                            {['Low', 'Medium', 'High'].map(p => <option key={p}>{p}</option>)}
                        </TextField>
                        <TextField label="Due date" type="date" fullWidth inputProps={{ min: new Date().toISOString().slice(0, 10) }} slotProps={{ inputLabel: { shrink: true } }} {...field('due_date')} />
                    </Stack>
                    <TextField select label="Assignee" fullWidth slotProps={{ select: { native: true }, inputLabel: { shrink: true } }} {...field('assignee_id')}>
                        <option value="">Unassigned</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </TextField>
                    <TextField label="Comment" multiline minRows={2} placeholder="Optional initial comment" {...field('comment')} />
                </Stack></DialogContent>
                <DialogActions>
                    <Button type="button" disabled={saving} onClick={closeCreate}>Cancel</Button>
                    <Button variant="contained" type="submit" disabled={saving || !values.title.trim()}>
                        {saving ? 'Creating...' : 'Create Task'}
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    </Box>;
}
export default Column;
