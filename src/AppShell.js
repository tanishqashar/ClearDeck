import React from 'react';
import { Avatar, Box, Button, Stack, Typography } from '@mui/material';
import clearDeckMark from './assets/cleardeck-mark.svg';
import { useThemeMode } from './ThemeContext';

function initials(user) {
    return (user?.name || user?.email || 'U')
        .split(/\s+/)
        .map(part => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

function AppShell({ user, boards = [], active, onNavigate, onLogout, children }) {
    const { mode, toggleMode } = useThemeMode();
    return (
        <Box className="app-shell">
            <Box component="aside" className="app-sidebar">
                <Box className="brand-lockup">
                    <img src={clearDeckMark} alt="" className="sidebar-brand-mark" />
                    <Box>
                        <Typography className="brand-name">ClearDeck</Typography>
                    </Box>
                </Box>
                <Box component="nav" aria-label="Main navigation" className="sidebar-nav">
                    <Button className={active === 'home' ? 'sidebar-link active' : 'sidebar-link'} onClick={() => onNavigate?.('home')}>
                        <span aria-hidden="true">⌂</span> Home
                    </Button>
                    <Button className={active === 'boards' ? 'sidebar-link active' : 'sidebar-link'} onClick={() => onNavigate?.('boards')}>
                        <span aria-hidden="true">▦</span> My Boards
                    </Button>
                    <Button className={active === 'shared' ? 'sidebar-link active' : 'sidebar-link'} onClick={() => onNavigate?.('shared')}>
                        <span aria-hidden="true">◇</span> Shared with me
                    </Button>
                </Box>
                <Button className="theme-toggle" onClick={toggleMode} aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
                    <span aria-hidden="true">{mode === 'light' ? '☾' : '☀'}</span>
                    <span className="theme-toggle-label">{mode === 'light' ? 'Dark mode' : 'Light mode'}</span>
                </Button>
                <Typography className="sidebar-section-label">Recent boards</Typography>
                <Stack className="recent-boards" spacing={0.25}>
                    {boards.slice(0, 4).map((board, index) => (
                        <Button key={board.id} className="recent-board" onClick={() => onNavigate?.('board', board)}>
                            <span className={`board-dot dot-${index}`} aria-hidden="true" />{board.name}
                        </Button>
                    ))}
                    {!boards.length && <Typography className="sidebar-empty">No recent boards</Typography>}
                </Stack>
                <Box className="sidebar-account">
                    <Avatar className="account-avatar">{initials(user)}</Avatar>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography className="account-name" noWrap>{user?.name || 'Account'}</Typography>
                        <Typography className="account-email" noWrap>{user?.email || ''}</Typography>
                    </Box>
                    <Button className="logout-button" onClick={onLogout}>Log out</Button>
                </Box>
            </Box>
            <Box component="main" className="app-main">{children}</Box>
        </Box>
    );
}

export default AppShell;
