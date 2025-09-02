import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Entity } from '../../framework/entity.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { SEMANTIC_POSITION } from '../../platform/graphics/constants.js';
import { CylinderGeometry } from '../../scene/geometry/cylinder-geometry.js';
import { ShaderMaterial } from '../../scene/materials/shader-material.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { Mesh } from '../../scene/mesh.js';

/**
 * @import { Color } from '../../core/math/color.js'
 * @import { AppBase } from '../../framework/app-base.js'
 * @import { Layer } from '../../scene/layer.js'
 */

const tmpV1 = new Vec3();

const shaderDesc = {
    uniqueName: 'mesh-line',
    attributes: {
        vertex_position: SEMANTIC_POSITION
    },
    vertexGLSL: /* glsl */`
        attribute vec3 vertex_position;
    
        uniform mat4 matrix_model;
        uniform mat4 matrix_viewProjection;
    
        void main(void) {
            gl_Position = matrix_viewProjection * matrix_model * vec4(vertex_position, 1.0);
            gl_Position.z = clamp(gl_Position.z, -abs(gl_Position.w), abs(gl_Position.w));
        }
    `,
    fragmentGLSL: /* glsl */`
        #include "gammaPS"
    
        precision highp float;
    
        uniform vec4 uColor;

        void main(void) {
            gl_FragColor = vec4(gammaCorrectOutput(decodeGamma(uColor)), uColor.w);
        }
    `,
    vertexWGSL: /* wgsl */`
        attribute vertex_position: vec3f;

        uniform matrix_model: mat4x4f;
        uniform matrix_viewProjection: mat4x4f;

        @vertex
        fn vertexMain(input: VertexInput) -> VertexOutput {
            var output: VertexOutput;
            let pos = vec4f(input.vertex_position, 1.0);
            output.position = uniform.matrix_viewProjection * uniform.matrix_model * pos;
            output.position.z = clamp(output.position.z, -abs(output.position.w), abs(output.position.w));
            return output;
        }
    `,
    fragmentWGSL: /* wgsl */`
        #include "gammaPS"

        uniform uColor: vec4f;

        @fragment
        fn fragmentMain(input: FragmentInput) -> FragmentOutput {
            var output: FragmentOutput;
            output.color = vec4f(gammaCorrectOutput(decodeGamma(uniform.uColor)), uniform.uColor.w);
            return output;
        }
    `
};

/**
 * @ignore
 */
class MeshLine {
    /**
     * @type {number}
     * @private
     */
    _thickness = 0.02;

    /**
     * @type {ShaderMaterial}
     * @private
     */
    _material = new ShaderMaterial(shaderDesc);

    /**
     * @type {Entity}
     * @private
     */
    _entity = new Entity();

    /**
     * @param {AppBase} app - The application instance
     * @param {Layer} layer - The layer to draw the guideline on
     * @param {object} [args] - The arguments object
     * @param {number} [args.thickness] - The thickness of the line
     */
    constructor(app, layer, args = {}) {
        this._thickness = args.thickness ?? this._thickness;

        this._material.blendState = BlendState.ALPHABLEND;
        this._material.update();

        const mesh = Mesh.fromGeometry(app.graphicsDevice, new CylinderGeometry());
        const meshInstance = new MeshInstance(mesh, this._material);

        this._entity.addComponent('render', {
            meshInstances: [meshInstance],
            layers: [layer.id]
        });
        app.root.addChild(this._entity);
        this._entity.enabled = false;
    }

    /**
     * Draw a line from one point to another with a specific color.
     *
     * @param {Vec3} from - The starting point of the line.
     * @param {Vec3} to - The ending point of the line.
     * @param {number} scale - The scale of the line.
     * @param {Color} color - The color of the line.
     */
    draw(from, to, scale, color) {
        this._material.setParameter('uColor', color.toArray());

        const dir = tmpV1.sub2(to, from).normalize();
        const elev = Math.atan2(-dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z)) * math.RAD_TO_DEG;
        const azim = Math.atan2(-dir.x, -dir.z) * math.RAD_TO_DEG;
        this._entity.setLocalEulerAngles(-elev + 90, azim, 0);

        const length = from.distance(to) * scale;
        this._entity.setLocalPosition(dir.mulScalar(0.5 * length).add(from));
        this._entity.setLocalScale(this._thickness * scale, length, this._thickness * scale);

        this._entity.enabled = true;
    }

    hide() {
        this._entity.enabled = false;
    }
}

export { MeshLine };
