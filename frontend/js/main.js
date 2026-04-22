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
