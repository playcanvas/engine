import { Color } from '../../../core/math/color.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { ShaderMaterial } from '../../../scene/materials/shader-material.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Entity } from '../../../framework/entity.js';
import { CULLFACE_BACK, SEMANTIC_POSITION, SEMANTIC_COLOR } from '../../../platform/graphics/constants.js';
import { BLEND_NORMAL } from '../../../scene/constants.js';

import { COLOR_GRAY } from '../color.js';
import { Mesh } from '../../../scene/mesh.js';
import { BoxGeometry } from '../../../scene/geometry/box-geometry.js';
import { CylinderGeometry } from '../../../scene/geometry/cylinder-geometry.js';
import { ConeGeometry } from '../../../scene/geometry/cone-geometry.js';
import { PlaneGeometry } from '../../../scene/geometry/plane-geometry.js';
import { SphereGeometry } from '../../../scene/geometry/sphere-geometry.js';
import { TorusGeometry } from '../../../scene/geometry/torus-geometry.js';
import { Mat4 } from '../../../core/math/mat4.js';

/** @import { Geometry } from '../../../scene/geometry/geometry.js' */

// constants
const SHADOW_DAMP_SCALE = 0.25;
const SHADOW_DAMP_OFFSET = 0.75;
const SHADOW_MESH_MAP = new Map();

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
    vertexCode: /* glsl */`
        attribute vec3 vertex_position;
        attribute vec4 vertex_color;
        varying vec4 vColor;
        varying vec2 vZW;
        uniform mat4 matrix_model;
        uniform mat4 matrix_viewProjection;
        void main(void) {
            gl_Position = matrix_viewProjection * matrix_model * vec4(vertex_position, 1.0);
            vColor = vertex_color;
        }
    `,
    fragmentCode: /* glsl */`
        precision highp float;
        varying vec4 vColor;
        varying vec2 vZW;
        void main(void) {
            gl_FragColor = vec4(gammaCorrectOutput(decodeGamma(vColor)), vColor.w);
            gl_FragDepth = gl_FragCoord.z;
        }
    `
};

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpM1 = new Mat4();

/**
 * Apply shadow to a geometry.
 *
 * @param {Geometry} geom - The geometry to apply shadow to.
 * @param {Mat4} transform - The transform of the geometry.
 * @param {Color} color - The color of the geometry.
 * @param {Vec3} lightDir - The direction of the light.
 * @returns {number[]} The shadow data.
 */
const applyShadow = (geom, transform, color, lightDir) => {
    if (!geom.normals || !geom.positions) {
        return [];
    }

    // transform light direction to local space
    const invMat = tmpM1.copy(transform).invert();
    const localLightDir = invMat.transformVector(tmpV1.copy(lightDir), tmpV1).normalize();

    // calculate shadow intensity and apply to color
    geom.colors = [];
    const shadow = [];
    const numVertices = geom.positions.length / 3;
    for (let i = 0; i < numVertices; i++) {
        const x = geom.normals[i * 3];
        const y = geom.normals[i * 3 + 1];
        const z = geom.normals[i * 3 + 2];
        const normal = tmpV2.set(x, y, z);

        const dot = localLightDir.dot(normal);
        shadow.push(dot * SHADOW_DAMP_SCALE + SHADOW_DAMP_OFFSET);

        geom.colors.push(
            shadow[i] * color.r * 0xFF,
            shadow[i] * color.g * 0xFF,
            shadow[i] * color.b * 0xFF,
            color.a * 0xFF
        );
    }

    return shadow;
};

/**
 * Set the color of a mesh.
 *
 * @param {Mesh} mesh - The mesh to set the color of.
 * @param {Color} color - The color to set the mesh to.
 */
