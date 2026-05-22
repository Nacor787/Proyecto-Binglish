/**
 * Binglish - Inactivity Timeout Module
 * Cierra la sesión automáticamente tras un periodo de inactividad de 15 minutos.
 */

const INACTIVITY_LIMIT_MINUTES = 30;
const INACTIVITY_LIMIT_MS = INACTIVITY_LIMIT_MINUTES * 60 * 1000;
let inactivityTimer;

function resetInactivityTimer() {
    // Si no está autenticado, no hacer nada
    if (typeof isAuthenticated === 'function' && !isAuthenticated()) return;

    // Actualizar el timestamp de última actividad en localStorage (así funciona entre pestañas)
    localStorage.setItem('binglish_last_activity', Date.now().toString());

    // Limpiar timer anterior
    if (inactivityTimer) clearTimeout(inactivityTimer);

    // Configurar nuevo timer
    inactivityTimer = setTimeout(() => {
        checkInactivity();
    }, INACTIVITY_LIMIT_MS);
}

function checkInactivity() {
    if (typeof isAuthenticated === 'function' && !isAuthenticated()) return;

    const lastActivityStr = localStorage.getItem('binglish_last_activity');
    if (lastActivityStr) {
        const lastActivity = parseInt(lastActivityStr, 10);
        const now = Date.now();
        const timeSinceLastActivity = now - lastActivity;

        // Si realmente pasó el tiempo límite
        if (timeSinceLastActivity >= INACTIVITY_LIMIT_MS) {
            handleLogoutDueToInactivity();
        } else {
            // El usuario estuvo activo en otra pestaña, resetear timer local con el tiempo restante
            const remainingTime = INACTIVITY_LIMIT_MS - timeSinceLastActivity;
            inactivityTimer = setTimeout(checkInactivity, remainingTime);
        }
    } else {
        // No hay registro, forzar logout por si acaso
        handleLogoutDueToInactivity();
    }
}

function handleLogoutDueToInactivity() {
    // Limpiar el localStorage para que al recargar la página lo envíe al login
    localStorage.removeItem('binglish_token');
    localStorage.removeItem('binglish_refresh_token');
    localStorage.removeItem('binglish_user');

    // Mostrar alerta usando SweetAlert
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión Expirada',
            text: 'Tu sesión se ha cerrado automáticamente por inactividad.',
            confirmButtonText: 'Aceptar',
            allowOutsideClick: false,
            confirmButtonColor: '#6C63FF'
        }).then(() => {
            window.location.href = '/';
        });
    } else {
        alert('Tu sesión se ha cerrado automáticamente por inactividad.');
        window.location.href = '/';
    }
}

// Inicializar y escuchar eventos de actividad del usuario
function initInactivityTracker() {
    // Si no estamos autenticados al cargar, no hacemos nada (auth.js se encarga de redirigir)
    if (typeof isAuthenticated === 'function' && !isAuthenticated()) return;

    // Inicializar el timer
    resetInactivityTimer();

    // Comprobar la inactividad al cargar la página (importante si el usuario recarga la pestaña después de irse a tomar un café)
    setTimeout(checkInactivity, 500);

    // Eventos que reinician el timer de inactividad
    const activityEvents = [
        'mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'click'
    ];

    // Para no saturar el navegador, usamos un "throttle" para los eventos (solo se registra 1 vez por segundo)
    let throttled = false;
    const throttleDelay = 1000;

    activityEvents.forEach(event => {
        document.addEventListener(event, () => {
            if (!throttled) {
                resetInactivityTimer();
                throttled = true;
                setTimeout(() => { throttled = false; }, throttleDelay);
            }
        }, { passive: true });
    });

    // Escuchar cambios en localStorage para sincronizar la actividad en todas las pestañas abiertas
    window.addEventListener('storage', (e) => {
        if (e.key === 'binglish_last_activity') {
            resetInactivityTimer();
        }
    });
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Damos un pequeño margen para que auth.js se ejecute primero
    setTimeout(initInactivityTracker, 100);
});
