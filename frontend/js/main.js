/* ============================================================
   Binglish — Main JS (Premium Dark Theme)
   ============================================================ */

// ── Vanta.js Background Initialization ──
(function initVantaBackground() {
    function initVanta() {
        if (typeof VANTA === 'undefined' || typeof THREE === 'undefined') {
            console.warn('Vanta.js or Three.js not loaded – skipping animated background.');
            var bg = document.getElementById('vanta-bg');
            if (bg) bg.style.background = 'radial-gradient(ellipse at 50% 30%, #0a1628 0%, #050510 70%)';
            return null;
        }
        try {
            return VANTA.WAVES({
                el: '#vanta-bg',
                THREE: THREE,
                mouseControls: true,
                touchControls: true,
                gyroControls: false,
                minHeight: 200.0,
                minWidth: 200.0,
                scale: 1.0,
                scaleMobile: 0.8,
                color: 0x0a1628,
                shininess: 35.0,
                waveHeight: 15.0,
                waveSpeed: 0.7,
                zoom: 0.85
            });
        } catch (e) {
            console.warn('Vanta.js init error:', e);
            return null;
        }
    }

    var vantaEffect = null;
    document.addEventListener('DOMContentLoaded', function () {
        vantaEffect = initVanta();
    });
    window.addEventListener('beforeunload', function () {
        if (vantaEffect) vantaEffect.destroy();
    });
})();

// ── Animación Titulo Hero (TypeIt.js) ──
document.addEventListener('DOMContentLoaded', () => {
    if (typeof TypeIt !== 'undefined' && document.getElementById('hero-typing-text')) {
        new TypeIt("#hero-typing-text", {
            speed: 80,
            waitUntilVisible: true,
            loop: true,
            breakLines: false
        })
            .type("con <span>Binglish</span>", { delay: 2000 })
            .delete(13)
            .type("para tu futuro", { delay: 2000 })
            .delete(14)
            .type("sin límites", { delay: 2000 })
            .delete(11)
            .go();
    }
});

// Botón de App Móvil - Próximamente
const appCelBtn = document.getElementById('appCelBtn');
if (appCelBtn) {
    appCelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        Swal.fire({
            title: '¡Próximamente!',
            text: 'Nuestra aplicación móvil estará disponible muy pronto para iOS y Android.',
            icon: 'info',
            confirmButtonColor: 'var(--accent-color)',
            confirmButtonText: 'Entendido',
            background: 'var(--surface)',
            color: 'var(--text-color)',
            customClass: {
                popup: 'glass-panel'
            }
        });
    });
}

function smoothScrollTo(targetY, duration) {
    const startY = window.scrollY;
    const diff = targetY - startY;
    let startTime = null;

    function swing(t) {
        return 0.5 - Math.cos(t * Math.PI) / 2;
    }

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = swing(progress);

        window.scrollTo(0, startY + diff * easedProgress);

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }

    requestAnimationFrame(step);
}

// ── Navbar scroll effect ──
const navbar = document.getElementById('mainNavbar');
if (navbar) {
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    });
}

// ── Click → animated scroll to section (800ms) ──
const navbarHeight = () => navbar ? navbar.offsetHeight : 0;

document.querySelectorAll('.navbar-binglish a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        if (targetId === '#') return;
        const target = document.querySelector(targetId);
        if (!target) return;
        e.preventDefault();

        // Set active immediately on click
        document.querySelectorAll('.navbar-binglish .nav-link').forEach(l => l.classList.remove('active'));
        if (link.classList.contains('nav-link')) link.classList.add('active');

        // Close mobile nav INSTANTLY
        const navCollapse = document.getElementById('navbarNav');
        const isMobile = navCollapse && navCollapse.classList.contains('show');

        if (isMobile) {
            navCollapse.classList.remove('show');
            navCollapse.style.height = '';
            const toggler = document.querySelector('.navbar-toggler');
            if (toggler) toggler.classList.add('collapsed');
        }

        // Scroll rápido
        const top = target.getBoundingClientRect().top + window.scrollY - navbarHeight();
        smoothScrollTo(top, isMobile ? 300 : 400);

        // Move indicator immediately
        moveIndicator(link.classList.contains('nav-link') ? link : null);
    });
});

