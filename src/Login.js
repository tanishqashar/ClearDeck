
import React, { useState } from "react";
import { api } from "./api";
import Alert from "@mui/material/Alert";

import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import clearDeckMark from "./assets/cleardeck-mark.svg";

function Login({ onLogin, onRegister }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const [error, setError] = useState("");
    const handleLogin = async () => {
        setError("");
        if (!email.trim() || !password) {
            setError("Please enter email and password");
            return;
        }

        try {
            setLoading(true);

            const data = await api('/auth/login', { method: 'POST', publicRequest: true,
                body: { email: email.trim(), password } });

            localStorage.setItem("token", data.token);
            localStorage.setItem(
                "user",
                JSON.stringify(data.user)
            );

            onLogin(data.user);
        } catch (error) {
            setError(error.message || "Cannot connect to the server.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box className="auth-page"
            sx={{
                minHeight: "100vh",
                backgroundColor: "background.default",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "20px"
            }}
        >
            <Paper className="auth-card"
                sx={{
                    padding: "35px",
                    width: "100%",
                    maxWidth: "450px"
                }}
            >
                <Typography
                    component="div"
                    className="auth-brand"
                    aria-label="ClearDeck"
                >
                    <img src={clearDeckMark} alt="" className="auth-brand-mark" />
                    <Typography component="span" className="auth-brand-name">ClearDeck</Typography>
                </Typography>
                <Typography
                    variant="h4" className="auth-title"
                    sx={{
                        fontWeight: "bold",
                        textAlign: "center",
                        marginBottom: "10px"
                    }}
                >
                    Login
                </Typography>

                <Typography
                    sx={{
                        textAlign: "center",
                        color: "text.secondary",
                        marginBottom: "25px"
                    }}
                >
                    Login to your Task Management System
                </Typography>

                <Stack component="form" onSubmit={e => { e.preventDefault(); handleLogin(); } } spacing={2}>
                    {error && <Alert severity="error">{error}</Alert>}
                    <TextField
                        fullWidth
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <TextField
                        fullWidth
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <Button
                        variant="contained"
                        size="large"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? "Logging in..." : "Login"}
                    </Button>

                    <Button
                        variant="text"
                        onClick={onRegister}
                    >
                        Don't have an account? Register
                    </Button>
                </Stack>
            </Paper>
        </Box>
    );
}

export default Login;
