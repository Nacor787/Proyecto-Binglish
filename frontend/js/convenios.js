/* ============================================================
   CONVENIOS.JS — Premium Landing Page Logic
   Binglish — The Right Move
   ============================================================ */

(function () {
    'use strict';

    /* ── Vanta.js Initialization ─────────────────────────────── */
    function initVanta() {
        if (typeof VANTA === 'undefined' || typeof THREE === 'undefined') {
            console.warn('Vanta.js or Three.js not loaded – skipping animated background.');
            // Fallback: simple radial gradient
            const bg = document.getElementById('vanta-bg');
            if (bg) {
                bg.style.background = 'radial-gradient(ellipse at 50% 30%, #0a1628 0%, #050510 70%)';
            }
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

    /* ── Navbar Scroll Effect ────────────────────────────────── */
    function initNavbarScroll() {
        const navbar = document.getElementById('convNavbar');
        if (!navbar) return;

        let ticking = false;

        function onScroll() {
            if (!ticking) {
                window.requestAnimationFrame(function () {
                    if (window.scrollY > 50) {
                        navbar.classList.add('scrolled');
                    } else {
                        navbar.classList.remove('scrolled');
                    }
                    ticking = false;
                });
                ticking = true;
            }
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        // Initial check
        onScroll();
    }

    /* ── AOS Initialization ──────────────────────────────────── */
    function initAOS() {
        if (typeof AOS === 'undefined') {
            console.warn('AOS not loaded – skipping scroll animations.');
            return;
        }

        AOS.init({
            duration: 800,
            easing: 'ease-in-out',
            once: true,
            offset: 50,
            disable: function () {
                // Disable on very low-end devices
                return window.innerWidth < 320;
            }
        });
    }

    /* ── Smooth Scroll for Anchor Links ──────────────────────── */
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
            anchor.addEventListener('click', function (e) {
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;

                const target = document.querySelector(targetId);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    /* ── Card Tilt / Parallax Effect (subtle) ────────────────── */
    function initCardEffects() {
        const cards = document.querySelectorAll('.conv-card');

        cards.forEach(function (card) {
            card.addEventListener('mousemove', function (e) {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = ((y - centerY) / centerY) * -4;
                const rotateY = ((x - centerX) / centerX) * 4;

                card.style.transform =
                    'translateY(-8px) scale(1.02) perspective(1000px) rotateX(' +
                    rotateX + 'deg) rotateY(' + rotateY + 'deg)';
            });

            card.addEventListener('mouseleave', function () {
                card.style.transform = '';
            });
        });
    }

    /* ── Counter Animation for Stats ─────────────────────────── */
    function initCounterAnimation() {
        const statPills = document.querySelectorAll('.conv-stat-pill strong');
        if (!statPills.length) return;

        const observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    animateValue(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        statPills.forEach(function (el) {
            observer.observe(el);
        });
    }

    function animateValue(element) {
        const text = element.textContent.trim();
        const hasPlus = text.includes('+');
        const numericValue = parseInt(text.replace(/[^0-9]/g, ''), 10);

        if (isNaN(numericValue)) return;

        const duration = 1500;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            var eased = 1 - Math.pow(1 - progress, 3);
            var current = Math.round(eased * numericValue);

            element.textContent = current + (hasPlus ? '+' : '');

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    /* ── Scroll Indicator Click ──────────────────────────────── */
    function initScrollIndicator() {
        var indicator = document.querySelector('.conv-scroll-indicator');
        if (indicator) {
            indicator.style.cursor = 'pointer';
            indicator.addEventListener('click', function () {
                var section = document.getElementById('conveniosGrid');
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        }
    }

    /* ── Init Everything ─────────────────────────────────────── */
    var vantaEffect = null;

    document.addEventListener('DOMContentLoaded', function () {
        vantaEffect = initVanta();
        initNavbarScroll();
        initAOS();
        initSmoothScroll();
        initCardEffects();
        initCounterAnimation();
        initScrollIndicator();
    });

    /* ── Cleanup on unload ───────────────────────────────────── */
    window.addEventListener('beforeunload', function () {
        if (vantaEffect) {
            vantaEffect.destroy();
        }
    });

})();

/* ============================================================
   LÓGICA DEL EQUIPO (STAFF)
   ============================================================ */

const staff = [
    { id: 1, name: "Maria", role: "Cargo / Rol", category: "coordinacion", bio: "Licenciada en Administración de Empresas, TS. Informática, encargada del área comercial y administrativa.", email: "nacoruziel@gmail.com", initials: "M", featured: true, image: "assets/miembros/maria.jpg" },
    { id: 2, name: "Nombre del Miembro", role: "Cargo / Rol", category: "docente", bio: "Breve descripción o frase inspiradora sobre este profesional y su dedicación a la enseñanza.", email: "nacoruziel@gmail.com", initials: "N", image: "https://via.placeholder.com/150" },
    { id: 3, name: "Nombre del Miembro", role: "Cargo / Rol", category: "docente", bio: "Breve descripción o frase inspiradora sobre este profesional y su dedicación a la enseñanza.", email: "nacoruziel@gmail.com", initials: "N", image: "https://via.placeholder.com/150" },
    { id: 4, name: "Nombre del Miembro", role: "Cargo / Rol", category: "docente", bio: "Breve descripción o frase inspiradora sobre este profesional y su dedicación a la enseñanza.", email: "nacoruziel@gmail.com", initials: "N", image: "https://via.placeholder.com/150" },
    { id: 5, name: "Nombre del Miembro", role: "Cargo / Rol", category: "administrativo", bio: "Breve descripción o frase inspiradora sobre este profesional y su dedicación a la enseñanza.", email: "nacoruziel@gmail.com", initials: "N", image: "https://via.placeholder.com/150" },
    { id: 6, name: "Nombre del Miembro", role: "Cargo / Rol", category: "administrativo", bio: "Breve descripción o frase inspiradora sobre este profesional y su dedicación a la enseñanza.", email: "nacoruziel@gmail.com", initials: "N", image: "https://via.placeholder.com/150" },
    { id: 7, name: "Nombre del Miembro", role: "Cargo / Rol", category: "administrativo", bio: "Breve descripción o frase inspiradora sobre este profesional y su dedicación a la enseñanza.", email: "nacoruziel@gmail.com", initials: "N", image: "https://via.placeholder.com/150" },
    { id: 8, name: "Nombre del Miembro", role: "Cargo / Rol", category: "docente", bio: "Breve descripción o frase inspiradora sobre este profesional y su dedicación a la enseñanza.", email: "nacoruziel@gmail.com", initials: "N", image: "https://via.placeholder.com/150" }
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
    ['todos', 'docente', 'administrativo', 'coordinacion'].forEach(cat => {
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
            let photoHtml = p.image && p.image !== '' ? `<img src='${p.image}' alt='${p.name}'>` : p.initials;
            html += `<div class="team-featured-card" data-aos="fade-up" data-aos-duration="600">
                <div class="team-featured-photo">${photoHtml}</div>
                <div class="team-featured-info">
                    <span class="featured-badge">Dirección</span>
                    <p class="featured-name">${p.name}</p>
                    <p class="featured-role">${p.role}</p>
                    <p class="featured-bio">${p.bio}</p>
                    <a href="mailto:${p.email}" class="featured-email"><i class="bi bi-envelope"></i>${p.email}</a>
                </div>
            </div>`;
        });
        if (rest.length > 0) html += '<p class="section-label mt-5">Equipo</p>';
    }

    if (rest.length > 0) {
        html += '<div class="row g-4 justify-content-center">';
        rest.forEach((p, index) => {
            let delay = 100 + (index * 100);
            let photoHtml = p.image && p.image !== '' ? `<img src='${p.image}' alt='${p.name}' class='team-img'>` : p.initials;
            html += `
                <div class="col-md-6 col-lg-3" data-aos="zoom-in" data-aos-duration="600" data-aos-delay="${delay}">
                    <div class="team-card">
                        <div class="team-img-wrapper">
                            ${photoHtml}
                        </div>
                        <h5>${p.name}</h5>
                        <p class="team-role">${p.role}</p>
                        <p class="team-desc">${p.bio}</p>
                        <div class="d-inline-flex flex-column mt-3 w-100 align-items-center">
                            <div class="text-start">
                                <a href="mailto:${p.email}" target="_blank" class="team-text-link mb-0">
                                    <i class="bi bi-envelope"></i>${p.email}
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
});