// ── Scroll-spy + sliding indicator ──
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.navbar-binglish .nav-link[href^="#"]');
const indicator = document.getElementById('navIndicator');
const navMenu = document.getElementById('navMenu');

function moveIndicator(activeLink) {
    if (!activeLink || !navMenu || !indicator) return;
    const menuRect = navMenu.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    indicator.style.left = (linkRect.left - menuRect.left) + 'px';
    indicator.style.width = linkRect.width + 'px';
}

function updateActiveLink() {
    const scrollY = window.scrollY + navbarHeight() + 60;
    let currentId = '';

    sections.forEach(section => {
        if (scrollY >= section.offsetTop) {
            currentId = section.getAttribute('id');
        }
    });

    let activeEl = null;
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + currentId) {
            link.classList.add('active');
            activeEl = link;
        }
    });

    moveIndicator(activeEl);
}

window.addEventListener('scroll', updateActiveLink, { passive: true });
window.addEventListener('resize', () => updateActiveLink(), { passive: true });
setTimeout(updateActiveLink, 100);

// ── Anti-spam helper ──
const SPAM_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 horas

function checkSpamCooldown(key) {
    const lastSent = localStorage.getItem(key);
    if (!lastSent) return null;
    const elapsed = Date.now() - parseInt(lastSent, 10);
    if (elapsed < SPAM_COOLDOWN_MS) {
        const remaining = SPAM_COOLDOWN_MS - elapsed;
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.ceil((remaining % 3600000) / 60000);
        return `${hours}h ${minutes}min`;
    }
    localStorage.removeItem(key);
    return null;
}

function markAsSent(key) {
    localStorage.setItem(key, Date.now().toString());
}

// ── Contact form (Formspree) ──
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

        const cooldown = checkSpamCooldown('binglish_contact_sent');
        if (cooldown) {
            Swal.fire({
                icon: 'info',
                title: 'Mensaje ya enviado',
                html: `Ya enviaste un mensaje recientemente.<br>Podrás enviar otro en <b>${cooldown}</b>.`,
            });
            return;
        }

        const btn = document.getElementById('btnContactSubmit');
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';

        const formData = new FormData();
        formData.append('nombre', document.getElementById('contactNombre').value.trim());
        formData.append('email', document.getElementById('contactEmail').value.trim());
        formData.append('asunto', document.getElementById('contactAsunto').value.trim());
        formData.append('mensaje', document.getElementById('contactMensaje').value.trim());

        try {
            const response = await fetch('https://formspree.io/f/xeevgzdq', {
                method: 'POST',
                body: formData,
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) throw new Error('Error al enviar el formulario');

            markAsSent('binglish_contact_sent');
            Swal.fire({
                icon: 'success',
                title: '¡Mensaje enviado!',
                text: 'Nos pondremos en contacto contigo pronto.'
            });
            form.reset();
            form.classList.remove('was-validated');
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Error al enviar',
                text: err.message
            });
        } finally {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    });
}

