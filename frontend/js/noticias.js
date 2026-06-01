let allNoticias = [];

/* ── Noticia Destacada ── */
function buildFeaturedCard(noticia, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let imgUrl = null;
    if (noticia.imagenes && noticia.imagenes.length > 0) {
        const portada = noticia.imagenes.find(img => img.es_portada) || noticia.imagenes[0];
        if (portada) imgUrl = `${API_BASE}/${portada.image_path}`;
    }

    const fecha = new Date(noticia.fecha_publicacion + 'Z').toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' });

    let icon = 'bi-newspaper';
    if (noticia.categoria === 'anuncio') icon = 'bi-megaphone-fill';
    else if (noticia.categoria === 'promo') icon = 'bi-tag-fill';
    else if (noticia.categoria === 'evento') icon = 'bi-calendar-event-fill';

    container.style.display = 'block';
    container.innerHTML = `
        <div class="featured-news-card" onclick="abrirDetalle(${noticia.id})" style="cursor:pointer;">
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

document.addEventListener('DOMContentLoaded', () => {
    cargarNoticias();

    // Filtrado por botones
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            filtrarNoticias();

            // Desplazar suavemente directamente a la grilla de noticias para ver los resultados
            // Desplazar suavemente directamente a la grilla de noticias
            scrollToGrid();
        });
    });

    // Filtrado por buscador
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', filtrarNoticias);
        // Desplazar al presionar Enter en el buscador
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Evitar envío de formularios si los hubiera
                scrollToGrid();
            }
        });
    }
});

// Función para desplazar la vista hacia la grilla de noticias
function scrollToGrid() {
    const grid = document.getElementById('newsGrid');
    if (grid) {
        const yOffset = -120; // Margen para el menú superior
        const y = grid.getBoundingClientRect().top + window.scrollY + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
    }
}

async function cargarNoticias() {
    try {
        const res = await fetch(`${API_BASE}/noticias/`);
        if (!res.ok) throw new Error('Error de red');
        allNoticias = await res.json();

        // Mostrar la noticia destacada si existe
        const destacada = allNoticias.find(n => n.es_destacado);
        if (destacada) {
            buildFeaturedCard(destacada, 'featuredNewsContainer');
        }


        renderGrid(allNoticias);
        renderPromoBanner(allNoticias);
        renderMasLeidas(allNoticias);

        // Autocargar noticia desde URL amigable o localStorage
        const idParamStorage = localStorage.getItem('noticia_abrir_id');

        // Detectar slug desde la URL (ej: /noticias/mi-titulo-noticia)
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        let slugOpened = false;

        // Si la URL tiene formato /noticias/slug (2 partes)
        if (pathParts.length >= 2 && pathParts[0] === 'noticias') {
            const slug = pathParts[pathParts.length - 1];
            // Buscar la noticia por slug en el array ya cargado
            const noticiaBySlug = allNoticias.find(n => n.slug === slug);
            if (noticiaBySlug) {
                abrirDetalle(noticiaBySlug.id);
                slugOpened = true;
            }
        } else if (idParamStorage) {
            localStorage.removeItem('noticia_abrir_id');
            setTimeout(() => {
                abrirDetalle(parseInt(idParamStorage));
            }, 100);
            slugOpened = true;
        }

        // Si no se abrió ningún detalle, asegurar que el listado esté visible
        if (!slugOpened) {
            const vistaListado = document.getElementById('vista-listado');
            if (vistaListado) vistaListado.style.display = 'block';
        }
    } catch (error) {
        console.error(error);
        const vistaListado = document.getElementById('vista-listado');
        if (vistaListado) vistaListado.style.display = 'block';
        const newsGrid = document.getElementById('newsGrid');
        if (newsGrid) newsGrid.innerHTML = '<p class="text-danger w-100 text-center">Error al cargar las noticias. Inténtalo más tarde.</p>';
    }
}

let currentPage = 1;
const ITEMS_PER_PAGE = 6;
let lastFilteredNoticias = [];

function filtrarNoticias() {
    const categoriaActiva = document.querySelector('.filter-btn.active').dataset.filter;
    const query = document.getElementById('searchInput').value.toLowerCase();

    let filtradas = allNoticias;
    if (categoriaActiva !== 'todas') {
        filtradas = filtradas.filter(n => n.categoria === categoriaActiva);
    }
    if (query) {
        filtradas = filtradas.filter(n => n.titulo.toLowerCase().includes(query) || n.extracto.toLowerCase().includes(query));
    }

    currentPage = 1;
    lastFilteredNoticias = filtradas;
    renderGrid(filtradas);
}

window.changeNewsPage = function (page) {
    currentPage = page;
    renderGrid(lastFilteredNoticias);
    const target = document.getElementById('noticiasFilters');
    if (target) {
        const yOffset = -100;
        const y = target.getBoundingClientRect().top + window.scrollY + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
    }
};

function renderGrid(noticias) {
    const grid = document.getElementById('newsGrid');
    const paginationContainer = document.getElementById('newsPaginationContainer');
    const paginationInfo = document.getElementById('newsPaginationInfo');
    const paginationButtons = document.getElementById('newsPaginationButtons');

    // Make sure we are on the noticias page
    if (!grid) return;

    // Si no es un array, salir
    if (!Array.isArray(noticias)) return;

    // Almacenar el último array de noticias
    lastFilteredNoticias = noticias;

    // Excluir la destacada del grid normal
    const noDestacadas = noticias.filter(n => !n.es_destacado);

    if (noDestacadas.length === 0) {
        grid.innerHTML = '<p class="text-white-50 w-100 text-center py-5">No se encontraron noticias con estos filtros.</p>';
        if (paginationContainer) paginationContainer.style.display = 'none';
        return;
    }

    const totalItems = noDestacadas.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const paginatedList = noDestacadas.slice(startIdx, endIdx);

    grid.innerHTML = paginatedList.map(n => {
        let imgUrl = null;
        const portada = n.imagenes.find(img => img.es_portada) || n.imagenes[0];
        if (portada) imgUrl = `${API_BASE}/${portada.image_path}`;

        const fecha = new Date(n.fecha_publicacion + 'Z').toLocaleDateString('es-BO', { month: 'short', day: 'numeric', year: 'numeric' });

        return `
            <div class="noticia-card" onclick="abrirDetalle(${n.id})">
                <div class="noticia-tag">${n.categoria}</div>
                <div class="noticia-img">
                    ${imgUrl ?
                `<img src="${imgUrl}" alt="${n.titulo}">` :
                `<div style="width: 100%; height: 100%; display:flex; align-items:center; justify-content:center; background:#1A233A;">
                            <i class="bi ${n.icono || 'bi-image'} text-white-50" style="font-size: 3rem;"></i>
                         </div>`
            }
                </div>
                <div class="noticia-body">
                    <div class="noticia-date"><i class="bi bi-clock"></i> ${fecha}</div>
                    <h3 class="noticia-title">${n.titulo}</h3>
                    <p class="noticia-excerpt">${n.extracto}</p>
                    <div class="noticia-footer">
                        <span class="noticia-readmore">Leer más <i class="bi bi-arrow-right"></i></span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Actualizar controles de paginación
    if (paginationContainer) {
        if (totalItems > ITEMS_PER_PAGE) {
            paginationContainer.style.display = 'flex';

            const currentEnd = Math.min(endIdx, totalItems);
            paginationInfo.textContent = `Mostrando ${currentEnd} de ${totalItems} noticias`;

            let buttonsHtml = '';
            buttonsHtml += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changeNewsPage(${currentPage - 1})"><i class="bi bi-chevron-left" style="font-size:14px;"></i></button>`;

            let lastRendered = 0;
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                    if (lastRendered && i - lastRendered > 1) {
                        buttonsHtml += `<button class="page-btn" disabled>...</button>`;
                    }
                    buttonsHtml += `<button class="page-btn ${currentPage === i ? 'active' : ''}" onclick="changeNewsPage(${i})">${i}</button>`;
                    lastRendered = i;
                }
            }

            buttonsHtml += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changeNewsPage(${currentPage + 1})"><i class="bi bi-chevron-right" style="font-size:14px;"></i></button>`;

            paginationButtons.innerHTML = buttonsHtml;
        } else {
            paginationContainer.style.display = 'none';
        }
    }
}

