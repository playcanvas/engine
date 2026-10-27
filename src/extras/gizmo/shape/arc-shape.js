import { TorusGeometry } from '../../../scene/geometry/torus-geometry.js';
import { Mesh } from '../../../scene/mesh.js';
import { TriData } from './tri-data.js';
import { Shape } from './shape.js';

/**
 * @import { ShapeArgs } from './shape.js'
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

const TORUS_RENDER_SEGMENTS = 80;
const TORUS_INTERSECT_SEGMENTS = 20;

/**
 * @typedef {object} ArcShapeArgs
 * @property {number} [tubeRadius] - The tube radius.
 * @property {number} [ringRadius] - The ring radius.
 * @property {number} [sectorAngle] - The sector angle.
 */

/**
 * @ignore
 */
class ArcShape extends Shape {
    /**
     * The tube radius.
     *
     * @private
     */
    _tubeRadius = 0.01;

    /**
     * The ring radius.
     *
     * @private
     */
    _ringRadius = 0.5;

    /**
     * The sector angle.
     *
     * @private
     */
    _sectorAngle = 360;

    /**
     * The intersection tolerance.
     *
     * @private
     */
    _tolerance = 0.05;

    /**
     * The cache for triangle data.
     *
     * @type {[TriData, TriData]}
     * @private
     */
    _triDataCache;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {ShapeArgs & ArcShapeArgs} args - The shape options.
     */
    constructor(device, args = {}) {
        super(device, 'disk', args);

        this._tubeRadius = args.tubeRadius ?? this._tubeRadius;
        this._ringRadius = args.ringRadius ?? this._ringRadius;
        this._sectorAngle = args.sectorAngle ?? this._sectorAngle;

        this._triDataCache = [
            new TriData(this._createTorusGeometry(this._sectorAngle)),
            new TriData(this._createTorusGeometry(360))
        ];
        this.triData = [this._triDataCache[0]];

        this._createRenderComponent(this.entity, [
            this._createTorusMesh(this._sectorAngle),
            this._createTorusMesh(360)
        ]);
        this.show('sector');
    }

    /**
     * Create the torus geometry.
     *
     * @param {number} sectorAngle - The sector angle.
     * @returns {TorusGeometry} The torus geometry.
     * @private
     */
    _createTorusGeometry(sectorAngle) {
        return new TorusGeometry({
            tubeRadius: this._tubeRadius + this._tolerance,
            ringRadius: this._ringRadius,
            sectorAngle: sectorAngle,
            segments: TORUS_INTERSECT_SEGMENTS
        });
    }

    /**
     * Create the torus mesh.
     *
     * @param {number} sectorAngle - The sector angle.
     * @returns {Mesh} The torus mesh.
     * @private
     */
    _createTorusMesh(sectorAngle) {
        const geom = new TorusGeometry({
            tubeRadius: this._tubeRadius,
            ringRadius: this._ringRadius,
            sectorAngle: sectorAngle,
            segments: TORUS_RENDER_SEGMENTS
        });
        return Mesh.fromGeometry(this.device, geom);
    }

    /**
     * Set the tube radius.
     *
     * @type {number}
     */
    set tubeRadius(value) {
        this._tubeRadius = value ?? this._tubeRadius;
        this._update();
    }

    /**
     * Get the tube radius.
     *
     * @type {number}
     */
    get tubeRadius() {
        return this._tubeRadius;
    }

    /**
     * Set the ring radius.
     *
     * @type {number}
     */
    set ringRadius(value) {
        this._ringRadius = value ?? this._ringRadius;
        this._update();
    }

    /**
     * Get the ring radius.
     *
     * @type {number}
     */
    get ringRadius() {
        return this._ringRadius;
    }

    /**
     * Set the sector angle in degrees.
     *
     * @type {number}
     */
    set sectorAngle(value) {
        this._sectorAngle = value ?? this._sectorAngle;
        this._update();
    }

    /**
     * Get the sector angle in degrees.
     *
     * @type {number}
     */
    get sectorAngle() {
        return this._sectorAngle;
    }

    /**
     * Set the intersection tolerance.
     *
     * @type {number}
     */
    set tolerance(value) {
        this._tolerance = value ?? this._tolerance;
        this._update();
    }

    /**
     * Get the intersection tolerance.
     *
     * @type {number}
     */
    get tolerance() {
        return this._tolerance;
    }

    /**
     * Updates the transform.
     *
     * @protected
     * @override
     */
    _update() {
        this._triDataCache[0].fromGeometry(this._createTorusGeometry(this._sectorAngle));
        this._triDataCache[1].fromGeometry(this._createTorusGeometry(360));

        // destroy the meshes being replaced
        const angles = [this._sectorAngle, 360];
        for (let i = 0; i < angles.length; i++) {
            const mesh = this.meshInstances[i].mesh;
            this.meshInstances[i].mesh = this._createTorusMesh(angles[i]);
            if (this.occludedMeshInstances[i]) {
                this.occludedMeshInstances[i].mesh = this.meshInstances[i].mesh;
            }
            if (mesh && mesh.refCount < 1) {
                mesh.destroy();
            }
        }
    }

    /**
     * @param {'sector' | 'ring' | 'none'} state - The visibility state.
     */
    show(state) {
        switch (state) {
            case 'sector': {
                this.triData[0] = this._triDataCache[0];
                this.meshInstances[0].visible = true;
                this.meshInstances[1].visible = false;
                break;
            }
            case 'ring': {
                this.triData[0] = this._triDataCache[1];
                this.meshInstances[0].visible = false;
                this.meshInstances[1].visible = true;
                break;
            }
            case 'none': {
                this.meshInstances[0].visible = false;
                this.meshInstances[1].visible = false;
                break;
            }
        }
        for (let i = 0; i < this.occludedMeshInstances.length; i++) {
            this.occludedMeshInstances[i].visible = this.meshInstances[i].visible;
        }
    }
}

export { ArcShape };
