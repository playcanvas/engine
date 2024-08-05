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
            // store z/w for later use in fragment shader
            vZW = gl_Position.zw;
            // disable depth clipping
            // gl_Position.z = 0.0;
        }
    `,
    fragmentCode: /* glsl */`
        precision highp float;
        varying vec4 vColor;
        varying vec2 vZW;
        void main(void) {
            gl_FragColor = vec4(gammaCorrectOutput(decodeGamma(vColor)), vColor.w);
            // clamp depth in Z to [0, 1] range
            gl_FragDepth = max(0.0, min(1.0, (vZW.x / vZW.y + 1.0) * 0.5));
        }
    `
};

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();

const calculateShadow = (lightDir, numVertices, normals) => {
    const shadow = [];
    for (let i = 0; i < numVertices; i++) {
        const x = normals[i * 3];
        const y = normals[i * 3 + 1];
        const z = normals[i * 3 + 2];
        tmpV2.set(x, y, z);

        const dot = lightDir.dot(tmpV2);
        shadow.push(dot * SHADOW_DAMP_SCALE + SHADOW_DAMP_OFFSET);
    }

    return shadow;
};

const createShadowMesh = (device, entity, type, color = Color.WHITE, templateOpts) => {
    const Geometry = GEOMETRIES[type];
    if (!Geometry) {
        throw new Error('Invalid primitive type.');
    }

    const geom = new Geometry(templateOpts);
    geom.colors = [];

    const wtm = entity.getWorldTransform().clone().invert();
    tmpV1.copy(LIGHT_DIR);
    wtm.transformVector(tmpV1, tmpV1);
    tmpV1.normalize();
    const numVertices = geom.positions.length / 3;
    const shadow = calculateShadow(tmpV1, numVertices, geom.normals);
    for (let i = 0; i < shadow.length; i++) {
        geom.colors.push(
            shadow[i] * color.r * 0xFF,
            shadow[i] * color.g * 0xFF,
            shadow[i] * color.b * 0xFF,
            color.a * 0xFF
        );
    }

    const shadowMesh = Mesh.fromGeometry(device, geom);
    SHADOW_MESH_MAP.set(shadowMesh, shadow);

    return shadowMesh;
};

const setShadowMeshColor = (mesh, color) => {
    if (!SHADOW_MESH_MAP.has(mesh)) {
        return;
    }
    const shadow = SHADOW_MESH_MAP.get(mesh);
    const colors = [];
    for (let i = 0; i < shadow.length; i++) {
        colors.push(shadow[i] * color.r * 255, shadow[i] * color.g * 255, shadow[i] * color.b * 255, color.a * 255);
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
            setShadowMeshColor(this.meshInstances[i].mesh, value ? this._disabledColor : this._defaultColor);
        }
        this._disabled = value ?? false;
    }

    get disabled() {
        return this._disabled;
    }

    _createRoot(name) {
        this.entity = new Entity(name + ':' + this.axis);
        this._updateRootTransform();
    }

    _updateRootTransform() {
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._scale);
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

    _addRenderShadowMesh(entity, type) {
        const color = this._disabled ? this._disabledColor : this._defaultColor;
        const mesh = createShadowMesh(this.device, entity, type, color);
        this._addRenderMeshes(entity, [mesh]);
    }

    hover(state) {
        if (this._disabled) {
            return;
        }

        for (let i = 0; i < this.meshInstances.length; i++) {
            const color = state ? this._hoverColor : this._defaultColor;
            setShadowMeshColor(this.meshInstances[i].mesh, color);
        }
    }

    destroy() {
        this.entity.destroy();
    }
}

export { createShadowMesh, Shape };