function abrirDetalle(id) {
    const n = allNoticias.find(x => x.id === id);
    if (!n) return;

    document.getElementById('vista-listado').style.display = 'none';
    document.getElementById('vista-detalle').style.display = 'block';
    window.scrollTo(0, 0);

    // Actualizar URL amigable para compartir
    const slug = n.slug || id;
    history.pushState(null, '', `/noticias/${slug}`);

    // Registrar vista en el servidor de forma silenciosa
    fetch(`${API_BASE}/noticias/por-slug/${slug}`).catch(e => console.error(e));

    document.getElementById('detalleCategoria').textContent = n.categoria.toUpperCase();

    const badgeDestacada = document.getElementById('detalleDestacada');
    if (n.es_destacado) {
        badgeDestacada.innerHTML = '<i class="bi bi-star-fill me-1"></i> Destacada';
        badgeDestacada.className = 'badge ms-2';
        badgeDestacada.style.background = 'rgba(255, 170, 0, 0.2)';
        badgeDestacada.style.color = '#FFAA00';
        badgeDestacada.style.border = '1px solid rgba(255, 170, 0, 0.4)';
        badgeDestacada.style.display = 'inline-flex';
        badgeDestacada.style.alignItems = 'center';
    } else {
        badgeDestacada.style.display = 'none';
    }

    document.getElementById('detalleTitulo').textContent = n.titulo;

    // Mostramos fecha y vistas (asumimos +1 visualmente si es la primera vez que entra, pero usamos n.vistas o 0)
    document.getElementById('detalleFecha').innerHTML = `<i class="bi bi-calendar3 me-1"></i> ` + new Date(n.fecha_publicacion + 'Z').toLocaleDateString('es-BO', { month: 'long', day: 'numeric', year: 'numeric' }) + ` <span class="ms-3" title="Vistas"><i class="bi bi-eye-fill me-1"></i> ${n.vistas || 0} Vistas</span>`;

    // Formateo especial de contenido (Agrupar blockquotes de Quill)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = n.contenido;

    let currentQuoteGroup = null;
    Array.from(tempDiv.childNodes).forEach(node => {
        if (node.tagName === 'BLOCKQUOTE') {
            if (!currentQuoteGroup) {
                currentQuoteGroup = document.createElement('div');
                currentQuoteGroup.className = 'quote-block';
                node.parentNode.insertBefore(currentQuoteGroup, node);
            }
            let text = node.innerHTML.trim();
            // Si la línea empieza con un guion, la convertimos en cita de autor
            if (text.startsWith('—') || text.startsWith('–') || text.startsWith('-')) {
                currentQuoteGroup.insertAdjacentHTML('beforeend', `<cite>${text}</cite>`);
            } else {
                currentQuoteGroup.insertAdjacentHTML('beforeend', `<p>${text}</p>`);
            }
            node.remove();
        } else {
            // Ignorar nodos de texto vacíos (saltos de línea del HTML)
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() === '') {
                return;
            }
            currentQuoteGroup = null; // Romper el grupo
        }
    });

    document.getElementById('detalleContenido').innerHTML = tempDiv.innerHTML;

    // ==========================================
    // CUSTOM IMAGE SLIDER
    // ==========================================
    const sliderTrack = document.getElementById('detalleSliderTrack');
    const sliderWrapper = document.getElementById('detalleSliderWrapper');
    const btnPrev = document.getElementById('sliderPrev');
    const btnNext = document.getElementById('sliderNext');

    // Limpiar intervalo anterior si existe
    if (window._sliderInterval) {
        clearInterval(window._sliderInterval);
        window._sliderInterval = null;
    }
    if (window._sliderResizeHandler) {
        window.removeEventListener('resize', window._sliderResizeHandler);
    }

    if (n.imagenes && n.imagenes.length > 0) {
        const imagenes = [...n.imagenes].sort((a, b) => b.es_portada - a.es_portada);

        sliderTrack.innerHTML = imagenes.map(img =>
            `<img src="${API_BASE}/${img.image_path}" alt="Noticia Imagen">`
        ).join('');

        let currentSlide = 0;
        const totalSlides = imagenes.length;

        function goToSlide(index) {
            const slideWidth = sliderTrack.children[0].clientWidth;
            sliderTrack.style.transform = `translateX(-${index * slideWidth}px)`;
        }

        function nextSlide() {
            currentSlide = (currentSlide + 1) % totalSlides;
            goToSlide(currentSlide);
        }

        function prevSlide() {
            currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
            goToSlide(currentSlide);
        }

        // Mostrar flechas solo si hay más de 1 imagen
        if (totalSlides > 1) {
            btnPrev.style.display = 'flex';
            btnNext.style.display = 'flex';

            btnPrev.onclick = () => { prevSlide(); resetAutoSlide(); };
            btnNext.onclick = () => { nextSlide(); resetAutoSlide(); };

            // Auto-play
            window._sliderInterval = setInterval(nextSlide, 3000);

            function resetAutoSlide() {
                clearInterval(window._sliderInterval);
                window._sliderInterval = setInterval(nextSlide, 3000);
            }
        } else {
            btnPrev.style.display = 'none';
            btnNext.style.display = 'none';
        }

        // Ajustar al redimensionar
        window._sliderResizeHandler = () => goToSlide(currentSlide);
        window.addEventListener('resize', window._sliderResizeHandler);

        goToSlide(0);
    } else {
        // Sin imágenes: mostrar icono sin destruir la estructura del slider
        btnPrev.style.display = 'none';
        btnNext.style.display = 'none';
        sliderTrack.style.transform = 'translateX(0)';
        sliderTrack.innerHTML = `<div class="detalle-slider-placeholder" style="flex-shrink: 0;"><i class="bi ${n.icono || 'bi-newspaper'} text-white-50" style="font-size: 6rem;"></i></div>`;
    }
}

