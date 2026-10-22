import { CapsuleGeometry } from '../../../scene/geometry/capsule-geometry.js';
import { Mesh } from '../../../scene/mesh.js';
import { TriData } from './tri-data.js';
import { Shape } from './shape.js';

/**
 * @import { ShapeArgs } from './shape.js'
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

/**
 * @typedef {object} CapsuleShapeArgs
 * @property {number} [height] - The height, caps included, as a multiple of the radius.
 */

/**
 * A capsule along the y axis with a radius of 1, its height a multiple of the radius, so a uniform
 * scale sets its radius.
 *
 * @ignore
 */
class CapsuleShape extends Shape {
    /**
     * The height, as a multiple of the radius.
     *
     * @private
     */
    _height = 4;

    /**
     * Create a new CapsuleShape.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {ShapeArgs & CapsuleShapeArgs} args - The shape options.
     */
    constructor(device, args = {}) {
        super(device, 'capsule', args);

        this._height = args.height ?? this._height;

        this.triData = [new TriData(this._createGeometry())];

        this._createRenderComponent(this.entity, [this._createMesh()]);
    }

    /**
     * Create the capsule geometry.
     *
     * @returns {CapsuleGeometry} The capsule geometry.
     * @private
     */
    _createGeometry() {
        return new CapsuleGeometry({
            radius: 1,
            height: Math.max(this._height, 2),
            heightSegments: 1,
            sides: 32
        });
    }

    /**
     * Create the capsule mesh.
     *
     * @returns {Mesh} The capsule mesh.
     * @private
     */
    _createMesh() {
        return Mesh.fromGeometry(this.device, this._createGeometry());
    }

    /**
     * Set the height, caps included, as a multiple of the radius.
     *
     * @type {number}
     */
    set height(value) {
        this._height = value ?? this._height;
        this._update();
    }

    /**
     * Get the height, as a multiple of the radius.
     *
     * @type {number}
     */
    get height() {
        return this._height;
    }

    /**
     * Rebuilds the mesh, destroying the replaced one.
     *
     * @protected
     * @override
     */
    _update() {
        const mesh = this.meshInstances[0].mesh;
        this.meshInstances[0].mesh = this._createMesh();
        if (this.occludedMeshInstances[0]) {
            this.occludedMeshInstances[0].mesh = this.meshInstances[0].mesh;
        }
        if (mesh && mesh.refCount < 1) {
            mesh.destroy();
        }
    }
}

export { CapsuleShape };
