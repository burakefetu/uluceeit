(() => {
    const navbar = document.getElementById('navbar');
    const menu = document.getElementById('mobileMenu');
    const menuButton = document.getElementById('mobileMenuBtn');
    const page = window.location.pathname.split('/').pop() || 'index.html';

    for (const link of navbar?.querySelectorAll('a[href]') ?? []) {
        if (link.getAttribute('href') === page) link.setAttribute('aria-current', 'page');
    }

    if (menu && menuButton) {
        const syncMenuState = () => {
            menuButton.setAttribute('aria-expanded', String(!menu.classList.contains('hidden')));
        };
        menuButton.setAttribute('aria-controls', menu.id);
        new MutationObserver(syncMenuState).observe(menu, { attributeFilter: ['class'] });
        syncMenuState();
    }

    if (navbar) {
        let pending = false;
        function showProgress() {
            pending = false;
            const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
            const progress = scrollRange > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollRange)) : 0;
            navbar.style.setProperty('--redesign-progress', progress);
        }

        function scheduleProgress() {
            if (pending) return;
            pending = true;
            window.requestAnimationFrame(showProgress);
        }

        window.addEventListener('scroll', scheduleProgress, { passive: true });
        window.addEventListener('resize', scheduleProgress);
        window.addEventListener('load', scheduleProgress, { once: true });
        showProgress();
    }

    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const reveal = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                entry.target.classList.add('is-in');
                reveal.unobserve(entry.target);
            }
        }, { rootMargin: '0px 0px -5% 0px' });

        for (const section of document.querySelectorAll('.redesign [data-reveal]')) {
            if (section.getBoundingClientRect().top >= window.innerHeight) reveal.observe(section);
        }
    }
})();
