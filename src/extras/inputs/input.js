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
     * @type {Record<string, Delta>}
     */
    deltas = {
        translate: new Delta(3),
        rotate: new Delta(2),
        pointer: new Delta(2),
        pan: new Delta(2),
        zoom: new Delta()
    };

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

    frame() {
        const frame = [];
        for (const delta in this.deltas) {
            frame.push(...this.deltas[delta].value);
            this.deltas[delta].flush();
        }
        return frame;
    }

    destroy() {
        this.detach();
    }
}

export { Input };
