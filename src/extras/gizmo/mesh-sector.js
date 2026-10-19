import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Entity } from '../../framework/entity.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { CULLFACE_NONE, PRIMITIVE_TRIANGLES } from '../../platform/graphics/constants.js';
import { ShaderMaterial } from '../../scene/materials/shader-material.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { Mesh } from '../../scene/mesh.js';
import { unlitShader } from './shaders.js';

/**
 * @import { Color } from '../../core/math/color.js'
 * @import { AppBase } from '../../framework/app-base.js'
 * @import { Layer } from '../../scene/layer.js'
 */

const tmpV1 = new Vec3();
const tmpQ1 = new Quat();

/** @ignore */
class MeshSector {
    /**
     * @type {ShaderMaterial}
     * @private
     */
    _material = new ShaderMaterial(unlitShader);

    /**
     * @type {Mesh}
     * @private
     */
    _mesh;

    /**
     * @type {Float32Array}
     * @private
     */
    _positions;

    /**
     * @type {number}
     * @private
     */
    _segments = 64;

    /**
     * @type {Entity}
     */
    entity = new Entity('mesh-sector');

    /**
     * @param {AppBase} app - The application instance.
     * @param {Layer} layer - The layer to draw the sector on.
     * @param {object} [args] - The arguments object.
     * @param {number} [args.segments] - The number of segments of the arc.
     */
    constructor(app, layer, args = {}) {
        this._segments = args.segments ?? this._segments;

        this._material.blendState = BlendState.ALPHABLEND;
        this._material.cull = CULLFACE_NONE;
        this._material.depthWrite = false;
        this._material.setDefine('DEPTH_WRITE', '0');
        this._material.update();

        // a fan around the centre vertex, its positions written on each draw
        const indices = [];
        for (let i = 0; i < this._segments; i++) {
            indices.push(0, i + 1, i + 2);
        }
        this._positions = new Float32Array((this._segments + 2) * 3);
        this._mesh = new Mesh(app.graphicsDevice);
        this._mesh.clear(true, false);
        this._mesh.setPositions(this._positions);
        this._mesh.setIndices(indices);
        this._mesh.update(PRIMITIVE_TRIANGLES, false);

        const instance = new MeshInstance(this._mesh, this._material);
        instance.cull = false;

        this.entity.addComponent('render', {
            meshInstances: [instance],
            layers: [layer.id]
        });
    }

    /**
     * Draw a filled arc around an axis, starting at a point and sweeping by an angle.
     *
     * @param {Vec3} center - The center of the sector.
     * @param {Vec3} start - The offset from the center to the start of the arc.
     * @param {Vec3} axis - The normalized axis to sweep around.
     * @param {number} from - The angle to start the arc at, in degrees.
     * @param {number} sweep - The angle to sweep by, in degrees.
     * @param {number} scale - The scale of the sector.
     * @param {Color} color - The color of the sector.
     */
    draw(center, start, axis, from, sweep, scale, color) {
        this._material.setParameter('uColor', color.toArray());

        const positions = this._positions;
        positions[0] = center.x;
        positions[1] = center.y;
        positions[2] = center.z;
        for (let i = 0; i <= this._segments; i++) {
            tmpQ1.setFromAxisAngle(axis, from + sweep * i / this._segments).transformVector(start, tmpV1);
            positions[(i + 1) * 3] = center.x + tmpV1.x * scale;
            positions[(i + 1) * 3 + 1] = center.y + tmpV1.y * scale;
            positions[(i + 1) * 3 + 2] = center.z + tmpV1.z * scale;
        }
        this._mesh.setPositions(positions);
        this._mesh.update(PRIMITIVE_TRIANGLES, false);
    }

    destroy() {
        this._material.destroy();
        this.entity.destroy();
    }
}

export { MeshSector };
