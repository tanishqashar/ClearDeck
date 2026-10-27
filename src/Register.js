import React, { useState } from "react";
import { api } from "./api";
import Alert from "@mui/material/Alert";

import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";

function Register({ onRegister, onLogin }) {

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const handleRegister = async () => {
        setError("");
        if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length < 8) {
            setError("Enter your name, a valid email and a password of at least 8 characters.");
            return;
        }
        setLoading(true);
        try {
            await api('/auth/register', { method: 'POST', publicRequest: true,
                body: { name: name.trim(), email: email.trim(), password } });
            onRegister();
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    return (

        <Box className="auth-page"
            sx={{
                minHeight: "100vh",
                backgroundColor: "#f5f7fa",
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
                    variant="h4" className="auth-title"
                    sx={{
                        fontWeight: "bold",
                        textAlign: "center",
                        marginBottom: "10px"
                    }}
                >
                    Create Account
                </Typography>

                <Typography
                    sx={{
                        textAlign: "center",
                        color: "#666",
                        marginBottom: "25px"
                    }}
                >
                    Register to use the Task Management System
                </Typography>


                <Stack component="form" onSubmit={e => { e.preventDefault(); handleRegister(); } } spacing={2}>
                    {error && <Alert severity="error">{error}</Alert>}

                    <TextField
                        fullWidth
                        label="Name"
                        value={name}
                        onChange={(e) =>
                            setName(e.target.value)
                        }
                    />

                    <TextField
                        fullWidth
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) =>
                            setEmail(e.target.value)
                        }
                    />

                    <TextField
                        fullWidth
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) =>
                            setPassword(e.target.value)
                        }
                    />

                    <Button
                        variant="contained"
                        size="large"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? "Registering..." : "Register"}
                    </Button>

                    <Button
                        variant="text"
                        onClick={onLogin}
                    >
                        Already have an account? Login
                    </Button>

                </Stack>

            </Paper>

        </Box>
    );
}

export default Register;