// ==========================================
// LIGHTBOX CONTROLS
// ==========================================
function openLightbox(src) {
    const overlay = document.getElementById('lightboxOverlay');
    const img = document.getElementById('lightboxImg');
    img.src = src;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // Evita scroll de fondo
}

function closeLightbox() {
    const overlay = document.getElementById('lightboxOverlay');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function volverListado() {
    document.getElementById('vista-detalle').style.display = 'none';
    document.getElementById('vista-listado').style.display = 'block';
    window.scrollTo(0, 0);
    // Limpiar URL (volver a /noticias o /noticias.html)
    history.pushState(null, '', '/noticias');
}

function irACategoria(cat) {
    volverListado();
    // Remover clase activa de todos los botones
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    // Agregar clase activa al botón correspondiente
    const btn = document.querySelector(`.filter-btn[data-filter="${cat}"]`);
    if (btn) btn.classList.add('active');
    // Aplicar el filtro
    filtrarNoticias();
}

// ==========================================
// COMPARTIR NOTICIA
// ==========================================
function compartirWA() {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.getElementById('detalleTitulo').textContent);
    window.open(`https://api.whatsapp.com/send?text=${title}%0A${url}`, '_blank');
}

function compartirFB() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
}

function copiarLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        const btn = document.querySelector('.share-btn:last-child');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-check-lg text-success"></i> ¡Copiado!';
        setTimeout(() => { btn.innerHTML = originalText; }, 2000);
    });
}

