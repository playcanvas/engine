import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BUFFER_STATIC, PIXELFORMAT_R32U, PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, SEMANTIC_ATTR13, SEMANTIC_POSITION, TYPE_UINT32 } from '../../platform/graphics/constants.js';
import { DITHER_NONE } from '../constants.js';
import { MeshInstance } from '../mesh-instance.js';
import { Mesh } from '../mesh.js';
import { createGSplatMaterial } from './gsplat-material.js';
import { GSplatSorter } from './gsplat-sorter.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { RenderPassShaderQuad } from '../graphics/render-pass-shader-quad.js';

// vertex shader
const v1v2VS = /* glsl */`

attribute vec2 aPosition;

void main(void) {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// fragment shader
const v1v2FS = /* glsl */`

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

    // TODO: these two 2d vectors could be stored in 3 floats instead of 4 as: angle, length1, length2
    vec2 v1 = min(sqrt(2.0 * lambda1), 1024.0) * diagonalVector;
    vec2 v2 = min(sqrt(2.0 * lambda2), 1024.0) * vec2(diagonalVector.y, -diagonalVector.x);

    return vec4(v1, v2);
}

uniform highp usampler2D splatOrder;
uniform highp sampler2D transformA;
uniform highp sampler2D transformB;
uniform highp sampler2D transformC;
uniform mediump sampler2D splatColor;

uniform mat4 matrix_model;
uniform mat4 matrix_view;
uniform mat4 matrix_projection;
uniform vec2 viewport;
uniform vec2 bufferSize;
uniform vec2 clipScale;

