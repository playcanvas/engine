import { Color } from '../../../core/math/color.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { ShaderMaterial } from '../../../scene/materials/shader-material.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Entity } from '../../../framework/entity.js';
import { CULLFACE_BACK, SEMANTIC_POSITION, SEMANTIC_COLOR } from '../../../platform/graphics/constants.js';
import { BLEND_NORMAL } from '../../../scene/constants.js';

import { COLOR_GRAY } from '../color.js';
import { Mesh } from '../../../scene/mesh.js';
import { Geometry } from '../../../scene/geometry/geometry.js';
import { BoxGeometry } from '../../../scene/geometry/box-geometry.js';
import { CylinderGeometry } from '../../../scene/geometry/cylinder-geometry.js';
import { ConeGeometry } from '../../../scene/geometry/cone-geometry.js';
import { PlaneGeometry } from '../../../scene/geometry/plane-geometry.js';
import { SphereGeometry } from '../../../scene/geometry/sphere-geometry.js';
import { TorusGeometry } from '../../../scene/geometry/torus-geometry.js';
import { Mat4 } from '../../../core/math/mat4.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js';
 * @import { TriData } from '../tri-data.js';
 */

// constants
const SHADING_DAMP_SCALE = 0.25;
const SHADING_DAMP_OFFSET = 0.75;

const LIGHT_DIR = new Vec3(1, 2, 3);

const GEOMETRIES = {
    box: BoxGeometry,
    cone: ConeGeometry,
    cylinder: CylinderGeometry,
    plane: PlaneGeometry,
    sphere: SphereGeometry,
    torus: TorusGeometry
};

const shaderDesc = {
    uniqueName: 'axis-shape',
    attributes: {
        vertex_position: SEMANTIC_POSITION,
        vertex_color: SEMANTIC_COLOR
    },
    vertexGLSL: /* glsl */`
        attribute vec3 vertex_position;
        attribute vec4 vertex_color;
    
        varying vec4 vColor;
    
        uniform mat4 matrix_model;
        uniform mat4 matrix_viewProjection;
    
        void main(void) {
            gl_Position = matrix_viewProjection * matrix_model * vec4(vertex_position, 1.0);
            gl_Position.z = clamp(gl_Position.z, -abs(gl_Position.w), abs(gl_Position.w));
            vColor = vertex_color;
        }
    `,
    fragmentGLSL: /* glsl */`
        #include "gammaPS"
    
        precision highp float;
    
        varying vec4 vColor;

        void main(void) {
            gl_FragColor = vec4(gammaCorrectOutput(decodeGamma(vColor)), vColor.w);
        }
    `,
    vertexWGSL: /* wgsl */`
        attribute vertex_position: vec3f;
        attribute vertex_color: vec4f;

        uniform matrix_model: mat4x4f;
        uniform matrix_viewProjection: mat4x4f;

        varying vColor: vec4f;

        @vertex
        fn vertexMain(input: VertexInput) -> VertexOutput {
            var output: VertexOutput;
            output.vColor = input.vertex_color;
            let pos = vec4f(input.vertex_position, 1.0);
            output.position = uniform.matrix_viewProjection * uniform.matrix_model * pos;
            output.position.z = clamp(output.position.z, -abs(output.position.w), abs(output.position.w));
            return output;
        }
    `,
    fragmentWGSL: /* wgsl */`
        #include "gammaPS"

        varying vColor: vec4f;

        @fragment
        fn fragmentMain(input: FragmentInput) -> FragmentOutput {
            var output: FragmentOutput;
            output.color = vec4f(gammaCorrectOutput(decodeGamma(input.vColor)), input.vColor.w);
            return output;
        }
    `
};

const shadingMeshMap = new Map();

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpM1 = new Mat4();
const tmpG = new Geometry();
tmpG.positions = [];
tmpG.normals = [];

/**
 * Apply shadow to a geometry.
 *
 * @param {Geometry} geom - The geometry to apply shadow to.
 * @param {Color} color - The color of the geometry.
 * @param {Mat4} [transform] - The transform of the geometry.
 * @returns {number[]} The shadow data.
 */
const applyShadowColor = (geom, color, transform) => {
    if (!geom.normals || !geom.positions) {
        return [];
    }

    // transform light direction to local space
    let localLightDir;
    if (transform) {
        localLightDir = tmpM1.copy(transform).invert()
        .transformVector(tmpV1.copy(LIGHT_DIR), tmpV1)
        .normalize();
    }

    // calculate shading intensity and apply to color
    geom.colors = [];
    const shading = [];
    const numVertices = geom.positions.length / 3;
    for (let i = 0; i < numVertices; i++) {
        let strength = 1;
        if (localLightDir) {
            const x = geom.normals[i * 3];
            const y = geom.normals[i * 3 + 1];
            const z = geom.normals[i * 3 + 2];
            const normal = tmpV2.set(x, y, z);
            const dot = localLightDir.dot(normal);
            strength = dot * SHADING_DAMP_SCALE + SHADING_DAMP_OFFSET;
        }
        shading.push(strength);
        geom.colors.push(
            strength * color.r * 0xFF,
            strength * color.g * 0xFF,
            strength * color.b * 0xFF,
            color.a * 0xFF
        );
    }

    return shading;
};

/**
 * Set the color of a mesh.
 *
 * @param {Mesh} mesh - The mesh to set the color of.
 * @param {Color} color - The color to set the mesh to.
 */
