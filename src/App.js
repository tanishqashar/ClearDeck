
import React, { useState, useEffect } from "react";

import Login from "./Login";
import Register from "./Register";
import BoardList from "./BoardList";
import { clearSession } from "./api";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

const theme = createTheme({
    palette: {
        primary: { main: '#52745F', dark: '#3F5D4B', contrastText: '#FFFFFF' },
        secondary: { main: '#E5EDE4' },
        background: { default: '#F6F6F1', paper: '#FFFFFF' },
        text: { primary: '#252B28', secondary: '#727A74' },
        divider: '#DFE3DA',
        error: { main: '#B85C5C' },
        warning: { main: '#B5822F' }
    },
    typography: {
        fontFamily: '"Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
        h3: { fontWeight: 700, letterSpacing: '-0.035em' },
        h4: { fontWeight: 700, letterSpacing: '-0.03em' },
        h5: { fontWeight: 700, letterSpacing: '-0.02em' },
        h6: { fontWeight: 650, letterSpacing: '-0.01em' },
        button: { textTransform: 'none', fontWeight: 600 }
    },
    shape: { borderRadius: 10 },
    components: {
        MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', border: '1px solid #DFE3DA', boxShadow: '0 4px 18px rgba(37, 43, 40, 0.045)' } } },
        MuiButton: { styleOverrides: { root: { borderRadius: 8, minHeight: 36, boxShadow: 'none' } } },
        MuiTextField: { defaultProps: { size: 'small' } },
        MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8 } } },
        MuiDialog: { styleOverrides: { paper: { border: '1px solid #DFE3DA', boxShadow: '0 18px 50px rgba(37, 43, 40, 0.16)' } } }
    }
});

function App() {
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem("user");
        try { return savedUser ? JSON.parse(savedUser) : null; }
        catch { clearSession(); return null; }
    });

    const [loggedIn, setLoggedIn] = useState(() => {
        return Boolean(localStorage.getItem("token"));
    });

    const [showRegister, setShowRegister] = useState(false);

    const handleRegister = () => {
        setUser(null);
        setShowRegister(false);
    };

    const handleLogin = (loggedInUser) => {
        setUser(loggedInUser);
        setLoggedIn(true);
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
        setLoggedIn(false);
        setShowRegister(false);
    };

    useEffect(() => {
        window.addEventListener('session-expired', handleLogout);
        return () => window.removeEventListener('session-expired', handleLogout);
    }, []);

    return <ThemeProvider theme={theme}>
        <CssBaseline />
        {loggedIn ? <BoardList user={user} onLogout={handleLogout} /> :
            showRegister ? <Register onRegister={handleRegister} onLogin={() => setShowRegister(false)} /> :
            <Login onLogin={handleLogin} onRegister={() => setShowRegister(true)} />}
    </ThemeProvider>;
}

export default App;
