class Delta {
    /**
     * @type {number[]}
     */
    _instance;

    /**
     * @param {number} dim - The dimension.
     */
    constructor(dim = 1) {
        this._instance = new Array(dim).fill(0);
    }

    get value() {
        return this._instance;
    }

    add() {
        for (let i = 0; i < this._instance.length; i++) {
            this._instance[i] += arguments[i] || 0;
        }
    }

    flush() {
        this._instance.fill(0);
    }
}

class Input {
    /**
     * @type {HTMLElement | null}
     * @protected
     */
    _element = null;

    /**
     * @type {object}
     * @protected
     */
    deltas = {};

    /**
     * @param {HTMLElement} element - The element.
     */
    attach(element) {
        if (this._element) {
            this.detach();
        }
        this._element = element;
    }

    detach() {
        if (!this._element) {
            return;
        }

        this._element = null;
        this._camera = null;
    }

    /**
     * Flatten the deltas into a frame and then flushes them.
     *
     * @returns {number[]} - The delta frame.
     */
    frame() {
        const frame = [];
        for (const name in this.deltas) {
            const delta = this.deltas[name];
            frame.push(...delta.value);
            delta.flush();
        }
        return frame;
    }

    destroy() {
        this.detach();
    }
}

export { Delta, Input };
