import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Task, { TaskEditor } from './Task';
import { api } from './api';
jest.mock('./api', () => ({ api: jest.fn() }));
jest.setTimeout(30000);
const task = { id: 9, title: 'Original', description: 'Details', priority: 'Medium', due_date: '2026-11-01', assignee_id: 2, column_id: 3 };
const props = { task, columns: [{ id: 3, name: 'Custom' }, { id: 4, name: 'Done' }], members: [{ id: 2, name: 'Member' }] };
beforeEach(() => {
    api.mockReset();
    api.mockResolvedValue([]);
});
test('editor submits API field names and stays open after failure', async () => {
    const onSave = jest.fn().mockRejectedValueOnce(new Error('Save failed')).mockResolvedValueOnce({});
    const onClose = jest.fn();
    render(<TaskEditor {...props} onSave={onSave} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Edited' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));
    expect(await screen.findByText('Save failed')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith({ title: 'Edited', description: 'Details', priority: 'Medium', due_date: '2026-11-01', assignee_id: 2, column_id: 3 });
    fireEvent.click(screen.getByRole('button', { name: 'Save task' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
});

test('loads, adds, and displays comments for the selected task', async () => {
    api.mockResolvedValueOnce([{ id: 1, user_id: 2, user_name: 'Member', content: 'Existing comment', created_at: '2026-10-27 10:00:00' }])
        .mockResolvedValueOnce({ commentId: 2 })
        .mockResolvedValueOnce([
            { id: 1, user_id: 2, user_name: 'Member', content: 'Existing comment', created_at: '2026-10-27 10:00:00' },
            { id: 2, user_id: 2, user_name: 'Member', content: 'New comment', created_at: '2026-10-27 10:01:00' }
        ]);
    render(<TaskEditor {...props} user={{ id: 2 }} boardId={4} />);

    expect(await screen.findByText('Existing comment')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'New comment' }), { target: { value: 'New comment' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    await waitFor(() => expect(screen.getAllByText('New comment').length).toBeGreaterThanOrEqual(1));
    expect(api).toHaveBeenNthCalledWith(2, '/boards/4/tasks/9/comments', { method: 'POST', body: { content: 'New comment' } });
});

test('shows comment deletion to authors and board owners only', async () => {
    api.mockResolvedValueOnce([
        { id: 1, user_id: 2, user_name: 'Member', content: 'Member comment', created_at: '2026-10-27 10:00:00' },
        { id: 2, user_id: 3, user_name: 'Other', content: 'Other comment', created_at: '2026-10-27 10:01:00' }
    ]);
    const base = { ...props, boardId: 4, task: { ...task, id: 9 } };
    const { rerender } = render(<TaskEditor {...base} user={{ id: 2 }} />);
    await screen.findByText('Member comment');
    expect(screen.getAllByRole('button', { name: 'Delete comment' })).toHaveLength(1);

    rerender(<TaskEditor {...base} user={{ id: 1 }} owner />);
    await screen.findByText('Member comment');
    expect(screen.getAllByRole('button', { name: 'Delete comment' })).toHaveLength(2);

    rerender(<TaskEditor {...base} user={{ id: 3 }} />);
    await screen.findByText('Member comment');
    expect(screen.getAllByRole('button', { name: 'Delete comment' })).toHaveLength(1);
});

test('shows comment loading and API error states', async () => {
    let resolve;
    api.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    render(<TaskEditor {...props} boardId={4} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading comments...');
    resolve([]);
    await waitFor(() => expect(screen.getByText('No comments yet.')).toBeInTheDocument());

    api.mockRejectedValueOnce(new Error('Comments unavailable'));
    render(<TaskEditor {...props} task={{ ...task, id: 10 }} boardId={4} />);
    expect(await screen.findByText('Comments unavailable')).toBeInTheDocument();
});

test('shows independent comments sections on task cards and persists a new comment in the section', async () => {
    api.mockImplementation((path, options) => {
        if (options?.method === 'POST') return Promise.resolve({ commentId: 3 });
        return Promise.resolve(path.endsWith('/1/comments')
            ? [{ id: 1, user_id: 2, user_name: 'Member', content: 'Saved comment', created_at: '2026-10-27 10:00:00' }]
            : []);
    });
    const taskProps = { columns: [], members: [], user: { id: 2 }, boardId: 4, lastColumnId: 1,
        onEdit: jest.fn(), onDelete: jest.fn(), onMove: jest.fn() };
    render(<><Task task={{ ...task, id: 1 }} {...taskProps} /><Task task={{ ...task, id: 2, title: 'Second' }} {...taskProps} /></>);

    const toggles = screen.getAllByRole('button', { name: 'View comments' });
    fireEvent.click(toggles[0]);
    expect(await screen.findByText('Saved comment')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Hide comments' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'View comments' })).toHaveLength(1);

    fireEvent.change(screen.getByRole('textbox', { name: 'New comment' }), { target: { value: 'Another comment' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/boards/4/tasks/1/comments', { method: 'POST', body: { content: 'Another comment' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Hide comments' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'View comments' })[0]);
    expect(await screen.findByText('Saved comment')).toBeInTheDocument();
});

test('uses the current column and priority for card styling and shows a local due warning', () => {
    const today = new Date();
    const dueToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    render(<Task task={{ ...task, priority: 'High', due_date: dueToday, column_id: 3 }}
        columns={[{ id: 3, name: 'To Do' }, { id: 4, name: 'Done' }]} members={[]} boardId={4}
        lastColumnId={4} onEdit={jest.fn()} onDelete={jest.fn()} />);

    const card = document.querySelector('.task-card');
    expect(card).toHaveAttribute('data-column-color', 'todo');
    expect(card).toHaveAttribute('data-priority', 'high');
    expect(screen.getByRole('img', { name: 'Due today' })).toBeInTheDocument();
});

test('does not warn for a completed task in Done', () => {
    const today = new Date();
    const dueToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    render(<Task task={{ ...task, due_date: dueToday, column_id: 4 }}
        columns={[{ id: 3, name: 'To Do' }, { id: 4, name: 'Done' }]} members={[]} boardId={4}
        lastColumnId={4} onEdit={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
