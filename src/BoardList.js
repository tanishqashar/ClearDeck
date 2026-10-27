
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";

import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";

import Board from "./Board";
import { api } from "./api";
import Alert from "@mui/material/Alert";
import AppShell from "./AppShell";

export function getIstGreeting(date = new Date()) {
    const hour = Number(new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false
    }).format(date));
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    return 'Good evening';
}

function istDateKey(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(date);
}

function dateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function displayDateKey(key) {
    const [year, month, day] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' })
        .format(new Date(Date.UTC(year, month - 1, day)));
}

function monthLabel(year, month) {
    return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(Date.UTC(year, month, 1)));
}

function calendarDays(year, month) {
    const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const mondayOffset = (firstDay + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const previousDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return Array.from({ length: 42 }, (_, index) => {
        const dayOffset = index - mondayOffset + 1;
        if (dayOffset < 1) {
            const day = previousDays + dayOffset;
            const previousMonth = month === 0 ? 11 : month - 1;
            const previousYear = month === 0 ? year - 1 : year;
            return { day, key: dateKey(previousYear, previousMonth, day), outside: true };
        }
        if (dayOffset > daysInMonth) {
            const day = dayOffset - daysInMonth;
            const nextMonth = month === 11 ? 0 : month + 1;
            const nextYear = month === 11 ? year + 1 : year;
            return { day, key: dateKey(nextYear, nextMonth, day), outside: true };
        }
        return { day: dayOffset, key: dateKey(year, month, dayOffset), outside: false };
    });
}

function deadlinePriority(task) {
    return task.priority === 'High' ? 'high' : task.priority === 'Medium' ? 'medium' : 'low';
}

function BoardList({ user, onLogout }) {
    const [boards, setBoards] = useState([]);
    const [value, setValue] = useState("");
    const [editIndex, setEditIndex] = useState(null);
    const [selectedBoard, setSelectedBoard] = useState(null);
    const [loading, setLoading] = useState(true);

    const [description, setDescription] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [calendarTasks, setCalendarTasks] = useState([]);
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const today = istDateKey();
        const [year, month] = today.split('-').map(Number);
        return { year, month: month - 1 };
    });
    const [selectedDate, setSelectedDate] = useState(() => istDateKey());
    const createFormRef = useRef(null);
    const sharedBoardsRef = useRef(null);
    const [activeNav, setActiveNav] = useState('boards');
    const [greeting, setGreeting] = useState(() => getIstGreeting());

    const fetchBoards = useCallback(async () => {
        try {
            const boardList = await api('/boards');
            setBoards(boardList);
            const details = await Promise.all(boardList.map(async board => {
                const detail = await api(`/boards/${board.id}`);
                const doneColumnId = detail.columns[detail.columns.length - 1]?.id;
                return detail.tasks
                    .filter(task => task.due_date && task.column_id !== doneColumnId)
                    .map(task => ({ ...task, board_id: board.id, board_name: board.name }));
            }));
            setCalendarTasks(details.flat());
        }
        catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { fetchBoards(); }, [fetchBoards]);
    useEffect(() => {
        const update = () => setGreeting(getIstGreeting());
        const now = new Date();
        const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
        const timer = window.setTimeout(update, Math.max(1000, nextHour.getTime() - now.getTime()));
        return () => window.clearTimeout(timer);
    }, [greeting]);
    const saveBoard = async () => {
        setError('');
        if (!value.trim()) { setError('Please enter a board name'); return; }
        setBusy(true);
        try {
            await api(editIndex === null ? '/boards' : `/boards/${boards[editIndex].id}`, {
                method: editIndex === null ? 'POST' : 'PUT', body: { name: value.trim(), description }
            });
            setValue(''); setDescription(''); setEditIndex(null); await fetchBoards();
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    };
    const handleCreateBoard = saveBoard;
    const handleUpdateBoard = saveBoard;
    const handleDeleteBoard = async board => {
        if (!window.confirm(`Delete "${board.name}" and all its tasks?`)) return;
        setBusy(true); setError('');
        try { await api(`/boards/${board.id}`, { method: 'DELETE' }); setEditIndex(null); setValue(''); setDescription(''); await fetchBoards(); }
        catch (err) { setError(err.message); }
        finally { setBusy(false); }
    };
    const handleEditBoard = index => {
        setEditIndex(index); setValue(boards[index].name); setDescription(boards[index].description || '');
    };
    const ownedBoards = boards.filter(board => board.owner_id === user?.id);
    const sharedBoards = boards.filter(board => board.owner_id !== user?.id);
    const monthCells = useMemo(() => calendarDays(calendarMonth.year, calendarMonth.month), [calendarMonth]);
    const deadlines = useMemo(() => calendarTasks.reduce((groups, task) => {
        (groups[task.due_date] ||= []).push(task);
        return groups;
    }, {}), [calendarTasks]);
    const selectedTasks = deadlines[selectedDate] || [];
    const shiftMonth = amount => setCalendarMonth(current => {
        const next = new Date(Date.UTC(current.year, current.month + amount, 1));
        return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });

    if (selectedBoard !== null) {
        return (
            <Board
                board={selectedBoard}
                boards={boards}
                onSelectBoard={setSelectedBoard}
                user={user}
                onLogout={onLogout}
                onBack={() => { setSelectedBoard(null); fetchBoards(); }}
            />
        );
    }

    return (
        <AppShell user={user} boards={boards} active={activeNav} onLogout={onLogout} onNavigate={(target, board) => {
            if (target === 'board' && board) setSelectedBoard(board);
            if (target === 'boards' || target === 'home') setActiveNav('boards');
            if (target === 'shared') {
                setActiveNav('shared');
                window.setTimeout(() => sharedBoardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
            }
        }}>
            <Box className="page-container">
                <Stack className="home-heading" direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                    <Box>
                        <Typography variant="h3" className="page-title">{greeting}{user?.name ? `, ${user.name}` : ''}</Typography>
                        <Typography className="page-lede">Here's what's happening across your boards today.</Typography>
                    </Box>
                </Stack>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Box className="home-grid">
                    <Box className="home-boards">
                <Paper ref={createFormRef} className="board-create-card" sx={{ padding: "25px", marginBottom: "30px" }}>
                    <Typography
                        variant="h5"
                        sx={{ fontWeight: "bold", marginBottom: "20px" }}
                    >
                        {editIndex === null ? "Create New Board" : "Rename Board"}
                    </Typography>

                    <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={2}
                    >
                        <TextField
                            fullWidth
                            label="Board Name"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                        />

                        <Button
                            disabled={busy}
                            variant="contained"
                            onClick={
                                editIndex === null
                                    ? handleCreateBoard
                                    : handleUpdateBoard
                            }
                            sx={{ minWidth: "150px" }}
                        >
                            {editIndex === null ? "Create Board" : "Update Board"}
                        </Button>

                        {editIndex !== null && (
                            <Button
                                variant="text"
                                onClick={() => {
                                    setEditIndex(null);
                                    setValue(""); setDescription("");
                                }}
                            >
                                Cancel
                            </Button>
                        )}
                    </Stack>
                    <TextField fullWidth label="Board description" multiline value={description} onChange={e => setDescription(e.target.value)} sx={{ mt: 2 }} />
                </Paper>

                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                    <Typography variant="h5">My boards</Typography>
                    <Typography className="muted-caption">{ownedBoards.length} {ownedBoards.length === 1 ? 'board' : 'boards'}</Typography>
                </Stack>

                {loading ? (
                    <Paper sx={{ padding: "40px", textAlign: "center" }}>
                        <Typography>Loading boards...</Typography>
                    </Paper>
                ) : ownedBoards.length === 0 ? (
                    <Paper sx={{ padding: "40px", textAlign: "center" }}>
                        <Typography color="text.secondary">
                            No boards created yet.
                        </Typography>
                    </Paper>
                ) : (
                    <Stack spacing={2}>
                        {ownedBoards.map((board) => {
                            const index = boards.findIndex(item => item.id === board.id);
                            return (
                            <Paper key={board.id} sx={{ padding: "20px" }}>
                                <Stack
                                    direction={{ xs: "column", sm: "row" }}
                                    spacing={2}
                                    alignItems={{ xs: "stretch", sm: "center" }}
                                    justifyContent="space-between"
                                >
                                    <Box>
                                        <Typography
                                            variant="h6"
                                            sx={{ fontWeight: "bold" }}
                                        >
                                            {board.name}
                                        </Typography>

                                        <Typography color="text.secondary">{board.task_count || 0} tasks · {board.owner_id === user?.id ? "Owner" : "Member"}</Typography>
                                        {board.description && (
                                            <Typography
                                                sx={{ color: "text.secondary", marginTop: "4px" }}
                                            >
                                                {board.description}
                                            </Typography>
                                        )}
                                    </Box>

                                    <Stack direction="row" spacing={1}>
                                        <Button
                                            variant="contained"
                                            onClick={() => setSelectedBoard(board)}
                                        >
                                            Open
                                        </Button>

                                        {board.owner_id === user?.id && <><Button
                                            disabled={busy}
                                            variant="outlined"
                                            onClick={() => {
                                                handleEditBoard(index);
                                            }}
                                        >
                                            Rename
                                        </Button>

                                        <Button
                                            variant="outlined"
                                            color="error"
                                            disabled={busy}
                                            onClick={() => handleDeleteBoard(board)}
                                        >
                                            Delete
                                        </Button></>}
                                    </Stack>
                                </Stack>
                            </Paper>
                            );
                        })}
                    </Stack>
                )}
                <Stack ref={sharedBoardsRef} direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 4, mb: 1.5, scrollMarginTop: 24 }}>
                    <Typography variant="h5">Shared with me</Typography>
                    <Typography className="muted-caption">{sharedBoards.length} {sharedBoards.length === 1 ? 'board' : 'boards'}</Typography>
                </Stack>
                {sharedBoards.length === 0 ? <Paper className="shared-empty" sx={{ p: 2.5 }}>
                    <Typography fontWeight={600}>No shared boards yet</Typography>
                    <Typography color="text.secondary">Boards shared with your team will appear here.</Typography>
                </Paper> : <Stack spacing={2}>{sharedBoards.map(board => (
                    <Paper key={board.id} className="shared-board-card" sx={{ p: 2 }}>
                        <Button fullWidth onClick={() => setSelectedBoard(board)} sx={{ justifyContent: 'space-between', textAlign: 'left', color: 'inherit' }}>
                            <Box><Typography fontWeight={650}>{board.name}</Typography><Typography variant="body2" color="text.secondary">{board.description || 'Board shared with your team'}</Typography></Box>
                            <Typography aria-hidden="true">→</Typography>
                        </Button>
                    </Paper>
                ))}</Stack>}
                    </Box>
                    <Paper className="calendar-panel">
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box><Typography variant="h5">Calendar</Typography><Typography variant="body2" color="text.secondary">Task deadlines</Typography></Box>
                            <Typography className="calendar-icon" aria-hidden="true">▣</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" className="calendar-nav">
                            <Button size="small" aria-label="Previous month" onClick={() => shiftMonth(-1)}>‹</Button>
                            <Typography fontWeight={650}>{monthLabel(calendarMonth.year, calendarMonth.month)}</Typography>
                            <Button size="small" aria-label="Next month" onClick={() => shiftMonth(1)}>›</Button>
                        </Stack>
                        <Box className="calendar-grid calendar-weekdays">{['M','T','W','T','F','S','S'].map((day, i) => <Typography key={`${day}-${i}`}>{day}</Typography>)}</Box>
                        <Box className="calendar-grid">
                            {monthCells.map(cell => {
                                const tasks = deadlines[cell.key] || [];
                                return <Button key={cell.key} className={`calendar-day ${cell.outside ? 'outside' : ''} ${cell.key === istDateKey() ? 'today' : ''} ${cell.key === selectedDate ? 'selected' : ''}`} onClick={() => setSelectedDate(cell.key)}>
                                    <span>{cell.day}</span>{tasks.length > 0 && <span className="deadline-dots">{tasks.slice(0, 3).map(task => <i key={task.id} className={`priority-dot ${deadlinePriority(task)}`} />)}{tasks.length > 3 && <b>+{tasks.length - 3}</b>}</span>}
                                </Button>;
                            })}
                        </Box>
                        <Box className="selected-deadlines">
                            <Typography className="selected-date-label">{displayDateKey(selectedDate)}</Typography>
                            {selectedTasks.length ? selectedTasks.map(task => <Button key={`${task.board_id}-${task.id}`} className="deadline-task" onClick={() => setSelectedBoard(boards.find(board => board.id === task.board_id))}>
                                <span className={`priority-dot ${deadlinePriority(task)}`} /><Box><Typography>{task.title}</Typography><Typography variant="caption">{task.priority} · {task.board_name}</Typography></Box>
                            </Button>) : <Typography variant="body2" color="text.secondary">No tasks due on this date.</Typography>}
                        </Box>
                        <Box className="calendar-legend"><Typography><i className="priority-dot high" /> High priority</Typography><Typography><i className="priority-dot medium" /> Medium priority</Typography><Typography><i className="priority-dot low" /> Low priority</Typography></Box>
                    </Paper>
                </Box>
            </Box>
        </AppShell>
    );
}

export default BoardList;
