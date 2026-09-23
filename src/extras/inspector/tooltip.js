// milliseconds the pointer rests on an element before its tooltip shows
const DELAY = 350;

/**
 * Sets the tooltip of an element of the panel. It is kept in a data attribute, not the title:
 * the browser's own tooltip shows only after a long rest, and some hosts do not show it at all
 * for elements in a shadow root.
 *
 * @param {HTMLElement} element - The element.
 * @param {string} text - The tooltip, or an empty string for none.
 */
function setTip(element, text) {
    if (text) {
        element.dataset.tip = text;
    } else {
        delete element.dataset.tip;
    }
}

/**
 * Shows the tooltip of whatever the pointer rests on in the panel, below it, or above it when
 * there is no room below. The tooltip element lives in the panel, so it moves with the panel into
 * a popped-out window.
 *
 * @param {HTMLElement} panel - The panel.
 */
function installTooltip(panel) {
    const tip = document.createElement('div');
    tip.className = 'pci-tip';
    panel.appendChild(tip);

    /** @type {HTMLElement|null} */
    let current = null;
    let timer = 0;

    const hide = () => {
        clearTimeout(timer);
        current = null;
        tip.style.display = 'none';
    };

    const show = () => {
        const text = current?.dataset.tip;
        if (!current?.isConnected || !text) return;
        tip.textContent = text;
        tip.style.display = 'block';

        const view = panel.ownerDocument.defaultView ?? window;
        const rect = current.getBoundingClientRect();
        const width = tip.offsetWidth;
        const height = tip.offsetHeight;
        const left = Math.max(4, Math.min(rect.left, view.innerWidth - width - 4));
        const below = rect.bottom + 6;
        const top = below + height > view.innerHeight - 4 ? Math.max(4, rect.top - height - 6) : below;
        tip.style.left = `${left}px`;
        tip.style.top = `${top}px`;
    };

    panel.addEventListener('pointerover', (e) => {
        const target = /** @type {HTMLElement|null} */ (/** @type {Element} */ (e.target).closest?.('[data-tip]'));
        if (target === current) return;
        hide();
        if (!target || target === tip) return;
        current = target;
        timer = setTimeout(show, DELAY);
    });
    panel.addEventListener('pointerleave', hide);
    panel.addEventListener('pointerdown', hide);
    panel.addEventListener('wheel', hide, { passive: true });
}

export { installTooltip, setTip };
