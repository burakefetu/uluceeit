(() => {
    const navbar = document.getElementById('navbar');
    const menu = document.getElementById('mobileMenu');
    const menuButton = document.getElementById('mobileMenuBtn');
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const root = document.documentElement;
    const memberDialogs = [
        'memberCardModal', 'unregisteredModal', 'activationModal',
        'redeemConfirmModal', 'redeemSuccessModal',
    ].map(id => document.getElementById(id)).filter(Boolean);
    let pagePosition;

    function syncMemberDialogScroll() {
        const dialogOpen = memberDialogs.some(dialog =>
            !dialog.classList.contains('hidden') && !dialog.hidden && dialog.style.display !== 'none'
        );

        if (dialogOpen && !pagePosition) {
            pagePosition = { left: window.scrollX, top: window.scrollY };
            root.style.setProperty('--member-dialog-offset', `${-pagePosition.top}px`);
            root.classList.add('member-dialog-open');
        } else if (!dialogOpen && pagePosition) {
            root.classList.remove('member-dialog-open');
            root.style.removeProperty('--member-dialog-offset');
            window.scrollTo({ ...pagePosition, behavior: 'instant' });
            pagePosition = undefined;
        }
    }

    const memberDialogObserver = new MutationObserver(syncMemberDialogScroll);
    for (const dialog of memberDialogs) {
        memberDialogObserver.observe(dialog, { attributeFilter: ['class', 'style', 'hidden'] });
    }
    syncMemberDialogScroll();

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
            if (pagePosition) return;
            const scrollRange = root.scrollHeight - window.innerHeight;
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
