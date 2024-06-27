import { Component } from '../component.js';

/**
 * A LayoutChildComponent enables the Entity to control the sizing applied to it by its parent
 * {@link LayoutGroupComponent}.
 *
 * @category User Interface
 */
class LayoutChildComponent extends Component {
    /**
     * Create a new LayoutChildComponent.
     *
     * @param {import('./system.js').LayoutChildComponentSystem} system - The ComponentSystem that
     * created this Component.
     * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
     * attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        /** @private */
        this._minWidth = 0;
        /** @private */
        this._minHeight = 0;
        /** @private */
        this._maxWidth = null;
        /** @private */
        this._maxHeight = null;
        /** @private */
        this._fitWidthProportion = 0;
        /** @private */
        this._fitHeightProportion = 0;
        /** @private */
        this._excludeFromLayout = false;
    }

    /**
     * Sets the minimum width the element should be rendered at.
     *
     * @type {number}
     */
    set minWidth(value) {
        if (value !== this._minWidth) {
            this._minWidth = value;
            this.fire('resize');
        }
    }

    /**
     * Gets the minimum width the element should be rendered at.
     *
     * @type {number}
     */
    get minWidth() {
        return this._minWidth;
    }

    /**
     * Sets the minimum height the element should be rendered at.
     *
     * @type {number}
     */
    set minHeight(value) {
        if (value !== this._minHeight) {
            this._minHeight = value;
            this.fire('resize');
        }
    }

    /**
     * Gets the minimum height the element should be rendered at.
     *
     * @type {number}
     */
    get minHeight() {
        return this._minHeight;
    }

    /**
     * Sets the maximum width the element should be rendered at.
     *
     * @type {number|null}
     */
    set maxWidth(value) {
        if (value !== this._maxWidth) {
            this._maxWidth = value;
            this.fire('resize');
        }
    }

    /**
     * Gets the maximum width the element should be rendered at.
     *
     * @type {number|null}
     */
    get maxWidth() {
        return this._maxWidth;
    }

    /**
     * Sets the maximum height the element should be rendered at.
     *
     * @type {number|null}
     */
    set maxHeight(value) {
        if (value !== this._maxHeight) {
            this._maxHeight = value;
            this.fire('resize');
        }
    }

    /**
     * Gets the maximum height the element should be rendered at.
     *
     * @type {number|null}
     */
    get maxHeight() {
        return this._maxHeight;
    }

    /**
     * Sets the amount of additional horizontal space that the element should take up, if necessary to
     * satisfy a Stretch/Shrink fitting calculation. This is specified as a proportion, taking into
     * account the proportion values of other siblings.
     *
     * @type {number}
     */
    set fitWidthProportion(value) {
        if (value !== this._fitWidthProportion) {
            this._fitWidthProportion = value;
            this.fire('resize');
        }
    }

    /**
     * Gets the amount of additional horizontal space that the element should take up, if necessary to
     * satisfy a Stretch/Shrink fitting calculation.
     *
     * @type {number}
     */
    get fitWidthProportion() {
        return this._fitWidthProportion;
    }

    /**
     * Sets the amount of additional vertical space that the element should take up, if necessary to
     * satisfy a Stretch/Shrink fitting calculation. This is specified as a proportion, taking into
     * account the proportion values of other siblings.
     *
     * @type {number}
     */
    set fitHeightProportion(value) {
        if (value !== this._fitHeightProportion) {
            this._fitHeightProportion = value;
            this.fire('resize');
        }
    }

    /**
     * Gets the amount of additional vertical space that the element should take up, if necessary to
     * satisfy a Stretch/Shrink fitting calculation.
     *
     * @type {number}
     */
    get fitHeightProportion() {
        return this._fitHeightProportion;
    }

    /**
     * Sets whether the child will be excluded from all layout calculations.
     *
     * @type {boolean}
     */
    set excludeFromLayout(value) {
        if (value !== this._excludeFromLayout) {
            this._excludeFromLayout = value;
            this.fire('resize');
        }
    }

    /**
     * Gets whether the child will be excluded from all layout calculations.
     *
     * @type {boolean}
     */
    get excludeFromLayout() {
        return this._excludeFromLayout;
    }
}

export { LayoutChildComponent };
