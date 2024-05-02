import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BUFFER_DYNAMIC, BUFFER_STATIC, PIXELFORMAT_R32U, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, SEMANTIC_ATTR13, SEMANTIC_COLOR, SEMANTIC_POSITION, TYPE_UINT32 } from '../../platform/graphics/constants.js';
import { DITHER_NONE } from '../constants.js';
import { MeshInstance } from '../mesh-instance.js';
import { Mesh } from '../mesh.js';
import { createGSplatMaterial } from './gsplat-material.js';
import { GSplatSorter } from './gsplat-sorter.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { drawQuadWithShader } from '../graphics/quad-render-utils.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';

// vertex shader
const v1v2VS = /* glsl */`

attribute vec2 aPosition;
void main(void) {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// fragment shader
const v1v2FS = /* glsl */`

uniform highp sampler2D transformA;
uniform highp sampler2D transformB;
uniform highp sampler2D transformC;

// read splat center and covariance from textures
void readTransform(vec2 splatUV, out vec3 center, out vec3 covA, out vec3 covB) {
    vec4 tA = texture2D(transformA, splatUV);
    vec4 tB = texture2D(transformB, splatUV);
    vec4 tC = texture2D(transformC, splatUV);

    center = tA.xyz;
    covA = tB.xyz;
    covB = vec3(tA.w, tB.w, tC.x);
}

// given the splat center (view space) and covariance A and B vectors, calculate
// the v1 and v2 vectors for this view.
vec4 calcV1V2(vec3 centerView, vec3 covA, vec3 covB, float focal, mat3 W) {
    mat3 Vrk = mat3(
        covA.x, covA.y, covA.z, 
        covA.y, covB.x, covB.y,
        covA.z, covB.y, covB.z
    );

    float J1 = focal / centerView.z;
    vec2 J2 = -J1 / centerView.z * centerView.xy;
    mat3 J = mat3(
        J1, 0., J2.x, 
        0., J1, J2.y, 
        0., 0., 0.
    );

    mat3 T = W * J;
    mat3 cov = transpose(T) * Vrk * T;

    float diagonal1 = cov[0][0] + 0.3;
    float offDiagonal = cov[0][1];
    float diagonal2 = cov[1][1] + 0.3;

    float mid = 0.5 * (diagonal1 + diagonal2);
    float radius = length(vec2((diagonal1 - diagonal2) / 2.0, offDiagonal));
    float lambda1 = mid + radius;
    float lambda2 = max(mid - radius, 0.1);
    vec2 diagonalVector = normalize(vec2(offDiagonal, lambda1 - diagonal1));
    vec2 v1 = min(sqrt(2.0 * lambda1), 1024.0) * diagonalVector;
    vec2 v2 = min(sqrt(2.0 * lambda2), 1024.0) * vec2(diagonalVector.y, -diagonalVector.x);

    return vec4(v1, v2);
}

uniform mat4 matrix_model;
uniform mat4 matrix_view;
uniform mat4 matrix_projection;
uniform vec2 viewport;
uniform vec2 bufferSize;

