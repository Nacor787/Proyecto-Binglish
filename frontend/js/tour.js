/**
 * Binglish - Onboarding Tour Module (Driver.js)
 * Tour interactivo para Docentes y Estudiantes.
 */

function getDocenteTourSteps() {
    return [
        {
            element: '#sidebarUserCard',
            popover: {
                title: '👋 ¡Bienvenido, Docente!',
                description: 'Este es tu perfil. Aquí puedes ver tu nombre, rol y avatar dentro de la plataforma Binglish.',
                side: 'right',
                align: 'start',
            }
        },
        {
            element: '#contentArea',
            popover: {
                title: '🏠 Panel de Inicio',
                description: 'Tu dashboard principal muestra un resumen de tus cursos asignados y las notas que has registrado. También encontrarás atajos rápidos.',
                side: 'top',
                align: 'center',
            }
        },
        {
            element: '[data-section="cursos"]',
            popover: {
                title: '📚 Mis Cursos',
                description: 'Aquí verás únicamente los cursos que el administrador te ha asignado. Puedes consultar horarios, niveles y modalidades.',
                side: 'right',
                align: 'start',
            }
        },
        {
            element: '[data-section="notas"]',
            popover: {
                title: '📝 Gestión de Notas',
                description: 'Registra calificaciones por estudiante con el sistema de Report Card (Reading, Writing, Speaking, Listening, etc.). Solo verás notas de tus propios cursos.',
                side: 'right',
                align: 'start',
            }
        },
        {
            element: '[data-section="biblioteca"]',
            popover: {
                title: '📖 Biblioteca Virtual',
                description: 'Accede a recursos educativos como PDFs, guías y materiales de apoyo para tus clases.',
                side: 'right',
                align: 'start',
            }
        },
        {
            element: '#btnNotifBell',
            popover: {
                title: '🔔 Notificaciones',
                description: 'Aquí recibirás avisos importantes del administrador y mensajes del sistema.',
                side: 'bottom',
                align: 'end',
            }
        },
        {
            element: '#btnLogout',
            popover: {
                title: '🚪 Cerrar Sesión',
                description: 'Cuando termines, cierra tu sesión de forma segura desde este botón.',
                side: 'right',
                align: 'end',
            }
        },
    ];
}

function getEstudianteTourSteps(user) {
    return [
        {
            element: '#sidebarUserCard',
            popover: {
                title: '👋 ¡Bienvenido, Estudiante!',
                description: `Este es tu perfil dentro de la plataforma Binglish. Tu código de acceso es <strong style="color:#00c6ff">${user.codigo}</strong>. Guárdalo, lo necesitarás siempre para ingresar.`,
                side: 'right',
                align: 'start',
            }
        },
        {
            element: '#contentArea',
            popover: {
                title: '🏠 Tu Panel Principal',
                description: 'Desde aquí puedes ver un resumen de tus calificaciones, acceder a la biblioteca y revisar tus pagos con un solo clic.',
                side: 'top',
                align: 'center',
            }
        },
        {
            element: '[data-section="mis-notas"]',
            popover: {
                title: '📝 Mis Notas',
                description: 'Consulta todas tus calificaciones registradas por tus docentes. También puedes descargar tu Report Card en PDF.',
                side: 'right',
                align: 'start',
            }
        },
        {
            element: '[data-section="mis-pagos"]',
            popover: {
                title: '💳 Mis Pagos',
                description: 'Revisa el estado de tus mensualidades. Aquí podrás ver si tienes pagos pendientes o si estás al día.',
                side: 'right',
                align: 'start',
            }
        },
        {
            element: '[data-section="biblioteca"]',
            popover: {
                title: '📖 Biblioteca Virtual',
                description: 'Explora los recursos educativos disponibles: PDFs, guías de estudio y materiales complementarios.',
                side: 'right',
                align: 'start',
            }
        },
        {
            element: '#btnNotifBell',
            popover: {
                title: '🔔 Notificaciones',
                description: 'Recibe avisos importantes de la administración y alertas del sistema directamente aquí.',
                side: 'bottom',
                align: 'end',
            }
        },
        {
            element: '#btnLogout',
            popover: {
                title: '🚪 Cerrar Sesión',
                description: 'No olvides cerrar tu sesión cuando termines de usar la plataforma.',
                side: 'right',
                align: 'end',
            }
        },
    ];
}

