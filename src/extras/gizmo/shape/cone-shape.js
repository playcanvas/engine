import { Entity } from '../../../framework/entity.js';
import { ConeGeometry } from '../../../scene/geometry/cone-geometry.js';
import { Mesh } from '../../../scene/mesh.js';
import { TriData } from './tri-data.js';
import { Shape } from './shape.js';

/**
 * @import { ShapeArgs } from './shape.js'
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

/**
 * @typedef {object} ConeShapeArgs
 * @property {number} [peakRadius] - The peak radius, as a fraction of the base radius.
 * @property {number} [segments] - The number of sides around the cone.
 * @property {number} [twist] - The rotation of the sides about the cone axis, in degrees.
 */

/**
 * A unit cone along the y axis, its base of radius 0.5 at y = -0.5 and its peak at y = 0.5. Few
 * segments make a pyramid, a cone with a peak radius equal to the base radius a prism.
 *
 * @ignore
 */
class ConeShape extends Shape {
    /**
     * The peak radius, as a fraction of the base radius.
     *
     * @private
     */
    _peakRadius = 0;

    /**
     * The number of sides.
     *
     * @private
     */
    _segments = 32;

    /**
     * The entity holding the mesh, turned by the twist.
     *
     * @type {Entity}
     * @private
     */
    _body;

    /**
     * Create a new ConeShape.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {ShapeArgs & ConeShapeArgs} args - The shape options.
     */
    constructor(device, args = {}) {
        super(device, 'cone', args);

        this._peakRadius = args.peakRadius ?? this._peakRadius;
        this._segments = args.segments ?? this._segments;

        // hit-testing uses the initial peak radius
        this.triData = [new TriData(this._createGeometry())];

        this._body = new Entity(`body:${this.axis}`);
        this._body.setLocalEulerAngles(0, args.twist ?? 0, 0);
        this.entity.addChild(this._body);
        this._createRenderComponent(this._body, [this._createMesh()]);
    }

    /**
     * Create the cone geometry.
     *
     * @returns {ConeGeometry} The cone geometry.
     * @private
     */
    _createGeometry() {
        return new ConeGeometry({
            baseRadius: 0.5,
            peakRadius: 0.5 * this._peakRadius,
            height: 1,
            heightSegments: 1,
            capSegments: this._segments
        });
    }

    /**
     * Create the cone mesh.
     *
     * @returns {Mesh} The cone mesh.
     * @private
     */
    _createMesh() {
        return Mesh.fromGeometry(this.device, this._createGeometry());
    }

    /**
     * Set the peak radius, as a fraction of the base radius.
     *
     * @type {number}
     */
    set peakRadius(value) {
        this._peakRadius = value ?? this._peakRadius;
        this._update();
    }

    /**
     * Get the peak radius, as a fraction of the base radius.
     *
     * @type {number}
     */
    get peakRadius() {
        return this._peakRadius;
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

export { ConeShape };
