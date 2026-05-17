/**
 * Binglish - Auth Module
 * Manejo de autenticación, sesión y protección de rutas.
 */

/**
 * Inicia sesión con código de usuario y contraseña.
 */
async function login(codigo, password) {
    const data = await apiPost('/auth/login', { codigo, password });
    localStorage.setItem('binglish_token', data.access_token);
    localStorage.setItem('binglish_refresh_token', data.refresh_token);

    // Obtener info del usuario autenticado
    const user = await apiGet('/usuarios/me');
    localStorage.setItem('binglish_user', JSON.stringify(user));
    return user;
}

/**
 * Cierra la sesión, destruye la cookie de refresh y redirige al index.
 */
async function logout() {
    try {
        // Pedirle al backend que destruya la cookie HttpOnly
        await apiPost('/auth/logout', {});
    } catch (e) {
        console.error("Aviso: No se pudo conectar con el servidor para hacer logout", e);
    }

    localStorage.removeItem('binglish_token');
    localStorage.removeItem('binglish_refresh_token'); // Limpieza por si quedó de la versión anterior
    localStorage.removeItem('binglish_user');
    window.location.href = 'index.html';
}

/**
 * Obtiene el usuario actual desde localStorage.
 */
function getCurrentUser() {
    const data = localStorage.getItem('binglish_user');
    return data ? JSON.parse(data) : null;
}

/**
 * Verifica si hay un usuario autenticado.
 */
function isAuthenticated() {
    return !!getToken() && !!getCurrentUser();
}

/**
 * Protege una página: si no hay sesión, muestra una vista de "No autorizado".
 */
function requireAuth() {
    if (!isAuthenticated()) {
        renderUnauthorizedView();
        return false;
    }
    return true;
}

/**
 * Renderiza la pantalla visual de "Acceso no autorizado" sin recargar la página.
 */
function renderUnauthorizedView() {
    // Determinar la ruta relativa dinámica dependiendo de dónde estemos (/pages/ o raíz)
    const inPagesDir = window.location.pathname.includes('/pages/');
    const redirectPath = inPagesDir ? '../401.html' : '401.html';

    // Redirigir al usuario
    window.location.href = redirectPath;
}

/**
 * Verifica si el usuario actual tiene alguno de los roles indicados.
 */
function hasRole(roles) {
    const user = getCurrentUser();
    return user && roles.includes(user.rol);
}

/**
 * Maneja el submit del formulario de login (modal glassmorphism).
 */
function initLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validación Bootstrap
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const rawInput = document.getElementById('loginCodigo').value.trim();
        const prefix = document.getElementById('tipoUsuario').value;
        const password = document.getElementById('loginPassword').value;
        const btnSubmit = form.querySelector('button[type="submit"]');
        const originalText = btnSubmit.innerHTML;

        // Validar que el input sea numérico
        if (!rawInput || !/^\d+$/.test(rawInput)) {
            Swal.fire({
                icon: 'warning',
                title: 'Código inválido',
                text: 'Ingresa solo números en el campo de código.'
            });
            return;
        }

        // Construir el código completo PREFIJO-###
        const codigo = `${prefix}-${rawInput}`;


        try {
            // Mostrar spinner en botón
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Iniciando sesión...';

            const user = await login(codigo, password);

            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
            if (modal) modal.hide();

            // SweetAlert2 - éxito
            await Swal.fire({
                icon: 'success',
                title: '¡Bienvenido!',
                text: `Hola ${user.nombre}, has iniciado sesión correctamente`,
                timer: 2000,
                showConfirmButton: false,
            });

            // Redirigir al dashboard
            window.location.href = 'dashboard.html';

        } catch (error) {
            const detail = error.detail;

            // Caso: usuario bloqueado por rate limiting (429)
            if (error.status === 429 && detail && detail.locked) {
                let remaining = detail.retry_after || 60;

                // Deshabilitar botón con cuenta regresiva
                btnSubmit.disabled = true;
                const countdownInterval = setInterval(() => {
                    remaining--;
                    const mins = Math.floor(remaining / 60);
                    const secs = remaining % 60;
                    const timeStr = mins > 0
                        ? `${mins}:${secs.toString().padStart(2, '0')}`
                        : `${secs}s`;
                    btnSubmit.innerHTML = `<i class="bi bi-lock-fill me-2"></i>Bloqueado (${timeStr})`;

                    if (remaining <= 0) {
                        clearInterval(countdownInterval);
                        btnSubmit.disabled = false;
                        btnSubmit.innerHTML = originalText;
                    }
                }, 1000);

                Swal.fire({
                    icon: 'warning',
                    title: '⛔ Cuenta bloqueada',
                    html: detail.message || 'Demasiados intentos fallidos.'
                });
                return; // No ejecutar finally para mantener el botón bloqueado

                // Caso: credenciales inválidas con intentos restantes (401)
            } else if (detail && detail.attempts_remaining !== undefined) {
                const attemptsLeft = detail.attempts_remaining;
                Swal.fire({
                    icon: 'error',
                    title: 'Credenciales inválidas',
                    html: `${detail.message}<br><br>
                           <span style="color: #ff6b6b; font-weight: 600;">
                           <i class="bi bi-exclamation-triangle-fill"></i> 
                           Te quedan ${attemptsLeft} intento(s)</span>`
                });

                // Caso: error genérico
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error de autenticación',
                    text: error.message || 'Credenciales inválidas'
                });
            }
        } finally {
            // Solo restaurar botón si NO está en modo countdown
            if (!btnSubmit.innerHTML.includes('Bloqueado')) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = originalText;
            }
        }
    });
}

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    initLoginForm();

    // Mostrar/ocultar botón login si ya autenticado
    const btnLoginNav = document.getElementById('btnLoginNav');
    const btnDashNav = document.getElementById('btnDashNav');
    if (isAuthenticated()) {
        if (btnLoginNav) btnLoginNav.style.display = 'none';
        if (btnDashNav) btnDashNav.style.display = 'flex'; // Usar flex para mantener alineación del ícono
    } else {
        if (btnLoginNav) btnLoginNav.style.display = 'flex';
        if (btnDashNav) btnDashNav.style.display = 'none';
    }
});

/**
 * Alterna la visibilidad de la contraseña en el formulario.
 */
function togglePasswordVisibility(inputId, element) {
    const input = document.getElementById(inputId);
    const icon = element.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('bi-eye-fill');
        icon.classList.add('bi-eye-slash-fill');
        element.title = 'Ocultar contraseña';
    } else {
        input.type = 'password';
        icon.classList.remove('bi-eye-slash-fill');
        icon.classList.add('bi-eye-fill');
        element.title = 'Mostrar contraseña';
    }
}
window.togglePasswordVisibility = togglePasswordVisibility;
