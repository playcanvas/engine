const GAP = 6;

/**
 * @ignore
 */
class Readout {
    /**
     * @type {HTMLCanvasElement}
     * @private
     */
    _canvas;

    /**
     * The `div.gizmo-readout` element in the document body.
     *
     * @type {HTMLDivElement}
     * @private
     */
    _dom = document.createElement('div');

    /**
     * The markup shown, to skip unchanged rewrites.
     *
     * @private
     */
    _html = '';

    /**
     * @param {HTMLCanvasElement} canvas - The canvas the readout is placed over.
     */
    constructor(canvas) {
        this._canvas = canvas;

        this._dom.className = 'gizmo-readout';
        this._dom.style.cssText = [
            'position: fixed',
            'display: none',
            'transform: translateX(-50%)',
            'padding: 2px 6px',
            'border-radius: 3px',
            'background: rgba(0, 0, 0, 0.9)',
            'color: #fff',
            'font: 12px monospace',
            'white-space: pre',
            'pointer-events: none'
        ].join(';');
        document.body.appendChild(this._dom);
    }

    /**
     * Shows the markup centered on x, just below y, in canvas coordinates.
     *
     * @param {string} html - The readout markup.
     * @param {number} x - The canvas x coordinate to center on.
     * @param {number} y - The canvas y coordinate to sit below.
     */
    show(html, x, y) {
        const rect = this._canvas.getBoundingClientRect();
        if (html !== this._html) {
            this._html = html;
            this._dom.innerHTML = html;
        }
        this._dom.style.left = `${rect.left + x}px`;
        this._dom.style.top = `${rect.top + y + GAP}px`;
        this._dom.style.display = 'block';
    }

    hide() {
        this._dom.style.display = 'none';
    }

    destroy() {
        this._dom.remove();
    }
}

export { Readout };
