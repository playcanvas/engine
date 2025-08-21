import { BoxGeometry } from '../../../scene/geometry/box-geometry.js';
import { TriData } from '../tri-data.js';
import { Shape } from './shape.js';

class BoxShape extends Shape {
    _size = 0.12;

    _tolerance = 0.05;

    constructor(device, options = {}) {
        super(device, options);

        this.triData = [
            new TriData(new BoxGeometry(), 2)
        ];

        this._createRoot('boxCenter');
        this._updateTransform();

        // box
        this._addRenderMesh(this.entity, 'box', this._shading);
    }

    set size(value) {
        this._size = value ?? 1;
        this._updateTransform();
    }

    get size() {
        return this._size;
    }

    set tolerance(value) {
        this._tolerance = value;
        this._updateTransform();
    }

    get tolerance() {
        return this._tolerance;
    }

    _updateTransform() {
        // intersect/render
        this.entity.setLocalScale(this._size, this._size, this._size);
    }
}

export { BoxShape };
