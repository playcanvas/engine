import { Vec3 } from '../../../core/math/vec3.js';
import { CULLFACE_NONE } from '../../../platform/graphics/constants.js';
import { PlaneGeometry } from '../../../scene/geometry/plane-geometry.js';
import { TriData } from '../tri-data.js';
import { Shape } from './shape.js';

class PlaneShape extends Shape {
    _cull = CULLFACE_NONE;

    _size = 0.2;

    _gap = 0.1;

    constructor(device, options = {}) {
        super(device, options);

        this.triData = [
            new TriData(new PlaneGeometry())
        ];

        this._createPlane();
    }

    _getPosition() {
        const offset = this._size / 2 + this._gap;
        const position = new Vec3(offset, offset, offset);
        position[this.axis] = 0;
        return position;
    }

    _createPlane() {
        this._createRoot('plane');
        this._updateTransform();

        // plane
        this._addRenderMesh(this.entity, 'plane', this._shadows);
    }

    set size(value) {
        this._size = value ?? 1;
        this._updateTransform();
    }

    get size() {
        return this._size;
    }

    set gap(value) {
        this._gap = value ?? 0;
        this._updateTransform();
    }

    get gap() {
        return this._gap;
    }

    _updateTransform() {
        // intersect/render
        this.entity.setLocalPosition(this._getPosition());
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._size, this._size, this._size);
    }
}

export { PlaneShape };