void main(void) {
    // calculate splatUV
    uint index = texelFetch(splatOrder, ivec2(gl_FragCoord.xy), 0).r;
    ivec2 splatUV = ivec2(
        int(index) % int(bufferSize.x),
        int(index) / int(bufferSize.x)
    );

    // read splat center and covariance
    vec4 tA = texelFetch(transformA, splatUV, 0);

    vec3 center = tA.xyz;
    mat4 modelView = matrix_view * matrix_model;
    vec4 centerView = modelView * vec4(center, 1.0);
    vec4 centerClip = matrix_projection * centerView;

    // calculate the bound of the splat in clip space for cull test
    vec3 centerBound = vec3(2.0 * clipScale * tA.w, 0.0);

    if (any(greaterThan(abs(centerClip.xyz) - centerBound, vec3(centerClip.w)))) {
        // TODO: on WebGPU it is quicker to clear the render target before rendering
        // and then discard fragments instead of writing black. On WebGL2 though, writing
        // black is faster so we keep it for now.
        pcFragColor0 = vec4(0.0);
        pcFragColor1 = vec4(0.0);
        pcFragColor2 = vec4(0.0);
    } else {
        vec4 tB = texelFetch(transformB, splatUV, 0);
        vec4 tC = texelFetch(transformC, splatUV, 0);
        vec3 covA = tB.xyz;
        vec3 covB = vec3(tB.w, tC.x, tC.y);

        float focal = viewport.x * matrix_projection[0][0];

        // calcV1V2
        pcFragColor0 = calcV1V2(
            centerView.xyz,
            covA,
            covB,
            focal,
            transpose(mat3(modelView))
        );

        pcFragColor1 = centerClip;
        pcFragColor2 = texelFetch(splatColor, splatUV, 0);
    }
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

    /** @type {import('../../platform/graphics/texture.js').Texture} */
    orderTexture;

    options = {};

    /** @type {import('../../platform/graphics/texture.js').Texture} */
    v1v2Texture;
    centerTexture;
    colorTexture;

    v1v2RenderTarget;
    v1v2RenderPass;

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

        const device = splat.device;

        // create the order texture
        this.orderTexture = this.splat.createTexture(
            'splatOrder',
            PIXELFORMAT_R32U,
            this.splat.evalTextureSize(this.splat.numSplats)
        );

        this.v1v2Texture = this.splat.createTexture(
            'splatV1V2',
            device.textureHalfFloatRenderable ? PIXELFORMAT_RGBA16F : PIXELFORMAT_RGBA32F,
            this.splat.evalTextureSize(this.splat.numSplats)
        );

        this.centerTexture = this.splat.createTexture(
            'centerTexture',
            device.textureHalfFloatRenderable ? PIXELFORMAT_RGBA16F : PIXELFORMAT_RGBA32F,
            this.splat.evalTextureSize(this.splat.numSplats)
        );

        this.colorTexture = this.splat.createTexture(
            'colorTexture',
            PIXELFORMAT_RGBA8,
            this.splat.evalTextureSize(this.splat.numSplats)
        );

        this.v1v2RenderTarget = new RenderTarget({
            name: 'splatV1V2RenderTarget',
            colorBuffers: [this.v1v2Texture, this.centerTexture, this.colorTexture],
            depth: false
        });

        // create v1v2 render pass
        const pass = new RenderPassShaderQuad(device);
        pass.shader = createShaderFromCode(device, v1v2VS, v1v2FS, 'v1v2Shader', { aPosition: SEMANTIC_POSITION });
        pass.init(this.v1v2RenderTarget);
        this.v1v2RenderPass = pass;

        // material
        this.createMaterial(options);

        // number of quads to combine into a single instance. this is to increase occupancy
        // in the vertex shader.
        const splatInstanceSize = 128;
        const numSplats = Math.ceil(splat.numSplats / splatInstanceSize) * splatInstanceSize;
        const numSplatInstances = numSplats / splatInstanceSize;

        // specify the base splat index per instance
        const indexData = new Uint32Array(numSplatInstances);
        for (let i = 0; i < numSplatInstances; ++i) {
            indexData[i] = i * splatInstanceSize;
        }

        const vertexFormat = new VertexFormat(device, [
            { semantic: SEMANTIC_ATTR13, components: 1, type: TYPE_UINT32, asInt: true }
        ]);

        const indicesVB = new VertexBuffer(device, vertexFormat, numSplatInstances, {
            usage: BUFFER_STATIC,
            data: indexData.buffer
        });

        // build the instance mesh
        const meshPositions = new Float32Array(12 * splatInstanceSize);
        const meshIndices = new Uint32Array(6 * splatInstanceSize);
        for (let i = 0; i < splatInstanceSize; ++i) {
            meshPositions.set([
                -2, -2, i,
                2, -2, i,
                2, 2, i,
                -2, 2, i
            ], i * 12);

            const b = i * 4;
            meshIndices.set([
                0 + b, 1 + b, 2 + b, 0 + b, 2 + b, 3 + b
            ], i * 6);
        }

        const mesh = new Mesh(device);
        mesh.setPositions(meshPositions, 3);
        mesh.setIndices(meshIndices);
        mesh.update();

        this.mesh = mesh;
        this.mesh.aabb.copy(splat.aabb);
        this.meshInstance = new MeshInstance(this.mesh, this.material);
        this.meshInstance.setInstancing(indicesVB, true);
        this.meshInstance.gsplatInstance = this;
        this.meshInstance.instancingCount = numSplatInstances;

        // clone centers to allow multiple instances of sorter
        this.centers = new Float32Array(splat.centers);

        // create sorter
        if (!options.dither || options.dither === DITHER_NONE) {
            this.sorter = new GSplatSorter();
            this.sorter.init(this.orderTexture, this.centers);
            this.sorter.on('updated', (count) => {
                // limit splat render count to exclude those behind the camera.
                // NOTE: the last instance rendered may include non-existant splat
                // data. this should be ok though. as the data is filled with 0's.
                this.meshInstance.instancingCount = Math.ceil(count / splatInstanceSize);

                // update preprocess buffer when sorting changes
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
        // this.material.setParameter('splatOrder', this.orderTexture);
        this.material.setParameter('v1v2Texture', this.v1v2Texture)
        this.material.setParameter('splatCenterOrdered', this.centerTexture);
        this.material.setParameter('splatColorOrdered', this.colorTexture);
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

        scope.resolve('splatColor').setValue(this.splat.colorTexture);
        scope.resolve('splatOrder').setValue(this.orderTexture);
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

        // calculate and set clipScale for frustum culling based on splat size
        const modelViewProjectionMatrix = new Mat4();
        modelViewProjectionMatrix.mul2(camera.projectionMatrix, viewMatrix);
        modelViewProjectionMatrix.mul(cameraMatrix);
        modelViewProjectionMatrix.transpose();

        scope.resolve('clipScale').setValue([
            modelViewProjectionMatrix.getX().length(),
            modelViewProjectionMatrix.getY().length(),
        ]);

        this.v1v2RenderPass.render();
    }
}

export { GSplatInstance };
