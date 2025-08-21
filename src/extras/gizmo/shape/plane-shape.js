import { Vec3 } from '../../../core/math/vec3.js';
import { CULLFACE_NONE } from '../../../platform/graphics/constants.js';
import { PlaneGeometry } from '../../../scene/geometry/plane-geometry.js';
import { TriData } from '../tri-data.js';
import { Shape } from './shape.js';

const UPDATE_EPSILON = 1e-6;

class PlaneShape extends Shape {
    _cull = CULLFACE_NONE;

    _size = 0.2;

    _gap = 0.1;

    _flipped = new Vec3();

    constructor(device, options = {}) {
        super(device, options);

        this.triData = [
            new TriData(new PlaneGeometry())
        ];

        this._createRoot('plane');
        this._updateTransform();

        // plane
        this._addRenderMesh(this.entity, 'plane', this._shading);
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

    set flipped(value) {
        if (this._flipped.distance(value) < UPDATE_EPSILON) {
            return;
        }
        this._flipped.copy(value);
        this.entity.setLocalPosition(this._getPosition());
    }

    get flipped() {
        return this._flipped;
    }

    _getPosition() {
        const offset = this._size / 2 + this._gap;
        const position = new Vec3(
            this._flipped.x ? -offset : offset,
            this._flipped.y ? -offset : offset,
            this._flipped.z ? -offset : offset
        );
        position[this.axis] = 0;
        return position;
    }

    _updateTransform() {
        // intersect/render
        this.entity.setLocalPosition(this._getPosition());
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._size, this._size, this._size);
    }
}

export { PlaneShape };