const setMeshColor = (mesh, color) => {
    const shading = shadingMeshMap.get(mesh);
    const colors = [];
    for (let i = 0; i < shading.length; i++) {
        colors.push(
            shading[i] * color.r * 0xFF,
            shading[i] * color.g * 0xFF,
            shading[i] * color.b * 0xFF,
            color.a * 0xFF
        );
    }
    mesh.setColors32(colors);
    mesh.update();
};

class Shape {
    _position;

    _rotation;

    _scale;

    _layers = [];

    _shading = true;

    _disabled;

    _defaultColor = Color.WHITE;

    _hoverColor = Color.BLACK;

    _disabledColor = COLOR_GRAY;

    _cull = CULLFACE_BACK;

    /**
     * The graphics device.
     *
     * @type {GraphicsDevice}
     */
    device;

    /**
     * The axis of the shape.
     *
     * @type {string}
     */
    axis;

    /**
     * The entity of the shape.
     *
     * @type {Entity}
     */
    entity;


    /**
     * The triangle data of the shape.
     *
     * @type {TriData[]}
     */
    triData = [];

    /**
     * The mesh instances of the shape.
     *
     * @type {MeshInstance[]}
     */
    meshInstances = [];

    constructor(device, options) {
        this.device = device;
        this.axis = options.axis ?? 'x';
        this._position = options.position ?? new Vec3();
        this._rotation = options.rotation ?? new Vec3();
        this._scale = options.scale ?? new Vec3(1, 1, 1);

        this._disabled = options.disabled ?? false;

        this._layers = options.layers ?? this._layers;
        this._shading = options.shading ?? this._shading;

        if (options.defaultColor instanceof Color) {
            this._defaultColor = options.defaultColor;
        }
        if (options.hoverColor instanceof Color) {
            this._hoverColor = options.hoverColor;
        }
        if (options.disabledColor instanceof Color) {
            this._disabledColor = options.disabledColor;
        }
    }

    set disabled(value) {
        for (let i = 0; i < this.meshInstances.length; i++) {
            setMeshColor(this.meshInstances[i].mesh, value ? this._disabledColor : this._defaultColor);
        }
        this._disabled = value ?? false;
    }

    get disabled() {
        return this._disabled;
    }

    set shading(value) {
        this._shading = value ?? true;

        const color = this._disabled ? this._disabledColor : this._defaultColor;
        for (let i = 0; i < this.meshInstances.length; i++) {
            const mesh = this.meshInstances[i].mesh;
            mesh.getPositions(tmpG.positions);
            mesh.getNormals(tmpG.normals);
            const shadow = applyShadowColor(
                tmpG,
                color,
                this._shading ? this.entity.getWorldTransform() : undefined
            );
            shadingMeshMap.set(mesh, shadow);
            setMeshColor(mesh, color);
        }
    }

    get shading() {
        return this._shading;
    }

    _createRoot(name) {
        this.entity = new Entity(`${name}:${this.axis}`);
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._scale);
    }

    /**
     * Create a mesh from a primitive.
     *
     * @param {Geometry} geom - The geometry to create the mesh from.
     * @param {boolean} shading - Whether to apply shading to the primitive.
     * @returns {Mesh} The mesh created from the primitive.
     * @throws {Error} If the primitive type is invalid.
     * @protected
     */
    _createMesh(geom, shading = true) {
        const color = this._disabled ? this._disabledColor : this._defaultColor;
        const shadow = applyShadowColor(
            geom,
            color,
            shading ? this.entity.getWorldTransform() : undefined
        );
        const mesh = Mesh.fromGeometry(this.device, geom);
        shadingMeshMap.set(mesh, shadow);

        return mesh;
    }

    /**
     * Create a render component for an entity.
     *
     * @param {Entity} entity - The entity to create the render component for.
     * @param {Mesh[]} meshes - The meshes to create the render component with.
     * @protected
     */
    _createRenderComponent(entity, meshes) {
        const material = new ShaderMaterial(shaderDesc);
        material.cull = this._cull;
        material.blendType = BLEND_NORMAL;
        material.update();

        const meshInstances = [];
        for (let i = 0; i < meshes.length; i++) {
            const mi = new MeshInstance(meshes[i], material);
            mi.cull = false;
            meshInstances.push(mi);
            this.meshInstances.push(mi);
        }
        entity.addComponent('render', {
            meshInstances: meshInstances,
            layers: this._layers,
            castShadows: false
        });
    }

    /**
     * Add a render mesh to an entity.
     *
     * @param {Entity} entity - The entity to add the render mesh to.
     * @param {string} type - The type of primitive to create.
     * @param {boolean} shading - Whether to apply shading to the primitive.
     * @throws {Error} If the primitive type is invalid.
     * @protected
     */
    _addRenderMesh(entity, type, shading) {
        const Geometry = GEOMETRIES[type];
        if (!Geometry) {
            throw new Error('Invalid primitive type.');
        }
        this._createRenderComponent(entity, [
            this._createMesh(new Geometry(), shading)
        ]);
    }

    hover(state) {
        if (this._disabled) {
            return;
        }
        for (let i = 0; i < this.meshInstances.length; i++) {
            const color = state ? this._hoverColor : this._defaultColor;
            const mesh = this.meshInstances[i].mesh;
            setMeshColor(mesh, color);
        }
    }

    destroy() {
        this.entity.destroy();
    }
}

export { Shape };
