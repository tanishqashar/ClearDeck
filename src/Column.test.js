import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Column from './Column';
jest.setTimeout(15000);

const props = {
    column: { id: 1, name: 'To Do' },
    tasks: [],
    allTasks: [],
    columns: [{ id: 1, name: 'To Do' }],
    members: [{ id: 7, name: 'Board member' }],
    user: { id: 1 },
    boardId: 3,
    owner: false,
    busy: false,
    index: 0,
    lastColumnId: 1,
    onEditTask: jest.fn(),
    onDeleteTask: jest.fn(),
    onRename: jest.fn(),
    onDelete: jest.fn(),
    onReorder: jest.fn(),
    onMove: jest.fn(),
    dragId: null,
    onDragStart: jest.fn(),
    onDragEnd: jest.fn(),
    dragEnabled: false
};

test('opens and cancels task creation without submitting', async () => {
    const onAddTask = jest.fn();
    render(<Column {...props} onAddTask={onAddTask} />);

    fireEvent.click(screen.getByRole('button', { name: '+ New Task' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onAddTask).not.toHaveBeenCalled();
});

test('shows a quick-add input in the column and creates a task in that column', async () => {
    const onAddTask = jest.fn().mockResolvedValue({});
    render(<Column {...props} onAddTask={onAddTask} />);

    const input = screen.getByRole('textbox', { name: 'Quick add task' });
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'Quick task' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(onAddTask).toHaveBeenCalledWith({
        title: 'Quick task',
        description: '',
        priority: 'Medium',
        due_date: null,
        assignee_id: null,
        comment: ''
    }));
    await waitFor(() => expect(input).toHaveValue(''));
});

test('quick-add submits with Enter and rejects whitespace-only titles', async () => {
    const onAddTask = jest.fn().mockResolvedValue({});
    render(<Column {...props} onAddTask={onAddTask} />);

    const input = screen.getByRole('textbox', { name: 'Quick add task' });
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(input.closest('form'));
    expect(await screen.findByText('Task title is required')).toBeInTheDocument();
    expect(onAddTask).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'Enter task' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });
    await waitFor(() => expect(onAddTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Enter task' })));
});

test('quick-add preserves the title and shows an API error', async () => {
    const onAddTask = jest.fn().mockRejectedValue(new Error('Could not create task'));
    render(<Column {...props} onAddTask={onAddTask} />);

    const input = screen.getByRole('textbox', { name: 'Quick add task' });
    fireEvent.change(input, { target: { value: 'Retry task' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Could not create task')).toBeInTheDocument();
    expect(input).toHaveValue('Retry task');
});

test('creates a task with all fields', async () => {
    const onAddTask = jest.fn().mockResolvedValue({});
    render(<Column {...props} onAddTask={onAddTask} />);
    fireEvent.click(screen.getByRole('button', { name: '+ New Task' }));

    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Plan release' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Prepare the release notes' } });
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'High' } });
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('Assignee'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'Initial note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Task' }));

    await waitFor(() => expect(onAddTask).toHaveBeenCalledWith({
        title: 'Plan release',
        description: 'Prepare the release notes',
        priority: 'High',
        due_date: '2026-12-01',
        assignee_id: 7,
        comment: 'Initial note'
    }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
});

test('requires a title and keeps values visible after an API error', async () => {
    const onAddTask = jest.fn().mockRejectedValue(new Error('Could not create task'));
    render(<Column {...props} onAddTask={onAddTask} />);
    fireEvent.click(screen.getByRole('button', { name: '+ New Task' }));

    const title = screen.getByLabelText('Title *');
    expect(title).toHaveAttribute('required');
    expect(screen.getByRole('button', { name: 'Create Task' })).toBeDisabled();

    fireEvent.change(title, { target: { value: 'Keep this task' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Keep these details' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Task' }));
    expect(await screen.findByText('Could not create task')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(title).toHaveValue('Keep this task');
    expect(screen.getByLabelText('Description')).toHaveValue('Keep these details');
});

test('disables duplicate submissions while creating', async () => {
    let resolve;
    const onAddTask = jest.fn().mockImplementation(() => new Promise(r => { resolve = r; }));
    render(<Column {...props} onAddTask={onAddTask} />);
    fireEvent.click(screen.getByRole('button', { name: '+ New Task' }));
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'One task' } });
    const create = screen.getByRole('button', { name: 'Create Task' });

    fireEvent.click(create);
    fireEvent.click(create);
    expect(onAddTask).toHaveBeenCalledTimes(1);
    expect(create).toBeDisabled();
    await act(async () => {
        resolve({});
        await new Promise(done => setTimeout(done, 300));
    });
});

test('closes after a task is created when its initial comment fails', async () => {
    const failure = new Error('Task created, but the initial comment could not be saved');
    failure.taskCreated = true;
    const onAddTask = jest.fn().mockRejectedValue(failure);
    render(<Column {...props} onAddTask={onAddTask} />);
    fireEvent.click(screen.getByRole('button', { name: '+ New Task' }));
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Created task' } });
    fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'Initial note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Task' }));
    await waitFor(() => expect(onAddTask).toHaveBeenCalledTimes(1));
});

test('does not show edit or move controls for tasks in the final column', () => {
    render(<Column {...props}
        column={{ id: 2, name: 'Done' }}
        columns={[{ id: 1, name: 'To Do' }, { id: 2, name: 'Done' }]}
        lastColumnId={2}
        tasks={[{ id: 8, column_id: 2, title: 'Finished', priority: 'Medium' }]}
        allTasks={[{ id: 8, column_id: 2, title: 'Finished', priority: 'Medium' }]}
        onAddTask={jest.fn()}
    />);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Move to')).not.toBeInTheDocument();
});