// ── BANNER DE PROMOCIONES Y ANUNCIOS DEBAJO EL NAV──
function renderPromoBanner(noticias) {
    const container = document.getElementById('promoBannerContainer');
    if (!container) return;

    // Filtrar promos y anuncios
    const promos = noticias.filter(n => n.categoria.toLowerCase() === 'promo' || n.categoria.toLowerCase() === 'anuncio');

    // Si no hay promos, ocultar el banner
    if (promos.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';

    // Función para crear un bloque de promos
    const buildPromoItems = () => {
        let itemsHtml = '';
        promos.forEach(p => {
            const defaultIcon = p.categoria.toLowerCase() === 'promo' ? 'bi-star-fill' : 'bi-megaphone-fill';
            const icon = p.icono ? p.icono : defaultIcon;
            itemsHtml += `
                <div class="promo-item"><i class="bi ${icon}"></i> ${p.titulo}</div>
                <div class="promo-item text-white-50 mx-2">|</div>
            `;
        });
        return itemsHtml;
    };

    // Creamos DOS contenedores idénticos para que el CSS translateX(-100%) haga un loop perfecto
    let html = `
        <div class="promo-marquee-content">${buildPromoItems()}</div>
        <div class="promo-marquee-content">${buildPromoItems()}</div>
    `;

    container.innerHTML = html;
}

/* ── Renderizar Noticias Más Leídas ── */
function renderMasLeidas(noticias) {
    const container = document.getElementById('masLeidasContainer');
    if (!container) return;
    container.innerHTML = '';

    // Ordenar por vistas descendente y tomar las top 3
    const topNoticias = [...noticias].sort((a, b) => (b.vistas || 0) - (a.vistas || 0)).slice(0, 3);

    if (topNoticias.length === 0) {
        container.innerHTML = '<p class="text-white-50 small">No hay noticias suficientes.</p>';
        return;
    }

    topNoticias.forEach((noticia, index) => {
        const fecha = new Date(noticia.fecha_publicacion + 'Z').toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });

        let bgColor = 'rgba(0, 229, 255, 0.1)';
        let borderColor = 'rgba(0, 229, 255, 0.3)';
        let iconColor = '#00E5FF';
        let iconClass = 'bi-newspaper';

        if (noticia.categoria === 'anuncio') {
            bgColor = 'rgba(255, 61, 113, 0.1)';
            borderColor = 'rgba(255, 61, 113, 0.3)';
            iconColor = '#FF3D71';
            iconClass = 'bi-megaphone-fill';
        } else if (noticia.categoria === 'promo') {
            bgColor = 'rgba(255, 170, 0, 0.1)';
            borderColor = 'rgba(255, 170, 0, 0.3)';
            iconColor = '#FFAA00';
            iconClass = 'bi-tag-fill';
        } else if (noticia.categoria === 'evento') {
            bgColor = 'rgba(0, 214, 143, 0.1)';
            borderColor = 'rgba(0, 214, 143, 0.3)';
            iconColor = '#00D68F';
            iconClass = 'bi-calendar-event-fill';
        }

        if (noticia.icono) iconClass = noticia.icono;

        const isLast = index === topNoticias.length - 1;
        const mbClass = isLast ? '' : 'mb-4';

        const html = `
            <div class="d-flex align-items-center ${mbClass}"
                style="cursor: pointer; transition: transform 0.2s ease;"
                onmouseover="this.style.transform='translateX(5px)'"
                onmouseout="this.style.transform='translateX(0)'"
                onclick="abrirDetalle(${noticia.id})">
                <div class="rounded-3 d-flex align-items-center justify-content-center me-3"
                    style="min-width: 45px; height: 45px; background: ${bgColor}; border: 1px solid ${borderColor};">
                    <i class="bi ${iconClass} fs-5" style="color: ${iconColor};"></i>
                </div>
                <div>
                    <p class="text-white fw-semibold mb-1"
                        style="font-size: 0.95rem; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${noticia.titulo}">
                        ${noticia.titulo}
                    </p>
                    <p class="text-white-50 mb-0" style="font-size: 0.8rem;">
                        ${fecha} · ${noticia.vistas || 0} lecturas
                    </p>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}