const setMeshColor = (mesh, color) => {
    const data = SHADOW_MESH_MAP.get(mesh) ?? [];
    const colors = [];
    const vertexCount = mesh.vertexBuffer.numVertices;
    for (let i = 0; i < vertexCount; i++) {
        const shadow = data[i] ?? 1;
        colors.push(
            shadow * color.r * 0xFF,
            shadow * color.g * 0xFF,
            shadow * color.b * 0xFF,
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

    _disabled;

    _defaultColor = Color.WHITE;

    _hoverColor = Color.BLACK;

    _disabledColor = COLOR_GRAY;

    _cull = CULLFACE_BACK;

    device;

    axis;

    entity;

    triData = [];

    meshInstances = [];

    /**
     * Create a mesh from a primitive.
     *
     * @param {Shape} shape - The shape to create the mesh for.
     * @param {string} type - The type of primitive to create.
     * @param {Color} color - The color of the primitive.
     * @param {boolean} shadow - Whether to create a shadow mesh.
     * @param {object} [templateOpts] - The options to use for the primitive.
     * @returns {Mesh} The mesh created from the primitive.
     */
    static createMesh(shape, type, color = Color.WHITE, shadow = true, templateOpts) {
        const Geometry = GEOMETRIES[type];
        if (!Geometry) {
            throw new Error('Invalid primitive type.');
        }

        const geom = new Geometry(templateOpts);
        const data = shadow ? applyShadow(geom, shape.entity.getWorldTransform(), color, LIGHT_DIR) : [];

        const mesh = Mesh.fromGeometry(shape.device, geom);
        SHADOW_MESH_MAP.set(mesh, data);

        return mesh;
    }

    constructor(device, options) {
        this.device = device;
        this.axis = options.axis ?? 'x';
        this._position = options.position ?? new Vec3();
        this._rotation = options.rotation ?? new Vec3();
        this._scale = options.scale ?? new Vec3(1, 1, 1);

        this._disabled = options.disabled ?? false;

        this._layers = options.layers ?? this._layers;

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

    _createRoot(name) {
        this.entity = new Entity(`${name}:${this.axis}`);
        this._updateRootTransform();
    }

    _updateRootTransform() {
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._scale);
    }

    /**
     * Create a mesh from a primitive.
     *
     * @param {string} type - The type of primitive to create.
     * @param {Color} color - The color of the primitive.
     * @param {boolean} shadow - Whether to create a shadow mesh.
     * @param {object} [templateOpts] - The options to use for the primitive.
     * @returns {Mesh} The mesh created from the primitive.
     * @throws {Error} If the primitive type is invalid.
     * @protected
     */
    _createMesh(type, color = Color.WHITE, shadow = true, templateOpts) {
        const Geometry = GEOMETRIES[type];
        if (!Geometry) {
            throw new Error('Invalid primitive type.');
        }

        const geom = new Geometry(templateOpts);
        const data = shadow ? applyShadow(geom, this.entity.getWorldTransform(), color, LIGHT_DIR) : [];

        const mesh = Mesh.fromGeometry(this.device, geom);
        SHADOW_MESH_MAP.set(mesh, data);

        return mesh;
    }

    _addRenderMeshes(entity, meshes) {
        const material = new ShaderMaterial(shaderDesc);
        material.cull = this._cull;
        material.blendType = BLEND_NORMAL;
        material.update();

        const meshInstances = [];
        for (let i = 0; i < meshes.length; i++) {
            const mi = new MeshInstance(meshes[i], material);
            meshInstances.push(mi);
            this.meshInstances.push(mi);
        }
        entity.addComponent('render', {
            meshInstances: meshInstances,
            layers: this._layers,
            castShadows: false
        });
    }

    _addRenderShadowMesh(entity, type, shadow) {
        const color = this._disabled ? this._disabledColor : this._defaultColor;
        const mesh = this._createMesh(type, color, shadow);
        this._addRenderMeshes(entity, [mesh]);
    }

    hover(state) {
        if (this._disabled) {
            return;
        }

        for (let i = 0; i < this.meshInstances.length; i++) {
            const color = state ? this._hoverColor : this._defaultColor;
            setMeshColor(this.meshInstances[i].mesh, color);
        }
    }

    destroy() {
        this.entity.destroy();
    }
}

export { Shape };