// ── Becas form (Formspree) ──
const becasForm = document.getElementById('becasForm');
if (becasForm) {
    becasForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

        const cooldown = checkSpamCooldown('binglish_becas_sent');
        if (cooldown) {
            Swal.fire({
                icon: 'info',
                title: 'Postulación ya enviada',
                html: `Ya enviaste una postulación recientemente.<br>Podrás enviar otra en <b>${cooldown}</b>.`,
            });
            return;
        }

        const btn = document.getElementById('btnBecasSubmit');
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';

        const formData = new FormData();
        formData.append('_subject', '📩 Nueva Postulación de Beca — Binglish');
        formData.append('Nombre', document.getElementById('becaNombre').value.trim());
        formData.append('Apellido', document.getElementById('becaApellido').value.trim());
        formData.append('Edad', document.getElementById('becaEdad').value.trim());
        formData.append('Email', document.getElementById('becaEmail').value.trim());
        formData.append('Teléfono', document.getElementById('becaTelefono').value.trim());
        formData.append('País', document.getElementById('becaPais').value.trim());
        formData.append('Nivel de Inglés', document.getElementById('becaNivel').value);
        formData.append('¿Por qué quiere aprender?', document.getElementById('becaPorque').value.trim());
        formData.append('Motivación', document.getElementById('becaMotivacion').value.trim());

        try {
            const response = await fetch('https://formspree.io/f/xeevgzdq', {
                method: 'POST',
                body: formData,
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) throw new Error('Error al enviar la postulación');

            markAsSent('binglish_becas_sent');

            if (typeof bootstrap !== 'undefined') {
                const modal = bootstrap.Modal.getInstance(document.getElementById('becasModal'));
                if (modal) modal.hide();
            }

            Swal.fire({
                icon: 'success',
                title: '¡Postulación Enviada!',
                html: 'Hemos recibido tu solicitud de beca.<br>Nos pondremos en contacto contigo pronto.',
                confirmButtonText: '¡Genial!',
            });

            form.reset();
            form.classList.remove('was-validated');
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Error al enviar',
                text: err.message
            });
        } finally {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    });
}

// ── Hero Scroll Fade/Parallax Effect ──
let ticking = false;

document.addEventListener('scroll', () => {
    if (!ticking) {
        window.requestAnimationFrame(() => {
            const heroWrapper = document.querySelector('.glass-hero-wrapper');
            if (!heroWrapper) return;

            const scrolled = window.scrollY;
            const opacity = Math.max(0, 1 - (scrolled / 1500));
            const translateY = scrolled * 0.10;

            heroWrapper.style.opacity = opacity;
            heroWrapper.style.transform = `translateY(${translateY}px)`;
            heroWrapper.style.pointerEvents = opacity <= 0.05 ? 'none' : 'auto';

            ticking = false;
        });

        ticking = true;
    }
});

