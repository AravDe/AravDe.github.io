/**
 * portfolio.js — Section navigation, scroll hijacking, nav + dots sync
 */
(function () {
    'use strict';

    const sections = Array.from(document.querySelectorAll('.section'));
    const navLinks = Array.from(document.querySelectorAll('.nav-link'));
    const dots = Array.from(document.querySelectorAll('.dot'));
    const progressBar = document.getElementById('progress-bar');

    const DURATION = 600; // ms
    const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
    const SLIDE_PX = 70;  // px

    let current = 0;
    let isAnimating = false;

    // Apply a full inline transition to a section element
    function applyStyle(el, props) {
        Object.assign(el.style, props);
    }

    // ── Show a section (animate in from direction) ──────────────────
    function showSection(el, fromDown) {
        // Start position (off-screen)
        applyStyle(el, {
            display: 'flex',
            pointerEvents: 'none',
            transition: 'none',
            opacity: '0',
            transform: `translateY(${fromDown ? SLIDE_PX : -SLIDE_PX}px)`,
        });
        // Force reflow so transition fires
        void el.offsetHeight;
        // Animate to final position
        applyStyle(el, {
            transition: `opacity ${DURATION}ms ${EASE}, transform ${DURATION}ms ${EASE}`,
            opacity: '1',
            transform: 'translateY(0)',
        });
        setTimeout(() => {
            applyStyle(el, { pointerEvents: 'all', transition: '' });
        }, DURATION);
    }

    // ── Hide a section (animate out in direction) ───────────────────
    function hideSection(el, goingUp) {
        applyStyle(el, {
            pointerEvents: 'none',
            transition: `opacity ${DURATION}ms ${EASE}, transform ${DURATION}ms ${EASE}`,
            opacity: '0',
            transform: `translateY(${goingUp ? -SLIDE_PX : SLIDE_PX}px)`,
        });
        setTimeout(() => {
            applyStyle(el, { display: 'none', transform: '', transition: '' });
        }, DURATION);
    }

    // ── Navigate ────────────────────────────────────────────────────
    function goTo(index) {
        if (index === current || isAnimating) return;
        if (index < 0 || index >= sections.length) return;

        isAnimating = true;

        const prev = current;
        const goingDown = index > prev;
        current = index;

        hideSection(sections[prev], goingDown);
        showSection(sections[index], goingDown);

        updateUI();

        setTimeout(() => { isAnimating = false; }, DURATION + 50);
    }

    function updateUI() {
        navLinks.forEach((l, i) => l.classList.toggle('active', i === current));
        dots.forEach((d, i) => d.classList.toggle('active', i === current));

        const pct = sections.length > 1 ? (current / (sections.length - 1)) * 100 : 0;
        progressBar.style.width = pct + '%';

        history.replaceState(null, '', '#' + sections[current].id);
    }

    // ── Event listeners ─────────────────────────────────────────────

    // Mouse wheel — debounce so one scroll = one section
    let wheelCooldown = false;
    window.addEventListener('wheel', function (e) {
        e.preventDefault();
        if (wheelCooldown) return;
        wheelCooldown = true;
        setTimeout(() => { wheelCooldown = false; }, DURATION + 100);
        goTo(e.deltaY > 0 ? current + 1 : current - 1);
    }, { passive: false });

    // Keyboard arrow keys
    window.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); goTo(current + 1); }
        if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goTo(current - 1); }
    });

    // Touch swipe
    let touchStartY = null;
    let touchStartX = null;
    window.addEventListener('touchstart', e => { 
        touchStartY = e.touches[0].clientY; 
        touchStartX = e.touches[0].clientX;
    }, { passive: true });
    window.addEventListener('touchend', e => {
        if (touchStartY === null || touchStartX === null) return;
        const dy = touchStartY - e.changedTouches[0].clientY;
        const dx = touchStartX - e.changedTouches[0].clientX;
        
        // Only trigger vertical navigation if the swipe is vertical-dominant
        if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx)) {
            goTo(dy > 0 ? current + 1 : current - 1);
        }
        touchStartY = null;
        touchStartX = null;
    });

    // Nav links
    navLinks.forEach((link, i) => {
        link.addEventListener('click', e => { e.preventDefault(); goTo(i); });
    });

    // Hero CTA buttons
    const ctaProjects = document.getElementById('cta-projects');
    if (ctaProjects) ctaProjects.addEventListener('click', e => { e.preventDefault(); goTo(2); });
    const ctaContact = document.getElementById('cta-contact');
    if (ctaContact) ctaContact.addEventListener('click', e => { e.preventDefault(); goTo(3); });

    // Section dots
    dots.forEach(dot => {
        dot.addEventListener('click', () => goTo(parseInt(dot.dataset.section, 10)));
    });

    // ── Init ────────────────────────────────────────────────────────
    function init() {
        // First hide ALL sections
        sections.forEach(s => applyStyle(s, { display: 'none', opacity: '0', pointerEvents: 'none' }));

        // Determine start from URL hash
        const hash = window.location.hash.slice(1);
        const startIdx = hash ? Math.max(0, sections.findIndex(s => s.id === hash)) : 0;
        current = startIdx;

        // Show the initial section immediately (no animation)
        applyStyle(sections[current], {
            display: 'flex',
            opacity: '1',
            transform: 'translateY(0)',
            pointerEvents: 'all',
        });

        updateUI();
    }

    init();
})();