/**
 * Inicia el tour de onboarding usando Driver.js
 */
function startOnboardingTour() {
    if (typeof driver === 'undefined') {
        console.warn('Driver.js no está disponible.');
        return;
    }

    const user = getCurrentUser();
    if (!user) return;

    let steps = [];
    if (user.rol === 'docente') {
        steps = getDocenteTourSteps();
    } else if (user.rol === 'estudiante') {
        steps = getEstudianteTourSteps(user);
    } else {
        return; // Admin no necesita tour
    }

    // Filtrar pasos cuyos elementos no existen en el DOM actualmente
    steps = steps.filter(s => document.querySelector(s.element));

    if (steps.length === 0) return;

    const totalSteps = steps.length;

    const driverObj = driver.js.driver({
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        nextBtnText: 'Siguiente →',
        prevBtnText: '← Anterior',
        doneBtnText: '✓ Finalizar',
        progressText: '{{current}} de {{total}}',
        allowClose: false,
        disableActiveInteraction: true,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        stagePadding: 8,
        stageRadius: 12,
        animate: true,
        smoothScroll: true,
        onPopoverRender: (popover, { config, state }) => {
            // Inject custom progress bar at the top of the popover
            const currentIdx = state.activeIndex + 1;
            const pct = Math.round((currentIdx / totalSteps) * 100);

            const progressEl = document.createElement('div');
            progressEl.className = 'tour-progress-bar';
            progressEl.innerHTML = `<div class="tour-progress-bar-fill" style="width: ${pct}%"></div>`;

            // Insert at the very top of the popover wrapper
            const wrapper = popover.wrapper;
            if (wrapper && wrapper.firstChild) {
                wrapper.insertBefore(progressEl, wrapper.firstChild);
            }

            // Custom Close Button (X) - since allowClose: false hides the native one
            let closeBtn = wrapper.querySelector('.custom-tour-close-btn');
            if (!closeBtn) {
                closeBtn = document.createElement('button');
                closeBtn.className = 'custom-tour-close-btn';
                closeBtn.innerHTML = '&times;';
                closeBtn.style.cssText = 'position: absolute; top: 12px; right: 16px; background: transparent; border: none; color: rgba(255,255,255,0.6); font-size: 24px; cursor: pointer; z-index: 10; padding: 0; line-height: 1; outline: none; font-family: sans-serif;';
                closeBtn.onmouseover = () => closeBtn.style.color = '#ff4d4f';
                closeBtn.onmouseout = () => closeBtn.style.color = 'rgba(255,255,255,0.6)';
                closeBtn.onclick = () => driverObj.destroy();
                wrapper.appendChild(closeBtn);
            }
        },
        onDestroyStarted: () => {
            driverObj.destroy();
        },
        steps: steps,
    });

    // Small delay to let the dashboard finish rendering
    setTimeout(() => {
        driverObj.drive();
    }, 800);
}

/**
 * Verifica si es la primera sesión del usuario y lanza el tour automáticamente.
 * Se guarda en localStorage con una key única por user ID.
 */
function checkAndLaunchTour() {
    const user = getCurrentUser();
    if (!user || user.rol === 'admin') return;

    const tourKey = `binglish_tour_done_${user.id}`;
    if (!localStorage.getItem(tourKey)) {
        startOnboardingTour();
        localStorage.setItem(tourKey, 'true');
    }
}

// Exponer globalmente para poder relanzar el tour manualmente
window.startOnboardingTour = startOnboardingTour;
