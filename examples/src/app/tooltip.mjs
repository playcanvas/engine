// milliseconds the pointer rests on an element before its tooltip shows (as in the inspector)
const DELAY = 350;

let installed = false;

/**
 * Shows the tooltip of any element with a `data-tip` attribute the pointer rests on, below it, or
 * above it when there is no room below. Elements use `data-tip` rather than `title`, as the
 * browser shows a title only after a long rest.
 */
const installTooltip = () => {
    if (installed) {
        return;
    }
    installed = true;

    const tip = document.createElement('div');
    tip.className = 'app-tip';
    document.body.appendChild(tip);

    /** @type {HTMLElement | null} */
    let current = null;
    let timer = 0;

    const hide = () => {
        clearTimeout(timer);
        current = null;
        tip.style.display = 'none';
    };

    const show = () => {
        const text = current?.dataset.tip;
        if (!current?.isConnected || !text) {
            return;
        }
        tip.textContent = text;
        tip.style.display = 'block';

        const rect = current.getBoundingClientRect();
        const width = tip.offsetWidth;
        const height = tip.offsetHeight;
        const left = Math.max(4, Math.min(rect.left, window.innerWidth - width - 4));
        const below = rect.bottom + 6;
        const top = below + height > window.innerHeight - 4 ? Math.max(4, rect.top - height - 6) : below;
        tip.style.left = `${left}px`;
        tip.style.top = `${top}px`;
    };

    document.addEventListener('pointerover', (e) => {
        const target = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest?.('[data-tip]'));
        if (target === current) {
            return;
        }
        hide();
        if (!target) {
            return;
        }
        current = target;
        timer = window.setTimeout(show, DELAY);
    });
    // hide when the pointer leaves the window, on a click (which may also change the tip's text),
    // and on a scroll
    document.addEventListener('pointerout', (e) => {
        if (!e.relatedTarget) {
            hide();
        }
    });
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('wheel', hide, { capture: true, passive: true });
    window.addEventListener('blur', hide);
};

export { installTooltip };
