/**
 * Binglish - Dashboard Module
 * Controla toda la lógica del dashboard: sidebar, routing, CRUD de módulos.
 */

// Configuración global de SweetAlert2 Toast
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Proteger página
    if (!requireAuth()) return;

    const user = getCurrentUser();
    initSidebar(user);
    initTopbar();
    // Cargar sección por defecto al iniciar
    loadSection('inicio');

    // ★ Fix: Mover modales dinámicos al body para que el backdrop cubra toda la pantalla
    document.addEventListener('show.bs.modal', function (e) {
        const modal = e.target;
        if (modal.closest('.main-content')) {
            document.body.appendChild(modal);
        }
    });
});

/* ==========================================================
   SIDEBAR
   ========================================================== */

function initSidebar(user) {
    const sidebar = document.getElementById('sidebar');
    const userName = document.getElementById('sidebarUserName');
    const userRole = document.getElementById('sidebarUserRole');
    const avatar = document.getElementById('sidebarAvatar');

    // ── User Card: nombre, rol, avatar con iniciales ──
    if (userName) userName.innerHTML = `${user.nombre}<br><span style="font-size: 0.9em;">${user.apellido}</span>`;
    if (userRole) userRole.textContent = user.rol.toUpperCase();
    const userCode = document.getElementById('sidebarUserCode');
    if (userCode && user.codigo) userCode.textContent = user.codigo;
    if (avatar) {
        const initials = `${(user.nombre || '')[0] || ''}${(user.apellido || '')[0] || ''}`.toUpperCase();
        avatar.textContent = initials || '?';
    }

    // ── Generar menú agrupado según rol ──
    const navContainer = document.getElementById('sidebarNav');
    const menuSections = getMenuForRole(user.rol);

    let navHTML = '';
    menuSections.forEach(section => {
        // Etiqueta de sección
        navHTML += `<li class="sidebar-section-label">${section.label}</li>`;
        // Items de la sección
        section.items.forEach(item => {
            const isActive = item.id === 'inicio';
            navHTML += `
                <li class="nav-item">
                    <a class="nav-link ${isActive ? 'active' : ''}" href="#" data-section="${item.id}" title="${item.label}">
                        <span class="nav-emoji">${item.emoji}</span>
                        <span class="nav-text">${item.label}</span>
                        ${(item.id === 'mensajes' || item.id === 'mis-mensajes') ? '<span class="badge bg-danger rounded-pill ms-auto nav-badge" id="badgeMensajes" style="display:none;">0</span>' : ''}
                    </a>
                </li>
            `;
        });
    });
    navContainer.innerHTML = navHTML;

    // ── Event listeners: navegación ──
    navContainer.querySelectorAll('.nav-link[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navContainer.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            loadSection(link.dataset.section);

            // Cerrar sidebar en mobile
            if (window.innerWidth < 992) {
                sidebar.classList.remove('show');
            }
        });
    });

    // ── Tour button (solo docente/estudiante) ──
    const tourContainer = document.getElementById('tourBtnContainer');
    if (tourContainer && (user.rol === 'docente' || user.rol === 'estudiante')) {
        tourContainer.innerHTML = `
            <button class="sidebar-logout-btn mb-2" onclick="startOnboardingTour()" title="Repetir Tour" style="opacity: 0.7;">
                <span><i class="bi bi-signpost-split text-info"></i></span>
                <span class="nav-text">Repetir Tour</span>
            </button>`;
    }

    // ── Logout (footer button) ──
    document.getElementById('btnLogout').addEventListener('click', (e) => {
        e.preventDefault();
        Swal.fire({
            title: '¿Cerrar sesión?',
            text: 'Se cerrará tu sesión actual',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#6C63FF',
            cancelButtonColor: '#aaa',
            confirmButtonText: 'Sí, salir',
            cancelButtonText: 'Cancelar',
        }).then(result => {
            if (result.isConfirmed) logout();
        });
    });

    // Cargar badge de mensajes
    loadMensajesBadge();
    // Actualizar badge cada 30 segundos
    setInterval(loadMensajesBadge, 30000);

    // "Ver todos los avisos" → navegar a la sección de mensajes
    const btnVerTodos = document.getElementById('btnVerTodosAvisos');
    if (btnVerTodos) {
        btnVerTodos.addEventListener('click', (e) => {
            e.preventDefault();
            // Cerrar el dropdown
            const dropdown = bootstrap.Dropdown.getOrCreateInstance(document.getElementById('btnNotifBell'));
            dropdown.hide();
            // Navegar a la sección correspondiente según rol
            const seccion = hasRole(['admin', 'docente']) ? 'mensajes' : 'mis-mensajes';
            loadSection(seccion);
        });
    }
}

async function loadMensajesBadge() {
    try {
        const data = await apiGet('/mensajes/conteo');

        // ── Badge del sidebar ──
        const badge = document.getElementById('badgeMensajes');
        if (badge) {
            if (data.no_leidos === 0) {
                badge.style.display = 'none';
            } else {
                badge.style.display = 'inline-block';
                badge.textContent = data.no_leidos > 99 ? '99+' : data.no_leidos;
                badge.className = 'badge bg-danger rounded-pill ms-auto badge-pulse';
            }
        }

        // ── Badge de la campana (topbar) ──
        const bellBadge = document.getElementById('badgeNotifBell');
        if (bellBadge) {
            if (data.no_leidos === 0) {
                bellBadge.style.display = 'none';
            } else {
                bellBadge.style.display = 'inline-block';
                bellBadge.textContent = data.no_leidos > 99 ? '99+' : data.no_leidos;
            }
        }

        // ── Contador en el header del dropdown ──
        const countLabel = document.getElementById('notifCountLabel');
        if (countLabel) countLabel.textContent = data.no_leidos;

        // Cargar mensajes en el dropdown
        loadNotifDropdown();
    } catch (e) {
        // Silenciar error si no hay permisos
    }
}

