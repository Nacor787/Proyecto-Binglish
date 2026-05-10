/**
 * Binglish - API Module
 * Módulo centralizado para comunicación con el backend FastAPI.
 */

// Configuración para Cloudflare Tunnel con dominio propio
// En desarrollo local: conecta directo al backend en el puerto 8000.
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Configuración para Cloudflare Tunnel + Nginx
// Nginx en producción se encarga de recibir las peticiones en /apib
const API_BASE = IS_LOCAL ? 'http://localhost:8000/api' : '/api';

/**
 * Obtiene el token JWT almacenado en localStorage.
 */
function getToken() {
    return localStorage.getItem('binglish_token');
}

// Variables globales para manejo centralizado de refresh tokens
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

function handleSessionExpired() {
    if (window.sessionExpiredAlertShown) return;
    window.sessionExpiredAlertShown = true;

    const onLogout = () => {
        if (typeof logout === 'function') {
            logout();
        } else {
            localStorage.removeItem('binglish_token');
            localStorage.removeItem('binglish_refresh_token');
            localStorage.removeItem('binglish_user');
            window.location.href = 'index.html';
        }
    };

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Tu sesión ha expirado, por favor inicia sesión nuevamente.',
            allowOutsideClick: false
        }).then(onLogout);
    } else {
        alert('Tu sesión ha expirado, por favor inicia sesión nuevamente.');
        onLogout();
    }
}

/**
 * Petición fetch autenticada con interceptor global para manejar Refresh Tokens y error 401
 */
async function apiFetch(endpoint, options = {}) {
    const headers = { ...options.headers };

    // Solo agregar Content-Type si no es FormData (el browser lo pone solo con el boundary)
    // y si no se ha especificado ya un Content-Type
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    let token = getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // credentials: 'include' asegura que se envíen las cookies HttpOnly al backend
    const config = { ...options, headers, mode: 'cors', credentials: 'include' };
    let res;

    try {
        res = await fetch(`${API_BASE}${endpoint}`, config);
    } catch (error) {
        if (!navigator.onLine) {
            throw new Error('No hay conexión a Internet. Por favor, revisa tu conexión e inténtalo de nuevo.');
        } else if (error.name === 'TypeError' || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            throw new Error('La conexión es muy lenta o el servidor no responde. Por favor, verifica tu internet e intenta de nuevo.');
        } else {
            throw error;
        }
    }

    // Interceptar el código 401 globalmente
    if (res.status === 401) {
        // Evitar bucles en endpoints de auth
        if (endpoint === '/auth/refresh' || endpoint === '/auth/login' || endpoint === '/auth/logout') {
            return res;
        }

        // Si ya hay un proceso de refresh en curso, encolar la petición actual
        if (isRefreshing) {
            try {
                const newToken = await new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                });
                config.headers['Authorization'] = `Bearer ${newToken}`;
                return await fetch(`${API_BASE}${endpoint}`, config);
            } catch (err) {
                throw err;
            }
        }

        isRefreshing = true;

        try {
            // Intentar renovar token (el navegador enviará la cookie automáticamente gracias a credentials: 'include')
            const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                mode: 'cors'
            });

            if (!refreshRes.ok) throw new Error('Refresh fallido');

            const data = await refreshRes.json();
            localStorage.setItem('binglish_token', data.access_token);

            // Reanudar todas las peticiones fallidas encoladas
            processQueue(null, data.access_token);

            // Reintentar esta petición original
            config.headers['Authorization'] = `Bearer ${data.access_token}`;
            res = await fetch(`${API_BASE}${endpoint}`, config);

        } catch (error) {
            processQueue(error, null);
            handleSessionExpired();
            throw new Error('Sesión expirada');
        } finally {
            isRefreshing = false;
        }
    }

    return res;
}

/**
 * Petición GET genérica.
 */
async function apiGet(endpoint) {
    const res = await apiFetch(endpoint, { method: 'GET' });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Error del servidor' }));
        throw new Error(err.detail || `Error ${res.status}`);
    }
    return res.json();
}

/**
 * Petición GET que retorna un Blob (para descargas de archivos).
 */
async function apiGetBlob(endpoint) {
    const res = await apiFetch(endpoint, { method: 'GET' });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Error del servidor' }));
        throw new Error(err.detail || `Error ${res.status}`);
    }
    return res.blob();
}

/**
 * Petición POST genérica.
 */
async function apiPost(endpoint, body) {
    const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Error del servidor' }));
        const error = new Error(
            typeof err.detail === 'object' ? err.detail.message : (err.detail || `Error ${res.status}`)
        );
        error.status = res.status;
        error.detail = err.detail;
        throw error;
    }
    return res.json();
}

/**
 * Petición PUT genérica.
 */
async function apiPut(endpoint, body) {
    const res = await apiFetch(endpoint, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Error del servidor' }));
        throw new Error(err.detail || `Error ${res.status}`);
    }
    return res.json();
}

/**
 * Petición PATCH genérica.
 */
async function apiPatch(endpoint, body = {}) {
    const res = await apiFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Error del servidor' }));
        throw new Error(err.detail || `Error ${res.status}`);
    }
    return res.json();
}

/**
 * Petición DELETE genérica.
 */
async function apiDelete(endpoint) {
    const res = await apiFetch(endpoint, { method: 'DELETE' });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Error del servidor' }));
        throw new Error(err.detail || `Error ${res.status}`);
    }
    return res.json();
}

/**
 * Petición POST con FormData (multipart). No pone Content-Type para que el browser
 * agregue automáticamente el boundary. Útil para subida de archivos.
 */
async function apiPostFormData(endpoint, formData) {
    const res = await apiFetch(endpoint, {
        method: 'POST',
        body: formData,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Error del servidor' }));
        throw new Error(err.detail || `Error ${res.status}`);
    }
    return res.json();
}

/**
 * Petición POST pública (sin token), útil para contacto.
 */
async function apiPostPublic(endpoint, body) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Error del servidor' }));
        throw new Error(err.detail || `Error ${res.status}`);
    }
    return res.json();
}

/**
 * Descarga un archivo blob y lo guarda con el nombre indicado.
 */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
