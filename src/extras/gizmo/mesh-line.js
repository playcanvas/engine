import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Entity } from '../../framework/entity.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { CylinderGeometry } from '../../scene/geometry/cylinder-geometry.js';
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

/** @ignore */
class MeshLine {
    /** @private */
    _thickness = 0.02;

    /**
     * @type {ShaderMaterial}
     * @private
     */
    _material = new ShaderMaterial(unlitShader);

    /**
     * Material of the occluded pass, or null when there is none.
     *
     * @type {ShaderMaterial|null}
     * @private
     */
    _occludedMaterial = null;

    /**
     * Uniform storage for the color.
     *
     * @type {number[]}
     * @private
     */
    _colorData = [0, 0, 0, 0];

    /**
     * Uniform storage for the occluded color.
     *
     * @type {number[]}
     * @private
     */
    _occludedColorData = [0, 0, 0, 0];

    /**
     * @type {Entity}
     */
    entity = new Entity('mesh-line');

    /**
     * @param {AppBase} app - The application instance
     * @param {Layer} layer - The layer to draw the guideline on
     * @param {object} [args] - The arguments object
     * @param {number} [args.thickness] - The thickness of the line
     * @param {boolean} [args.occluded] - Whether the line is depth tested against the scene, with
     * a pass without depth test drawn first in the occluded color of {@link MeshLine#draw}. Defaults
     * to false, which draws the line over everything.
     */
    constructor(app, layer, args = {}) {
        this._thickness = args.thickness ?? this._thickness;

        this._material.blendState = BlendState.ALPHABLEND;
        this._material.setDefine('DEPTH_WRITE', args.occluded ? '0' : '1');
        this._material.setParameter('uDepth', 0);
        this._material.update();

        const mesh = Mesh.fromGeometry(app.graphicsDevice, new CylinderGeometry());
        const meshInstances = [new MeshInstance(mesh, this._material)];

        if (args.occluded) {
            const material = new ShaderMaterial(unlitShader);
            material.blendState = BlendState.ALPHABLEND;
            material.setDefine('DEPTH_WRITE', '0');
            material.setParameter('uDepth', 0);
            material.depthTest = false;
            material.depthWrite = false;
            material.update();
            this._occludedMaterial = material;
            meshInstances.unshift(new MeshInstance(mesh, material));
        }

        this.entity.addComponent('render', {
            meshInstances,
            layers: [layer.id]
        });
    }

    /**
     * @type {number}
     */
    set thickness(value) {
        this._thickness = value ?? this._thickness;
    }

    /**
     * @type {number}
     */
    get thickness() {
        return this._thickness;
    }

    /**
     * Draw a line from one point to another with a specific color.
     *
     * @param {Vec3} from - The starting point of the line.
     * @param {Vec3} to - The ending point of the line.
     * @param {number} scale - The scale of the line.
     * @param {Color} color - The color of the line.
     * @param {Color} [occludedColor] - The color where the scene hides the line, for a line
     * created with `occluded`.
     */
    draw(from, to, scale, color, occludedColor) {
        this._material.setParameter('uColor', color.toArray(this._colorData));
        if (occludedColor) {
            this._occludedMaterial?.setParameter('uColor', occludedColor.toArray(this._occludedColorData));
        }

        const dir = tmpV1.sub2(to, from).normalize();
        const elev = Math.atan2(-dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z)) * math.RAD_TO_DEG;
        const azim = Math.atan2(-dir.x, -dir.z) * math.RAD_TO_DEG;
        this.entity.setLocalEulerAngles(-elev + 90, azim, 0);

        const length = from.distance(to) * scale;
        this.entity.setLocalPosition(dir.mulScalar(0.5 * length).add(from));
        this.entity.setLocalScale(this._thickness * scale, length, this._thickness * scale);
    }

    destroy() {
        this._material.destroy();
        this._occludedMaterial?.destroy();
        this.entity.destroy();
    }
}

export { MeshLine };