void main(void) {
    // calculate splat UV
    vec2 splatUV = gl_FragCoord.xy / bufferSize;

    // read splat center and covariance
    vec3 center, covA, covB;
    readTransform(splatUV, center, covA, covB);

    mat4 modelView = matrix_view * matrix_model;

    float focal = viewport.x * matrix_projection[0][0];

    // calcV1V2
    gl_FragColor = calcV1V2(
        (modelView * vec4(center, 1.0)).xyz,
        covA,
        covB,
        focal,
        transpose(mat3(modelView))
    );
}
`;

const mat = new Mat4();
const cameraPosition = new Vec3();
const cameraDirection = new Vec3();
const viewport = [0, 0];

/** @ignore */
class GSplatInstance {
    /** @type {import('./gsplat.js').GSplat} */
    splat;

    /** @type {Mesh} */
    mesh;

    /** @type {MeshInstance} */
    meshInstance;

    /** @type {import('../materials/material.js').Material} */
    material;

    /** @type {VertexBuffer} */
    vb;

    options = {};

    /** @type {import('../../platform/graphics/texture.js').Texture} */
    v1v2Texture;
    v1v2RenderTarget;
    v1v2Shader;

    /** @type {GSplatSorter | null} */
    sorter = null;

    lastCameraPosition = new Vec3();

    lastCameraDirection = new Vec3();

    /**
     * List of cameras this instance is visible for. Updated every frame by the renderer.
     *
     * @type {import('../camera.js').Camera[]}
     * @ignore
     */
    cameras = [];

    /**
     * @param {import('./gsplat.js').GSplat} splat - The splat instance.
     * @param {import('./gsplat-material.js').SplatMaterialOptions} options - The options.
     */
    constructor(splat, options) {
        this.splat = splat;

        // clone options object
        options = Object.assign(this.options, options);

        // not supported on WebGL1
        const device = splat.device;
        if (device.isWebGL1)
            return;

        this.v1v2Texture = this.splat.createTexture(
            'splatV1V2',
            device.textureHalfFloatRenderable ? PIXELFORMAT_RGBA16F : PIXELFORMAT_RGBA32F,
            this.splat.evalTextureSize(this.splat.numSplats)
        );

        this.v1v2RenderTarget = new RenderTarget({
            name: 'splatV1V2RenderTarget',
            colorBuffer: this.v1v2Texture,
            depth: false
        });

        this.v1v2Shader = createShaderFromCode(device, v1v2VS, v1v2FS, 'v1v2Shader', { aPosition: SEMANTIC_POSITION });

        // material
        this.createMaterial(options);

        // const numSplats = Math.floor(splat.numSplats / 4) * 4;
        const numSplats = splat.numSplats;

        const indexData = new Uint32Array(numSplats);
        for (let i = 0; i < numSplats; ++i) {
            indexData[i] = i;
        }

        const vertexFormat = new VertexFormat(device, [
            // { semantic: SEMANTIC_ATTR13, components: 4, type: TYPE_UINT32, asInt: true }
            { semantic: SEMANTIC_ATTR13, components: 1, type: TYPE_UINT32, asInt: true }
        ]);

        // const vb = new VertexBuffer(device, vertexFormat, numSplats / 4, {
        const vb = new VertexBuffer(device, vertexFormat, numSplats, {
            usage: BUFFER_DYNAMIC,
            data: indexData.buffer
        });

        const mesh = new Mesh(device);
        // mesh.setPositions(new Float32Array([
        //     -2, -2, 0, 2, -2, 0, 2, 2, 0, -2, 2, 0,
        //     -2, -2, 1, 2, -2, 1, 2, 2, 1, -2, 2, 1,
        //     -2, -2, 2, 2, -2, 2, 2, 2, 2, -2, 2, 2,
        //     -2, -2, 3, 2, -2, 3, 2, 2, 3, -2, 2, 3
        // ]), 3);
        mesh.setPositions(new Float32Array([-2, -2, 2, -2, 2, 2, -2, 2]), 2);
        // mesh.setIndices([
        //     0, 1, 2, 0, 2, 3,
        //     4, 5, 6, 4, 6, 7,
        //     8, 9, 10, 8, 10, 11,
        //     12, 13, 14, 12, 14, 15
        // ]);
        mesh.setIndices([0, 1, 2, 0, 2, 3]);
        mesh.update();

        this.mesh = mesh;
        this.mesh.aabb.copy(splat.aabb);
        this.meshInstance = new MeshInstance(this.mesh, this.material);
        this.meshInstance.setInstancing(vb, true);
        this.meshInstance.gsplatInstance = this;

        // this.meshInstance.instancingCount = numSplats / 4;
        this.meshInstance.instancingCount = numSplats;

        // clone centers to allow multiple instances of sorter
        this.centers = new Float32Array(splat.centers);

        // create sorter
        if (!options.dither || options.dither === DITHER_NONE) {
            this.sorter = new GSplatSorter();
            this.sorter.init(vb, this.centers);
            this.sorter.on('updated', (count) => {
                // ideally we would update the number of splats rendered here in order to skip
                // the ones behind the camera. unfortunately changing this value dynamically
                // results in performance lockups. (the browser is likely re-validating the index
                // buffer when this value changes and/or re-uploading the index buffer to gpu memory).
                // this.mesh.primitive[0].count = count * 6;

                // sorter not working
                this.meshInstance.instancingCount = count;

                // console.log(count);

                // this.updateV1V2(this.cameras[0]);
            });
        }
    }

    destroy() {
        this.material?.destroy();
        this.meshInstance?.destroy();
        this.sorter?.destroy();
    }

    clone() {
        return new GSplatInstance(this.splat, this.options);
    }

    createMaterial(options) {
        this.material = createGSplatMaterial(options);
        this.material.setParameter('v1v2Texture', this.v1v2Texture);
        this.splat.setupMaterial(this.material);
        if (this.meshInstance) {
            this.meshInstance.material = this.material;
        }
    }

    updateViewport() {
        // TODO: improve, needs to handle render targets of different sizes
        const device = this.splat.device;
        viewport[0] = device.width;
        viewport[1] = device.height;
        this.material.setParameter('viewport', viewport);
    }

    /**
     * Sorts the GS vertices based on the given camera.
     * @param {import('../graph-node.js').GraphNode} cameraNode - The camera node used for sorting.
     */
    sort(cameraNode) {
        if (this.sorter) {
            const cameraMat = cameraNode.getWorldTransform();
            cameraMat.getTranslation(cameraPosition);
            cameraMat.getZ(cameraDirection);

            const modelMat = this.meshInstance.node.getWorldTransform();
            const invModelMat = mat.invert(modelMat);
            invModelMat.transformPoint(cameraPosition, cameraPosition);
            invModelMat.transformVector(cameraDirection, cameraDirection);

            // sort if the camera has changed
            if (!cameraPosition.equalsApprox(this.lastCameraPosition) || !cameraDirection.equalsApprox(this.lastCameraDirection)) {
                this.lastCameraPosition.copy(cameraPosition);
                this.lastCameraDirection.copy(cameraDirection);
                this.sorter.setCamera(cameraPosition, cameraDirection);
            }
        }

        this.updateViewport();
    }

    update() {
        if (this.cameras.length > 0) {

            // sort by the first camera it's visible for
            // TODO: extend to support multiple cameras
            const camera = this.cameras[0];
            this.sort(camera._node);
            this.updateV1V2(camera);

            // we get new list of cameras each frame
            this.cameras.length = 0;
        }
    }

    updateV1V2(camera) {
        const device = this.splat.device;
        const scope = device.scope;

        scope.resolve('transformA').setValue(this.splat.transformATexture);
        scope.resolve('transformB').setValue(this.splat.transformBTexture);
        scope.resolve('transformC').setValue(this.splat.transformCTexture);

        const cameraMatrix = new Mat4();
        cameraMatrix.setTRS(camera._node.getPosition(), camera._node.getRotation(), Vec3.ONE);

        const viewMatrix = new Mat4();
        viewMatrix.invert(cameraMatrix);

        scope.resolve('matrix_model').setValue(this.meshInstance.node.worldTransform.data);
        scope.resolve('matrix_view').setValue(viewMatrix.data);
        scope.resolve('matrix_projection').setValue(camera.projectionMatrix.data);
        scope.resolve('viewport').setValue([device.width, device.height]);
        scope.resolve('bufferSize').setValue([this.v1v2Texture.width, this.v1v2Texture.height]);
        scope.resolve('tex_params').setValue([this.splat.numSplats, this.splat.numSplats, 1 / this.splat.numSplats, 1 / this.splat.numSplats]);

        drawQuadWithShader(device, this.v1v2RenderTarget, this.v1v2Shader);
    }
}

export { GSplatInstance };
