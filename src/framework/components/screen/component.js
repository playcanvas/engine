import { Mat4 } from '../../../math/mat4.js';
import { Vec2 } from '../../../math/vec2.js';

import { Entity } from '../../entity.js';

import { SCALEMODE_BLEND, SCALEMODE_NONE } from './constants.js';
import { Component } from '../component.js';

var _transform = new Mat4();

/**
 * @component
 * @class
 * @name pc.ScreenComponent
 * @augments pc.Component
 * @classdesc A ScreenComponent enables the Entity to render child {@link pc.ElementComponent}s using anchors and positions in the ScreenComponent's space.
 * @description Create a new ScreenComponent.
 * @param {pc.ScreenComponentSystem} system - The ComponentSystem that created this Component.
 * @param {pc.Entity} entity - The Entity that this Component is attached to.
 * @property {boolean} screenSpace If true then the ScreenComponent will render its child {@link pc.ElementComponent}s in screen space instead of world space. Enable this to create 2D user interfaces.
 * @property {boolean} cull If true then elements inside this screen will be not be rendered when outside of the screen (only valid when screenSpace is true).
 * @property {string} scaleMode Can either be {@link pc.SCALEMODE_NONE} or {@link pc.SCALEMODE_BLEND}. See the description of referenceResolution for more information.
 * @property {number} scaleBlend A value between 0 and 1 that is used when scaleMode is equal to {@link pc.SCALEMODE_BLEND}. Scales the ScreenComponent with width as a reference (when value is 0), the height as a reference (when value is 1) or anything in between.
 * @property {pc.Vec2} resolution The width and height of the ScreenComponent. When screenSpace is true the resolution will always be equal to {@link pc.GraphicsDevice#width} x {@link pc.GraphicsDevice#height}.
 * @property {pc.Vec2} referenceResolution The resolution that the ScreenComponent is designed for. This is only taken into account when screenSpace is true and scaleMode is {@link pc.SCALEMODE_BLEND}. If the actual resolution is different then the ScreenComponent will be scaled according to the scaleBlend value.
 */
class ScreenComponent extends Component {
    constructor(system, entity) {
        super(system, entity);

        this._resolution = new Vec2(640, 320);
        this._referenceResolution = new Vec2(640, 320);
        this._scaleMode = SCALEMODE_NONE;
        this.scale = 1;
        this._scaleBlend = 0.5;

        // priority determines the order in which screens components are rendered
        // priority is set into the top 8 bits of the drawOrder property in an element
        this._priority = 0;

        this._screenSpace = false;
        this.cull = this._screenSpace;
        this._screenMatrix = new Mat4();

        system.app.graphicsDevice.on("resizecanvas", this._onResize, this);
    }

    /**
     * @function
     * @name pc.ScreenComponent#syncDrawOrder
     * @description Set the drawOrder of each child {@link pc.ElementComponent}
     * so that ElementComponents which are last in the hierarchy are rendered on top.
     * Draw Order sync is queued and will be updated by the next update loop.
     */
    syncDrawOrder() {
        this.system.queueDrawOrderSync(this.entity.getGuid(), this._processDrawOrderSync, this);
    }

    _recurseDrawOrderSync(e, i) {
        if (!(e instanceof Entity)) {
            return i;
        }

        if (e.element) {
            var prevDrawOrder = e.element.drawOrder;
            e.element.drawOrder = i++;

            if (e.element._batchGroupId >= 0 && prevDrawOrder != e.element.drawOrder) {
                this.system.app.batcher.markGroupDirty(e.element._batchGroupId);
            }
        }

        // child particle system inside 2D screen sub-hierarachy gets sorted along other 2D elements
        if (e.particlesystem) {
            e.particlesystem.drawOrder = i++;
        }

        var children = e.children;
        for (var j = 0; j < children.length; j++) {
            i = this._recurseDrawOrderSync(children[j], i);
        }

        return i;
    }

    _processDrawOrderSync() {
        var i = 1;

        this._recurseDrawOrderSync(this.entity, i);

        // fire internal event after all screen hierarchy is synced
        this.fire('syncdraworder');
    }

    _calcProjectionMatrix() {
        var left;
        var right;
        var bottom;
        var top;
        var near = 1;
        var far = -1;

        var w = this._resolution.x / this.scale;
        var h = this._resolution.y / this.scale;

        left = 0;
        right = w;
        bottom = -h;
        top = 0;

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
        var lx = Math.log2(resolution.x / referenceResolution.x);
        var ly = Math.log2(resolution.y / referenceResolution.y);
        return Math.pow(2, (lx * (1 - this._scaleBlend) + ly * this._scaleBlend));
    }

    _onResize(width, height) {
        if (this._screenSpace) {
            this._resolution.set(width, height);
            this.resolution = this._resolution; // force update
        }
    }

    onRemove() {
        this.system.app.graphicsDevice.off("resizecanvas", this._onResize, this);
        this.fire('remove');

        // remove all events used by elements
        this.off();
    }

    set resolution(value) {
        if (!this._screenSpace) {
            this._resolution.set(value.x, value.y);
        } else {
            // ignore input when using screenspace.
            this._resolution.set(this.system.app.graphicsDevice.width, this.system.app.graphicsDevice.height);
        }

        this._updateScale();

        this._calcProjectionMatrix();

        if (!this.entity._dirtyLocal)
            this.entity._dirtifyLocal();

        this.fire("set:resolution", this._resolution);
    }

    get resolution() {
        return this._resolution;
    }

    set referenceResolution(value) {
        this._referenceResolution.set(value.x, value.y);
        this._updateScale();
        this._calcProjectionMatrix();

        if (!this.entity._dirtyLocal)
            this.entity._dirtifyLocal();

        this.fire("set:referenceresolution", this._resolution);
    }

    get referenceResolution() {
        if (this._scaleMode === SCALEMODE_NONE) {
            return this._resolution;
        }
        return this._referenceResolution;

    }

    set screenSpace(value) {
        this._screenSpace = value;
        if (this._screenSpace) {
            this._resolution.set(this.system.app.graphicsDevice.width, this.system.app.graphicsDevice.height);
        }
        this.resolution = this._resolution; // force update either way

        if (!this.entity._dirtyLocal)
            this.entity._dirtifyLocal();

        this.fire('set:screenspace', this._screenSpace);
    }

    get screenSpace() {
        return this._screenSpace;
    }

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
        this.fire("set:scalemode", this._scaleMode);
    }

    get scaleMode() {
        return this._scaleMode;
    }

    set scaleBlend(value) {
        this._scaleBlend = value;
        this._updateScale();
        this._calcProjectionMatrix();

        if (!this.entity._dirtyLocal)
            this.entity._dirtifyLocal();

        this.fire("set:scaleblend", this._scaleBlend);
    }

    get scaleBlend() {
        return this._scaleBlend;
    }

    get priority() {
        return this._priority;
    }

    set priority(value) {
        if (value > 0xFF) {
            // #ifdef DEBUG
            console.warn('Clamping screen priority from ' + value + ' to 255');
            // #endif
            value = 0xFF;
        }

        this._priority = value;
    }
}

export { ScreenComponent };