/** Carga los últimos mensajes reales en el dropdown de la campana */
async function loadNotifDropdown() {
    const list = document.getElementById('notifDropdownList');
    if (!list) return;

    try {
        // Estudiante usa /mis-mensajes, Admin/Docente usa /mensajes/
        const endpoint = hasRole(['admin', 'docente']) ? '/mensajes/' : '/mensajes/mis-mensajes';
        const mensajes = await apiGet(endpoint);

        if (mensajes.length === 0) {
            list.innerHTML = `
                <div class="text-center py-4 text-muted small">
                    <i class="bi bi-inbox fs-4 d-block mb-1"></i>
                    Sin notificaciones
                </div>`;
            return;
        }

        // Mostrar últimos 5 mensajes en el dropdown
        const recientes = mensajes.slice(0, 5);
        list.innerHTML = recientes.map(m => `
            <div class="notif-item d-flex align-items-start px-3 py-2 border-bottom ${m.leido ? '' : (!m.destinatario_id ? 'bg-warning bg-opacity-10' : 'bg-primary bg-opacity-10')}" style="cursor: pointer;" onclick="document.getElementById('btnVerTodosAvisos').click()">
                <div class="notif-icon-wrapper me-2 mt-1">
                    <i class="bi ${m.destinatario_id ? 'bi-person-fill' : 'bi-megaphone-fill'}"></i>
                </div>
                <div class="flex-grow-1 overflow-hidden">
                    <div class="fw-600 small text-truncate">${m.titulo}</div>
                    <div class="text-muted small text-truncate">${m.contenido}</div>
                    <div class="text-muted" style="font-size: 0.7rem;">${m.created_at ? timeAgo(m.created_at) : ''}</div>
                </div>
                ${!m.destinatario_id
                ? '<span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 ms-1" style="font-size:0.7rem; align-self:center;">General</span>'
                : '<span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 ms-1" style="font-size:0.7rem; align-self:center;">Admin</span>'}
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = `<div class="text-center py-3 text-muted small">Error al cargar</div>`;
    }
}

/** Convierte una fecha ISO a texto relativo ("Hace 2h", "Hace 3d", etc.) */
function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffSeg = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSeg / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDias = Math.floor(diffHr / 24);

    if (diffSeg < 60) return 'Justo ahora';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    if (diffHr < 24) return `Hace ${diffHr}h`;
    if (diffDias < 7) return `Hace ${diffDias}d`;
    return date.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' });
}

function getMenuForRole(rol) {
    if (rol === 'admin') {
        return [
            {
                label: 'PRINCIPAL',
                items: [
                    { id: 'inicio', emoji: '🏠', label: 'Inicio' },
                    { id: 'usuarios', emoji: '👥', label: 'Usuarios' },
                ]
            },
            {
                label: 'ACADÉMICO',
                items: [
                    { id: 'cursos', emoji: '📚', label: 'Cursos' },
                    { id: 'asignaciones', emoji: '👥', label: 'Asignaciones' },
                    { id: 'notas', emoji: '📝', label: 'Notas' },
                    { id: 'biblioteca', emoji: '📖', label: 'Biblioteca' },
                ]
            },
            {
                label: 'ADMINISTRACIÓN',
                items: [
                    { id: 'pagos', emoji: '💳', label: 'Pagos' },
                    { id: 'reportes', emoji: '📊', label: 'Reportes' },
                    { id: 'backups', emoji: '💾', label: 'Backups' },
                ]
            },
        ];
    } else if (rol === 'docente') {
        return [
            {
                label: 'PRINCIPAL',
                items: [
                    { id: 'inicio', emoji: '🏠', label: 'Inicio' },
                ]
            },
            {
                label: 'ACADÉMICO',
                items: [
                    { id: 'cursos', emoji: '📚', label: 'Mis Cursos' },
                    { id: 'notas', emoji: '📝', label: 'Notas' },
                    { id: 'biblioteca', emoji: '📖', label: 'Biblioteca' },
                ]
            },
        ];
    } else {
        return [
            {
                label: 'PRINCIPAL',
                items: [
                    { id: 'inicio', emoji: '🏠', label: 'Inicio' },
                ]
            },
            {
                label: 'MI CUENTA',
                items: [
                    { id: 'mis-notas', emoji: '📝', label: 'Mis Notas' },
                    { id: 'mis-pagos', emoji: '💳', label: 'Mis Pagos' },
                    { id: 'biblioteca', emoji: '📖', label: 'Biblioteca' },
                ]
            },
        ];
    }
}

/* ==========================================================
   TOPBAR
   ========================================================== */

function initTopbar() {
    const btnToggle = document.getElementById('btnToggleSidebar');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');

    if (btnToggle) {
        btnToggle.addEventListener('click', () => {
            if (window.innerWidth >= 992) {
                sidebar.classList.toggle('collapsed');
                mainContent.classList.toggle('expanded');
            } else {
                sidebar.classList.toggle('show');
            }
        });
    }
}

/* ==========================================================
   SECTION LOADER (SPA-like routing)
   ========================================================== */

function loadSection(section) {
    const content = document.getElementById('contentArea');
    const topTitle = document.getElementById('topbarTitle');

    const titles = {
        'inicio': 'Dashboard',
        'usuarios': 'Gestión de Usuarios',
        'cursos': 'Centro Académico',
        'notas': 'Gestión de Notas',
        'mensajes': 'Mensajes / Avisos',
        'reportes': 'Reportes',
        'mis-notas': 'Mis Notas',
        'mis-mensajes': 'Mis Mensajes',
        'mis-pagos': 'Mis Pagos',
        'pagos': 'Gestión de Pagos',
        'backups': 'Backups',
        'biblioteca': 'Biblioteca Virtual',
        'asignaciones': 'Gestión de Asignaciones',
    };

    if (topTitle) topTitle.textContent = titles[section] || 'Dashboard';

    switch (section) {
        case 'inicio': renderInicio(content); break;
        case 'usuarios': renderUsuarios(content); break;
        case 'cursos': renderCursos(content); break;
        case 'notas': renderNotas(content); break;
        case 'mensajes': renderMensajes(content); break;
        case 'reportes': renderReportes(content); break;
        case 'mis-notas': renderMisNotas(content); break;
        case 'mis-mensajes': renderMisMensajes(content); break;
        case 'backups': renderBackups(content); break;
        case 'pagos': renderPagos(content); break;
        case 'mis-pagos': renderMisPagos(content); break;
        case 'biblioteca': renderBiblioteca(content); break;
        case 'asignaciones': renderAsignaciones(content); break;
        default: renderInicio(content);
    }
}

/* ==========================================================
   INICIO / HOME
   ========================================================== */

async function renderInicio(container) {
    const user = getCurrentUser();
    container.innerHTML = `
        <div class="row g-3 mb-4">
            <div class="col-12">
                <div class="dash-stat-card purple" style="border-left: 4px solid var(--primary);">
                    <h4 class="mb-1">¡Welcome ${user.nombre}! 👋</h4>
                    <p class="text-muted mb-0">Bienvenid@ a la plataforma de Binglish</p>
                </div>
            </div>
        </div>
        <div class="row g-3" id="statsCards">
            <div class="col-12 text-center py-4">
                <div class="spinner-border text-primary" role="status"></div>
            </div>
        </div>
    `;

    try {
        let cardsHTML = '';

        if (user.rol === 'admin') {
            const [usuarios, cursos, notas] = await Promise.all([
                apiGet('/usuarios/'),
                apiGet('/cursos/'),
                apiGet('/notas/'),
            ]);
            cardsHTML = `
                <div class="col-md-4">
                    <div class="dash-stat-card purple">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="dash-stat-value">${usuarios.length}</div>
                                <div class="dash-stat-label">Usuarios</div>
                            </div>
                            <div class="dash-stat-icon purple"><i class="bi bi-people-fill"></i></div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="dash-stat-card green">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="dash-stat-value">${cursos.length}</div>
                                <div class="dash-stat-label">Cursos</div>
                            </div>
                            <div class="dash-stat-icon green"><i class="bi bi-book-fill"></i></div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="dash-stat-card pink">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="dash-stat-value">${notas.length}</div>
                                <div class="dash-stat-label">Notas Registradas</div>
                            </div>
                            <div class="dash-stat-icon pink"><i class="bi bi-clipboard-data-fill"></i></div>
                        </div>
                    </div>
                </div>
            `;
        } else if (user.rol === 'docente') {
            const [cursos, notas] = await Promise.all([
                apiGet('/cursos/'),
                apiGet('/notas/'),
            ]);
            const misCursos = cursos.filter(c => c.docente_id == user.id);
            const misCursosIds = misCursos.map(c => c.id);
            const misNotas = notas.filter(n => misCursosIds.includes(n.curso_id));

            cardsHTML = `
                <div class="col-md-6 mb-3">
                    <div class="dash-stat-card green" style="height: 100%;">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <div class="dash-stat-value">${misCursos.length}</div>
                                <div class="dash-stat-label">Cursos Asignados</div>
                            </div>
                            <div class="dash-stat-icon green"><i class="bi bi-easel2-fill"></i></div>
                        </div>
                        <button class="btn btn-sm btn-outline-success w-100 fw-bold" onclick="document.querySelector('[data-section=\\'cursos\\']').click()">
                            <i class="bi bi-arrow-right-circle me-1"></i>Ir a Mis Cursos
                        </button>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="dash-stat-card blue" style="height: 100%;">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <div class="dash-stat-value">${misNotas.length}</div>
                                <div class="dash-stat-label">Notas Registradas</div>
                            </div>
                            <div class="dash-stat-icon blue"><i class="bi bi-award-fill"></i></div>
                        </div>
                        <button class="btn btn-sm btn-outline-info w-100 fw-bold" onclick="document.querySelector('[data-section=\\'notas\\']').click()">
                            <i class="bi bi-plus-circle me-1"></i>Registrar / Editar Nota
                        </button>
                    </div>
                </div>
            `;
        } else if (user.rol === 'estudiante') {
            const misNotas = await apiGet('/notas/mis-notas');
            cardsHTML = `
                <div class="col-md-4 mb-3">
                    <div class="dash-stat-card pink" style="height: 100%;">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <div class="dash-stat-value">${misNotas.length}</div>
                                <div class="dash-stat-label">Materias / Notas Registradas</div>
                            </div>
                            <div class="dash-stat-icon pink"><i class="bi bi-mortarboard-fill"></i></div>
                        </div>
                        <button class="btn btn-sm btn-outline-danger w-100 fw-bold" onclick="document.querySelector('[data-section=\\'mis-notas\\']').click()">
                            <i class="bi bi-clipboard2-check me-1"></i>Calificaciones
                        </button>
                    </div>
                </div>
                <div class="col-md-4 mb-3">
                    <div class="dash-stat-card yellow" style="height: 100%;">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <div class="dash-stat-value"><i class="bi bi-globe"></i></div>
                                <div class="dash-stat-label">Recursos Libres</div>
                            </div>
                            <div class="dash-stat-icon yellow"><i class="bi bi-collection-play-fill"></i></div>
                        </div>
                        <button class="btn btn-sm btn-outline-warning w-100 fw-bold" onclick="document.querySelector('[data-section=\\'biblioteca\\']').click()">
                            <i class="bi bi-book-half me-1"></i>Biblioteca
                        </button>
                    </div>
                </div>
                <div class="col-md-4 mb-3">
                    <div class="dash-stat-card green" style="height: 100%;">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div>
                                <div class="dash-stat-value"><i class="bi bi-wallet2"></i></div>
                                <div class="dash-stat-label">Historial Mensual</div>
                            </div>
                            <div class="dash-stat-icon green"><i class="bi bi-cash-coin"></i></div>
                        </div>
                        <button class="btn btn-sm btn-outline-success w-100 fw-bold" onclick="document.querySelector('[data-section=\\'mis-pagos\\']').click()">
                            <i class="bi bi-currency-dollar me-1"></i>Ir a Pagos
                        </button>
                    </div>
                </div>
            `;
        }

        document.getElementById('statsCards').innerHTML = cardsHTML;
    } catch {
        document.getElementById('statsCards').innerHTML = '<div class="col-12 py-3 text-center text-muted small"><i class="bi bi-info-circle me-1"></i>Ocurrió un error consultando los datos del usuario.</div>';
    }
}

/* ==========================================================
   USUARIOS (Admin)
   ========================================================== */

async function renderUsuarios(container) {
    container.innerHTML = `
        <div class="section-header mb-4" data-aos="fade-up">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h4 class="text-white fw-bold mb-1">
                        <i class="bi bi-people-fill me-2 text-primary"></i>Gestión de Usuarios
                    </h4>
                    <p class="text-muted small mb-0">Administra cuentas, perfiles y permisos de todo el personal académico.</p>
                </div>
                <div class="badge bg-primary bg-opacity-10 text-primary px-3 py-2 border border-primary border-opacity-25 rounded-pill d-none d-md-flex align-items-center gap-2">
                    <i class="bi bi-shield-check"></i>
                    USER CONTROL CENTER
                </div>
            </div>
        </div>

        <!-- Tarjetas de resumen por rol -->
        <div class="row g-3 mb-4" id="userStatsCards">
            <div class="col-md-4">
                <div class="dash-stat-card green" data-aos="fade-up" data-aos-delay="100">
                    <div class="d-flex align-items-center justify-content-between">
                        <div>
                            <div class="text-muted small">Administradores</div>
                            <div class="fs-3 fw-bold" id="countAdmins">0</div>
                        </div>
                        <div class="dash-stat-icon blue">
                            <i class="bi bi-shield-lock-fill"></i>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="dash-stat-card green" data-aos="fade-up" data-aos-delay="200">
                    <div class="d-flex align-items-center justify-content-between">
                        <div>
                            <div class="text-muted small">Docentes</div>
                            <div class="fs-3 fw-bold" id="countDocentes">0</div>
                        </div>
                        <div class="dash-stat-icon green">
                            <i class="bi bi-person-video3"></i>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="dash-stat-card yellow" data-aos="fade-up" data-aos-delay="300">
                    <div class="d-flex align-items-center justify-content-between">
                        <div>
                            <div class="text-muted small">Estudiantes</div>
                            <div class="fs-3 fw-bold" id="countEstudiantes">0</div>
                        </div>
                        <div class="dash-stat-icon yellow">
                            <i class="bi bi-mortarboard-fill"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="d-flex justify-content-between align-items-center mb-3" data-aos="fade-up" data-aos-delay="400">
            <h5 class="text-white fw-bold mb-0">Lista de Usuarios</h5>
            <button class="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 shadow-glow"
                onclick="showUserModal()">
                <i class="bi bi-person-plus-fill fs-6"></i>
                <span>Nuevo Usuario</span>
            </button>
        </div>
        <div class="table-card mt-3">
            <div class="d-flex flex-wrap gap-2 mb-4">
                <div class="input-group glass-search flex-grow-1" style="max-width: 400px;">
                    <span class="input-group-text bg-transparent border-end-0"><i class="bi bi-search text-muted"></i></span>
                    <input type="text" class="form-control border-start-0 ps-0 text-white" id="userSearch" placeholder="Buscar código, nombre, dirección...">
                </div>
                <div class="input-group glass-search w-auto">
                    <span class="input-group-text bg-transparent border-end-0"><i class="bi bi-funnel text-muted"></i></span>
                    <select class="form-select border-start-0 ps-0 text-white shadow-none glass-select" id="userRolFilter">
                        <option class="text-dark" value="">Todos los roles</option>
                        <option class="text-dark" value="estudiante">Estudiante</option>
                        <option class="text-dark" value="docente">Docente</option>
                        <option class="text-dark" value="admin">Administrador</option>
                    </select>
                </div>
            </div>
            <div class="table-responsive">
                <table class="table table-hover" id="usersTable">
                    <thead>
                        <tr class="text-muted small uppercase fw-bold" style="letter-spacing: 0.5px;">
                            <th class="ps-4">Profile</th>
                            <th>Code</th>
                            <th>Contact Info</th>
                            <th>Address</th>
                            <th class="text-center">Status</th>
                            <th class="text-center">Role</th>
                            <th class="text-end pe-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colspan="7" class="text-center py-4">
                            <div class="spinner-border spinner-border-sm text-primary"></div> Cargando...
                        </td></tr>
                    </tbody>
                </table>
            </div>
            <div id="usersPagination" class="mt-3"></div>
        </div>

        <!-- Modal Crear/Editar Usuario -->
        <div class="modal fade modal-dashboard" id="userModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content overflow-hidden" style="border: 1px solid rgba(255,255,255,0.08);">
                    <div class="modal-header border-0 pb-0">
                        <h5 class="modal-title d-flex align-items-center gap-2" id="userModalTitle">
                            <i class="bi bi-person-circle text-primary"></i>
                            <span>User Management</span>
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <form id="userForm" novalidate>
                            <input type="hidden" id="userId">
                            
                            <div class="row g-4">
                                <!-- Columna Izquierda: Identidad -->
                                <div class="col-md-6 border-end border-secondary border-opacity-10">
                                    <h6 class="text-muted small uppercase fw-bold mb-3" style="letter-spacing: 1px;">Personal Information</h6>
                                    <div class="mb-3">
                                        <label class="form-label small text-muted mb-1">Nombre (First Name)</label>
                                        <input type="text" class="form-control form-control-sm bg-dark border-secondary text-white" id="userNombre" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label small text-muted mb-1">Apellido (Last Name)</label>
                                        <input type="text" class="form-control form-control-sm bg-dark border-secondary text-white" id="userApellido" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label small text-muted mb-1">Password</label>
                                        <input type="password" class="form-control form-control-sm bg-dark border-secondary text-white" id="userPassword">
                                    </div>
                                    <div class="mb-0">
                                        <label class="form-label small text-muted mb-1">Address</label>
                                        <input type="text" class="form-control form-control-sm bg-dark border-secondary text-white" id="userDireccion">
                                    </div>
                                </div>

                                <!-- Columna Derecha: Sistema y Contacto -->
                                <div class="col-md-6">
                                    <h6 class="text-muted small uppercase fw-bold mb-3" style="letter-spacing: 1px;">Account & System</h6>
                                    <div class="mb-3">
                                        <label class="form-label small text-muted mb-1">Código (Student/User ID)</label>
                                        <div class="input-group input-group-sm">
                                            <span class="input-group-text bg-transparent border-secondary text-info fw-bold">BTRM-</span>
                                            <input type="text" class="form-control bg-dark border-secondary text-white" id="userCodigo" placeholder="204" inputmode="numeric" pattern="[0-9]+" required>
                                        </div>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label small text-muted mb-1">System Role</label>
                                        <select class="form-select form-select-sm bg-dark text-white border-secondary" id="userRol" required>
                                            <option value="estudiante">Estudiante</option>
                                            <option value="docente">Docente</option>
                                            <option value="admin">Administrador</option>
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label small text-muted mb-1">Phone Number</label>
                                        <input type="text" class="form-control form-control-sm bg-dark border-secondary text-white" id="userTelefono">
                                    </div>
                                    <div class="mb-0 pt-1 d-flex align-items-end" style="height: 38px;">
                                        <div class="form-check form-switch w-100 p-2 rounded" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);">
                                            <input class="form-check-input ms-1" type="checkbox" id="userActivo" checked style="cursor: pointer;">
                                            <label class="form-check-label small text-white ms-2 fw-bold" for="userActivo" style="cursor: pointer; letter-spacing: 0.5px;">Usuario Activo</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button type="submit" class="btn btn-primary w-100 mt-4 py-2 fw-bold text-uppercase" style="letter-spacing: 1px;">
                                <i class="bi bi-cloud-check me-2"></i>Save Account Changes
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;

    loadUsersTable();
    initUserForm();
}

let _usersCache = [];

async function loadUsersTable() {
    try {
        _usersCache = await apiGet('/usuarios/');
        updateUserStats(_usersCache);
        renderUsersRows(_usersCache);
        initUserSearch();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

function updateUserStats(users) {
    const admins = users.filter(u => u.rol === 'admin').length;
    const docentes = users.filter(u => u.rol === 'docente').length;
    const estudiantes = users.filter(u => u.rol === 'estudiante').length;
    const elAdmins = document.getElementById('countAdmins');
    const elDocentes = document.getElementById('countDocentes');
    const elEstudiantes = document.getElementById('countEstudiantes');
    if (elAdmins) elAdmins.textContent = admins;
    if (elDocentes) elDocentes.textContent = docentes;
    if (elEstudiantes) elEstudiantes.textContent = estudiantes;
}

window.changeUsersPage = (page) => {
    window.paginationState.usuarios.page = page;
    _internalRenderUsers();
};

function renderUsersRows(users) {
    window.paginationState.usuarios = window.paginationState.usuarios || { page: 1, size: 6 };
    window.paginationState.usuarios.data = users;
    window.paginationState.usuarios.page = 1;
    _internalRenderUsers();
}

function _internalRenderUsers() {
    const state = window.paginationState.usuarios;
    const tbody = document.querySelector('#usersTable tbody');
    if (!tbody) return;
    if (!state.data || state.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No se encontraron usuarios</td></tr>';
        const pgn = document.getElementById('usersPagination');
        if (pgn) pgn.innerHTML = '';
        return;
    }

    const pageData = paginateArray(state.data, state.page, state.size);
    tbody.innerHTML = pageData.map(u => {
        const initials = ((u.nombre[0] || '') + (u.apellido[0] || '')).toUpperCase();
        const roleColors = {
            admin: 'bg-danger text-danger',
            docente: 'bg-info text-info',
            estudiante: 'bg-warning text-warning'
        };
        const color = roleColors[u.rol] || 'bg-secondary text-secondary';

        return `
        <tr class="align-middle">
            <td class="ps-4">
                <div class="fw-bold text-white mb-0">${u.nombre} ${u.apellido}</div>
            </td>
            <td>
                <code class="text-info bg-info bg-opacity-10 px-2 py-1 rounded border border-info border-opacity-25">${u.codigo}</code>
            </td>
            <td>
                <div class="small"><i class="bi bi-telephone text-muted me-2"></i>${u.telefono || 'Not provided'}</div>
            </td>
            <td>
                <div class="small text-truncate" style="max-width: 150px;" title="${u.direccion || ''}">
                    <i class="bi bi-geo-alt text-muted me-2"></i>${u.direccion || 'No address'}
                </div>
            </td>
            <td class="text-center">
                <span class="badge ${u.activo ? 'bg-success' : 'bg-secondary'} bg-opacity-10 ${u.activo ? 'text-success border-success' : 'text-secondary border-secondary'} border border-opacity-25">${u.activo ? 'Activo' : 'Inactivo'}</span>
            </td>
            <td class="text-center">
                <span class="badge-role ${u.rol}">${u.rol}</span>
            </td>
            <td class="text-end pe-4">
                <div class="d-flex justify-content-end gap-1">
                    <button class="btn btn-sm btn-outline-light border-0 py-1 px-2 opacity-75 hover-opacity-100" onclick="editUser(${u.id})" title="Edit user">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger border-0 py-1 px-2 opacity-75 hover-opacity-100" onclick="deleteUser(${u.id}, '${u.nombre}')" title="Delete user">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');

    renderPaginationControls('usersPagination', state.data.length, state.size, state.page, 'changeUsersPage');
}

function initUserSearch() {
    const input = document.getElementById('userSearch');
    const filter = document.getElementById('userRolFilter');

    if (input) {
        input.removeEventListener('input', _handleUserSearch);
        input.addEventListener('input', _handleUserSearch);
    }
    if (filter) {
        filter.removeEventListener('change', _handleUserSearch);
        filter.addEventListener('change', _handleUserSearch);
    }
}

function _handleUserSearch() {
    const searchInput = document.getElementById('userSearch');
    const filterInput = document.getElementById('userRolFilter');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedRol = filterInput ? filterInput.value.toLowerCase().trim() : '';

    if (!query && !selectedRol) {
        renderUsersRows(_usersCache);
        return;
    }

    const filtered = _usersCache.filter(u => {
        const matchQuery = !query ||
            u.codigo.toLowerCase().includes(query) ||
            u.nombre.toLowerCase().includes(query) ||
            u.apellido.toLowerCase().includes(query) ||
            (u.telefono && u.telefono.toLowerCase().includes(query)) ||
            (u.direccion && u.direccion.toLowerCase().includes(query)) ||
            u.rol.toLowerCase().includes(query);

        const matchRol = !selectedRol || u.rol.toLowerCase() === selectedRol;

        return matchQuery && matchRol;
    });

    renderUsersRows(filtered);
}

function showUserModal(title = 'Nuevo Usuario') {
    document.getElementById('userModalTitle').textContent = title;
    document.getElementById('userForm').reset();
    document.getElementById('userForm').classList.remove('was-validated');
    document.getElementById('userId').value = '';
    document.getElementById('userPassword').required = true;
    document.getElementById('userActivo').checked = true;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal')).show();
}

async function editUser(id) {
    try {
        const user = await apiGet(`/usuarios/${id}`);
        document.getElementById('userId').value = user.id;
        document.getElementById('userCodigo').value = user.codigo.replace(/^BTRM-/i, '');
        document.getElementById('userNombre').value = user.nombre;
        document.getElementById('userApellido').value = user.apellido;
        document.getElementById('userTelefono').value = user.telefono || '';
        document.getElementById('userDireccion').value = user.direccion || '';
        document.getElementById('userRol').value = user.rol;
        document.getElementById('userActivo').checked = user.activo;
        document.getElementById('userPassword').required = false;
        document.getElementById('userPassword').value = '';
        document.getElementById('userModalTitle').textContent = 'Editar Usuario';
        bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal')).show();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

async function deleteUser(id, nombre) {
    const result = await Swal.fire({
        title: '¿Eliminar usuario?',
        html: `Se eliminará permanentemente a <b>${nombre}</b>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#E17055',
        cancelButtonColor: '#aaa',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
    });
    if (result.isConfirmed) {
        try {
            await apiDelete(`/usuarios/${id}`);
            Swal.fire({ icon: 'success', title: 'Eliminado', text: 'Usuario eliminado correctamente', timer: 1500, showConfirmButton: false });
            loadUsersTable();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    }
}

function initUserForm() {
    const form = document.getElementById('userForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

        const id = document.getElementById('userId').value;
        let rawCodigo = document.getElementById('userCodigo').value.trim();

        // Limpiar si el usuario copió y pegó 'BTRM-' por accidente
        rawCodigo = rawCodigo.replace(/^BTRM-/i, '').replace(/\s+/g, '');

        if (!/^\d+$/.test(rawCodigo)) {
            Swal.fire({ icon: 'warning', title: 'Código inválido', text: 'El código numérico solo debe contener números.' });
            return;
        }

        const data = {
            codigo: `BTRM-${rawCodigo}`,
            nombre: document.getElementById('userNombre').value.trim(),
            apellido: document.getElementById('userApellido').value.trim(),
            telefono: document.getElementById('userTelefono').value.trim() || null,
            direccion: document.getElementById('userDireccion').value.trim() || null,
            rol: document.getElementById('userRol').value,
            activo: document.getElementById('userActivo').checked,
        };
        const password = document.getElementById('userPassword').value;
        if (password) data.password = password;

        try {
            if (id) {
                await apiPut(`/usuarios/${id}`, data);
            } else {
                await apiPost('/usuarios/', data);
            }

            // Cerrar modal y limpiar backdrop
            const modalEl = document.getElementById('userModal');
            const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
            modalInstance.hide();

            setTimeout(() => {
                document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
                document.body.classList.remove('modal-open');
                document.body.style.paddingRight = '';
            }, 300);

            Swal.fire({ icon: 'success', title: id ? 'Actualizado' : 'Creado', timer: 1500, showConfirmButton: false });
            loadUsersTable();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    });
}

/* ==========================================================
   CURSOS
   ========================================================== */

async function renderCursos(container) {
    container.innerHTML = `
        <div class="section-header mb-4" data-aos="fade-up">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h4 class="text-white fw-bold mb-1">
                        <i class="bi bi-book-half me-2 text-primary"></i>Centro Académico
                    </h4>
                    <p class="text-muted small mb-0">Administra los cursos, niveles y modalidades institucionales.</p>
                </div>
                <div class="badge bg-warning bg-opacity-10 text-warning px-3 py-2 border border-warning border-opacity-25 rounded-pill d-none d-md-flex align-items-center gap-2">
                    <i class="bi bi-mortarboard-fill"></i>
                    GESTIÓN INSTITUCIONAL
                </div>
            </div>
        </div>

        <ul class="nav nav-pills mb-4 gap-2" id="cursosTabs" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link active px-4 rounded-pill" id="cursos-tab" data-bs-toggle="pill" data-bs-target="#cursos-pane" type="button" role="tab">📚 Cursos</button>
            </li>
            ${hasRole(['admin']) ? `
            <li class="nav-item" role="presentation">
                <button class="nav-link px-4 rounded-pill" id="niveles-tab" data-bs-toggle="pill" data-bs-target="#niveles-pane" type="button" role="tab">⭐ Niveles</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link px-4 rounded-pill" id="modalidades-tab" data-bs-toggle="pill" data-bs-target="#modalidades-pane" type="button" role="tab">🏢 Modalidades</button>
            </li>
            ` : ''}
        </ul>

        <div class="tab-content" id="cursosTabsContent">
            <!-- PESTAÑA CURSOS -->
            <div class="tab-pane fade show active" id="cursos-pane" role="tabpanel">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="text-white fw-bold mb-0">Lista de Cursos</h5>
                    ${hasRole(['admin']) ? '<button class="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3" onclick="showCursoModal()"><i class="bi bi-book-half"></i><span>Nuevo Curso</span></button>' : ''}
                </div>
                <div class="table-card">
                    <div class="table-responsive">
                        <table class="table table-hover" id="cursosTable">
                            <thead><tr><th>Curso</th><th>Nivel</th><th>Modalidad</th><th>Horario</th><th>Docente</th><th>Acciones</th></tr></thead>
                            <tbody><tr><td colspan="6" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr></tbody>
                        </table>
                    </div>
                </div>
                <div id="cursosPagination" class="mt-3"></div>
            </div>

            <!-- PESTAÑA NIVELES -->
            <div class="tab-pane fade" id="niveles-pane" role="tabpanel">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="text-white fw-bold mb-0">Lista de Niveles</h5>
                    ${hasRole(['admin']) ? '<button class="btn btn-warning btn-sm text-white d-flex align-items-center gap-2 px-3 shadow-glow" onclick="showConfigModal(\'nivel\')"><i class="bi bi-plus-circle"></i><span>Nuevo Nivel</span></button>' : ''}
                </div>
                <div class="table-card">
                    <div class="table-responsive">
                        <table class="table table-hover" id="nivelesTable">
                            <thead><tr><th>Nombre</th><th class="text-end">Acciones</th></tr></thead>
                            <tbody><tr><td colspan="2" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr></tbody>
                        </table>
                    </div>
                </div>
                <div id="nivelesPagination" class="mt-3"></div>
            </div>

            <!-- PESTAÑA MODALIDADES -->
            <div class="tab-pane fade" id="modalidades-pane" role="tabpanel">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="text-white fw-bold mb-0">Lista de Modalidades</h5>
                    ${hasRole(['admin']) ? '<button class="btn btn-info btn-sm text-white d-flex align-items-center gap-2 px-3 shadow-glow" onclick="showConfigModal(\'modalidad\')"><i class="bi bi-plus-circle"></i><span>Nueva Modalidad</span></button>' : ''}
                </div>
                <div class="table-card">
                    <div class="table-responsive">
                        <table class="table table-hover" id="modalidadesTable">
                            <thead><tr><th>Nombre</th><th class="text-end">Acciones</th></tr></thead>
                            <tbody><tr><td colspan="2" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr></tbody>
                        </table>
                    </div>
                </div>
                <div id="modalidadesPagination" class="mt-3"></div>
            </div>
        </div>

        <!-- MODAL CURSO -->
        <div class="modal fade modal-dashboard" id="cursoModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="cursoModalTitle">Nuevo Curso</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="cursoForm" novalidate>
                            <input type="hidden" id="cursoId">
                            <div class="row g-3">
                                <div class="col-md-6 mb-2">
                                    <label class="form-label">Docente (Opcional)</label>
                                    <select class="form-select" id="cursoDocenteId"><option value="">Ninguno</option></select>
                                </div>
                                <div class="col-md-6 mb-2">
                                    <label class="form-label">Nivel</label>
                                    <select class="form-select" id="cursoNivelId"><option value="">Seleccione...</option></select>
                                </div>
                                <div class="col-md-6 mb-2">
                                    <label class="form-label">Modalidad</label>
                                    <select class="form-select" id="cursoModalidadId"><option value="">Seleccione...</option></select>
                                </div>
                                <div class="col-md-3 mb-2">
                                    <label class="form-label">Hora Inicio</label>
                                    <input type="time" class="form-control" id="cursoHoraInicio">
                                </div>
                                <div class="col-md-3 mb-2">
                                    <label class="form-label">Hora Fin</label>
                                    <input type="time" class="form-control" id="cursoHoraFin">
                                </div>
                                <div class="col-md-3 mb-2">
                                    <label class="form-label">Horas/Sem.</label>
                                    <input type="number" class="form-control" id="cursoHorasSemanales">
                                </div>
                                <div class="col-md-3 mb-2">
                                    <label class="form-label">Días (ej. Lu-Mi-Vi)</label>
                                    <input type="text" class="form-control" id="cursoDias">
                                </div>
                                <div class="col-12 mb-2">
                                    <label class="form-label">Descripción</label>
                                    <textarea class="form-control" id="cursoDescripcion" rows="2"></textarea>
                                </div>
                            </div>
                            <button type="submit" class="btn btn-primary w-100 mt-2"><i class="bi bi-floppy"></i> Guardar</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>

        <!-- MODAL CONFIG (Nivel/Modalidad) -->
        <div class="modal fade modal-dashboard" id="configModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="configModalTitle">Nueva Categoría</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="configForm" novalidate>
                            <input type="hidden" id="configTipo">
                            <div class="mb-3">
                                <label class="form-label">Nombre</label>
                                <input type="text" class="form-control" id="configNombre" required>
                                <div class="invalid-feedback">El nombre es requerido.</div>
                            </div>
                            <button type="submit" class="btn btn-primary w-100 mt-2"><i class="bi bi-floppy"></i> Guardar</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;
    loadCursosTable();
    loadNivelesTable();
    loadModalidadesTable();
    initCursoForm();
    initConfigForm();
}

// ---------------------- PAGINATION ENGINE -------------------
window.paginationState = window.paginationState || {};

function paginateArray(items, page, pageSize) {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
}

function renderPaginationControls(containerId, totalItems, pageSize, currentPage, onPageChangeCallback) {
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const container = document.getElementById(containerId);
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = `<nav><ul class="pagination pagination-sm justify-content-center mb-0 gap-1 pb-3">`;
    html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <button class="page-link shadow-none rounded-pill border-0 bg-transparent text-secondary" onclick="${onPageChangeCallback}(${currentPage - 1})">Anterior</button>
             </li>`;
    for (let i = 1; i <= totalPages; i++) {
        if (totalPages > 7) {
            if (i !== 1 && i !== totalPages && Math.abs(i - currentPage) > 1) {
                if (i === 2 && currentPage > 3) html += `<li class="page-item disabled"><span class="page-link border-0 bg-transparent">...</span></li>`;
                if (i === totalPages - 1 && currentPage < totalPages - 2) html += `<li class="page-item disabled"><span class="page-link border-0 bg-transparent">...</span></li>`;
                continue;
            }
        }
        let activeClass = i === currentPage ? 'active rounded-circle' : 'border-0 bg-transparent text-secondary rounded-circle';
        html += `<li class="page-item">
                    <button class="page-link shadow-none ${activeClass} px-3 mx-1" onclick="${onPageChangeCallback}(${i})">${i}</button>
                 </li>`;
    }
    html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <button class="page-link shadow-none rounded-pill border-0 bg-transparent text-secondary" onclick="${onPageChangeCallback}(${currentPage + 1})">Siguiente</button>
             </li>`;
    html += `</ul></nav>`;
    container.innerHTML = html;
}

window.changeCursosPage = (page) => {
    window.paginationState.cursos.page = page;
    renderCursosRows();
};

async function loadCursosTable() {
    try {
        let cursos = await apiGet('/cursos/');
        if (hasRole(['docente'])) {
            cursos = cursos.filter(c => c.docente_id == getCurrentUser().id);
        }
        window.paginationState.cursos = { data: cursos, page: 1, size: 6 };
        renderCursosRows();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

function renderCursosRows() {
    const state = window.paginationState.cursos;
    const tbody = document.querySelector('#cursosTable tbody');
    if (!state.data.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No hay cursos registrados</td></tr>';
        document.getElementById('cursosPagination').innerHTML = '';
        return;
    }

    const pageData = paginateArray(state.data, state.page, state.size);
    tbody.innerHTML = pageData.map(c => `
        <tr>
            <td><strong>${c.nombre}</strong></td>
            <td>${c.nivel ? `<span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-3 py-2" style="font-size: 0.85rem;">${c.nivel.nombre}</span>` : '—'}</td>
            <td>${c.modalidad ? `<span class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-3 py-2" style="font-size: 0.85rem;">${c.modalidad.nombre}</span>` : '—'}</td>
            <td><small class="text-muted"><i class="bi bi-clock me-1"></i>${c.hora_inicio || '--:--'} a ${c.hora_fin || '--:--'}<br><i class="bi bi-calendar-event me-1"></i>${c.dias || '—'} (${c.horas_semanales || 0}h)</small></td>
            <td>${c.docente ? `<code class="text-info">${c.docente.codigo}</code><br><small class="text-muted">${c.docente.nombre} ${c.docente.apellido}</small>` : '<span class="text-muted">Sin docente</span>'}</td>
            <td>
                ${hasRole(['admin']) ? `
                <button class="btn btn-sm btn-outline-info border-0 py-0 px-2 fs-6 me-1" onclick="editCurso(${c.id})" title="Editar"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger border-0 py-0 px-2 fs-6" onclick="deleteCurso(${c.id}, '${c.nombre}')" title="Eliminar"><i class="bi bi-trash"></i></button>
                ` : '—'}
            </td>
        </tr>
    `).join('');

    renderPaginationControls('cursosPagination', state.data.length, state.size, state.page, 'changeCursosPage');
}


async function loadCursoDropdowns() {
    try {
        const [usuarios, niveles, modalidades] = await Promise.all([
            _usersCache.length ? Promise.resolve(_usersCache) : apiGet('/usuarios/'),
            apiGet('/cursos/niveles'),
            apiGet('/cursos/modalidades')
        ]);

        const docentes = usuarios.filter(u => u.rol === 'docente' || u.rol === 'admin');
        const docSelect = document.getElementById('cursoDocenteId');
        if (docSelect) {
            docSelect.innerHTML = '<option value="">Ninguno asignado</option>' +
                docentes.map(d => `<option value="${d.id}">${d.nombre} ${d.apellido} (${d.codigo})</option>`).join('');
        }

        const nivSelect = document.getElementById('cursoNivelId');
        if (nivSelect) {
            nivSelect.innerHTML = '<option value="">Seleccione nivel</option>' +
                niveles.map(n => `<option value="${n.id}">${n.nombre}</option>`).join('');
        }

        const modSelect = document.getElementById('cursoModalidadId');
        if (modSelect) {
            modSelect.innerHTML = '<option value="">Seleccione modalidad</option>' +
                modalidades.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
        }
    } catch (err) { /* silent */ }
}

async function showCursoModal() {
    await loadCursoDropdowns();
    document.getElementById('cursoModalTitle').textContent = 'Nuevo Curso';
    document.getElementById('cursoForm').reset();
    document.getElementById('cursoForm').classList.remove('was-validated');
    document.getElementById('cursoId').value = '';
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('cursoModal'));
    modal.show();
}

async function editCurso(id) {
    try {
        const curso = await apiGet(`/cursos/${id}`);
        await loadCursoDropdowns();

        document.getElementById('cursoId').value = curso.id;
        document.getElementById('cursoDescripcion').value = curso.descripcion || '';
        document.getElementById('cursoDocenteId').value = curso.docente_id || '';
        document.getElementById('cursoNivelId').value = curso.nivel_id || '';
        document.getElementById('cursoModalidadId').value = curso.modalidad_id || '';
        document.getElementById('cursoHoraInicio').value = curso.hora_inicio || '';
        document.getElementById('cursoHoraFin').value = curso.hora_fin || '';
        document.getElementById('cursoDias').value = curso.dias || '';
        document.getElementById('cursoHorasSemanales').value = curso.horas_semanales || '';

        document.getElementById('cursoModalTitle').textContent = 'Editar Curso';

        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('cursoModal'));
        modal.show();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

async function deleteCurso(id, nombre) {
    const result = await Swal.fire({
        title: '¿Eliminar curso?', html: `Se eliminará <b>${nombre}</b>`, icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#E17055', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar',
    });
    if (result.isConfirmed) {
        try {
            await apiDelete(`/cursos/${id}`);
            Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1500, showConfirmButton: false });
            loadCursosTable();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    }
}

function initCursoForm() {
    const form = document.getElementById('cursoForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }
        const id = document.getElementById('cursoId').value;
        const docId = document.getElementById('cursoDocenteId').value;
        const nivId = document.getElementById('cursoNivelId').value;
        const modId = document.getElementById('cursoModalidadId').value;
        const hsSem = document.getElementById('cursoHorasSemanales').value;

        const data = {
            descripcion: document.getElementById('cursoDescripcion').value.trim() || null,
            docente_id: docId ? parseInt(docId) : null,
            nivel_id: nivId ? parseInt(nivId) : null,
            modalidad_id: modId ? parseInt(modId) : null,
            hora_inicio: document.getElementById('cursoHoraInicio').value || null,
            hora_fin: document.getElementById('cursoHoraFin').value || null,
            dias: document.getElementById('cursoDias').value.trim() || null,
            horas_semanales: hsSem ? parseInt(hsSem) : null
        };
        try {
            if (id) { await apiPut(`/cursos/${id}`, data); } else { await apiPost('/cursos/', data); }
            bootstrap.Modal.getInstance(document.getElementById('cursoModal')).hide();
            Swal.fire({ icon: 'success', title: id ? 'Actualizado' : 'Creado', timer: 1500, showConfirmButton: false });
            loadCursosTable();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    });
}

/* ==========================================================
   NIVELES
   ========================================================== */

window.changeNivelesPage = (page) => {
    window.paginationState.niveles.page = page;
    _internalRenderNiveles();
};

async function loadNivelesTable() {
    try {
        const niveles = await apiGet('/cursos/niveles');
        window.paginationState.niveles = { data: niveles, page: 1, size: 6 };
        _internalRenderNiveles();
    } catch { /* silent */ }
}

function _internalRenderNiveles() {
    const state = window.paginationState.niveles;
    const tbody = document.querySelector('#nivelesTable tbody');
    if (!tbody) return;
    if (!state.data.length) {
        tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted py-4">No hay niveles</td></tr>';
        document.getElementById('nivelesPagination').innerHTML = '';
        return;
    }
    const pageData = paginateArray(state.data, state.page, state.size);
    tbody.innerHTML = pageData.map(item => `
        <tr>
            <td><strong>${item.nombre}</strong></td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-danger border-0 py-0 px-2" onclick="deleteConfig(${item.id}, 'nivel', '${item.nombre}')" title="Eliminar"><i class="bi bi-trash"></i></button>
            </td>
        </tr>
    `).join('');
    renderPaginationControls('nivelesPagination', state.data.length, state.size, state.page, 'changeNivelesPage');
}

/* ==========================================================
   MODALIDADES
   ========================================================== */

window.changeModalidadesPage = (page) => {
    window.paginationState.modalidades.page = page;
    _internalRenderModalidades();
};

async function loadModalidadesTable() {
    try {
        const mods = await apiGet('/cursos/modalidades');
        window.paginationState.modalidades = { data: mods, page: 1, size: 6 };
        _internalRenderModalidades();
    } catch { /* silent */ }
}

function _internalRenderModalidades() {
    const state = window.paginationState.modalidades;
    const tbody = document.querySelector('#modalidadesTable tbody');
    if (!tbody) return;
    if (!state.data.length) {
        tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted py-4">No hay modalidades</td></tr>';
        document.getElementById('modalidadesPagination').innerHTML = '';
        return;
    }
    const pageData = paginateArray(state.data, state.page, state.size);
    tbody.innerHTML = pageData.map(item => `
        <tr>
            <td><strong>${item.nombre}</strong></td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-danger border-0 py-0 px-2" onclick="deleteConfig(${item.id}, 'modalidad', '${item.nombre}')" title="Eliminar"><i class="bi bi-trash"></i></button>
            </td>
        </tr>
    `).join('');
    renderPaginationControls('modalidadesPagination', state.data.length, state.size, state.page, 'changeModalidadesPage');
}

/* COMUNES NIVELES / MODALIDADES */

function showConfigModal(tipo) {
    document.getElementById('configForm').reset();
    document.getElementById('configForm').classList.remove('was-validated');
    document.getElementById('configTipo').value = tipo;
    const titleEl = document.getElementById('configModalTitle');
    if (titleEl) {
        titleEl.textContent = tipo === 'nivel' ? 'Nuevo Nivel' : 'Nueva Modalidad';
    }
    new bootstrap.Modal(document.getElementById('configModal')).show();
}

function initConfigForm() {
    const form = document.getElementById('configForm');
    if (!form || form.getAttribute('data-init')) return;
    form.setAttribute('data-init', 'true');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

        const tipo = document.getElementById('configTipo').value;
        const data = { nombre: document.getElementById('configNombre').value.trim() };

        try {
            await apiPost(`/cursos/${tipo === 'nivel' ? 'niveles' : 'modalidades'}`, data);
            bootstrap.Modal.getInstance(document.getElementById('configModal')).hide();
            Swal.fire({ icon: 'success', title: 'Agregado', timer: 1500, showConfirmButton: false });
            if (tipo === 'nivel') loadNivelesTable();
            else loadModalidadesTable();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    });
}


async function deleteConfig(id, tipo, nombre) {
    const result = await Swal.fire({
        title: '¿Eliminar categoría?', html: `Se eliminará <b>${nombre}</b>`, icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#E17055', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar',
    });
    if (result.isConfirmed) {
        try {
            await apiDelete(`/cursos/${tipo === 'nivel' ? 'niveles' : 'modalidades'}/${id}`);
            Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1500, showConfirmButton: false });
            if (tipo === 'nivel') loadNivelesTable();
            else loadModalidadesTable();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    }
}

/* ==========================================================
   Asignaciones (Gestión Global de Alumnos por Curso)
   ========================================================== */

let currentAsignacionEstudianteId = null;

window.renderAsignaciones = async (container) => {
    container.innerHTML = `
        <div class="section-header mb-4" data-aos="fade-up">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h4 class="text-white fw-bold mb-1">
                        <i class="bi bi-people-fill me-2 text-primary"></i>Centro de Asignaciones
                    </h4>
                    <p class="text-muted small mb-0">Administra la asignación de estudiantes a cursos. </p>
                </div>
                <div class="badge bg-success bg-opacity-10 text-success px-3 py-2 border border-success border-opacity-25 rounded-pill d-none d-md-flex align-items-center gap-2">
                    <i class="bi bi-person-check-fill"></i>
                    GESTIÓN DE ALUMNOS
                </div>
            </div>
        </div>

        <div class="d-flex justify-content-between align-items-center mb-3" data-aos="fade-up" data-aos-delay="50">
            <h5 class="text-white fw-bold mb-0">Lista de Asignaciones</h5>
            <button class="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 shadow-glow" onclick="showAsignacionModal()">
                <i class="bi bi-person-plus-fill fs-6"></i>
                <span>Nueva Asignación</span>
            </button>
        </div>

        <div class="table-card" data-aos="fade-up" data-aos-delay="100">
            <div class="p-4 border-bottom border-white border-opacity-10">
                <div class="search-box-wrapper" style="max-width: 400px;">
                    <div class="input-group glass-search">
                        <span class="input-group-text bg-transparent border-end-0"><i class="bi bi-search text-muted"></i></span>
                        <input type="text" class="form-control border-start-0 ps-0 text-white" id="searchInscripcion" placeholder="Buscar por alumno o curso...">
                    </div>
                </div>
            </div>
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0" id="asignacionesTable">
                    <thead>
                        <tr class="text-muted small uppercase fw-bold" style="letter-spacing: 0.5px;">
                            <th class="ps-4">Estudiante</th>
                            <th>Código</th>
                            <th>Curso</th>
                            <th>Nivel</th>
                            <th class="text-end pe-4">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>
                    </tbody>
                </table>
            </div>
            <div id="asignacionesPagination" class="mt-3 px-4 pb-4 text-end">
                <span class="text-muted small fw-bold">TOTAL: <span id="asignacionesTotal" class="text-info">0</span></span>
            </div>
        </div>
        </div>

        <!-- MODAL ASIGNACIÓN -->
        <div class="modal fade modal-dashboard" id="asignacionCRUDModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Asignar Alumno</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <form id="asignacionCRUDForm" novalidate>
                            <!-- Buscador de Estudiante (BTRM-##) -->
                            <div class="mb-4">
                                <label class="text-muted small uppercase fw-bold mb-2 d-block">CÓDIGO DEL ESTUDIANTE</label>
                                <div class="input-group">
                                    <span class="input-group-text bg-transparent border-secondary text-info fw-bold">BTRM-</span>
                                    <input type="text" class="form-control border-secondary bg-transparent text-white fw-bold" 
                                           id="asigSearchStudentCode" placeholder="Ej: 200" maxlength="4">
                                    <button class="btn btn-outline-info" type="button" id="btnSearchAsigStudent">
                                        <i class="bi bi-search"></i>
                                    </button>
                                </div>
                                <div id="asigStudentFoundInfo" class="mt-2 p-3 rounded d-none" style="background: rgba(0,255,255,0.05); border: 1px dashed rgba(0,255,255,0.2);">
                                    <div class="d-flex align-items-center gap-2">
                                        <div class="avatar-mini bg-info" id="asigStudentAvatar">??</div>
                                        <div>
                                            <div class="text-info tiny fw-bold uppercase">ALUMNO IDENTIFICADO</div>
                                            <div class="text-white fw-bold" id="asigStudentNameDisplay">—</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="mb-4">
                                <label class="text-muted small uppercase fw-bold mb-2 d-block">SELECCIONAR CURSO</label>
                                <select class="form-select glass-select py-2" id="asigCursoSelect" required>
                                    <option value="">Cargando cursos...</option>
                                </select>
                            </div>

                            <button type="submit" class="btn btn-primary w-100 py-3 fw-bold mt-2 shadow-glow" id="btnSaveAsignacion" disabled>
                                <i class="bi bi-person-check-fill me-2 f-5"></i>COMPLETAR ASIGNACIÓN
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;

    loadAsignacionesTable();
    initAsignacionesLogic();
};

async function loadAsignacionesTable() {
    const tbody = document.querySelector('#asignacionesTable tbody');
    if (!tbody) return;

    try {
        const [asignaciones, usuarios, cursos] = await Promise.all([
            apiGet('/cursos/inscripciones/todas'),
            apiGet('/usuarios/'),
            apiGet('/cursos/')
        ]);

        document.getElementById('asignacionesTotal').textContent = asignaciones.length;

        if (asignaciones.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">No hay asignaciones registradas</td></tr>';
            return;
        }

        tbody.innerHTML = asignaciones.map(ins => {
            const user = usuarios.find(u => u.id === ins.estudiante_id);
            const curso = cursos.find(c => c.id === ins.curso_id);

            const userName = user ? `${user.nombre} ${user.apellido}` : 'Alumno Desconocido';
            const userCode = user ? `${user.codigo}` : 'N/A';
            const cursoName = curso ? curso.nombre : 'Curso Desconocido';
            const nivelName = curso?.nivel?.nombre || 'N/A';
            const initials = user ? (user.nombre[0] + user.apellido[0]).toUpperCase() : '??';

            return `
                <tr>
                    <td class="ps-4">
                        <div class="d-flex align-items-center gap-2">
                            <div class="avatar-mini bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25">${initials}</div>
                            <span class="fw-bold text-white">${userName}</span>
                        </div>
                    </td>
                    <td><span class="text-info bg-info bg-opacity-10 px-2 py-1 rounded border border-info border-opacity-25 fw-bold" style="font-size: 0.85rem;">${userCode}</span></td>
                    <td class="text-white">${cursoName}</td>
                    <td><span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-3 py-2 fw-bold" style="letter-spacing: 0.5px;">${nivelName}</span></td>
                    <td class="text-end pe-4">
                        <button class="btn btn-action-mini btn-outline-danger" 
                                onclick="deleteAsignacion(${ins.estudiante_id}, ${ins.curso_id}, '${userName.replace(/'/g, "\\'")}', '${cursoName.replace(/'/g, "\\'")}')" 
                                title="Eliminar asignación">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-danger">Error: ${err.message}</td></tr>`;
    }
}

function initAsignacionesLogic() {
    const searchInput = document.getElementById('searchAsignacion');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const rows = document.querySelectorAll('#asignacionesTable tbody tr');
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        });
    }

    // Lógica del modal
    const btnSearch = document.getElementById('btnSearchAsigStudent');
    const inputCode = document.getElementById('asigSearchStudentCode');
    const infoFound = document.getElementById('asigStudentFoundInfo');
    const btnSave = document.getElementById('btnSaveAsignacion');

    if (btnSearch && inputCode) {
        const searchHandler = async () => {
            let rawCode = inputCode.value.trim();
            if (!rawCode) return;

            // Normalizar código (quitar BTRM- si el usuario lo escribió y quitar espacios)
            const searchCode = `BTRM-${rawCode.replace(/^BTRM-/i, '').replace(/\s+/g, '')}`;

            try {
                const usuarios = await apiGet('/usuarios/');
                // Comparación robusta contra el código completo guardado en DB
                const student = usuarios.find(u => u.codigo.toString().trim() === searchCode && u.rol === 'estudiante');

                if (student) {
                    currentAsignacionEstudianteId = student.id;
                    document.getElementById('asigStudentNameDisplay').textContent = `${student.nombre} ${student.apellido}`;
                    document.getElementById('asigStudentAvatar').textContent = (student.nombre[0] + student.apellido[0]).toUpperCase();
                    infoFound.classList.remove('d-none');
                    btnSave.disabled = false;
                } else {
                    Swal.fire({ icon: 'warning', title: 'Estudiante no encontrado', timer: 1500, showConfirmButton: false });
                    infoFound.classList.add('d-none');
                    btnSave.disabled = true;
                    currentAsignacionEstudianteId = null;
                }
            } catch (err) {
                console.error(err);
            }
        };

        btnSearch.onclick = searchHandler;
        inputCode.onkeypress = (e) => { if (e.key === 'Enter') { e.preventDefault(); searchHandler(); } };
    }

    // Cargar cursos en el modal
    (async () => {
        const select = document.getElementById('asigCursoSelect');
        if (!select) return;
        try {
            const cursos = await apiGet('/cursos/');
            select.innerHTML = '<option value="">-- Seleccionar Curso --</option>' +
                cursos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        } catch (err) {
            select.innerHTML = '<option value="">Error al cargar cursos</option>';
        }
    })();

    // Form submit
    const form = document.getElementById('asignacionCRUDForm');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const cursoId = document.getElementById('asigCursoSelect').value;
            if (!currentAsignacionEstudianteId || !cursoId) return;

            try {
                await apiPost('/cursos/inscripcion', {
                    estudiante_id: currentAsignacionEstudianteId,
                    curso_id: parseInt(cursoId)
                });
                Swal.fire({ icon: 'success', title: 'Asignación exitosa', timer: 1500, showConfirmButton: false });
                bootstrap.Modal.getInstance(document.getElementById('asignacionCRUDModal')).hide();
                loadAsignacionesTable();
            } catch (err) {
                Swal.fire({ icon: 'error', title: 'Error', text: err.message });
            }
        };
    }
}

window.showAsignacionModal = () => {
    const modalEl = document.getElementById('asignacionCRUDModal');
    if (!modalEl) return;

    // Reset form
    document.getElementById('asignacionCRUDForm').reset();
    document.getElementById('asigStudentFoundInfo').classList.add('d-none');
    document.getElementById('btnSaveAsignacion').disabled = true;
    currentAsignacionEstudianteId = null;

    new bootstrap.Modal(modalEl).show();
};

window.deleteAsignacion = async (estudianteId, cursoId, studentName, cursoName) => {
    const result = await Swal.fire({
        title: '¿Eliminar asignación?',
        html: `¿Estás seguro de quitar a <b>${studentName}</b> de <b>${cursoName}</b>?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await apiDelete(`/cursos/inscripcion/${estudianteId}/${cursoId}`);
            Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1500, showConfirmButton: false });
            loadAsignacionesTable();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    }
};

/* ==========================================================
   NOTAS (Admin/Docente)
   ========================================================== */

/**
 * Genera el encabezado del modal de notas (Info Estudiante, Curso, Código)
 */
function _getNotaModalHeaderHTML() {
    return `
        <!-- Header 3 Columns -->
        <div class="row g-3 mb-4 p-3 rounded" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05);">
            <!-- IZQUIERDA: Info Estudiante/Docente -->
            <div class="col-12 col-md-4 border-end-md border-secondary border-opacity-25">
                <div class="mb-3">
                    <label class="text-muted small uppercase fw-bold d-block">STUDENT NAME</label>
                    <span id="infoStudentName" class="text-info fw-bold">—</span>
                </div>
                <div class="mb-3">
                    <label class="text-muted small uppercase fw-bold d-block">LEVEL</label>
                    <span id="infoLevel" class="text-white">—</span>
                </div>
                <div class="mb-0">
                    <label class="text-muted small uppercase fw-bold d-block">TEACHER</label>
                    <span id="infoTeacher" class="text-white">—</span>
                </div>
            </div>

            <!-- CENTRO: Info Curso/Horario -->
            <div class="col-12 col-md-4 border-end-md border-secondary border-opacity-25">
                <div class="mb-3">
                    <label class="text-muted small uppercase fw-bold">COURSE SELECTION</label>
                    <select class="form-select form-select-sm" id="notaCursoId" required onchange="_handleCourseChange(this.value)">
                        <option value="">Select Course...</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label class="text-muted small uppercase fw-bold">ENDING DATE</label>
                    <input type="date" class="form-control form-control-sm" id="notaEndingDate">
                </div>
                <div class="mb-0">
                    <label class="text-muted small uppercase fw-bold">RECOMMENDED LEVEL</label>
                    <input type="text" class="form-control form-control-sm" id="notaRecommendedLevel" placeholder="Next Level">
                </div>
            </div>

            <!-- DERECHA: Codigo/Status -->
            <div class="col-12 col-md-4">
                <div class="mb-3">
                    <label class="text-muted small uppercase fw-bold">STUDENT CODE</label>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text bg-transparent border-secondary text-muted">BTRM-</span>
                        <input type="text" class="form-control" id="notaEstudianteCodigo" placeholder="204" oninput="_handleStudentCodeChange(this.value)" required>
                    </div>
                </div>
                <div class="mt-4">
                    <div class="d-flex justify-content-between align-items-center p-2 rounded" style="background: rgba(0,0,0,0.3);">
                        <div class="form-check form-check-inline mb-0">
                            <input class="form-check-input" type="radio" name="notaPassed" id="statusPassed" value="true" checked>
                            <label class="form-check-label text-success small fw-bold" for="statusPassed">APROBADO</label>
                        </div>
                        <div class="form-check form-check-inline mb-0">
                            <input class="form-check-input" type="radio" name="notaPassed" id="statusFailed" value="false">
                            <label class="form-check-label text-danger small fw-bold" for="statusFailed">REPROBADO</label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Genera la tabla de evaluación detallada
 */
function _getNotaModalAssessmentHTML() {
    const skills = [
        { id: 'reading', label: 'READING COMPREHENSION', max: 20 },
        { id: 'listening', label: 'LISTENING COMPREHENSION', max: 20 },
        { id: 'writing', label: 'WRITING', max: 15 },
        { id: 'speaking', label: 'SPEAKING', max: 15 },
        { id: 'participation', label: 'CLASS PARTICIPATION & ENGAGEMENT', max: 15 },
        { id: 'attendance', label: 'ATTENDANCE & RESPONSABILITY', max: 15 }
    ];

    return `
        <div class="table-responsive">
            <table class="table table-dark table-borderless align-middle assessment-table mb-0" style="table-layout: fixed; min-width: 320px;">
                <thead>
                    <tr class="text-center" style="background: rgba(0,0,0,0.5);">
                        <th style="width: 45%; border-bottom: 2px solid var(--primary-color);" class="text-start ps-3">SKILLS</th>
                        <th style="width: 27.5%; border-bottom: 2px solid var(--primary-color);">MIDTERM</th>
                        <th style="width: 27.5%; border-bottom: 2px solid var(--primary-color);">FINAL</th>
                        <th class="d-none d-lg-table-cell" style="width: 35%; border-bottom: 2px solid var(--primary-color);">COMMENTS</th>
                    </tr>
                </thead>
                <tbody>
                    ${skills.map((s, index) => `
                        <tr>
                            <td class="fw-bold text-light py-2 small ps-3 text-wrap" style="line-height: 1.2;">${s.label}</td>
                            <td class="text-center px-1">
                                <div class="input-group input-group-sm flex-nowrap mx-auto" style="max-width: 90px;">
                                    <input type="number" class="form-control form-control-sm text-center score-input fw-bold px-1" id="m_${s.id}" max="${s.max}" min="0" value="0">
                                    <span class="input-group-text bg-dark border-secondary text-muted px-1 small" style="font-size: 0.7rem;">/${s.max}</span>
                                </div>
                            </td>
                            <td class="text-center px-1">
                                <div class="input-group input-group-sm flex-nowrap mx-auto" style="max-width: 90px;">
                                    <input type="number" class="form-control form-control-sm text-center score-input fw-bold px-1" id="f_${s.id}" max="${s.max}" min="0" value="0">
                                    <span class="input-group-text bg-dark border-secondary text-muted px-1 small" style="font-size: 0.7rem;">/${s.max}</span>
                                </div>
                            </td>
                            ${index === 0 ? `
                            <td rowspan="6" class="p-3 bg-black bg-opacity-25 d-none d-lg-table-cell align-top">
                                <div class="mb-4">
                                    <label class="small fw-bold text-info mb-2"><i class="bi bi-chat-left-dots"></i> MIDTERM COMMENT</label>
                                    <textarea class="form-control bg-dark border-secondary bg-opacity-50 text-white rounded-3 shadow-none small" id="m_comment" rows="5" placeholder="Observations..."></textarea>
                                </div>
                                <div class="mb-0">
                                    <label class="small fw-bold text-primary mb-2"><i class="bi bi-chat-right-dots"></i> FINAL COMMENT</label>
                                    <textarea class="form-control bg-dark border-secondary bg-opacity-50 text-white rounded-3 shadow-none small" id="f_comment" rows="5" placeholder="Observations..."></textarea>
                                </div>
                            </td>` : ''}
                        </tr>
                    `).join('')}
                    
                    <tr class="bg-dark fw-bold border-top border-secondary border-opacity-50">
                        <td class="text-end text-muted small pe-3">TOTAL %</td>
                        <td class="text-center"><span id="m_pretotal" class="text-info">0</span><span class="text-muted small">/100</span></td>
                        <td class="text-center" colspan="2"><span id="f_pretotal" class="text-primary">0</span><span class="text-muted small">/100</span></td>
                    </tr>
                    <tr class="bg-primary bg-opacity-10 fw-bold">
                        <td colspan="2" class="text-end text-primary pe-3">OVERALL AVG</td>
                        <td class="text-center text-primary fs-5" colspan="2"><span id="overall_total">0</span><span class="small" style="font-size:0.7rem"> / 100</span></td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Genera el panel de comentarios para vista móvil
 */
function _getNotaModalCommentsHTML() {
    return `
        <div class="row g-3">
            <div class="col-12">
                <label class="small fw-bold text-info mb-2"><i class="bi bi-chat-left-dots me-2"></i>MIDTERM COMMENT</label>
                <textarea class="form-control bg-dark border-secondary bg-opacity-50 text-white rounded-3 shadow-none" id="m_comment_mob" rows="4" placeholder="Observations..."></textarea>
            </div>
            <div class="col-12">
                <label class="small fw-bold text-primary mb-2"><i class="bi bi-chat-right-dots me-2"></i>FINAL COMMENT</label>
                <textarea class="form-control bg-dark border-secondary bg-opacity-50 text-white rounded-3 shadow-none" id="f_comment_mob" rows="4" placeholder="Observations..."></textarea>
            </div>
        </div>
    `;
}

async function renderNotas(container) {
    container.innerHTML = `
        <div class="section-header mb-4" data-aos="fade-up">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h4 class="text-white fw-bold mb-1">
                        <i class="bi bi-clipboard-data me-2 text-primary"></i>Centro de Notas
                    </h4>
                    <p class="text-muted small mb-0">Registra y consulta las calificaciones de los estudiantes.</p>
                </div>
                <div class="badge bg-success bg-opacity-10 text-success px-3 py-2 border border-success border-opacity-25 rounded-pill d-none d-md-flex align-items-center gap-2">
                    <i class="bi bi-bar-chart-fill"></i>
                    CALIFICACIONES
                </div>
            </div>
        </div>

        <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="mb-0">Lista de Notas</h5>
            <button class="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3"
                onclick="showNotaModal()">
                <i class="bi bi-journal-plus fs-6"></i>
                <span>Registrar nota</span>
            </button>
        </div>
        <div class="table-card mt-3">
            <div class="input-group glass-search mb-4 w-100" style="max-width: 400px;">
                <span class="input-group-text bg-transparent border-end-0"><i class="bi bi-search text-muted"></i></span>
                <input type="text" class="form-control border-start-0 ps-0 text-white" id="notasSearch" placeholder="Buscar código, nota o curso...">
            </div>
            <div class="table-responsive">
                <table class="table table-hover" id="notasTable">
                    <thead>
                        <tr class="text-muted small uppercase fw-bold" style="letter-spacing: 0.5px;">
                            <th class="ps-4">STUDENT</th>
                            <th>COURSE</th>
                            <th class="text-center">AVG GRADE</th>
                            <th>STATUS & PROGRESS</th>
                            ${hasRole(['admin']) ? '<th class="text-end pe-4">ACTIONS</th>' : ''}
                        </tr>
                    </thead>
                    <tbody><tr><td colspan="${hasRole(['admin']) ? 5 : 4}" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr></tbody>
                </table>
            </div>
            <div id="notasPagination" class="mt-3"></div>
        </div>

        <!-- MODAL REGISTRAR NOTA -->
        <div class="modal fade modal-dashboard" id="notaModal" tabindex="-1">
            <div class="modal-dialog modal-xl modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title d-flex align-items-center">
                            <i class="bi bi-file-earmark-spreadsheet me-2 text-primary"></i>
                            <span>Student Report Card</span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="notaForm" novalidate>
                        <div class="modal-body p-0">
                            <!-- TABS PARA MÓVIL (Visibles solo en < 992px) -->
                            <ul class="nav nav-tabs nota-modal-tabs border-bottom border-secondary border-opacity-10 d-lg-none" role="tablist">
                                <li class="nav-item flex-fill text-center">
                                    <a class="nav-link active" data-bs-toggle="tab" href="#step-info" role="tab"><i class="bi bi-info-circle me-1"></i>INFO</a>
                                </li>
                                <li class="nav-item flex-fill text-center">
                                    <a class="nav-link" data-bs-toggle="tab" href="#step-scores" role="tab"><i class="bi bi-list-check me-1"></i>SCORES</a>
                                </li>
                                <li class="nav-item flex-fill text-center">
                                    <a class="nav-link" data-bs-toggle="tab" href="#step-comments" role="tab"><i class="bi bi-chat-dots me-1"></i>COMMS</a>
                                </li>
                            </ul>

                            <div class="p-3 p-lg-4">
                                <input type="hidden" id="notaId">
                                
                                <!-- Contenedor Flexible: Pestañas en móvil, Lista en escritorio -->
                                <div class="tab-content">
                                    <!-- SECCIÓN 1: INFO -->
                                    <div class="custom-section-pane tab-pane fade show active" id="step-info" role="tabpanel">
                                        ${_getNotaModalHeaderHTML()}
                                    </div>

                                    <!-- SECCIÓN 2: SCORES -->
                                    <div class="custom-section-pane tab-pane fade show active" id="step-scores" role="tabpanel">
                                        ${_getNotaModalAssessmentHTML()}
                                    </div>

                                    <!-- SECCIÓN 3: COMMENTS (Solo móvil, en desktop >= 992px se oculta) -->
                                    <div class="custom-section-pane tab-pane fade" id="step-comments" role="tabpanel">
                                        ${_getNotaModalCommentsHTML()}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer border-top border-secondary border-opacity-10 p-3">
                            <button type="submit" class="btn btn-primary w-100 py-2 fw-bold">
                                <i class="bi bi-cloud-arrow-up me-2"></i>Save Report Card
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    loadNotasTable();
    initNotaForm();
}

let _notasCache = [];
let _notasUserMap = {};
let _notasCursoMap = {};

async function loadNotasTable() {
    try {
        const [notas, users, cursos] = await Promise.all([
            apiGet('/notas/'),
            apiGet('/usuarios/'),
            apiGet('/cursos/')
        ]);

        // Mapas de lookup: id → datos completos
        _notasUserMap = {};
        users.forEach(u => _notasUserMap[u.id] = { id: u.id, codigo: u.codigo, nombre: `${u.nombre} ${u.apellido}` });

        _notasCursoMap = {}; // Guardaremos el objeto completo para autocompletar el modal
        cursos.forEach(c => {
            _notasCursoMap[c.id] = c;
        });

        _notasDocenteMap = {};
        users.filter(u => u.rol === 'docente').forEach(d => {
            _notasDocenteMap[d.id] = `${d.nombre} ${d.apellido}`;
        });

        // Filtrar notas si es docente: solo ver notas de sus cursos
        let notasFiltradas = notas;
        if (hasRole(['docente'])) {
            const misCursosIds = cursos.filter(c => c.docente_id == getCurrentUser().id).map(c => c.id);
            notasFiltradas = notas.filter(n => misCursosIds.includes(n.curso_id));
        }

        _notasCache = notasFiltradas;
        renderNotasRows(notasFiltradas);
        initNotasSearch();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

window.changeNotasPage = (page) => {
    window.paginationState.notas.page = page;
    _internalRenderNotas();
};

function renderNotasRows(notas) {
    window.paginationState.notas = window.paginationState.notas || { page: 1, size: 6 };
    window.paginationState.notas.data = notas;
    window.paginationState.notas.page = 1;
    _internalRenderNotas();
}

function _internalRenderNotas() {
    const state = window.paginationState.notas;
    const tbody = document.querySelector('#notasTable tbody');
    if (!tbody) return;
    if (!state.data || state.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${hasRole(['admin']) ? 5 : 4}" class="text-center text-muted py-4">No se encontraron notas registradas</td></tr>`;
        const pgn = document.getElementById('notasPagination');
        if (pgn) pgn.innerHTML = '';
        return;
    }

    const pageData = paginateArray(state.data, state.page, state.size);
    tbody.innerHTML = pageData.map(n => {
        const u = _notasUserMap[n.estudiante_id] || { codigo: n.estudiante_id, nombre: '' };
        const mid_total = n.midterm_reading + n.midterm_listening + n.midterm_writing + n.midterm_speaking + n.midterm_participation + n.midterm_attendance;
        const fin_total = n.final_reading + n.final_listening + n.final_writing + n.final_speaking + n.final_participation + n.final_attendance;
        const overall = (mid_total + fin_total) / 2;

        return `
        <tr class="align-middle">
            <td>
                <code class="text-info">${u.codigo}</code>
                ${u.nombre ? `<br><small class="text-muted">${u.nombre}</small>` : ''}
            </td>
            <td>${_notasCursoMap[n.curso_id]?.nombre || n.curso_id}</td>
            <td class="text-center">
                <div class="fs-5 fw-bold text-primary">${Math.round(overall)}</div>
                <small class="text-muted">Avg. Score</small>
            </td>
            <td>
                <div class="d-flex align-items-center gap-2">
                    ${n.is_passed
                ? '<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2">PASSED</span>'
                : '<span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2">FAILED</span>'}
                    <span class="text-muted small">${n.ending_date || ''}</span>
                </div>
                ${n.recommended_level ? `<div class="text-muted small mt-1">Next: ${n.recommended_level}</div>` : ''}
            </td>
            <td class="text-end pe-4">
                <div class="d-flex justify-content-end gap-1">
                    <button class="btn btn-sm btn-outline-info border-0 py-1 px-2 opacity-75 hover-opacity-100" onclick="descargarNotaPDF(${n.id}, '${(_notasCursoMap[n.curso_id]?.nombre || 'report').replace(/'/g, "\\'")}')" title="Preview PDF"><i class="bi bi-file-earmark-pdf"></i></button>
                    ${hasRole(['admin']) ? `
                    <button class="btn btn-sm btn-outline-light border-0 py-1 px-2 opacity-75 hover-opacity-100" onclick="editNota(${n.id})" title="Edit record"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger border-0 py-1 px-2 opacity-75 hover-opacity-100" onclick="deleteNota(${n.id})" title="Delete record"><i class="bi bi-trash"></i></button>
                    ` : ''}
                </div>
            </td>
        </tr>
        `;
    }).join('');

    renderPaginationControls('notasPagination', state.data.length, state.size, state.page, 'changeNotasPage');
}

function initNotasSearch() {
    const input = document.getElementById('notasSearch');
    if (!input) return;
    input.removeEventListener('input', _handleNotasSearch);
    input.addEventListener('input', _handleNotasSearch);
}

function _handleNotasSearch() {
    const query = this.value.toLowerCase().trim();
    if (!query) {
        renderNotasRows(_notasCache);
        return;
    }
    const filtered = _notasCache.filter(n => {
        const u = _notasUserMap[n.estudiante_id] || { codigo: '', nombre: '' };
        const matchEstudiante = u.codigo.toLowerCase().includes(query) || u.nombre.toLowerCase().includes(query);
        const cursoObj = _notasCursoMap[n.curso_id] || {};
        const cursoNombre = (cursoObj.nombre || '').toLowerCase();

        return matchEstudiante || cursoNombre.includes(query);
    });
    renderNotasRows(filtered);
}

function showNotaModal(skipShow = false) {
    const form = document.getElementById('notaForm');
    form.reset();
    form.classList.remove('was-validated');
    document.getElementById('notaId').value = '';

    // Poblamos el select de cursos
    const cursoSelect = document.getElementById('notaCursoId');
    cursoSelect.innerHTML = '<option value="">Select Course...</option>';

    // Filtrar si es docente
    let cursosVisibles = Object.values(_notasCursoMap);
    if (hasRole(['docente'])) {
        cursosVisibles = cursosVisibles.filter(c => c.docente_id == getCurrentUser().id);
    }

    if (cursosVisibles.length === 0 && hasRole(['docente'])) {
        cursoSelect.innerHTML = '<option value="">Sin cursos asignados (contacta al admin)...</option>';
    } else {
        cursosVisibles.forEach(c => {
            cursoSelect.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
        });
    }

    // Resetear info visual
    document.getElementById('infoStudentName').innerText = '—';
    document.getElementById('infoLevel').innerText = '—';
    document.getElementById('infoTeacher').innerText = '—';
    document.getElementById('m_pretotal').innerText = '0';
    document.getElementById('f_pretotal').innerText = '0';
    document.getElementById('overall_total').innerText = '0';

    if (!skipShow) {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('notaModal')).show();
    }
}

// Handlers dinámicos
window._handleCourseChange = (id) => {
    const curso = _notasCursoMap[id];
    if (curso) {
        document.getElementById('infoLevel').innerText = curso.nivel ? curso.nivel.nombre : 'N/A';
        document.getElementById('infoTeacher').innerText = curso.docente ? `${curso.docente.nombre} ${curso.docente.apellido}` : 'N/A';
    } else {
        document.getElementById('infoLevel').innerText = '—';
        document.getElementById('infoTeacher').innerText = '—';
    }
};

window._handleStudentCodeChange = (rawCode) => {
    const targetCode = `BTRM-${rawCode}`;
    const student = Object.values(_notasUserMap).find(u => u.codigo === targetCode);
    if (student) {
        document.getElementById('infoStudentName').innerText = student.nombre;
    } else {
        document.getElementById('infoStudentName').innerText = '—';
    }
};


// Función auxiliar para calcular totales en el modal
function _updateReportCardTotals() {
    const midFields = ['m_reading', 'm_listening', 'm_writing', 'm_speaking', 'm_participation', 'm_attendance'];
    const finFields = ['f_reading', 'f_listening', 'f_writing', 'f_speaking', 'f_participation', 'f_attendance'];

    let midSum = 0;
    midFields.forEach(id => {
        const val = parseInt(document.getElementById(id).value) || 0;
        midSum += val;
    });

    let finSum = 0;
    finFields.forEach(id => {
        const val = parseInt(document.getElementById(id).value) || 0;
        finSum += val;
    });

    const overall = Math.round((midSum + finSum) / 2);

    document.getElementById('m_pretotal').innerText = midSum;
    document.getElementById('f_pretotal').innerText = finSum;
    document.getElementById('overall_total').innerText = overall;
}


async function editNota(id) {
    try {
        const notas = await apiGet('/notas/');
        const n = notas.find(item => item.id === id);
        if (!n) throw new Error('Nota no encontrada');

        const user = await apiGet(`/usuarios/${n.estudiante_id}`);

        // Preparar modal (poblar curso dropdown primero) sin mostrar todavia
        showNotaModal(true);

        document.getElementById('notaId').value = n.id;
        document.getElementById('notaEstudianteCodigo').value = user.codigo.replace(/^BTRM-/i, '');
        document.getElementById('notaCursoId').value = n.curso_id;
        document.getElementById('notaEndingDate').value = n.ending_date || '';
        document.getElementById('notaRecommendedLevel').value = n.recommended_level || '';

        // Disparar handlers para info visual
        _handleCourseChange(n.curso_id);
        _handleStudentCodeChange(user.codigo.replace(/^BTRM-/i, ''));

        // Midterm
        document.getElementById('m_reading').value = n.midterm_reading;
        document.getElementById('m_listening').value = n.midterm_listening;
        document.getElementById('m_writing').value = n.midterm_writing;
        document.getElementById('m_speaking').value = n.midterm_speaking;
        document.getElementById('m_participation').value = n.midterm_participation;
        document.getElementById('m_attendance').value = n.midterm_attendance;
        document.getElementById('m_comment').value = n.midterm_comment || '';
        if (document.getElementById('m_comment_mob')) document.getElementById('m_comment_mob').value = n.midterm_comment || '';

        // Final
        document.getElementById('f_reading').value = n.final_reading;
        document.getElementById('f_listening').value = n.final_listening;
        document.getElementById('f_writing').value = n.final_writing;
        document.getElementById('f_speaking').value = n.final_speaking;
        document.getElementById('f_participation').value = n.final_participation;
        document.getElementById('f_attendance').value = n.final_attendance;
        document.getElementById('f_comment').value = n.final_comment || '';
        if (document.getElementById('f_comment_mob')) document.getElementById('f_comment_mob').value = n.final_comment || '';

        // Status
        if (n.is_passed) document.getElementById('statusPassed').checked = true;
        else document.getElementById('statusFailed').checked = true;

        _updateReportCardTotals();
        bootstrap.Modal.getOrCreateInstance(document.getElementById('notaModal')).show();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}


async function deleteNota(id) {
    const result = await Swal.fire({
        title: '¿Eliminar nota?', icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#E17055', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar',
    });
    if (result.isConfirmed) {
        try {
            await apiDelete(`/notas/${id}`);
            Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1500, showConfirmButton: false });
            loadNotasTable();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    }
}

function initNotaForm() {
    const form = document.getElementById('notaForm');
    if (!form) return;

    // Listener para cálculos automáticos y validación estricta
    form.querySelectorAll('.score-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const max = parseInt(e.target.max) || 20;
            let val = parseInt(e.target.value) || 0;

            // Validación estricta en tiempo real
            if (val > max) {
                e.target.value = max;
                val = max;
            }
            if (val < 0) {
                e.target.value = 0;
                val = 0;
            }

            _updateReportCardTotals();
        });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

        const id = document.getElementById('notaId').value;
        const rawEstudiante = document.getElementById('notaEstudianteCodigo').value.trim();
        if (!/^\d+$/.test(rawEstudiante)) {
            Swal.fire({ icon: 'warning', title: 'Código inválido', text: 'El código del estudiante debe contener solo números.' });
            return;
        }

        const data = {
            estudiante_codigo: `BTRM-${rawEstudiante}`,
            curso_id: parseInt(document.getElementById('notaCursoId').value),
            ending_date: document.getElementById('notaEndingDate').value,
            recommended_level: document.getElementById('notaRecommendedLevel').value,
            is_passed: document.querySelector('input[name="notaPassed"]:checked').value === 'true',

            midterm_reading: parseInt(document.getElementById('m_reading').value) || 0,
            midterm_listening: parseInt(document.getElementById('m_listening').value) || 0,
            midterm_writing: parseInt(document.getElementById('m_writing').value) || 0,
            midterm_speaking: parseInt(document.getElementById('m_speaking').value) || 0,
            midterm_participation: parseInt(document.getElementById('m_participation').value) || 0,
            midterm_attendance: parseInt(document.getElementById('m_attendance').value) || 0,
            midterm_comment: document.getElementById('m_comment').value.trim(),

            final_reading: parseInt(document.getElementById('f_reading').value) || 0,
            final_listening: parseInt(document.getElementById('f_listening').value) || 0,
            final_writing: parseInt(document.getElementById('f_writing').value) || 0,
            final_speaking: parseInt(document.getElementById('f_speaking').value) || 0,
            final_participation: parseInt(document.getElementById('f_participation').value) || 0,
            final_attendance: parseInt(document.getElementById('f_attendance').value) || 0,
            final_comment: document.getElementById('f_comment').value.trim()
        };

        try {
            if (id) {
                // Para actualizar, usamos PUT. NotaUpdate no requiere curso_id/estudiante_id en el schema
                const updateData = { ...data };
                delete updateData.estudiante_codigo;
                delete updateData.curso_id;
                await apiPut(`/notas/${id}`, updateData);
            } else {
                await apiPost('/notas/', data);
            }

            // Cerrar modal y limpiar backdrop
            const modalEl = document.getElementById('notaModal');
            const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
            modalInstance.hide();

            // Garantizar limpieza de backdrop persistente
            setTimeout(() => {
                document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
                document.body.classList.remove('modal-open');
                document.body.style.paddingRight = '';
            }, 300);

            Swal.fire({ icon: 'success', title: id ? 'Updated' : 'Registered', timer: 1500, showConfirmButton: false });
            loadNotasTable();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    });
}


/* ==========================================================
   MIS NOTAS (Estudiante)
   ========================================================== */

async function renderMisNotas(container) {
    // Mostrar loader mientras verificamos estado de pago
    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="text-muted mt-2">Verificando estado de pagos...</p>
        </div>
    `;

    try {
        const estadoPago = await apiGet('/pagos/mi-estado');

        // ─── CASO 1: Sin registro de pago ───
        if (!estadoPago.registrado) {
            container.innerHTML = `
                <div class="dash-stat-card" style="text-align: center; padding: 3rem 2rem; border: 1px solid rgba(255, 193, 7, 0.3); background: rgba(255, 193, 7, 0.05);">
                    <div style="width: 80px; height: 80px; background: rgba(255, 193, 7, 0.1); border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto 1.5rem auto; border: 1px solid rgba(255, 193, 7, 0.3);">
                        <i class="bi bi-exclamation-triangle-fill" style="font-size: 2rem; color: #ffc107;"></i>
                    </div>
                    <h4 class="text-white mb-2">Registro de pago requerido</h4>
                    <p class="text-muted mb-3">No tienes ninguna consigna de pago asignada. Debes registrarte en una consigna de pago para poder acceder a tus notas y calificaciones.</p>
                    <p class="text-muted small">Contacta con la administración de Binglish para que te asignen tu plan de pago correspondiente.</p>
                </div>
            `;
            return;
        }

        // ─── CASO 2: Tiene deudas pendientes ───
        if (!estadoPago.al_dia) {
            container.innerHTML = `
                <div class="dash-stat-card" style="text-align: center; padding: 3rem 2rem; border: 1px solid rgba(255, 71, 87, 0.3); background: rgba(255, 71, 87, 0.05);">
                    <div style="width: 80px; height: 80px; background: rgba(255, 71, 87, 0.1); border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto 1.5rem auto; border: 1px solid rgba(255, 71, 87, 0.3); box-shadow: 0 0 20px rgba(255, 71, 87, 0.15);">
                        <i class="bi bi-lock-fill" style="font-size: 2rem; color: #ff4757;"></i>
                    </div>
                    <h4 class="text-white mb-2">Acceso restringido por pago pendiente</h4>
                    <p class="text-muted mb-1">Regulariza tu pago para acceder a tus notas y calificaciones.</p>
                    <p style="font-size: 2rem; font-weight: 800; color: #ff4757; margin: 1rem 0;">
                        Bs. ${estadoPago.deuda_pendiente.toFixed(2)}
                    </p>
                    <p class="text-muted small mb-0">Monto total pendiente. Acércate a la administración de Binglish para regularizar tu situación.</p>
                </div>
            `;
            return;
        }

        // ─── CASO 3: Al día → Mostrar notas normalmente ───
        container.innerHTML = `
            <div class="row g-4 mb-4">
                <div class="col-12">
                    <div class="d-flex align-items-center justify-content-between flex-wrap gap-3">
                        <div>
                            <h5 class="mb-0 text-white fw-bold"><i class="bi bi-journal-text me-2 text-primary"></i>Boletín de Notas</h5>
                            <p class="text-white-50 small mt-2 mb-0">Consulta detalladamente tu historial académico y rendimiento en los cursos inscritos.</p>
                        </div>
                        <span class="badge bg-success bg-opacity-10 text-success px-3 py-2 border border-success border-opacity-25 rounded-pill">
                            <i class="bi bi-mortarboard-fill me-1"></i> Académico
                        </span>
                    </div>
                </div>
            </div>
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0">Lista de Calificaciones</h5>
            </div>
            <div class="table-card mt-3">
                <div class="input-group glass-search mb-4 w-100" style="max-width: 400px;">
                    <span class="input-group-text bg-transparent border-end-0"><i class="bi bi-search text-muted"></i></span>
                    <input type="text" class="form-control border-start-0 ps-0 text-white" id="misNotasSearch" placeholder="Buscar por curso o descripción...">
                </div>
                <div class="table-responsive">
                    <table class="table table-hover" id="misNotasTable">
                        <thead>
                            <tr class="text-muted small uppercase fw-bold" style="letter-spacing: 0.5px;">
                                <th class="ps-4">COURSE</th>
                                <th class="text-center">FINAL GRADE</th>
                                <th class="text-center">STATUS</th>
                                <th>LAST UPDATE</th>
                                <th class="text-end pe-4">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody><tr><td colspan="5" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr></tbody>
                    </table>
                </div>
                <div id="misNotasPagination" class="mt-3"></div>
            </div>
        `;

        // Fetch grades and courses for name lookup
        const [notas, cursos] = await Promise.all([
            apiGet('/notas/mis-notas'),
            apiGet('/cursos/')
        ]);

        const tbody = document.querySelector('#misNotasTable tbody');
        if (notas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No tienes notas registradas aún.</td></tr>';
            return;
        }

        // Cache courses map for faster lookup
        window._misNotasCursoMap = {};
        cursos.forEach(c => { window._misNotasCursoMap[c.id] = c.nombre; });

        renderMisNotasRows(notas);
        initMisNotasSearch();

    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

async function descargarMisNotasPDF() {
    try {
        const blob = await apiGetBlob('/notas/mis-notas/pdf');
        downloadBlob(blob, 'mis_notas.pdf');
        Swal.fire({ icon: 'success', title: 'PDF descargado', timer: 1500, showConfirmButton: false });
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

let _misNotasCache = [];

function initMisNotasSearch() {
    const input = document.getElementById('misNotasSearch');
    if (!input) return;
    input.removeEventListener('input', _handleMisNotasSearch);
    input.addEventListener('input', _handleMisNotasSearch);
}

function _handleMisNotasSearch() {
    const query = this.value.toLowerCase().trim();
    if (!query) {
        renderMisNotasRows(_misNotasCache);
        return;
    }
    const filtered = _misNotasCache.filter(n => {
        const curso = String(n.curso_id).toLowerCase();
        const desc = (n.descripcion || '').toLowerCase();
        return curso.includes(query) || desc.includes(query);
    });
    renderMisNotasRows(filtered);
}

window.changeMisNotasPage = (page) => {
    window.paginationState.misNotas.page = page;
    _internalRenderMisNotas();
};

function renderMisNotasRows(notas) {
    _misNotasCache = notas;
    window.paginationState.misNotas = window.paginationState.misNotas || { page: 1, size: 6 };
    window.paginationState.misNotas.data = notas;
    window.paginationState.misNotas.page = 1;
    _internalRenderMisNotas();
}

function _internalRenderMisNotas() {
    const state = window.paginationState.misNotas;
    const tbody = document.querySelector('#misNotasTable tbody');
    if (!tbody) return;
    if (!state.data || state.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No se encontraron notas</td></tr>';
        const pgn = document.getElementById('misNotasPagination');
        if (pgn) pgn.innerHTML = '';
        return;
    }

    const pageData = paginateArray(state.data, state.page, state.size);
    tbody.innerHTML = pageData.map(n => {
        // Calculate scores (Average of midterm and final)
        const midterm = (n.midterm_reading + n.midterm_listening + n.midterm_writing + n.midterm_speaking + n.midterm_participation + n.midterm_attendance);
        const final = (n.final_reading + n.final_listening + n.final_writing + n.final_speaking + n.final_participation + n.final_attendance);
        const overall = Math.round((midterm + final) / 2);

        const courseName = window._misNotasCursoMap ? window._misNotasCursoMap[n.curso_id] : `Curso #${n.curso_id}`;

        return `
        <tr class="align-middle">
            <td class="ps-4">
                <div class="fw-bold text-white mb-0">${courseName}</div>
            </td>
            <td class="text-center">
                <span class="fs-5 fw-bold" style="color: ${overall >= 70 ? 'var(--accent)' : '#ff4757'};">${overall}</span>
                <small class="text-muted d-block" style="font-size: 0.7rem;">Promedio Final</small>
            </td>
            <td class="text-center">
                ${n.is_passed
                ? '<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2">Approved</span>'
                : '<span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2">Failed</span>'}
            </td>
            <td>
                <div class="small"><i class="bi bi-clock-history me-1"></i> ${n.fecha ? new Date(n.fecha).toLocaleDateString() : '—'}</div>
                <div class="text-muted" style="font-size: 0.7rem;">${n.ending_date || ''}</div>
            </td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-outline-danger border-0 py-1 px-3 d-inline-flex align-items-center gap-2" 
                        onclick="descargarNotaPDF(${n.id}, '${courseName.replace(/'/g, "\\'")}')">
                    <i class="bi bi-file-earmark-pdf fs-6"></i>
                    <span>PDF</span>
                    <i class="bi bi-download"></i>
                </button>
            </td>
        </tr>
        `;
    }).join('');

    renderPaginationControls('misNotasPagination', state.data.length, state.size, state.page, 'changeMisNotasPage');
}

async function descargarNotaPDF(notaId, courseName) {
    try {
        Swal.fire({
            title: 'Descargando...',
            didOpen: () => { Swal.showLoading(); },
            allowOutsideClick: false
        });
        const blob = await apiGetBlob(`/notas/${notaId}/pdf`);
        const safeName = courseName ? courseName.replace(/[^a-z0-9]/gi, '_') : 'nota';
        downloadBlob(blob, `mis_notas_${safeName}.pdf`);
        Swal.fire({ icon: 'success', title: 'Descarga completa', timer: 1000, showConfirmButton: false });
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error al descargar', text: err.message });
    }
}

/* ==========================================================
   PAGOS (Admin) — Gestión de consignas y pagos
   ========================================================== */

let _pagosCache = [];
let _consignasCache = [];

async function renderPagos(container) {
    container.innerHTML = `
        <div class="row g-4 mb-4">
            <div class="col-12">
                <div class="d-flex align-items-center justify-content-between">
                    <h5 class="mb-0 text-dark fw-bold"><i class="bi bi-credit-card me-2 text-primary"></i>Centro de Pagos</h5>
                    <span class="badge bg-success bg-opacity-10 text-success px-3 py-2 border border-success border-opacity-25 rounded-pill">
                        <i class="bi bi-wallet-fill me-1"></i> Administración
                    </span>
                </div>
                <p class="text-muted small mt-2 mb-0">Gestiona las consignas de pago y asigna planes a los estudiantes.</p>
            </div>
        </div>

        <ul class="nav nav-tabs nav-tabs-glass mb-4" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link active" id="tab-estudiantes" data-bs-toggle="tab" data-bs-target="#pane-estudiantes" type="button" role="tab">Pagos Estudiantes</button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" id="tab-catalogo" data-bs-toggle="tab" data-bs-target="#pane-catalogo" type="button" role="tab">Catálogo de Consignas</button>
            </li>
        </ul>

        <div class="tab-content">
            <!-- ========== PESTAÑA: PAGOS ESTUDIANTES ========== -->
            <div class="tab-pane fade show active" id="pane-estudiantes" role="tabpanel">
                <!-- Métricas -->
                <div class="row g-3 mb-4">
                    <div class="col-md-4">
                        <div class="dash-stat-card blue">
                            <div class="d-flex align-items-center justify-content-between">
                                <div><div class="text-muted small">Total Asignados</div><div class="fs-4 fw-bold" id="statPagosTotal">0</div></div>
                                <div class="dash-stat-icon blue"><i class="bi bi-people-fill"></i></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="dash-stat-card green">
                            <div class="d-flex align-items-center justify-content-between">
                                <div><div class="text-muted small">Pagados</div><div class="fs-4 fw-bold" id="statPagosPagados">0</div></div>
                                <div class="dash-stat-icon green"><i class="bi bi-check-circle-fill"></i></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="dash-stat-card orange">
                            <div class="d-flex align-items-center justify-content-between">
                                <div><div class="text-muted small">Pendientes / Vencidos</div><div class="fs-4 fw-bold" id="statPagosDeuda">0</div></div>
                                <div class="dash-stat-icon orange" style="color:#f39c12; background: rgba(243, 156, 18, 0.1);"><i class="bi bi-exclamation-circle-fill"></i></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tabla Toolbar y Filtros -->
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                    <div class="d-flex flex-wrap gap-2 flex-grow-1">
                        <div class="input-group glass-search" style="max-width: 300px;">
                            <span class="input-group-text bg-transparent border-end-0"><i class="bi bi-search text-muted"></i></span>
                            <input type="text" class="form-control border-start-0 ps-0 text-white" id="pagosSearch" placeholder="Buscar código o nombre...">
                        </div>
                        <div class="input-group glass-search" style="max-width: 180px;">
                            <span class="input-group-text bg-transparent border-end-0"><i class="bi bi-funnel text-muted"></i></span>
                            <select class="form-select border-start-0 ps-0 text-white shadow-none" id="filterEstado" style="background: transparent;">
                                <option value="" style="background: #0d121c; color: #fff;">Todos</option>
                                <option value="pendiente" style="background: #0d121c; color: #fff;">Pendiente</option>
                                <option value="pagado" style="background: #0d121c; color: #fff;">Pagado</option>
                                <option value="vencido" style="background: #0d121c; color: #fff;">Vencido</option>
                            </select>
                        </div>
                    </div>
                    <button class="btn btn-primary d-flex align-items-center gap-2" onclick="showAsignarPagoModal()">
                        <i class="bi bi-plus-circle"></i> Asignar Pago
                    </button>
                </div>

                <!-- Tabla de pagos compacta -->
                <div class="table-card">
                    <div class="table-responsive">
                        <table class="table table-hover table-sm" id="pagosTable">
                            <thead>
                                <tr>
                                    <th>Estudiante</th>
                                    <th>Consigna</th>
                                    <th>Monto</th>
                                    <th>Estado</th>
                                    <th>Último Pago</th>
                                    <th class="text-end">Acciones</th>
                                </tr>
                            </thead>
                            <tbody><tr><td colspan="6" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr></tbody>
                        </table>
                    </div>
                </div>
                <div id="pagosPagination" class="mt-3"></div>
            </div>

            <!-- ========== PESTAÑA: CATÁLOGO DE CONSIGNAS ========== -->
            <div class="tab-pane fade" id="pane-catalogo" role="tabpanel">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h6 class="mb-0 text-muted">Asegurate de mantener actualizados los tipos de planes y mensualidades.</h6>
                    <button class="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3" onclick="showConsignaModal()">
                        <i class="bi bi-plus-circle fs-6"></i>
                        <span>Nueva Consigna</span>
                    </button>
                </div>
                
                <div class="row g-3" id="consignasChipsContainer">
                    <div class="col-12 text-center py-4"><div class="spinner-border text-primary"></div></div>
                </div>
            </div>
        </div>

        <!-- Modales de pagos...-->
        <div class="modal fade modal-dashboard" id="consignaModal" tabindex="-1">
            <div class="modal-dialog modal-sm">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Nueva Consigna</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="consignaForm" novalidate>
                            <input type="hidden" id="consignaId">
                            <div class="mb-3">
                                <label class="form-label">Código</label>
                                <input type="text" class="form-control" id="consignaCodigo" placeholder="Ej: A" maxlength="5" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Monto (Bs.)</label>
                                <input type="number" step="0.01" class="form-control" id="consignaMonto" placeholder="150.00" required>
                            </div>
                            <button type="submit" class="btn btn-primary w-100"><i class="bi bi-floppy"></i> Guardar</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>

        <div class="modal fade modal-dashboard" id="asignarPagoModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Asignar Pago a Estudiante</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="asignarPagoForm" novalidate>
                            <input type="hidden" id="pagoId">
                            <div class="mb-3">
                                <label class="form-label">Estudiante (Código numérico)</label>
                                <div class="input-group">
                                    <span class="input-group-text glass-login-prefix"><span style="background: linear-gradient(125deg, #4FC3F7, #00E5FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 700; letter-spacing: 1px;">BTRM-</span></span>
                                    <input type="text" class="form-control" id="pagoUsuarioCodigo" inputmode="numeric" pattern="[0-9]+" placeholder="Ej: 001" required>
                                    <div class="invalid-feedback">El código numérico es requerido.</div>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Consigna</label>
                                <select class="form-select" id="pagoConsignaId" required>
                                    <option value="">Selecciona una consigna...</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Observación (opcional)</label>
                                <input type="text" class="form-control" id="pagoObservacion" placeholder="Nota adicional...">
                            </div>
                            <div class="mb-3 d-none" id="pagoEstadoContainer">
                                <label class="form-label">Estado actual</label>
                                <select class="form-select" id="pagoEstado">
                                    <option value="pendiente">Pendiente</option>
                                    <option value="pagado">Pagado</option>
                                    <option value="vencido">Vencido</option>
                                </select>
                            </div>
                            <button type="submit" class="btn btn-primary w-100">Asignar</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;

    loadConsignasTable();
    loadPagosTable();
    initConsignaForm();
    initAsignarPagoForm();
    initPagosSearch();
}

async function loadConsignasTable() {
    try {
        const consignas = await apiGet('/pagos/consignas');
        _consignasCache = consignas;
        const container = document.getElementById('consignasChipsContainer');
        if (!container) return;

        if (consignas.length === 0) {
            container.innerHTML = '<div class="col-12 text-center text-muted py-4">No hay consignas registradas. Crea tu primer plan de pago mensual.</div>';
            return;
        }

        container.innerHTML = consignas.map(c => `
            <div class="col-auto">
                <div class="d-flex align-items-center p-2 px-3 border rounded-pill bg-dark bg-opacity-25" style="border-color: rgba(255,255,255,0.1)!important;">
                    <strong class="text-primary me-2">${c.codigo}</strong>
                    <span class="text-white me-3">Bs. ${parseFloat(c.monto).toFixed(2)}</span>
                    <button class="btn btn-sm text-info p-0 border-0 ms-auto me-2" onclick="showConsignaModal(${c.id})" title="Editar"><i class="bi bi-pencil-fill fs-6"></i></button>
                    <button class="btn btn-sm text-danger p-0 border-0" onclick="deleteConsigna(${c.id})" title="Eliminar"><i class="bi bi-x-circle-fill fs-5"></i></button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

async function loadPagosTable() {
    try {
        const pagos = await apiGet('/pagos/');
        _pagosCache = pagos;
        renderPagosRows(pagos);
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

function updatePagosMetrics(pagos) {
    const total = pagos.length;
    const pagados = pagos.filter(p => p.estado === 'pagado').length;
    const deuda = total - pagados; // pendientes + vencidos

    document.getElementById('statPagosTotal').innerText = total;
    document.getElementById('statPagosPagados').innerText = pagados;
    document.getElementById('statPagosDeuda').innerText = deuda;
}

window.changePagosPage = (page) => {
    window.paginationState.pagos.page = page;
    _internalRenderPagos();
};

function renderPagosRows(pagos) {
    updatePagosMetrics(_pagosCache); // Las métricas siempre muestran el total general asíncrono

    window.paginationState.pagos = window.paginationState.pagos || { page: 1, size: 6 };
    window.paginationState.pagos.data = pagos;
    window.paginationState.pagos.page = 1;
    _internalRenderPagos();
}

function _internalRenderPagos() {
    const state = window.paginationState.pagos;
    const tbody = document.querySelector('#pagosTable tbody');
    if (!tbody) return;
    if (!state.data || state.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No se encontraron registros de pago</td></tr>';
        const pgn = document.getElementById('pagosPagination');
        if (pgn) pgn.innerHTML = '';
        return;
    }

    const pageData = paginateArray(state.data, state.page, state.size);
    tbody.innerHTML = pageData.map(p => {
        let badge = '';
        if (p.estado === 'pagado') {
            badge = '<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25"><i class="bi bi-check-circle-fill me-1"></i>Pagado</span>';
        } else if (p.estado === 'vencido') {
            badge = '<span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25"><i class="bi bi-x-circle-fill me-1"></i>Vencido</span>';
        } else {
            badge = '<span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-50"><i class="bi bi-clock-fill me-1"></i>Pendiente</span>';
        }

        let studentInfo = `<code class="text-info">${p.estudiante ? p.estudiante.codigo : p.usuario_id}</code>`;
        if (p.estudiante) {
            studentInfo += `<br><small class="text-muted">${p.estudiante.nombre} ${p.estudiante.apellido}</small>`;
        }

        return `
            <tr class="align-middle">
                <td>${studentInfo}</td>
                <td><span class="badge bg-secondary bg-opacity-25 text-white">${p.consigna ? p.consigna.codigo : p.consigna_id}</span></td>
                <td class="fw-bold">Bs. ${p.consigna ? parseFloat(p.consigna.monto).toFixed(2) : '—'}</td>
                <td>${badge}</td>
                <td class="text-muted small">${p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString() : '—'}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-info border-0 py-0 px-2 fs-6 me-1" onclick="showAsignarPagoModal(${p.id})" title="Editar"><i class="bi bi-pencil"></i></button>
                    ${p.estado !== 'pagado' ? `<button class="btn btn-sm btn-success py-0 px-2 fs-6 me-1" onclick="marcarPagado(${p.id})" title="Marcar pagado"><i class="bi bi-check2"></i></button>` : ''}
                    ${p.estado !== 'vencido' && p.estado !== 'pagado' ? `<button class="btn btn-sm btn-warning py-0 px-2 fs-6 me-1 text-white" onclick="marcarVencido(${p.id})" title="Marcar vencido"><i class="bi bi-exclamation-triangle"></i></button>` : ''}
                    <button class="btn btn-sm btn-outline-danger border-0 py-0 px-2 fs-6" onclick="deletePago(${p.id})" title="Eliminar"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');

    renderPaginationControls('pagosPagination', state.data.length, state.size, state.page, 'changePagosPage');
}

function initPagosSearch() {
    const searchInput = document.getElementById('pagosSearch');
    const filterSelect = document.getElementById('filterEstado');

    function applyFilters() {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const estado = filterSelect ? filterSelect.value : '';

        const filtered = _pagosCache.filter(p => {
            const code = p.estudiante ? p.estudiante.codigo.toLowerCase() : String(p.usuario_id);
            const nombre = p.estudiante ? (p.estudiante.nombre + " " + p.estudiante.apellido).toLowerCase() : '';
            const matchStatus = estado === '' || p.estado === estado;
            const matchSearch = code.includes(query) || nombre.includes(query) || (p.consigna && p.consigna.codigo.toLowerCase().includes(query));
            return matchStatus && matchSearch;
        });
        renderPagosRows(filtered);
    }

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (filterSelect) filterSelect.addEventListener('change', applyFilters);
}

function showConsignaModal(id = null) {
    const form = document.getElementById('consignaForm');
    form.reset();
    form.classList.remove('was-validated');
    document.getElementById('consignaId').value = '';

    if (id) {
        const c = _consignasCache.find(x => x.id === id);
        if (c) {
            document.getElementById('consignaId').value = c.id;
            document.getElementById('consignaCodigo').value = c.codigo;
            document.getElementById('consignaMonto').value = c.monto;
        }
        document.querySelector('#consignaModal .modal-title').innerText = 'Editar Consigna';
    } else {
        document.querySelector('#consignaModal .modal-title').innerText = 'Nueva Consigna';
    }

    new bootstrap.Modal(document.getElementById('consignaModal')).show();
}

function initConsignaForm() {
    const form = document.getElementById('consignaForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }
        try {
            const id = document.getElementById('consignaId').value;
            const payload = {
                codigo: document.getElementById('consignaCodigo').value.trim().toUpperCase(),
                monto: parseFloat(document.getElementById('consignaMonto').value),
            };

            if (id) {
                await apiPut(`/pagos/consignas/${id}`, payload);
                Swal.fire({ icon: 'success', title: 'Consigna actualizada', timer: 1500, showConfirmButton: false });
            } else {
                await apiPost('/pagos/consignas', payload);
                Swal.fire({ icon: 'success', title: 'Consigna creada', timer: 1500, showConfirmButton: false });
            }

            bootstrap.Modal.getInstance(document.getElementById('consignaModal')).hide();
            loadConsignasTable();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    });
}

async function deleteConsigna(id) {
    const result = await Swal.fire({
        title: '¿Eliminar consigna?', icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#E17055', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar',
    });
    if (result.isConfirmed) {
        try {
            await apiDelete(`/pagos/consignas/${id}`);
            Swal.fire({ icon: 'success', title: 'Eliminada', timer: 1500, showConfirmButton: false });
            loadConsignasTable();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    }
}

async function showAsignarPagoModal(id = null) {
    try {
        const consignas = _consignasCache.length ? _consignasCache : await apiGet('/pagos/consignas');
        const select = document.getElementById('pagoConsignaId');
        select.innerHTML = '<option value="">Selecciona una consigna...</option>' +
            consignas.map(c => `<option value="${c.id}">${c.codigo} — Bs. ${parseFloat(c.monto).toFixed(2)}</option>`).join('');
    } catch (err) { /* silently fail */ }

    const form = document.getElementById('asignarPagoForm');
    form.reset();
    form.classList.remove('was-validated');
    document.getElementById('pagoId').value = '';

    if (id) {
        const p = _pagosCache.find(x => x.id === id);
        if (p) {
            document.getElementById('pagoId').value = p.id;

            // Extract the numeric part if it already has 'BTRM-'
            let code = p.estudiante ? p.estudiante.codigo : p.usuario_id;
            code = String(code).toUpperCase().replace('BTRM-', '');
            document.getElementById('pagoUsuarioCodigo').value = code;

            document.getElementById('pagoConsignaId').value = p.consigna_id;
            document.getElementById('pagoObservacion').value = p.observacion || '';
            document.getElementById('pagoEstado').value = p.estado;
        }
        document.getElementById('pagoEstadoContainer').classList.remove('d-none');
        document.querySelector('#asignarPagoModal .modal-title').innerText = 'Editar Pago Asignado';
    } else {
        document.getElementById('pagoEstadoContainer').classList.add('d-none');
        document.getElementById('pagoEstado').value = 'pendiente';
        document.querySelector('#asignarPagoModal .modal-title').innerText = 'Asignar Pago a Estudiante';
    }

    new bootstrap.Modal(document.getElementById('asignarPagoModal')).show();
}

function initAsignarPagoForm() {
    const form = document.getElementById('asignarPagoForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }
        try {
            const id = document.getElementById('pagoId').value;
            const codigoBase = document.getElementById('pagoUsuarioCodigo').value.trim();
            const codigoCompleto = codigoBase.toUpperCase().startsWith('BTRM-') ? codigoBase : 'BTRM-' + codigoBase;

            const payload = {
                usuario_codigo: codigoCompleto,
                consigna_id: parseInt(document.getElementById('pagoConsignaId').value),
                observacion: document.getElementById('pagoObservacion').value.trim() || null,
            };

            if (id) {
                payload.estado = document.getElementById('pagoEstado').value;
                await apiPut(`/pagos/${id}`, payload);
                Swal.fire({ icon: 'success', title: 'Pago actualizado', timer: 1500, showConfirmButton: false });
            } else {
                await apiPost('/pagos/', payload);
                Swal.fire({ icon: 'success', title: 'Pago asignado', timer: 1500, showConfirmButton: false });
            }

            bootstrap.Modal.getInstance(document.getElementById('asignarPagoModal')).hide();
            loadPagosTable();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    });
}

async function marcarPagado(id) {
    try {
        await apiPut(`/pagos/${id}`, { estado: 'pagado' });
        Swal.fire({ icon: 'success', title: 'Marcado como pagado', timer: 1500, showConfirmButton: false });
        loadPagosTable();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

async function marcarVencido(id) {
    try {
        await apiPut(`/pagos/${id}`, { estado: 'vencido' });
        Swal.fire({ icon: 'success', title: 'Marcado como vencido', timer: 1500, showConfirmButton: false });
        loadPagosTable();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

async function deletePago(id) {
    const result = await Swal.fire({
        title: '¿Eliminar registro de pago?', icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#E17055', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar',
    });
    if (result.isConfirmed) {
        try {
            await apiDelete(`/pagos/${id}`);
            Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1500, showConfirmButton: false });
            loadPagosTable();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    }
}


/* ==========================================================
   MIS PAGOS (Estudiante) — Vista de estado de pagos
   ========================================================== */

async function renderMisPagos(container) {
    container.innerHTML = `
        <div class="row g-4 mb-4">
            <div class="col-12">
                <div class="d-flex align-items-center justify-content-between">
                    <h5 class="mb-0 text-dark fw-bold"><i class="bi bi-wallet2 me-2 text-primary"></i>Mis Pagos</h5>
                    <span class="badge bg-success bg-opacity-10 text-success px-3 py-2 border border-success border-opacity-25 rounded-pill">
                        <i class="bi bi-receipt me-1"></i> Estado Financiero
                    </span>
                </div>
                <p class="text-muted small mt-2">Consulta el estado de tus pagos y mensualidades.</p>
            </div>
        </div>
        <div id="misPagosContainer">
            <div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</div>
        </div>
    `;

    try {
        const estado = await apiGet('/pagos/mi-estado');
        const pagoContainer = document.getElementById('misPagosContainer');

        if (!estado.registrado) {
            pagoContainer.innerHTML = `
                <div class="dash-stat-card" style="text-align: center; padding: 2rem; border: 1px solid rgba(255, 193, 7, 0.3); background: rgba(255, 193, 7, 0.05);">
                    <i class="bi bi-exclamation-triangle-fill" style="font-size: 2.5rem; color: #ffc107;"></i>
                    <h5 class="text-white mt-3 mb-2">Sin consigna de pago asignada</h5>
                    <p class="text-muted">Aún no tienes un plan de pago asignado. Contacta con la administración para que te registren.</p>
                </div>
            `;
            return;
        }

        // Resumen general
        const statusColor = estado.al_dia ? 'rgba(0, 200, 83, 0.15)' : 'rgba(255, 71, 87, 0.15)';
        const statusBorder = estado.al_dia ? 'rgba(0, 200, 83, 0.4)' : 'rgba(255, 71, 87, 0.4)';
        const statusIcon = estado.al_dia ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill';
        const statusIconColor = estado.al_dia ? '#00c853' : '#ff4757';
        const statusText = estado.al_dia ? 'Estás al día con tus pagos' : `Tienes una deuda pendiente de Bs. ${estado.deuda_pendiente.toFixed(2)}`;

        let html = `
            <div class="dash-stat-card mb-4" style="border: 1px solid ${statusBorder}; background: ${statusColor}; padding: 1.5rem; text-align: center;">
                <i class="bi ${statusIcon}" style="font-size: 2.5rem; color: ${statusIconColor};"></i>
                <h5 class="text-white mt-2 mb-1">${statusText}</h5>
            </div>
            <div class="row g-3">
        `;

        estado.pagos.forEach(p => {
            const badge = p.estado === 'pagado'
                ? '<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">Pagado</span>'
                : p.estado === 'vencido'
                    ? '<span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25">Vencido</span>'
                    : '<span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25">Pendiente</span>';

            html += `
                <div class="col-md-6 col-lg-4">
                    <div class="dash-stat-card h-100" style="padding: 1.2rem;">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="mb-0 text-white">Consigna ${p.consigna ? p.consigna.codigo : p.consigna_id}</h6>
                            ${badge}
                        </div>
                        <p style="font-size: 1.5rem; font-weight: 800; color: var(--accent); margin: 0.5rem 0;">
                            Bs. ${p.consigna ? parseFloat(p.consigna.monto).toFixed(2) : '—'}
                        </p>
                        <div class="text-muted small">
                            <div><i class="bi bi-calendar3 me-1"></i> Asignado: ${p.fecha_asignacion ? new Date(p.fecha_asignacion).toLocaleDateString() : '—'}</div>
                            ${p.fecha_pago ? `<div><i class="bi bi-calendar-check me-1"></i> Pagado: ${new Date(p.fecha_pago).toLocaleDateString()}</div>` : ''}
                            ${p.observacion ? `<div class="mt-1"><i class="bi bi-chat-dots me-1"></i> ${p.observacion}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        pagoContainer.innerHTML = html;

    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

/* ==========================================================
   REPORTES (Admin/Docente)
   ========================================================== */

function renderReportes(container) {
    container.innerHTML = `
        <div class="row g-4 mb-4">
            <div class="col-12">
                <div class="d-flex align-items-center justify-content-between">
                    <h5 class="mb-0 text-dark fw-bold"><i class="bi bi-file-earmark-bar-graph me-2 text-primary"></i>Centro de Reportes</h5>
                    <span class="badge bg-success bg-opacity-10 text-success px-3 py-2 border border-success border-opacity-25 rounded-pill">
                        <i class="bi bi-download me-1"></i> Exportación
                    </span>
                </div>
                <p class="text-white-50 small mt-2">Extrae y descarga la información consolidada de la plataforma en múltiples formatos analíticos.</p>
            </div>

            <!-- Reporte de Notas -->
            <div class="col-xl-6 col-md-6">
                <div class="dash-stat-card orange">
                    <div class="card-body p-4 d-flex flex-column">
                        <div class="d-flex align-items-center mb-3">
                            <div class="icon-circle bg-primary bg-opacity-10 text-primary me-3" style="width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">
                                <i class="bi bi-clipboard-data-fill fs-5"></i>
                            </div>
                            <h6 class="mb-0 fw-bold">Rendimiento Académico</h6>
                        </div>
                        <p class="text-white-50 small mb-4 flex-grow-1">Descarga el historial consolidado de las calificaciones y asistencias registradas por los estudiantes en la plataforma.</p>
                        
                        <div class="d-flex gap-2 mt-auto">
                            <button class="btn btn-outline-danger flex-fill fw-semibold shadow-sm" onclick="descargarReporte('notas', 'pdf')">
                                <i class="bi bi-file-earmark-pdf me-2"></i>PDF
                            </button>
                            <button class="btn btn-outline-success flex-fill fw-semibold shadow-sm" onclick="descargarReporte('notas', 'excel')">
                                <i class="bi bi-file-earmark-excel me-2"></i>Excel
                            </button>
                            <button class="btn btn-outline-primary flex-fill fw-semibold shadow-sm" onclick="descargarReporte('notas', 'csv')">
                                <i class="bi bi-file-earmark-text me-2"></i>CSV
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Reporte de Usuarios -->
            ${hasRole(['admin']) ? `
            <div class="col-xl-6 col-md-6">
                <div class="dash-stat-card blue">
                    <div class="card-body p-4 d-flex flex-column">
                        <div class="d-flex align-items-center mb-3">
                            <div class="icon-circle bg-success bg-opacity-10 text-success me-3" style="width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">
                                <i class="bi bi-people-fill fs-5"></i>
                            </div>
                            <h6 class="mb-0 fw-bold">Directorio de Usuarios</h6>
                        </div>
                        <p class="text-white-50 small mb-3 flex-grow-1">Extrae una lista completa del personal docente, alumnos y administradores. Puedes filtrar por perfil.</p>
                        
                        <div class="mb-3">
                            <div class="input-group input-group-sm">
                                <span class="input-group-text text-muted bg-white border-end-0"><i class="bi bi-funnel-fill"></i></span>
                                <select id="reportesUsuarioRol" class="form-select border-start-0 shadow-none">
                                    <option value="">Todos los perfiles</option>
                                    <option value="estudiante">Solo Estudiantes</option>
                                    <option value="docente">Solo Docentes</option>
                                    <option value="admin">Solo Administradores</option>
                                </select>
                            </div>
                        </div>

                        <div class="d-flex gap-2 mt-auto">
                            <button class="btn btn-outline-danger flex-fill fw-semibold shadow-sm" onclick="descargarReporte('usuarios', 'pdf')">
                                <i class="bi bi-file-earmark-pdf me-2"></i>PDF
                            </button>
                            <button class="btn btn-outline-success flex-fill fw-semibold shadow-sm" onclick="descargarReporte('usuarios', 'excel')">
                                <i class="bi bi-file-earmark-excel me-2"></i>Excel
                            </button>
                            <button class="btn btn-outline-primary flex-fill fw-semibold shadow-sm" onclick="descargarReporte('usuarios', 'csv')">
                                <i class="bi bi-file-earmark-text me-2"></i>CSV
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Reporte de Pagos -->
            <div class="col-xl-6 col-md-6 mt-4">
                <div class="dash-stat-card green">
                    <div class="card-body p-4 d-flex flex-column">
                        <div class="d-flex align-items-center mb-3">
                            <div class="icon-circle bg-warning bg-opacity-10 text-warning me-3" style="width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">
                                <i class="bi bi-cash-coin fs-5"></i>
                            </div>
                            <h6 class="mb-0 fw-bold">Historial de Pagos</h6>
                        </div>
                        <p class="text-white-50 small mb-3 flex-grow-1">Extrae un reporte de los pagos registrados. Puedes filtrar por el código de un estudiante específico.</p>
                        
                        <div class="mb-3">
                            <div class="input-group input-group-sm">
                                <span class="input-group-text glass-login-prefix"><span style="background: linear-gradient(125deg, #4FC3F7, #00E5FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 700; letter-spacing: 1px;">BTRM-</span></span>
                                <input type="text" id="reportesPagoCodigo" class="form-control" inputmode="numeric" pattern="[0-9]+" placeholder="Número (Ej: 204)">
                            </div>
                        </div>

                        <div class="d-flex gap-2 mt-auto">
                            <button class="btn btn-outline-danger flex-fill fw-semibold shadow-sm" onclick="descargarReporte('pagos', 'pdf')">
                                <i class="bi bi-file-earmark-pdf me-2"></i>PDF
                            </button>
                            <button class="btn btn-outline-success flex-fill fw-semibold shadow-sm" onclick="descargarReporte('pagos', 'excel')">
                                <i class="bi bi-file-earmark-excel me-2"></i>Excel
                            </button>
                            <button class="btn btn-outline-primary flex-fill fw-semibold shadow-sm" onclick="descargarReporte('pagos', 'csv')">
                                <i class="bi bi-file-earmark-text me-2"></i>CSV
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
    `;
}

async function descargarReporte(tipo, formato) {
    const ext = formato === 'excel' ? 'xlsx' : formato;
    let url = `/reportes/${tipo}/${formato}`;

    if (tipo === 'pagos') {
        const codigoInput = document.getElementById('reportesPagoCodigo');
        if (codigoInput && codigoInput.value.trim()) {
            url += `?codigo_estudiante=${encodeURIComponent(codigoInput.value.trim())}`;
        }
    } else if (tipo === 'usuarios') {
        const rolInput = document.getElementById('reportesUsuarioRol');
        if (rolInput && rolInput.value) {
            url += `?rol=${encodeURIComponent(rolInput.value)}`;
        }
    }

    try {
        Swal.fire({
            title: 'Descargando...',
            didOpen: () => { Swal.showLoading(); },
            allowOutsideClick: false
        });
        const blob = await apiGetBlob(url);
        downloadBlob(blob, `reporte_${tipo}.${ext}`);
        Swal.fire({ icon: 'success', title: `Reporte ${formato.toUpperCase()} descargado`, timer: 1500, showConfirmButton: false });
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

/* ==========================================================
   BACKUPS (Admin)
   ========================================================== */

async function renderBackups(container) {
    container.innerHTML = `
        <div class="row g-4 mb-4">
            <div class="col-12">
                <div class="d-flex align-items-center justify-content-between">
                    <h5 class="mb-0 text-dark fw-bold"><i class="bi bi-shield-check me-2 text-primary"></i>Gestión de Respaldo y Recuperación</h5>
                    <span class="badge bg-success bg-opacity-10 text-success px-3 py-2 border border-success border-opacity-25 rounded-pill">
                        <i class="bi bi-server me-1"></i> PostgreSQL
                    </span>
                </div>
                <p class="text-muted small mt-2">Asegura la trazabilidad y permanencia de tu base de datos ejecutando o automatizando las copias de seguridad.</p>
            </div>
            
            <!-- Generar Backup Manual -->
            <div class="col-xl-4 col-md-6">
                <div class="card border-0 shadow-sm h-100 dash-stat-card border-top border-4 border-primary">
                    <div class="card-body p-4 d-flex flex-column">
                        <div class="d-flex align-items-center mb-3">
                            <div class="icon-circle bg-primary bg-opacity-10 text-primary me-3" style="width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">
                                <i class="bi bi-database-fill-down fs-5"></i>
                            </div>
                            <h6 class="mb-0 fw-bold">Generar Backup</h6>
                        </div>
                         <p class="text-white-50 small mt-2">Guarda una copia manual de todo el esquema o de una sola tabla al instante. El archivo resultante será exportable.</p>
                        
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-secondary">Tabla específica (Opcional)</label>
                            <div class="input-group input-group-sm">
                                <span class="input-group-text bg-light border-end-0"><i class="bi bi-table text-muted"></i></span>
                                <input type="text" class="form-control border-start-0 ps-0" id="backupTableName" placeholder="Ej: usuarios (vacío = completa)">
                            </div>
                        </div>
                        <button class="btn btn-primary w-100 fw-semibold shadow-sm" id="btnGenerateBackup">
                            <i class="bi bi-cloud-arrow-down me-2"></i>Crear Copia Manual
                        </button>
                    </div>
                </div>
            </div>

            <!-- Restaurar Backup -->
            <div class="col-xl-4 col-md-6">
                <div class="card border-0 shadow-sm h-100 dash-stat-card border-top border-4 border-success">
                    <div class="card-body p-4 d-flex flex-column">
                        <div class="d-flex align-items-center mb-3">
                            <div class="icon-circle bg-success bg-opacity-10 text-success me-3" style="width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">
                                <i class="bi bi-database-fill-up fs-5"></i>
                            </div>
                            <h6 class="mb-0 fw-bold">Restaurar Sistema</h6>
                        </div>
                        <p class="text-white-50 small mt-2">Repón la base de datos a un punto anterior usando un archivo SQL validado. Esta acción no se puede deshacer.</p>
                        
                        <div class="mb-3">
                            <label class="form-label small fw-semibold text-secondary">Archivo de Respaldo (.sql)</label>
                            <input type="file" class="form-control form-control-sm" id="restoreFile" accept=".sql">
                        </div>
                        <button class="btn btn-success w-100 fw-semibold shadow-sm" id="btnRestoreBackup" disabled>
                            <i class="bi bi-arrow-counterclockwise me-2"></i>Iniciar Restauración
                        </button>
                    </div>
                </div>
            </div>

            <!-- Backup Automático (Cron) -->
            <div class="col-xl-4 col-md-12">
                <div class="card border-0 shadow-sm h-100 dash-stat-card border-top border-4 border-info">
                    <div class="card-body p-4 d-flex flex-column">
                        <div class="d-flex align-items-center justify-content-between mb-3">
                            <div class="d-flex align-items-center">
                                <div class="icon-circle bg-info bg-opacity-10 text-info me-3" style="width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">
                                    <i class="bi bi-robot fs-5"></i>
                                </div>
                                <h6 class="mb-0 fw-bold">Automatización (Cron)</h6>
                            </div>
                            <span class="badge bg-light text-secondary border"><i class="bi bi-gear-fill me-1"></i>Linux Ready</span>
                        </div>
                        
                        <p class="text-white-50 small mt-2">Delega el trabajo a los cronjobs del servidor OS para asegurar la resiliencia pura.</p>

                        <div class="row g-2 mb-3 flex-grow-1">
                            <!-- Tipo de frecuencia -->
                            <div class="col-12">
                                <label class="form-label small fw-semibold text-secondary mb-1">Frecuencia</label>
                                <select class="form-select form-select-sm shadow-none" id="backupFrequency">
                                    <option value="none">Desactivado (Manual Solo)</option>
                                    <option value="daily">Diariamente</option>
                                    <option value="weekly">Semanalmente (Recomendado)</option>
                                    <option value="monthly">Mensualmente</option>
                                </select>
                            </div>

                            <!-- Día y Hora -->
                            <div class="col-7">
                                <label class="form-label small fw-semibold text-secondary mb-1">Día Preferido</label>
                                <select class="form-select form-select-sm shadow-none" id="backupDay">
                                    <option value="1">Lunes</option>
                                    <option value="2">Martes</option>
                                    <option value="3">Miércoles</option>
                                    <option value="4">Jueves</option>
                                    <option value="5">Viernes</option>
                                    <option value="6">Sábado</option>
                                    <option value="0" selected>Domingo</option>
                                </select>
                            </div>
                            <div class="col-5">
                                <label class="form-label small fw-semibold text-secondary mb-1">Hora</label>
                                <input type="time" class="form-control form-control-sm shadow-none" id="backupTime" value="03:00">
                            </div>
                        </div>

                        <button class="btn btn-outline-info w-100 fw-semibold" id="btnSaveBackupConfig">
                            <i class="bi bi-save me-2"></i>Sincronizar Cron
                        </button>
                    </div>
                </div>
            </div>

            <!-- Historial de Backups -->
            <div class="col-12 mt-4">
                <div class="card shadow-sm table-card">
                    <div class="card-header bg-transparent border-bottom-0 pt-4 pb-2 px-4 d-flex justify-content-between align-items-center">
                        <h6 class="mb-0 fw-bold text-white"><i class="bi bi-clock-history me-2" style="color: var(--accent);"></i>Historial de Copias Realizadas</h6>
                    </div>
                    <div class="card-body px-4 pb-4">
                        <div id="backupHistoryTable" class="rounded p-3 bg-transparent">
                            <div class="text-center py-4">
                                <div class="spinner-border spinner-border-sm mb-2" style="color: var(--accent);" role="status"></div>
                                <div class="text-muted small">Inspeccionando almacenamiento interno...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // ── Event Listeners ──
    const fileInput = document.getElementById('restoreFile');
    const btnRestore = document.getElementById('btnRestoreBackup');

    fileInput.addEventListener('change', () => {
        btnRestore.disabled = !fileInput.files.length;
    });

    document.getElementById('btnGenerateBackup').addEventListener('click', () => {
        const tableName = document.getElementById('backupTableName').value.trim();
        showBackupPasswordModal('generate', { table_name: tableName || null });
    });

    btnRestore.addEventListener('click', () => {
        if (!fileInput.files.length) return;
        Swal.fire({
            title: 'Cargando archivo...',
            didOpen: () => { Swal.showLoading(); },
            allowOutsideClick: false
        });
        showBackupPasswordModal('restore', { file: fileInput.files[0] });
    });

    // ── Lógica Frontend para Guardar Cron ──
    const btnSaveCron = document.getElementById('btnSaveBackupConfig');
    const freqSelect = document.getElementById('backupFrequency');
    const daySelect = document.getElementById('backupDay');

    // Deshabilitar 'dia' si la frecuencia es diaria o apagada
    freqSelect.addEventListener('change', () => {
        if (freqSelect.value === 'none' || freqSelect.value === 'daily') {
            daySelect.disabled = true;
        } else {
            daySelect.disabled = false;
        }
    });

    btnSaveCron.addEventListener('click', () => {
        const config = {
            frequency: freqSelect.value,
            day: daySelect.value,
            time: document.getElementById('backupTime').value || "02:00"
        };
        showBackupPasswordModal('config-cron', config);
    });

    // ── Cargar historial ──
    await loadBackupHistory();
}

/**
 * Muestra un modal SweetAlert2 para pedir la contraseña de admin antes de ejecutar acciones de backup.
 */
function showBackupPasswordModal(action, params) {
    let actionLabel, actionIcon, confirmColor;

    if (action === 'generate') {
        actionLabel = 'Generar Backup';
        actionIcon = 'bi-cloud-arrow-down';
        confirmColor = '#0d6efd';
    } else if (action === 'restore') {
        actionLabel = 'Restaurar Sistema';
        actionIcon = 'bi-arrow-counterclockwise';
        confirmColor = '#198754';
    } else {
        actionLabel = 'Autenticar Regla de Cron';
        actionIcon = 'bi-robot';
        confirmColor = '#0dcaf0';
    }

    Swal.fire({
        title: `<i class="bi ${actionIcon} me-2"></i>${actionLabel}`,
        html: `
            <p class="text-muted small mb-3">La modificación del núcleo o base de datos requiere privilegios máximos. Por favor ingresa tu contraseña.</p>
            <input type="password" id="swalBackupPassword" class="swal2-input text-center" placeholder="••••••••" style="letter-spacing: 2px;">
        `,
        icon: action === 'restore' ? 'warning' : 'info',
        showCancelButton: true,
        confirmButtonColor: confirmColor,
        cancelButtonColor: '#e9ecef83',
        confirmButtonText: `Proceder`,
        cancelButtonText: '<span class="text-dark">Cancelar</span>',
        focusConfirm: false,
        preConfirm: () => {
            const pw = document.getElementById('swalBackupPassword').value;
            if (!pw) {
                Swal.showValidationMessage('Autenticación requerida');
                return false;
            }
            return pw;
        }
    }).then(async (result) => {
        if (!result.isConfirmed) return;

        const password = result.value;

        if (action === 'generate') {
            await executeBackupGenerate(password, params.table_name);
        } else if (action === 'restore') {
            await executeBackupRestore(password, params.file);
        } else if (action === 'config-cron') {
            await executeCronConfig(password, params);
        }
    });
}

/**
 * Solicita al backend crear o actualizar el trabajo de Cron del OS
 */
async function executeCronConfig(password, configParams) {
    Swal.fire({
        title: 'Mapeando reglas del OS...',
        html: '<div class="spinner-border text-info" role="status"></div><p class="mt-2 small text-muted">Escribiendo en crontab...</p>',
        allowOutsideClick: false,
        showConfirmButton: false,
    });

    try {
        const result = await apiPost('/backups/config-cron', {
            password: password,
            frequency: configParams.frequency,
            day: configParams.day,
            time: configParams.time
        });

        Swal.fire({
            icon: 'success',
            title: '¡Automatización Sincronizada!',
            text: result.message || 'El planificador del sistema operativo ha sido actualizado.',
            confirmButtonColor: '#0dcaf0',
        });
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error de Permiso Crontab',
            text: err.message || 'No se pudo comunicar con el sistema principal de reglas.'
        });
    }
}


/**
 * Ejecuta la generación de backup contra la API.
 */
async function executeBackupGenerate(password, tableName) {
    Swal.fire({
        title: 'Generando backup...',
        html: '<div class="spinner-border text-primary" role="status"></div>',
        allowOutsideClick: false,
        showConfirmButton: false,
    });

    try {
        const result = await apiPost('/backups/generate', {
            password: password,
            table_name: tableName,
        });

        Swal.fire({
            icon: 'success',
            title: '¡Backup generado!',
            html: `
                <p class="mb-1"><strong>Archivo:</strong> ${result.filename}</p>
                <p class="mb-1"><strong>Tamaño:</strong> ${result.size_kb} KB</p>
                <p class="mb-0"><strong>Fecha:</strong> ${result.timestamp}</p>
            `,
            confirmButtonColor: '#6C63FF',
        });

        // Refrescar historial
        await loadBackupHistory();
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error al generar backup',
            text: err.message || 'Error desconocido',
        });
    }
}


/**
 * Ejecuta la restauración de backup contra la API (usa FormData para file upload).
 */
async function executeBackupRestore(password, file) {
    Swal.fire({
        title: 'Restaurando backup...',
        html: '<div class="spinner-border text-primary" role="status"></div><p class="mt-2 text-muted small">Esto puede tardar unos minutos.</p>',
        allowOutsideClick: false,
        showConfirmButton: false,
    });

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('password', password);

        const token = getToken();
        const res = await fetch(`${API_BASE}/backups/restore`, {
            method: 'POST',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.detail || `Error ${res.status}`);
        }

        Swal.fire({
            icon: 'success',
            title: '¡Backup restaurado!',
            text: data.message || 'Base de datos restaurada correctamente.',
            confirmButtonColor: '#6C63FF',
        });
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error al restaurar',
            text: err.message || 'Error desconocido',
        });
    }
}


/**
 * Carga y renderiza el historial de backups existentes.
 */
window.changeBackupsPage = (page) => {
    window.paginationState.backups.page = page;
    _internalRenderBackups();
};

async function loadBackupHistory() {
    const tableContainer = document.getElementById('backupHistoryTable');
    if (!tableContainer) return;

    try {
        const backups = await apiGet('/backups/');
        window.paginationState.backups = { data: backups, page: 1, size: 6 };
        _internalRenderBackups();
    } catch (err) {
        console.error("Error loading backups:", err);
    }
}

function _internalRenderBackups() {
    const tableContainer = document.getElementById('backupHistoryTable');
    if (!tableContainer) return;

    const state = window.paginationState.backups;
    if (!state.data || !state.data.length) {
        tableContainer.innerHTML = `
            <div class="text-center py-3">
                <i class="bi bi-database-x text-muted fs-3"></i>
                <p class="text-muted small mt-2 mb-0">No hay backups disponibles aún.</p>
            </div>
        `;
        return;
    }

    const pageData = paginateArray(state.data, state.page, state.size);
    tableContainer.innerHTML = `
        <div class="table-responsive">
            <table class="table table-sm table-hover mb-0">
                <thead>
                    <tr>
                        <th><i class="bi bi-file-earmark-code me-1"></i>Archivo</th>
                        <th><i class="bi bi-hdd me-1"></i>Tamaño</th>
                        <th><i class="bi bi-calendar3 me-1"></i>Fecha y hora</th>
                        <th class="text-end">Acción</th>
                    </tr>
                </thead>
                <tbody>
                    ${pageData.map(b => `
                        <tr>
                            <td><code class="small">${b.filename}</code></td>
                            <td>${b.size_kb} KB</td>
                            <td>${new Date(b.created).toLocaleString('es-BO')}</td>
                            <td class="text-end">
                                <a href="${API_BASE}/backups/download/${b.filename}" 
                                   class="btn btn-sm btn-outline-primary" 
                                   download="${b.filename}">
                                    <i class="bi bi-cloud-download"></i>
                                </a>
                                    <button class="btn btn-sm btn-outline-danger" 
                                            title="Eliminar"
                                            onclick="confirmDeleteBackup('${b.filename}')">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div id="backupsPagination" class="mt-3"></div>
        `;
    renderPaginationControls('backupsPagination', state.data.length, state.size, state.page, 'changeBackupsPage');
}

/**
 * Muestra confirmación y pide contraseña para eliminar un backup
 */
function confirmDeleteBackup(filename) {
    Swal.fire({
        title: '¿Eliminar backup?',
        html: `
            <p class="text-muted small mb-3">Estás a punto de eliminar <strong>${filename}</strong>. Ingresa la contraseña de administrador para confirmar.</p>
            <input type="password" id="swalDeletePassword" class="swal2-input" placeholder="Contraseña de admin">
        `,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#aaa',
        confirmButtonText: '<i class="bi bi-trash-fill me-1"></i>Eliminar',
        cancelButtonText: 'Cancelar',
        focusConfirm: false,
        preConfirm: () => {
            const pw = document.getElementById('swalDeletePassword').value;
            if (!pw) {
                Swal.showValidationMessage('Debes ingresar la contraseña');
                return false;
            }
            return pw;
        }
    }).then(async (result) => {
        if (!result.isConfirmed) return;
        await executeBackupDelete(filename, result.value);
    });
}

/**
 * Ejecuta la eliminación del backup contra la API
 */
async function executeBackupDelete(filename, password) {
    Swal.fire({
        title: 'Eliminando...',
        html: '<div class="spinner-border text-danger" role="status"></div>',
        allowOutsideClick: false,
        showConfirmButton: false,
    });

    try {
        const token = getToken();
        // Usamos fetch directamente porque apiFetch no soporta DELETE con body json fácilmente
        const res = await fetch(`${API_BASE}/backups/delete/${filename}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ password: password })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.detail || `Error ${res.status}`);
        }

        Swal.fire({
            icon: 'success',
            title: '¡Eliminado!',
            text: data.message || 'Backup eliminado correctamente.',
            timer: 2000,
            showConfirmButton: false
        });

        // Refrescar historial
        await loadBackupHistory();
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Error al eliminar',
            text: err.message || 'Error desconocido'
        });
    }
}

/* ==========================================================
   MENSAJES
   ========================================================== */

async function renderMensajes(container) {
    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="mb-0">Mensajes / Avisos</h5>
            <button class="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3" onclick="showMensajeModal()">
                <i class="bi bi-send-plus fs-6"></i>
                <span>Nuevo Aviso</span>
            </button>
        </div>
        <div id="mensajesContainer">
            <div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</div>
        </div>
        <div id="mensajesPagination" class="mt-3"></div>

        <div class="modal fade modal-dashboard" id="mensajeModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Nuevo Aviso</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="mensajeForm" novalidate>
                            <div class="mb-3">
                                <label class="form-label">Título</label>
                                <input type="text" class="form-control" id="mensajeTitulo" required>
                                <div class="invalid-feedback">El título es requerido.</div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Contenido</label>
                                <textarea class="form-control" id="mensajeContenido" rows="4" required></textarea>
                                <div class="invalid-feedback">El contenido es requerido.</div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Destinatario (opcional — vacío = aviso general)</label>
                                <div class="input-group">
                                    <span class="d-flex align-items-center" style="background: linear-gradient(125deg, #4FC3F7, #00E5FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 700; letter-spacing: 1px;">
                                        <select class="form-select border-0 bg-transparent fw-bold" id="mensajeDestinatarioPrefijo" style="color: inherit; cursor: pointer; box-shadow: none; padding-right: 30px; background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='6' viewBox='0 0 8 6'%3E%3Cpath fill='%234FC3F7' d='M0 0l4 6 4-6z'/%3E%3C/svg%3E&quot;);">
                                            <option value="BTRM" style="color: #fff; background: #0d121c; -webkit-text-fill-color: initial;">BTRM</option>
                                            <option value="TCH" style="color: #fff; background: #0d121c; -webkit-text-fill-color: initial;">TCH</option>
                                        </select>
                                        <span class="fw-bold fs-5 me-2">-</span>
                                    </span>
                                    <input type="text" class="form-control" id="mensajeDestinatarioCodigo" placeholder="204" inputmode="numeric" pattern="[0-9]*">
                                </div>
                            </div>
                            <button type="submit" class="btn btn-primary w-100">Enviar</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;
    loadMensajes();
    initMensajeForm();

    // Marcar mensajes como leídos al entrar a la sección
    apiPatch('/mensajes/marcar-leidos').then(() => loadMensajesBadge()).catch(() => { });
}

window.changeMensajesPage = (page) => {
    window.paginationState.mensajes.page = page;
    _internalRenderMensajes();
};

async function loadMensajes() {
    try {
        const mensajes = await apiGet('/mensajes/');
        window.paginationState.mensajes = { data: mensajes, page: 1, size: 6 };
        _internalRenderMensajes();
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

function _internalRenderMensajes() {
    const container = document.getElementById('mensajesContainer');
    if (!container) return;

    const state = window.paginationState.mensajes;
    if (!state.data || state.data.length === 0) {
        container.innerHTML = `<div class="d-flex flex-column align-items-center justify-content-center py-5 text-muted glass-search mx-auto mt-4" style="border-radius: var(--radius-lg); border: 1px dashed rgba(255,255,255,0.1); max-width: 600px;">
    <i class="bi bi-inbox" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem; color: var(--accent-blue);"></i>
    <h5 class="fw-bold mb-1 text-white">Bandeja Vacía</h5>
    <p class="small mb-0">No tienes mensajes ni avisos en este momento.</p>
</div>`;
        const pgn = document.getElementById('mensajesPagination');
        if (pgn) pgn.innerHTML = '';
        return;
    }

    const pageData = paginateArray(state.data, state.page, state.size);
    container.innerHTML = pageData.map(m => `
        <div class="card shadow-sm table-card mb-2 d-flex flex-row p-3 align-items-start ${m.destinatario_id ? 'border-start border-4 border-primary border-opacity-10' : 'border-start border-4 border-warning border-opacity-10'}">
            <i class="bi ${m.destinatario_id ? 'bi-person-fill text-primary' : 'bi-megaphone-fill text-warning'} fs-4 me-3 mt-1" style="opacity: 0.8;"></i>
            <div class="flex-grow-1">
                <div class="d-flex justify-content-between align-items-center">
                    <strong class="text-white mb-0" style="font-size: 1.1rem; text-shadow: 0 0 5px rgba(0, 229, 255, 0.2);">${m.titulo}</strong>
                    <div>
                        ${!m.destinatario_id
            ? '<span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 me-2">General</span>'
            : `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 me-2"><i class="bi bi-person-fill"></i> ${m.destinatario ? m.destinatario.codigo : 'Directo'}</span>`}
                    </div>
                </div>
                <p class="mb-1 mt-2 text-white" style="font-size: 0.95rem;">${m.contenido}</p>
                <small class="text-muted" style="font-size: 0.75rem;"><i class="bi bi-clock me-1"></i>${m.created_at ? new Date(m.created_at).toLocaleString() : ''}</small>
            </div>
            ${hasRole(['admin']) ? `<button class="btn btn-sm btn-outline-danger border-0 py-0 px-2 fs-6 ms-3 align-self-start mt-1" onclick="deleteMensaje(${m.id})" title="Eliminar"><i class="bi bi-trash"></i></button>` : ''}
        </div>
    `).join('');

    renderPaginationControls('mensajesPagination', state.data.length, state.size, state.page, 'changeMensajesPage');
}

function showMensajeModal() {
    document.getElementById('mensajeForm').reset();
    document.getElementById('mensajeForm').classList.remove('was-validated');
    new bootstrap.Modal(document.getElementById('mensajeModal')).show();
}

async function deleteMensaje(id) {
    const result = await Swal.fire({
        title: '¿Eliminar mensaje?', icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#E17055', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar',
    });
    if (result.isConfirmed) {
        try {
            await apiDelete(`/mensajes/${id}`);
            Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1500, showConfirmButton: false });
            loadMensajes();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    }
}

function initMensajeForm() {
    const form = document.getElementById('mensajeForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }
        let rawDestinatario = document.getElementById('mensajeDestinatarioCodigo').value.trim();
        const prefijo = document.getElementById('mensajeDestinatarioPrefijo').value;
        if (rawDestinatario) {
            rawDestinatario = rawDestinatario.replace(/^(BTRM|TCH)-/i, '').replace(/\s+/g, '');
            if (!/^\d+$/.test(rawDestinatario)) {
                Swal.fire({ icon: 'warning', title: 'Código inválido', text: 'El código de usuario solo debe contener números.' });
                return;
            }
        }

        const data = {
            titulo: document.getElementById('mensajeTitulo').value.trim(),
            contenido: document.getElementById('mensajeContenido').value.trim(),
            destinatario_codigo: rawDestinatario ? `${prefijo}-${rawDestinatario}` : null,
        };
        try {
            await apiPost('/mensajes/', data);
            bootstrap.Modal.getInstance(document.getElementById('mensajeModal')).hide();
            Swal.fire({ icon: 'success', title: 'Aviso enviado', timer: 1500, showConfirmButton: false });
            loadMensajes();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    });
}

/* ==========================================================
   MIS MENSAJES (Estudiante)
   ========================================================== */

async function renderMisMensajes(container) {
    container.innerHTML = `
        <h5 class="mb-3">Mis Mensajes</h5>
        <div id="misMensajesContainer">
            <div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</div>
        </div>
    `;
    // Marcar mensajes como leídos al entrar a la sección
    apiPatch('/mensajes/marcar-leidos').then(() => loadMensajesBadge()).catch(() => { });
    try {
        const mensajes = await apiGet('/mensajes/mis-mensajes');
        const mc = document.getElementById('misMensajesContainer');
        if (mensajes.length === 0) {
            mc.innerHTML = `<div class="d-flex flex-column align-items-center justify-content-center py-5 text-muted glass-search mx-auto mt-4" style="border-radius: var(--radius-lg); border: 1px dashed rgba(255,255,255,0.1); max-width: 600px;">
    <i class="bi bi-inbox" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem; color: var(--accent-blue);"></i>
    <h5 class="fw-bold mb-1 text-white">Bandeja Vacía</h5>
    <p class="small mb-0">No tienes mensajes ni avisos en este momento.</p>
</div>`;
            return;
        }
        mc.innerHTML = mensajes.map(m => `
            <div class="card shadow-sm table-card mb-2 d-flex flex-row p-3 align-items-start ${m.leido ? 'opacity-75 border-start border-4 border-secondary border-opacity-10' : (m.destinatario_id ? 'border-start border-4 border-primary border-opacity-10' : 'border-start border-4 border-warning border-opacity-10')}">
                <i class="bi ${m.destinatario_id ? 'bi-person-fill text-primary' : 'bi-megaphone-fill text-warning'} fs-4 me-3 mt-1" style="opacity: 0.8;"></i>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-center">
                        <strong class="mb-0 text-white" style="font-size: 1.1rem; text-shadow: 0 0 5px rgba(0, 229, 255, 0.2);">${m.titulo}</strong>
                        ${!m.destinatario_id
                ? '<span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25">General</span>'
                : '<span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25"><i class="bi bi-lock-fill"></i> Privado</span>'}
                    </div>
                    <p class="mb-1 mt-2 text-white" style="font-size: 0.95rem;">${m.contenido}</p>
                    <small class="text-muted"><i class="bi bi-clock me-1"></i>${m.created_at ? new Date(m.created_at).toLocaleString() : ''}</small>
                </div>
            </div>
        `).join('');
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    }
}

/* ==========================================================
   BIBLIOTECA VIRTUAL
   ========================================================== */

let _biblioCache = [];
let _bibCategoriasCache = [];

async function renderBiblioteca(container) {
    const isAdmin = hasRole(['admin']);
    const isUploader = hasRole(['admin', 'docente']);

    container.innerHTML = `
        <div class="row g-4 mb-4">
            <div class="col-12">
                <div class="d-flex align-items-center justify-content-between">
                    <h5 class="mb-0 text-dark fw-bold"><i class="bi bi-book me-2 text-primary"></i>Biblioteca Virtual</h5>
                    <span class="badge bg-success bg-opacity-10 text-success px-3 py-2 border border-success border-opacity-25 rounded-pill">
                        <i class="bi bi-collection-fill me-1"></i> Recursos Digitales
                    </span>
                </div>
                <p class="text-muted small mt-2">Accede a libros, guías y materiales de estudio en formato PDF.</p>
            </div>
        </div>

        <!-- Tabs -->
        <ul class="nav nav-pills mb-4 gap-2" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link active px-4" data-bs-toggle="pill" data-bs-target="#tabRecursos" type="button" role="tab">
                    <i class="bi bi-grid-3x3-gap-fill me-1"></i>Recursos
                </button>
            </li>
            ${isUploader ? `
            <li class="nav-item" role="presentation">
                <button class="nav-link px-4" data-bs-toggle="pill" data-bs-target="#tabCatBiblio" type="button" role="tab">
                    <i class="bi bi-tags-fill me-1"></i>Categorías
                </button>
            </li>` : ''}
        </ul>

        <div class="tab-content">
            <!-- TAB RECURSOS -->
            <div class="tab-pane fade show active" id="tabRecursos" role="tabpanel">
                <div class="d-flex flex-wrap gap-2 mb-4 align-items-center justify-content-between">
                    <div class="d-flex flex-wrap gap-2 flex-grow-1">
                        <div class="input-group glass-search" style="max-width: 300px;">
                            <span class="input-group-text bg-transparent border-end-0"><i class="bi bi-search text-muted"></i></span>
                            <input type="text" class="form-control border-start-0 ps-0 text-white" id="biblioSearch" placeholder="Buscar título...">
                        </div>
                        <div class="input-group glass-search" style="max-width: 235px;">
                            <span class="input-group-text bg-transparent border-end-0"><i class="bi bi-tag text-muted"></i></span>
                            <select class="form-select border-start-0 ps-0 text-white shadow-none glass-select-inner" id="filtroCatBiblio" style="background: transparent;">
                                <option value="" style="background: #161c24; color: #fff;">Todas las categorías</option>
                            </select>
                        </div>
                        <div class="input-group glass-search" style="max-width: 210px;">
                            <span class="input-group-text bg-transparent border-end-0"><i class="bi bi-journal-bookmark text-muted"></i></span>
                            <select class="form-select border-start-0 ps-0 text-white shadow-none glass-select-inner" id="filtroCursoBiblio" style="background: transparent;">
                                <option value="" style="background: #161c24; color: #fff;">Todos los cursos</option>
                            </select>
                        </div>
                    </div>
                    ${isUploader ? `<button class="btn btn-primary d-flex align-items-center gap-2 px-3" onclick="showUploadModal()"><i class="bi bi-cloud-upload"></i>Subir recurso</button>` : ''}
                </div>
                <div class="row g-3" id="biblioGrid">
                    <div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>
                </div>
            </div>

            ${isUploader ? `
            <!-- TAB CATEGORÍAS -->
            <div class="tab-pane fade" id="tabCatBiblio" role="tabpanel">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="mb-0">Gestionar Categorías</h6>
                    <button class="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3" onclick="showCatBiblioModal()"><i class="bi bi-plus-lg"></i>Nueva Categoría</button>
                </div>
                <div class="row g-2 flex-wrap" id="catBiblioChips">
                    <div class="col-12 text-center py-4 text-muted">Cargando categorías...</div>
                </div>
            </div>` : ''}
        </div>

        <!-- MODAL SUBIR RECURSO -->
        <div class="modal fade modal-dashboard" id="uploadBiblioModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Subir Recurso</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="uploadBiblioForm" novalidate>
                            <input type="hidden" id="biblioEditId">
                            <div class="mb-3">
                                <label class="form-label">Título</label>
                                <input type="text" class="form-control" id="biblioTitulo" required>
                                <div class="invalid-feedback">El título es requerido.</div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Descripción (opcional)</label>
                                <textarea class="form-control" id="biblioDescripcion" rows="2"></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Categoría</label>
                                <select class="form-select" id="biblioCategoriaId">
                                    <option value="">Sin categoría</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Curso (opcional)</label>
                                <select class="form-select" id="biblioCursoId">
                                    <option value="">Ninguno</option>
                                </select>
                            </div>
                            <div class="mb-3 form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="biblioEsPublico">
                                <label class="form-check-label" for="biblioEsPublico">Acceso público (visible para todos)</label>
                            </div>
                            <div class="mb-3" id="biblioArchivoContainer">
                                <label class="form-label">Archivo PDF</label>
                                <input type="file" class="form-control" id="biblioArchivo" accept=".pdf" required>
                                <div class="form-text">Máximo 50 MB</div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Portada (opcional)</label>
                                <input type="file" class="form-control" id="biblioPortada" accept="image/*">
                            </div>
                            <button type="submit" class="btn btn-primary w-100">Guardar</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>

        <!-- MODAL CATEGORÍA -->
        <div class="modal fade modal-dashboard" id="catBiblioModal" tabindex="-1">
            <div class="modal-dialog modal-sm">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Nueva Categoría</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="catBiblioForm" novalidate>
                            <input type="hidden" id="catBiblioId">
                            <div class="mb-3">
                                <label class="form-label">Nombre</label>
                                <input type="text" class="form-control" id="catBiblioNombre" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Descripción (opcional)</label>
                                <input type="text" class="form-control" id="catBiblioDescripcion">
                            </div>
                            <button type="submit" class="btn btn-primary w-100">Guardar</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>

        <!-- MODAL EDITAR RECURSO (sin archivo) -->
        <div class="modal fade modal-dashboard" id="editBiblioModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Editar Recurso</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="editBiblioForm" novalidate>
                            <input type="hidden" id="editBiblioId">
                            <div class="mb-3">
                                <label class="form-label">Título</label>
                                <input type="text" class="form-control" id="editBiblioTitulo" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Descripción</label>
                                <textarea class="form-control" id="editBiblioDescripcion" rows="2"></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Categoría</label>
                                <select class="form-select" id="editBiblioCategoriaId">
                                    <option value="">Sin categoría</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Curso</label>
                                <select class="form-select" id="editBiblioCursoId">
                                    <option value="">Ninguno</option>
                                </select>
                            </div>
                            <div class="mb-3 form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="editBiblioEsPublico">
                                <label class="form-check-label" for="editBiblioEsPublico">Acceso público</label>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Cambiar portada (opcional)</label>
                                <input type="file" class="form-control" id="editBiblioPortada" accept="image/*">
                                <div class="form-text">Deja vacío para mantener la portada actual.</div>
                            </div>
                            <button type="submit" class="btn btn-primary w-100">Actualizar</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>

        <!-- VISOR PDF FULLSCREEN -->
        <div class="modal fade" id="pdfViewerModal" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog modal-fullscreen">
                <div class="modal-content bg-dark">
                    <div class="modal-header border-0 py-2" style="background: rgba(0,0,0,0.8);">
                        <h6 class="modal-title text-white" id="pdfViewerTitle">Documento</h6>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-0 d-flex flex-column" id="pdfViewerBody" oncontextmenu="return false;">
                        <div class="flex-grow-1 overflow-auto" id="pdfCanvasContainer" style="background: #2a2a2a; text-align: center;">
                            <canvas id="pdfCanvas" style="display: inline-block;"></canvas>
                        </div>
                        <div class="d-flex align-items-center justify-content-center gap-2 gap-md-3 py-2 flex-wrap" style="background: rgba(0,0,0,0.85);">
                            <button class="btn btn-sm btn-outline-light" onclick="pdfPrevPage()" title="Página anterior"><i class="bi bi-chevron-left"></i></button>
                            <span class="text-white small" id="pdfPageInfo">Página 1 de 1</span>
                            <button class="btn btn-sm btn-outline-light" onclick="pdfNextPage()" title="Página siguiente"><i class="bi bi-chevron-right"></i></button>
                            <span class="text-muted mx-1">|</span>
                            <button class="btn btn-sm btn-outline-light" onclick="pdfZoomOut()" title="Alejar"><i class="bi bi-zoom-out"></i></button>
                            <button class="btn btn-sm btn-outline-light" onclick="pdfZoomFit()" title="Ajustar a pantalla"><i class="bi bi-aspect-ratio"></i></button>
                            <button class="btn btn-sm btn-outline-light" onclick="pdfZoomIn()" title="Acercar"><i class="bi bi-zoom-in"></i></button>
                            <span class="text-muted mx-1">|</span>
                            <button class="btn btn-sm btn-outline-light" onclick="pdfToggleFullscreen()" title="Pantalla completa"><i class="bi bi-fullscreen" id="pdfFullscreenIcon"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    loadBiblioteca();
    loadCatBiblio();
    initBiblioSearch();
    initUploadBiblioForm();
    initEditBiblioForm();
    initCatBiblioForm();
}


// ---------- CARGAR RECURSOS ----------

async function loadBiblioteca() {
    try {
        _biblioCache = await apiGet('/biblioteca/');
        renderBiblioGrid(_biblioCache);
    } catch (err) {
        const grid = document.getElementById('biblioGrid');
        if (grid) grid.innerHTML = `<div class="col-12 text-center text-danger py-4">Error al cargar: ${err.message}</div>`;
    }
}

function renderBiblioGrid(items) {
    const grid = document.getElementById('biblioGrid');
    if (!grid) return;

    if (items.length === 0) {
        grid.innerHTML = `<div class="col-12 text-center text-muted py-5"><i class="bi bi-book fs-1 d-block mb-2"></i>No hay recursos disponibles.</div>`;
        return;
    }

    const isUploader = hasRole(['admin', 'docente']);
    const isAdmin = hasRole(['admin']);

    grid.innerHTML = items.map(item => {
        const portadaUrl = item.tiene_portada
            ? `${API_BASE}/biblioteca/${item.id}/portada`
            : null;

        return `
            <div class="col-sm-6 col-md-4 col-lg-3">
                <div class="card h-100 border-0 shadow-sm" style="background: rgba(255,255,255,0.06); border-radius: 12px; overflow: hidden; transition: transform 0.2s, box-shadow 0.2s; cursor: pointer;" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 8px 25px rgba(0,0,0,0.3)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
                    <div style="height: 180px; background: ${portadaUrl ? `url('${portadaUrl}') center/cover` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}; display: flex; align-items: center; justify-content: center;" onclick="openPDFViewer(${item.id}, '${item.titulo.replace(/'/g, "\\'")}')">
                        ${!portadaUrl ? '<i class="bi bi-file-earmark-pdf-fill text-white" style="font-size: 3rem; opacity: 0.7;"></i>' : ''}
                    </div>
                    <div class="card-body p-3">
                        <h6 class="card-title text-white mb-1 text-truncate" title="${item.titulo}">${item.titulo}</h6>
                        <div class="d-flex flex-wrap gap-1 mb-2">
                            ${item.categoria ? `<span class="badge rounded-pill fw-normal shadow-sm" style="background: rgba(0,229,255,0.15); color: #00e5ff; border: 1px solid rgba(0,229,255,0.3);"><i class="bi bi-tag-fill me-1"></i>${item.categoria.nombre}</span>` : ''}
                            ${item.curso ? `<span class="badge rounded-pill fw-normal shadow-sm" style="background: rgba(255,255,255,0.1); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.15);"><i class="bi bi-journal-text me-1"></i>${item.curso.nombre}</span>` : ''}
                            ${item.es_publico ? '<span class="badge rounded-pill fw-normal shadow-sm" style="background: rgba(0,255,128,0.15); color: #00ff80; border: 1px solid rgba(0,255,128,0.3);"><i class="bi bi-globe2 me-1"></i>Público</span>' : '<span class="badge rounded-pill fw-normal shadow-sm" style="background: rgba(255,193,7,0.15); color: #ffc107; border: 1px solid rgba(255,193,7,0.3);"><i class="bi bi-lock-fill me-1"></i>Privado</span>'}
                        </div>
                        ${item.descripcion ? `<p class="card-text text-muted small mb-2" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${item.descripcion}</p>` : ''}
                        <div class="d-flex align-items-center justify-content-between">
                            <small class="text-muted">${item.autor ? item.autor.nombre : ''}</small>
                            <div class="d-flex gap-1">
                                <button class="btn btn-sm btn-primary py-0 px-2" onclick="openPDFViewer(${item.id}, '${item.titulo.replace(/'/g, "\\'")}')" title="Leer"><i class="bi bi-book-half"></i></button>
                                ${isUploader ? `<button class="btn btn-sm btn-outline-info border-0 py-0 px-2" onclick="editBiblioItem(${item.id})" title="Editar"><i class="bi bi-pencil"></i></button>` : ''}
                                ${isAdmin ? `<button class="btn btn-sm btn-outline-danger border-0 py-0 px-2" onclick="deleteBiblioItem(${item.id}, '${item.titulo.replace(/'/g, "\\'")}')" title="Eliminar"><i class="bi bi-trash"></i></button>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}


// ---------- FILTROS ----------

function initBiblioSearch() {
    const search = document.getElementById('biblioSearch');
    const filtCat = document.getElementById('filtroCatBiblio');
    const filtCurso = document.getElementById('filtroCursoBiblio');

    // Poblar filtro cursos
    (async () => {
        try {
            const cursos = await apiGet('/cursos/');
            if (filtCurso) {
                filtCurso.innerHTML = '<option value="" style="background: #161c24; color: #fff;">Todos los cursos</option>' +
                    cursos.map(c => `<option value="${c.id}" style="background: #161c24; color: #fff;">${c.nombre}</option>`).join('');
            }
        } catch (e) { /* silent */ }
    })();

    // Poblar filtro categorías
    (async () => {
        try {
            const cats = _bibCategoriasCache.length ? _bibCategoriasCache : await apiGet('/biblioteca/categorias');
            if (filtCat) {
                filtCat.innerHTML = '<option value="" style="background: #161c24; color: #fff;">Todas las categorías</option>' +
                    cats.map(c => `<option value="${c.id}" style="background: #161c24; color: #fff;">${c.nombre}</option>`).join('');
            }
        } catch (e) { /* silent */ }
    })();

    function applyFilters() {
        const q = search ? search.value.toLowerCase().trim() : '';
        const catId = filtCat ? filtCat.value : '';
        const cursoId = filtCurso ? filtCurso.value : '';

        const filtered = _biblioCache.filter(item => {
            const matchSearch = !q || item.titulo.toLowerCase().includes(q) || (item.descripcion && item.descripcion.toLowerCase().includes(q));
            const matchCat = !catId || String(item.categoria_id) === catId;
            const matchCurso = !cursoId || String(item.curso_id) === cursoId;
            return matchSearch && matchCat && matchCurso;
        });
        renderBiblioGrid(filtered);
    }

    if (search) search.addEventListener('input', applyFilters);
    if (filtCat) filtCat.addEventListener('change', applyFilters);
    if (filtCurso) filtCurso.addEventListener('change', applyFilters);
}


// ---------- SUBIDA ----------

async function showUploadModal() {
    const form = document.getElementById('uploadBiblioForm');
    form.reset();
    form.classList.remove('was-validated');
    document.getElementById('biblioEditId').value = '';
    document.getElementById('biblioArchivoContainer').classList.remove('d-none');
    document.getElementById('biblioArchivo').required = true;

    // Cargar selects
    try {
        const cats = _bibCategoriasCache.length ? _bibCategoriasCache : await apiGet('/biblioteca/categorias');
        document.getElementById('biblioCategoriaId').innerHTML = '<option value="">Sin categoría</option>' +
            cats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    } catch (e) { /* silent */ }

    try {
        const cursos = await apiGet('/cursos/');
        document.getElementById('biblioCursoId').innerHTML = '<option value="">Ninguno</option>' +
            cursos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    } catch (e) { /* silent */ }

    document.querySelector('#uploadBiblioModal .modal-title').textContent = 'Subir Recurso';
    new bootstrap.Modal(document.getElementById('uploadBiblioModal')).show();
}

function initUploadBiblioForm() {
    const form = document.getElementById('uploadBiblioForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

        const fd = new FormData();
        fd.append('titulo', document.getElementById('biblioTitulo').value.trim());
        fd.append('descripcion', document.getElementById('biblioDescripcion').value.trim() || '');
        fd.append('es_publico', document.getElementById('biblioEsPublico').checked);

        const catVal = document.getElementById('biblioCategoriaId').value;
        if (catVal) fd.append('categoria_id', catVal);

        const cursoVal = document.getElementById('biblioCursoId').value;
        if (cursoVal) fd.append('curso_id', cursoVal);

        const archivoInput = document.getElementById('biblioArchivo');
        if (archivoInput.files[0]) fd.append('archivo', archivoInput.files[0]);

        const portadaInput = document.getElementById('biblioPortada');
        if (portadaInput.files[0]) fd.append('portada', portadaInput.files[0]);

        try {
            await apiPostFormData('/biblioteca/upload', fd);
            bootstrap.Modal.getInstance(document.getElementById('uploadBiblioModal')).hide();
            Swal.fire({ icon: 'success', title: 'Recurso subido', timer: 1500, showConfirmButton: false });
            loadBiblioteca();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    });
}


// ---------- EDITAR RECURSO ----------

async function editBiblioItem(id) {
    const item = _biblioCache.find(x => x.id === id);
    if (!item) return;

    try {
        const cats = _bibCategoriasCache.length ? _bibCategoriasCache : await apiGet('/biblioteca/categorias');
        document.getElementById('editBiblioCategoriaId').innerHTML = '<option value="">Sin categoría</option>' +
            cats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    } catch (e) { /* silent */ }

    try {
        const cursos = await apiGet('/cursos/');
        document.getElementById('editBiblioCursoId').innerHTML = '<option value="">Ninguno</option>' +
            cursos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    } catch (e) { /* silent */ }

    document.getElementById('editBiblioId').value = item.id;
    document.getElementById('editBiblioTitulo').value = item.titulo;
    document.getElementById('editBiblioDescripcion').value = item.descripcion || '';
    document.getElementById('editBiblioCategoriaId').value = item.categoria_id || '';
    document.getElementById('editBiblioCursoId').value = item.curso_id || '';
    document.getElementById('editBiblioEsPublico').checked = item.es_publico;

    new bootstrap.Modal(document.getElementById('editBiblioModal')).show();
}

function initEditBiblioForm() {
    const form = document.getElementById('editBiblioForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

        const id = document.getElementById('editBiblioId').value;
        const catVal = document.getElementById('editBiblioCategoriaId').value;
        const cursoVal = document.getElementById('editBiblioCursoId').value;

        const payload = {
            titulo: document.getElementById('editBiblioTitulo').value.trim(),
            descripcion: document.getElementById('editBiblioDescripcion').value.trim() || null,
            categoria_id: catVal ? parseInt(catVal) : null,
            curso_id: cursoVal ? parseInt(cursoVal) : null,
            es_publico: document.getElementById('editBiblioEsPublico').checked,
        };

        try {
            // 1. Actualizar metadata
            await apiPut(`/biblioteca/${id}`, payload);

            // 2. Si hay nueva portada, subirla
            const portadaInput = document.getElementById('editBiblioPortada');
            if (portadaInput && portadaInput.files[0]) {
                const fd = new FormData();
                fd.append('portada', portadaInput.files[0]);
                await apiPostFormData(`/biblioteca/${id}/portada`, fd);
            }

            bootstrap.Modal.getInstance(document.getElementById('editBiblioModal')).hide();
            Swal.fire({ icon: 'success', title: 'Recurso actualizado', timer: 1500, showConfirmButton: false });
            loadBiblioteca();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    });
}

async function deleteBiblioItem(id, titulo) {
    const result = await Swal.fire({
        title: '¿Eliminar recurso?',
        html: `Se eliminará <b>${titulo}</b> y su archivo PDF.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#E17055',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
    });
    if (result.isConfirmed) {
        try {
            await apiDelete(`/biblioteca/${id}`);
            Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1500, showConfirmButton: false });
            loadBiblioteca();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    }
}


// ---------- CATEGORÍAS ----------

async function loadCatBiblio() {
    try {
        _bibCategoriasCache = await apiGet('/biblioteca/categorias');
        renderCatBiblioChips(_bibCategoriasCache);
    } catch (err) { /* silent */ }
}

function renderCatBiblioChips(cats) {
    const container = document.getElementById('catBiblioChips');
    if (!container) return;

    if (cats.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted py-4">No hay categorías. Crea la primera.</div>';
        return;
    }

    container.innerHTML = cats.map(c => `
        <div class="col-auto">
            <div class="d-flex align-items-center p-2 px-3 border rounded-pill bg-dark bg-opacity-25" style="border-color: rgba(255,255,255,0.1)!important;">
                <strong class="text-primary me-2">${c.nombre}</strong>
                ${c.descripcion ? `<span class="text-muted small me-2">${c.descripcion}</span>` : ''}
                <button class="btn btn-sm text-info p-0 border-0 ms-auto me-2" onclick="editCatBiblio(${c.id})" title="Editar"><i class="bi bi-pencil-fill fs-6"></i></button>
                ${hasRole(['admin']) ? `<button class="btn btn-sm text-danger p-0 border-0" onclick="deleteCatBiblio(${c.id}, '${c.nombre.replace(/'/g, "\\'")}')" title="Eliminar"><i class="bi bi-x-circle-fill fs-5"></i></button>` : ''}
            </div>
        </div>
    `).join('');
}

function showCatBiblioModal(id = null) {
    const form = document.getElementById('catBiblioForm');
    form.reset();
    form.classList.remove('was-validated');
    document.getElementById('catBiblioId').value = '';

    if (id) {
        const c = _bibCategoriasCache.find(x => x.id === id);
        if (c) {
            document.getElementById('catBiblioId').value = c.id;
            document.getElementById('catBiblioNombre').value = c.nombre;
            document.getElementById('catBiblioDescripcion').value = c.descripcion || '';
        }
        document.querySelector('#catBiblioModal .modal-title').textContent = 'Editar Categoría';
    } else {
        document.querySelector('#catBiblioModal .modal-title').textContent = 'Nueva Categoría';
    }

    new bootstrap.Modal(document.getElementById('catBiblioModal')).show();
}

function editCatBiblio(id) {
    showCatBiblioModal(id);
}

function initCatBiblioForm() {
    const form = document.getElementById('catBiblioForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

        const id = document.getElementById('catBiblioId').value;
        const payload = {
            nombre: document.getElementById('catBiblioNombre').value.trim(),
            descripcion: document.getElementById('catBiblioDescripcion').value.trim() || null,
        };

        try {
            if (id) {
                await apiPut(`/biblioteca/categorias/${id}`, payload);
                Swal.fire({ icon: 'success', title: 'Categoría actualizada', timer: 1500, showConfirmButton: false });
            } else {
                await apiPost('/biblioteca/categorias', payload);
                Swal.fire({ icon: 'success', title: 'Categoría creada', timer: 1500, showConfirmButton: false });
            }
            bootstrap.Modal.getInstance(document.getElementById('catBiblioModal')).hide();
            loadCatBiblio();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    });
}

async function deleteCatBiblio(id, nombre) {
    const result = await Swal.fire({
        title: '¿Eliminar categoría?',
        html: `Se eliminará <b>${nombre}</b>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#E17055',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
    });
    if (result.isConfirmed) {
        try {
            await apiDelete(`/biblioteca/categorias/${id}`);
            Swal.fire({ icon: 'success', title: 'Eliminada', timer: 1500, showConfirmButton: false });
            loadCatBiblio();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    }
}


// ---------- VISOR PDF CON PDF.JS ----------

let _pdfDoc = null;
let _pdfPageNum = 1;
let _pdfScale = 1.5;
let _pdfRenderTask = null;

async function openPDFViewer(itemId, titulo) {
    document.getElementById('pdfViewerTitle').textContent = titulo || 'Documento';

    const modal = new bootstrap.Modal(document.getElementById('pdfViewerModal'));
    modal.show();

    // Resetear
    _pdfDoc = null;
    _pdfPageNum = 1;
    _pdfScale = 1.5;
    _pdfRenderTask = null;
    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('pdfPageInfo').textContent = 'Cargando...';

    try {
        // Obtener URL firmada
        const data = await apiGet(`/biblioteca/${itemId}/view-url`);
        const pdfUrl = `${API_BASE}${data.url}`;

        // Configurar PDF.js worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdfjs/pdf.worker.min.js';
        }

        // Cargar PDF
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        _pdfDoc = await loadingTask.promise;

        document.getElementById('pdfPageInfo').textContent = `Página 1 de ${_pdfDoc.numPages}`;

        await pdfZoomFit();
    } catch (err) {
        document.getElementById('pdfPageInfo').textContent = 'Error al cargar';
        Swal.fire({ icon: 'error', title: 'No se pudo abrir', text: err.message });
    }
}

async function renderPDFPage(num) {
    if (!_pdfDoc) return;

    // Cancelar render previo si existe
    if (_pdfRenderTask) {
        try { _pdfRenderTask.cancel(); } catch (e) { /* ignore */ }
        _pdfRenderTask = null;
    }

    const page = await _pdfDoc.getPage(num);
    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');

    // Resolución de renderizado: usar 2x para nitidez en pantallas HiDPI
    const dpr = window.devicePixelRatio || 1;
    const renderScale = _pdfScale * dpr;
    const viewport = page.getViewport({ scale: renderScale });

    // Buffer interno del canvas (alta resolución para nitidez)
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Tamaño visual REAL del canvas en pantalla (esto es lo que controla el zoom visible)
    const cssWidth = viewport.width / dpr;
    const cssHeight = viewport.height / dpr;
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    canvas.style.maxWidth = 'none'; // evitar que CSS limite el tamaño

    // Renderizar
    _pdfRenderTask = page.render({ canvasContext: ctx, viewport: viewport });

    try {
        await _pdfRenderTask.promise;
    } catch (e) {
        if (e.name !== 'RenderingCancelledException') {
            console.error('Error renderizando PDF:', e);
        }
    }

    document.getElementById('pdfPageInfo').textContent = `Página ${num} de ${_pdfDoc.numPages}`;
}

function pdfPrevPage() {
    if (_pdfPageNum <= 1) return;
    _pdfPageNum--;
    renderPDFPage(_pdfPageNum);
}

function pdfNextPage() {
    if (!_pdfDoc || _pdfPageNum >= _pdfDoc.numPages) return;
    _pdfPageNum++;
    renderPDFPage(_pdfPageNum);
}

function pdfZoomIn() {
    _pdfScale = Math.min(_pdfScale + 0.5, 4.0);
    renderPDFPage(_pdfPageNum);
}

function pdfZoomOut() {
    _pdfScale = Math.max(_pdfScale - 0.5, 0.5);
    renderPDFPage(_pdfPageNum);
}

async function pdfZoomFit() {
    if (!_pdfDoc) return;

    try {
        const page = await _pdfDoc.getPage(_pdfPageNum);
        const viewport = page.getViewport({ scale: 1.0 });

        const container = document.getElementById('pdfCanvasContainer');
        const targetWidth = container.clientWidth - 40;

        let targetScale = targetWidth / viewport.width;

        if (targetScale > 2.5) targetScale = 2.5;
        if (targetScale < 0.3) targetScale = 0.3;

        _pdfScale = targetScale;
        renderPDFPage(_pdfPageNum);
    } catch (e) {
        console.error("Error al autoajustar zoom", e);
    }
}

function pdfToggleFullscreen() {
    const modalEl = document.getElementById('pdfViewerModal');
    const icon = document.getElementById('pdfFullscreenIcon');

    if (!document.fullscreenElement) {
        modalEl.requestFullscreen().then(() => {
            icon.className = 'bi bi-fullscreen-exit';
        }).catch(err => console.warn('Fullscreen no soportado:', err));
    } else {
        document.exitFullscreen().then(() => {
            icon.className = 'bi bi-fullscreen';
        });
    }
}