// ── Stat Counter Animation ──
(function initStatCounters() {
    document.addEventListener('DOMContentLoaded', function () {
        var statNumbers = document.querySelectorAll('.stat-number[data-count]');
        if (!statNumbers.length) return;

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        statNumbers.forEach(function (el) {
            observer.observe(el);
        });
    });

    function animateCounter(element) {
        var target = parseInt(element.getAttribute('data-count'), 10);
        if (isNaN(target)) return;

        var duration = 1800;
        var startTime = performance.now();

        function update(currentTime) {
            var elapsed = currentTime - startTime;
            var progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            var eased = 1 - Math.pow(1 - progress, 3);
            var current = Math.round(eased * target);

            element.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }
})();



/* ============================================================
   LÓGICA DEL EQUIPO PERSONAL DOCENTE Y ADMIN (STAFF)
   ============================================================ */

const staff = [
    { id: 1, name: "Jhon Khea", role: "CEO - Fundador", category: "docente", bio: "El fundador de BINGLISH, dedicado a crear experiencias de aprendizaje únicas y significativas. Un visionario con una pasión por la excelencia y la innovación.", email: "jhonkea@gmail.com", initials: "J", featured: true, image: "assets/miembros/jhon.jpeg" },
    { id: 2, name: "Valeria Poma", role: "Directora Academica", category: "docente", bio: "Docente y Directora Academica de Binglish", email: "belenpoma80@gmail.com", initials: "V", image: "assets/miembros/valeria.jpeg" },
    { id: 3, name: "Maria Cahuaya", role: "Administradora", category: "administrativo", bio: "Área comercial / Marketing y administración.", email: "cahuayamaria71@gmail.com", initials: "M", image: "assets/miembros/maria.jpeg" },
    { id: 4, name: "Nacor Ayala", role: "Area de Sistemas", category: "administrativo", bio: "Sistemas y administración", email: "ayalanacor@gmail.com", initials: "N", image: "assets/miembros/nacor.jpeg" },
    { id: 5, name: "Miguel Valverde", role: "Administrador", category: "administrativo", bio: "Área audiovisual y administración", email: "mickhacking.official@gmail.com", initials: "M", image: "assets/miembros/miguel.jpeg" },
    { id: 6, name: "Erika Cruz", role: "Docente", category: "docente", bio: "Docente de inglés A1 - C1", email: "lauracruzfl@gmail.com", initials: "E", image: "assets/miembros/erika.jpeg" },
    { id: 7, name: "Noelia Oliden", role: "Docente", category: "docente", bio: "Docente de Francés", email: "aileonnedilo@gmail.com", initials: "N", image: "assets/miembros/noelia.jpeg" },
    { id: 8, name: "Jessika Rocha", role: "Docente", category: "docente", bio: "Docente de Francés", email: "rochajhessika@gmail.com", initials: "J", image: "assets/miembros/jessika.jpeg" },
    { id: 9, name: "Richard Condori", role: "Docente", category: "docente", bio: "Docente de inglés A1 - C1", email: "richard.cep.oi@gmail.com", initials: "R", image: "assets/miembros/richard.png" },
    { id: 10, name: "Walter Coaquira", role: "Docente", category: "docente", bio: "Docente de inglés A1 - C1", email: "yassir6744@gmail.com", initials: "Y", image: "assets/miembros/walter.jpeg" }
];

let currentFilter = 'todos';

window.loadPhoto = function (event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById('groupPhotoImg');
        if (img) img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.setFilter = function (cat, btn) {
    currentFilter = cat;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderStaff();
};

function updateCounts() {
    ['todos', 'docente', 'administrativo'].forEach(cat => {
        const count = staff.filter(p => cat === 'todos' || p.category === cat).length;
        const el = document.getElementById('count-' + cat);
        if (el) el.textContent = count;
    });
}

function renderStaff() {
    const container = document.getElementById('staffContainer');
    if (!container) return;

    const filtered = staff.filter(p => currentFilter === 'todos' || p.category === currentFilter);

    if (filtered.length === 0) {
        container.innerHTML = '<div class="no-results"><i class="bi bi-people" style="font-size:32px;display:block;margin-bottom:8px;color:var(--text-muted)"></i>No hay miembros en esta categoría.</div>';
        return;
    }

    const featured = currentFilter === 'todos' ? filtered.filter(p => p.featured) : [];
    const rest = currentFilter === 'todos' ? filtered.filter(p => !p.featured) : filtered;

    let html = '';

    if (featured.length > 0) {
        html += '<p class="section-label">Dirección</p>';
        featured.forEach(p => {
            let photoHtml = p.image && p.image !== '' ? `<img src='${p.image}' alt='${p.name}' class='team-img'>` : p.initials;
            html += `<div class="team-featured-card" data-aos="fade-up" data-aos-duration="600">
                <div class="team-featured-photo">
                    ${photoHtml}
                    <img src="assets/logo.svg" class="team-watermark" alt="Binglish Logo">
                </div>
                <div class="team-featured-info">
                    <span class="featured-badge">Gerente General</span>
                    <p class="featured-name">${p.name}</p>
                    <p class="featured-role">${p.role}</p>
                    <p class="featured-bio">${p.bio}</p>
                    <a href="mailto:${p.email}" target="_blank" class="featured-email mt-2" style="text-decoration: none;">
                        <i class="bi bi-envelope me-2"></i>${p.email}
                    </a>
                </div>
            </div>`;
        });
        if (rest.length > 0) html += '<p class="section-label mt-5">Personal</p>';
    }

    if (rest.length > 0) {
        html += '<div class="row g-4 justify-content-center">';
        rest.forEach((p, index) => {
            let delay = 100 + (index * 100);
            let photoHtml = p.image && p.image !== '' ? `<img src='${p.image}' alt='${p.name}' class='team-img'>` : p.initials;
            html += `
                <div class="col-10 col-sm-8 col-md-6 col-lg-3" data-aos="zoom-in" data-aos-duration="600" data-aos-delay="${delay}">
                    <div class="team-card">
                        <div class="team-img-wrapper">
                            ${photoHtml}
                            <img src="assets/logo.svg" class="team-watermark" alt="Binglish Logo">
                            <div class="team-img-overlay">
                                <h5>${p.name}</h5>
                                <p class="team-desc-overlay">${p.bio}</p>
                            </div>
                        </div>
                        <div class="team-card-body">
                            <div class="team-card-email">
                                <a href="mailto:${p.email}" target="_blank" class="team-text-link mb-0">
                                    <i class="bi bi-envelope-at"></i>${p.email}
                                </a>
                            </div>
                        </div>
                    </div>
                </div>`;
        });
        html += '</div>';
    }

    container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
    updateCounts();
    renderStaff();
    cargarNoticiasIndex();
});

/* ============================================================
   LÓGICA DE NOTICIAS EN EL INDEX
   ============================================================ */

function buildFeaturedCard(noticia, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let imgUrl = null;
    if (noticia.imagenes && noticia.imagenes.length > 0) {
        const portada = noticia.imagenes.find(img => img.es_portada) || noticia.imagenes[0];
        if (portada) imgUrl = `${API_BASE}/${portada.image_path}`;
    }

    const fecha = new Date(noticia.fecha_publicacion).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' });

    let icon = 'bi-newspaper';
    if (noticia.categoria === 'anuncio') icon = 'bi-megaphone-fill';
    else if (noticia.categoria === 'promo') icon = 'bi-tag-fill';
    else if (noticia.categoria === 'evento') icon = 'bi-calendar-event-fill';

    container.style.display = 'block';
    container.innerHTML = `
        <div class="featured-news-card" onclick="verNoticiaIndex(${noticia.id})" style="cursor:pointer;">
            <div class="featured-news-img-col">
                ${imgUrl
                    ? `<img src="${imgUrl}" alt="Noticia Destacada">`
                    : `<div class="featured-news-img-placeholder"><i class="bi ${noticia.icono || 'bi-image'} text-white-50" style="font-size: 5rem;"></i></div>`
                }
                <div class="featured-news-img-overlay"></div>
            </div>
            <div class="featured-news-body">
                <div class="featured-news-badge">
                    <i class="bi bi-star-fill me-1"></i> Noticia Destacada
                </div>
                <div class="featured-news-category mb-2">
                    <i class="bi ${icon} me-1"></i> ${noticia.categoria.toUpperCase()}
                </div>
                <h2 class="featured-news-title">${noticia.titulo}</h2>
                <p class="featured-news-extract">${noticia.extracto || ''}</p>
                <div class="featured-news-meta">
                    <span><i class="bi bi-calendar3 me-1"></i> ${fecha}</span>
                </div>
                <a href="javascript:void(0)" class="featured-news-btn mt-auto">
                    Leer Más <i class="bi bi-arrow-right ms-1"></i>
                </a>
            </div>
        </div>
    `;
}

async function cargarNoticiasIndex() {
    const grid = document.getElementById('indexNewsGrid');
    if (!grid) return; // Si no estamos en la página que tiene el grid, salir

    try {
        const response = await fetch(`${API_BASE}/noticias/`);
        if (!response.ok) throw new Error('Error al cargar noticias');

        const data = await response.json();

        // Separar noticia destacada
        const destacada = data.find(n => n.es_destacado);
        if (destacada) {
            buildFeaturedCard(destacada, 'indexFeaturedNews');
        }

        // Filtrar por anuncios y promociones (excluyendo la destacada), tomar las últimas 3
        const sinDestacada = data.filter(n => !n.es_destacado);
        const noticiasFiltradas = sinDestacada
            .filter(n => n.categoria === 'anuncio' || n.categoria === 'promo')
            .slice(0, 3);

        // Si no hay suficientes, rellenar con otras categorías hasta llegar a 3
        if (noticiasFiltradas.length < 3) {
            const otrasNoticias = sinDestacada.filter(n => n.categoria !== 'anuncio' && n.categoria !== 'promo');
            const faltantes = 3 - noticiasFiltradas.length;
            noticiasFiltradas.push(...otrasNoticias.slice(0, faltantes));
        }

        if (noticiasFiltradas.length === 0) {
            grid.innerHTML = '<div class="col-12 text-center text-white-50"><p>No hay noticias recientes por el momento.</p></div>';
            return;
        }

        let html = '';
        noticiasFiltradas.forEach((noticia, index) => {
            const delay = 100 + (index * 100);

            // Icono según categoría
            let icon = 'bi-newspaper';
            if (noticia.categoria === 'anuncio') icon = 'bi-megaphone-fill';
            else if (noticia.categoria === 'promo') icon = 'bi-tag-fill text-warning';
            else if (noticia.categoria === 'evento') icon = 'bi-calendar-event-fill text-info';

            // Extraer imagen de portada
            let imgUrl = null;
            if (noticia.imagenes && noticia.imagenes.length > 0) {
                const portada = noticia.imagenes.find(img => img.es_portada) || noticia.imagenes[0];
                if (portada) imgUrl = `${API_BASE}/${portada.image_path}`;
            }

            html += `
                <div class="col-md-6 col-lg-4" data-aos="fade-up" data-aos-duration="800" data-aos-delay="${delay}">
                    <div class="noticia-card h-100 d-flex flex-column" onclick="verNoticiaIndex(${noticia.id})" style="cursor: pointer; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; overflow: hidden; backdrop-filter: blur(10px); transition: transform 0.3s ease;">
                        <div class="noticia-img" style="height: 200px; overflow: hidden; position: relative;">
                            ${imgUrl ?
                                `<img src="${imgUrl}" alt="Portada" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease;">` :
                                `<div style="width: 100%; height: 100%; display:flex; align-items:center; justify-content:center; background:#1A233A;">
                                    <i class="bi ${noticia.icono || 'bi-image'} text-white-50" style="font-size: 3rem;"></i>
                                 </div>`
                            }
                            <span class="badge position-absolute top-0 start-0 m-3" style="background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); border: 1px solid rgba(0,229,255,0.2); color: #00E5FF;">
                                <i class="bi ${icon} me-1"></i> ${noticia.categoria.toUpperCase()}
                            </span>
                        </div>
                        <div class="p-4 d-flex flex-column flex-grow-1">
                            <small class="text-info mb-2"><i class="bi bi-calendar3 me-1"></i> ${new Date(noticia.fecha_publicacion).toLocaleDateString()}</small>
                            <h5 class="text-white fw-bold mb-3" style="font-family: 'Playfair Display', serif;">${noticia.titulo}</h5>
                            <p class="text-white-50 small flex-grow-1" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                                ${noticia.extracto || ''}
                            </p>
                            <a href="javascript:void(0)" class="mt-auto d-inline-flex align-items-center fw-bold" style="color: #00E5FF; text-decoration: none; font-size: 0.95rem; gap: 5px; transition: gap 0.3s ease;" onmouseover="this.style.gap='10px'" onmouseout="this.style.gap='5px'">
                                Leer Más <i class="bi bi-arrow-right"></i>
                            </a>
                        </div>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;

        // Add hover effect via JS since inline style hover is limited
        const cards = grid.querySelectorAll('.noticia-card');
        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-5px)';
                card.style.borderColor = 'rgba(0, 229, 255, 0.3)';
                card.style.boxShadow = '0 10px 30px rgba(0, 229, 255, 0.1)';
                const img = card.querySelector('img');
                if (img) img.style.transform = 'scale(1.05)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'none';
                card.style.borderColor = 'rgba(255,255,255,0.1)';
                card.style.boxShadow = 'none';
                const img = card.querySelector('img');
                if (img) img.style.transform = 'none';
            });
        });

    } catch (error) {
        console.error('Error al cargar noticias en el index:', error);
        grid.innerHTML = '<div class="col-12 text-center text-danger"><p>Error al cargar las novedades.</p></div>';
    }
}

function verNoticiaIndex(id) {
    localStorage.setItem('noticia_abrir_id', id);
    window.location.href = 'noticias.html?t=' + new Date().getTime();
}
