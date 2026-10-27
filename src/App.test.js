import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { api } from './api';
afterEach(() => { localStorage.clear(); jest.restoreAllMocks(); });
test('registration submits to backend before returning to login', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 201, json: async () => ({ userId: 1 }) });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /don't have an account/i }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Student' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Register', exact: true }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/register'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Student', email: 'student@example.test', password: 'Password123!' }) })));
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
});
test('API clears expired session and preserves session on permission denial', async () => {
    localStorage.setItem('token', 'expired');
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Expired' }) });
    await expect(api('/boards')).rejects.toThrow('Expired');
    expect(localStorage.getItem('token')).toBeNull();
    localStorage.setItem('token', 'valid');
    global.fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) });
    await expect(api('/boards')).rejects.toThrow('Forbidden');
    expect(localStorage.getItem('token')).toBe('valid');
});
