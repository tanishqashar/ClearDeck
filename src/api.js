// One place for API URLs, JSON errors, and expired sessions.
const base = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
export function clearSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}
export async function api(path, { method = 'GET', body, publicRequest = false } = {}) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${base}${path}`, {
        method,
        headers: {
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...(!publicRequest && token ? { Authorization: `Bearer ${token}` } : {})
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    let data;
    try { data = await response.json(); }
    catch { throw new Error('The server returned an unexpected response. Check the API address.'); }
    if (!publicRequest && response.status === 401) {
        clearSession();
        window.dispatchEvent(new Event('session-expired'));
    }
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
}
