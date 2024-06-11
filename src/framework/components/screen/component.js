import { Debug } from '../../../core/debug.js';

import { Mat4 } from '../../../core/math/mat4.js';
import { Vec2 } from '../../../core/math/vec2.js';

import { Entity } from '../../entity.js';

import { SCALEMODE_BLEND, SCALEMODE_NONE } from './constants.js';
import { Component } from '../component.js';

const _transform = new Mat4();

/**
 * A ScreenComponent enables the Entity to render child {@link ElementComponent}s using anchors and
 * positions in the ScreenComponent's space.
 *
 * @category User Interface
 */
class ScreenComponent extends Component {
    /**
     * Create a new ScreenComponent.
     *
     * @param {import('./system.js').ScreenComponentSystem} system - The ComponentSystem that
     * created this Component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        this._resolution = new Vec2(640, 320);
        this._referenceResolution = new Vec2(640, 320);
        this._scaleMode = SCALEMODE_NONE;
        this.scale = 1;
        this._scaleBlend = 0.5;

        this._priority = 0;

        this._screenSpace = false;

        /**
         * If true, then elements inside this screen will be not be rendered when outside of the
         * screen (only valid when screenSpace is true).
         *
         * @type {boolean}
         */
        this.cull = this._screenSpace;
        this._screenMatrix = new Mat4();

        this._elements = new Set();

