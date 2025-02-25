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
     * @type {Delta}
     */
    translate = new Delta(3);

    /**
     * @type {Delta}
     */
    rotate = new Delta(2);

    /**
     * @type {Delta}
     */
    pointer = new Delta(2);

    /**
     * @type {Delta}
     */
    pan = new Delta(2);

    /**
     * @type {Delta}
     */
    zoom = new Delta();

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
        const frame = [
            this.translate.value[0],
            this.translate.value[1],
            this.translate.value[2],
            this.rotate.value[0],
            this.rotate.value[1],
            this.pointer.value[0],
            this.pointer.value[1],
            this.pan.value[0],
            this.pan.value[1],
            this.zoom.value[0]
        ];
        this.translate.flush();
        this.pointer.flush();
        this.rotate.flush();
        this.pan.flush();
        this.zoom.flush();
        return frame;
    }

    destroy() {
        this.detach();
    }
}

export { Input };
