import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// injects auth token into every request.
// relies on local storage persistence (see AuthContext).
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('nova_sketch_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// global 401 handler. if the session dies, hard redirect to login.
// brutal but effective for now.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('nova_sketch_token');
            localStorage.removeItem('nova_sketch_session');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