        system.app.graphicsDevice.on('resizecanvas', this._onResize, this);
    }

    /**
     * Set the drawOrder of each child {@link ElementComponent} so that ElementComponents which are
     * last in the hierarchy are rendered on top. Draw Order sync is queued and will be updated by
     * the next update loop.
     */
    syncDrawOrder() {
        this.system.queueDrawOrderSync(this.entity.getGuid(), this._processDrawOrderSync, this);
    }

    _recurseDrawOrderSync(e, i) {
        if (!(e instanceof Entity)) {
            return i;
        }

        if (e.element) {
            const prevDrawOrder = e.element.drawOrder;
            e.element.drawOrder = i++;

            if (e.element._batchGroupId >= 0 && prevDrawOrder !== e.element.drawOrder) {
                this.system.app.batcher?.markGroupDirty(e.element._batchGroupId);
            }
        }

        // child particle system inside 2D screen sub-hierarchy gets sorted along other 2D elements
        if (e.particlesystem) {
            e.particlesystem.drawOrder = i++;
        }

        const children = e.children;
        for (let j = 0; j < children.length; j++) {
            i = this._recurseDrawOrderSync(children[j], i);
        }

        return i;
    }

    _processDrawOrderSync() {
        const i = 1;

        this._recurseDrawOrderSync(this.entity, i);

        // fire internal event after all screen hierarchy is synced
        this.fire('syncdraworder');
    }

    _calcProjectionMatrix() {
        const w = this._resolution.x / this.scale;
        const h = this._resolution.y / this.scale;

        const left = 0;
        const right = w;
        const bottom = -h;
        const top = 0;
        const near = 1;
        const far = -1;

        this._screenMatrix.setOrtho(left, right, bottom, top, near, far);

        if (!this._screenSpace) {
            _transform.setScale(0.5 * w, 0.5 * h, 1);
            this._screenMatrix.mul2(_transform, this._screenMatrix);
        }
    }

    _updateScale() {
        this.scale = this._calcScale(this._resolution, this.referenceResolution);
    }

    _calcScale(resolution, referenceResolution) {
        // Using log of scale values
        // This produces a nicer outcome where if you have a xscale = 2 and yscale = 0.5
        // the combined scale is 1 for an even blend
        const lx = Math.log2((resolution.x || 1) / referenceResolution.x);
        const ly = Math.log2((resolution.y || 1) / referenceResolution.y);
        return Math.pow(2, (lx * (1 - this._scaleBlend) + ly * this._scaleBlend));
    }

    _onResize(width, height) {
        if (this._screenSpace) {
            this._resolution.set(width, height);
            this.resolution = this._resolution; // force update
        }
    }

    _bindElement(element) {
        this._elements.add(element);
    }

    _unbindElement(element) {
        this._elements.delete(element);
    }

    onRemove() {
        this.system.app.graphicsDevice.off('resizecanvas', this._onResize, this);
        this.fire('remove');

        this._elements.forEach(element => element._onScreenRemove());
        this._elements.clear();

        // remove all events
        this.off();

    }

    /**
     * Sets the width and height of the ScreenComponent. When screenSpace is true the resolution will
     * always be equal to {@link GraphicsDevice#width} x {@link GraphicsDevice#height}.
     *
     * @type {Vec2}
     */
    set resolution(value) {
        if (!this._screenSpace) {
            this._resolution.set(value.x, value.y);
        } else {
            // ignore input when using screen space.
            this._resolution.set(this.system.app.graphicsDevice.width, this.system.app.graphicsDevice.height);
        }

        this._updateScale();

        this._calcProjectionMatrix();

        if (!this.entity._dirtyLocal)
            this.entity._dirtifyLocal();

        this.fire('set:resolution', this._resolution);
        this._elements.forEach(element => element._onScreenResize(this._resolution));
    }

    /**
     * Gets the width and height of the ScreenComponent.
     *
     * @type {Vec2}
     */
    get resolution() {
        return this._resolution;
    }

    /**
     * Sets the resolution that the ScreenComponent is designed for. This is only taken into
     * account when screenSpace is true and scaleMode is {@link SCALEMODE_BLEND}. If the actual
     * resolution is different then the ScreenComponent will be scaled according to the scaleBlend
     * value.
     *
     * @type {Vec2}
     */
    set referenceResolution(value) {
        this._referenceResolution.set(value.x, value.y);
        this._updateScale();
        this._calcProjectionMatrix();

        if (!this.entity._dirtyLocal)
            this.entity._dirtifyLocal();

        this.fire('set:referenceresolution', this._resolution);
        this._elements.forEach(element => element._onScreenResize(this._resolution));
    }

    /**
     * Gets the resolution that the ScreenComponent is designed for.
     *
     * @type {Vec2}
     */
    get referenceResolution() {
        if (this._scaleMode === SCALEMODE_NONE) {
            return this._resolution;
        }
        return this._referenceResolution;
    }

    /**
     * Sets whether the ScreenComponent will render its child {@link ElementComponent}s in screen
     * space instead of world space. Enable this to create 2D user interfaces.
     *
     * @type {boolean}
     */
    set screenSpace(value) {
        this._screenSpace = value;
        if (this._screenSpace) {
            this._resolution.set(this.system.app.graphicsDevice.width, this.system.app.graphicsDevice.height);
        }
        this.resolution = this._resolution; // force update either way

        if (!this.entity._dirtyLocal)
            this.entity._dirtifyLocal();

        this.fire('set:screenspace', this._screenSpace);

        this._elements.forEach(element => element._onScreenSpaceChange());
    }

    /**
     * Gets whether the ScreenComponent will render its child {@link ElementComponent}s in screen
     * space instead of world space.
     *
     * @type {boolean}
     */
    get screenSpace() {
        return this._screenSpace;
    }

    /**
     * Sets the scale mode. Can either be {@link SCALEMODE_NONE} or {@link SCALEMODE_BLEND}. See
     * the description of referenceResolution for more information.
     *
     * @type {string}
     */
    set scaleMode(value) {
        if (value !== SCALEMODE_NONE && value !== SCALEMODE_BLEND) {
            value = SCALEMODE_NONE;
        }

        // world space screens do not support scale modes
        if (!this._screenSpace && value !== SCALEMODE_NONE) {
            value = SCALEMODE_NONE;
        }

        this._scaleMode = value;
        this.resolution = this._resolution; // force update
        this.fire('set:scalemode', this._scaleMode);
    }

    /**
     * Gets the scale mode.
     *
     * @type {string}
     */
    get scaleMode() {
        return this._scaleMode;
    }

    /**
     * Sets the scale blend. This is a value between 0 and 1 that is used when scaleMode is equal
     * to {@link SCALEMODE_BLEND}. Scales the ScreenComponent with width as a reference (when value
     * is 0), the height as a reference (when value is 1) or anything in between.
     *
     * @type {number}
     */
    set scaleBlend(value) {
        this._scaleBlend = value;
        this._updateScale();
        this._calcProjectionMatrix();

        if (!this.entity._dirtyLocal)
            this.entity._dirtifyLocal();

        this.fire('set:scaleblend', this._scaleBlend);

        this._elements.forEach(element => element._onScreenResize(this._resolution));
    }

    /**
     * Gets the scale blend.
     *
     * @type {number}
     */
    get scaleBlend() {
        return this._scaleBlend;
    }

    /**
     * Sets the priority. Priority determines the order in which Screen components in the same
     * layer are rendered. Number must be an integer between 0 and 255. Priority is set into the
     * top 8 bits of the drawOrder property in an element.
     *
     * @type {number}
     */
    set priority(value) {
        if (value > 0xFF) {
            Debug.warn(`Clamping screen priority from ${value} to 255`);
            value = 0xFF;
        }
        if (this._priority === value) {
            return;
        }

        this._priority = value;
        this.syncDrawOrder();
    }

    /**
     * Gets the priority.
     *
     * @type {number}
     */
    get priority() {
        return this._priority;
    }
}

export { ScreenComponent };
