import { SelectInput as ReactSelectInput } from '@playcanvas/pcui/react';

import { CLOSE_SELECTS_EVENT } from '../constants.mjs';

const CLASS_OVERLAY = 'pcui-select-input-list-overlay';
const VIEWPORT_PADDING = 8;

/** @typedef {ConstructorParameters<typeof ReactSelectInput.ctor>[0]} OverlaySelectInputArgs */

class OverlaySelectInputElement extends ReactSelectInput.ctor {
    /**
     * @type {Node | null}
     */
    _overlayParent = null;

    /**
     * @type {Node | null}
     */
    _overlayNext = null;

    /**
     * @param {OverlaySelectInputArgs} [args] - The constructor arguments.
     */
    constructor(args) {
        super(args);

        this._onOverlayLayout = () => {
            if (this._containerOptions.hidden) {
                return;
            }

            this._positionOverlay();
        };

        /**
         * @param {PointerEvent} evt - The pointer event.
         */
        this._onDocumentPointerDown = (evt) => {
            const target = /** @type {Node} */ (evt.composedPath()[0]);
            if (!this.dom.contains(target) && !this._containerOptions.dom.contains(target)) {
                this.close();
            }
        };

        this._onOverlayClose = () => this.close();
        window.addEventListener(CLOSE_SELECTS_EVENT, this._onOverlayClose);
    }

    _positionOverlay() {
        const list = this._containerOptions.dom;
        const field = this._allowInput ? this._input.dom : this._labelValue.dom;

        if (!field.isConnected || !list.isConnected) {
            this.close();
            return;
        }

        const rect = field.getBoundingClientRect();
        if (!rect.width || !rect.height) {
            this.close();
            return;
        }

        list.style.maxHeight = '';

        const height = list.scrollHeight;
        const width = Math.min(rect.width, window.innerWidth - VIEWPORT_PADDING * 2);
        const below = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
        const above = rect.top - VIEWPORT_PADDING;
        const down = below >= Math.min(height, above) || below >= above;
        const maxHeight = Math.max(down ? below : above, 0);
        const listHeight = Math.min(height, maxHeight);
        const left = Math.min(
            Math.max(rect.left, VIEWPORT_PADDING),
            window.innerWidth - width - VIEWPORT_PADDING
        );
        const top = down ? rect.bottom : rect.top - listHeight;

        list.style.position = 'fixed';
        list.style.left = `${left}px`;
        list.style.top = `${Math.max(top, VIEWPORT_PADDING)}px`;
        list.style.bottom = 'auto';
        list.style.width = `${width}px`;
        list.style.maxHeight = `${maxHeight}px`;
    }

    _showOverlay() {
        const list = this._containerOptions.dom;

        if (!this._overlayParent) {
            this._overlayParent = list.parentNode;
            this._overlayNext = list.nextSibling;
            document.body.appendChild(list);
            window.addEventListener('resize', this._onOverlayLayout);
            window.addEventListener('orientationchange', this._onOverlayLayout);
        }

        list.classList.add(CLASS_OVERLAY);
        this._domShadow.style.height = '';
        this._positionOverlay();
    }

    _hideOverlay() {
        const list = this._containerOptions.dom;

        window.removeEventListener('resize', this._onOverlayLayout);
        window.removeEventListener('orientationchange', this._onOverlayLayout);
        list.classList.remove(CLASS_OVERLAY);
        list.style.position = '';
        list.style.left = '';
        list.style.top = '';
        list.style.bottom = '';
        list.style.width = '';
        list.style.maxHeight = '';

        if (this._overlayParent) {
            const next = this._overlayNext?.parentNode === this._overlayParent ? this._overlayNext : null;
            this._overlayParent.insertBefore(list, next);
            this._overlayParent = null;
            this._overlayNext = null;
        }
    }

    /**
     * @param {string} filter - The filter value.
     */
    _filterOptions(filter) {
        super._filterOptions(filter);
        if (!this._containerOptions.hidden) {
            this._positionOverlay();
        }
    }

    open() {
        super.open();

        if (!this._containerOptions.hidden) {
            this._showOverlay();
        }
    }

    close() {
        super.close();
        this._hideOverlay();
    }

    destroy() {
        window.removeEventListener(CLOSE_SELECTS_EVENT, this._onOverlayClose);
        this._hideOverlay();
        super.destroy();
    }
}

class OverlaySelectInput extends ReactSelectInput {
    static ctor = OverlaySelectInputElement;

    componentWillUnmount() {
        this.element?.destroy();
    }
}

export { OverlaySelectInput as SelectInput };
