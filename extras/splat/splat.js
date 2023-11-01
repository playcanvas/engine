import {
    Material,
    MeshInstance,
    GraphicsDevice,
    Texture,
    FILTER_NEAREST,
    ADDRESS_CLAMP_TO_EDGE,
    Vec2,
    Quat,
    math,
    PIXELFORMAT_RGBA8,
    Mesh,
    Vec3,
    createBox,
    SEMANTIC_ATTR13,
    TYPE_FLOAT32,
    VertexFormat,
    TYPE_UINT32,
    BUFFER_DYNAMIC,
    VertexBuffer,
    PIXELFORMAT_RGBA16F,
    PIXELFORMAT_RGB32F,
    PIXELFORMAT_RGBA32F,
    FloatPacking
} from "playcanvas";
import { createSplatMaterial } from "./splat-material.js";

const floatView = new Float32Array(1);
const int32View = new Int32Array(floatView.buffer);

const evalTextureSize = (count) => {
    const width = Math.ceil(Math.sqrt(count));
    const height = Math.ceil(count / width);
    return new Vec2(width, height);
};

const createTexture = (device, name, format, size) => {
    return new Texture(device, {
        width: size.x,
        height: size.y,
        format: format,
        cubemap: false,
        mipmaps: false,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE,
        name: name
    });
};

const getTextureFormat = (device, preferHighPrecision) => {
    const halfFormat = (device.extTextureHalfFloat && device.textureHalfFloatUpdatable) ? PIXELFORMAT_RGBA16F : undefined;
    const half = halfFormat ? {
        format: halfFormat,
        numComponents: 4,
        isHalf: true
    } : undefined;

    const floatFormat = device.isWebGPU ? PIXELFORMAT_RGBA32F : (device.extTextureFloat ? PIXELFORMAT_RGB32F : undefined);
    const float = floatFormat ? {
        format: floatFormat,
        numComponents: floatFormat === PIXELFORMAT_RGBA32F ? 4 : 3,
        isHalf: false
    } : undefined;

    return preferHighPrecision ? (float ?? half) : (half ?? float);
};

class Splat {
    numSplats;

    material;

    mesh;

    meshInstance;

    format;

    colorTexture;

    scaleTexture;

    rotationTexture;

    centerTexture;

    constructor(device, numSplats, debugRender = false) {
        this.numSplats = numSplats;

        // material
        this.material = createSplatMaterial(device, debugRender);

        // mesh
        if (debugRender) {
            this.mesh = createBox(device, {
                halfExtents: new Vec3(1.0, 1.0, 1.0)
            });
        } else {
            this.mesh = new Mesh(device);
            this.mesh.setPositions(new Float32Array([
                -1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1
            ]), 2);
            this.mesh.update();
        }

        // mesh instance
        const vertexFormat = new VertexFormat(device, [
            { semantic: SEMANTIC_ATTR13, components: 1, type: device.isWebGPU ? TYPE_UINT32 : TYPE_FLOAT32 }
        ]);

        // initialize index data
        let indexData;
        if (device.isWebGPU) {
            indexData = new Uint32Array(numSplats);
            for (let i = 0; i < numSplats; ++i) {
                indexData[i] = i;
            }
        } else {
            indexData = new Float32Array(numSplats);
            for (let i = 0; i < numSplats; ++i) {
                indexData[i] = i + 0.2;
            }
        }

        const vertexBuffer = new VertexBuffer(
            device,
            vertexFormat,
            numSplats,
            BUFFER_DYNAMIC,
            indexData.buffer
        );

        this.meshInstance = new MeshInstance(this.mesh, this.material);
        this.meshInstance.setInstancing(vertexBuffer);

        // create data textures and fill
        const size = evalTextureSize(numSplats);

        this.format = getTextureFormat(device, false);
        this.colorTexture = createTexture(device, 'splatColor', PIXELFORMAT_RGBA8, size);
        this.scaleTexture = createTexture(device, 'splatScale', this.format.format, size);
        this.rotationTexture = createTexture(device, 'splatRotation', this.format.format, size);
        this.centerTexture = createTexture(device, 'splatCenter', this.format.format, size);

        this.material.setParameter('splatColor', this.colorTexture);
        this.material.setParameter('splatScale', this.scaleTexture);
        this.material.setParameter('splatRotation', this.rotationTexture);
        this.material.setParameter('splatCenter', this.centerTexture);
        this.material.setParameter('tex_params', new Float32Array([size.x, size.y, 1 / size.x, 1 / size.y]));
    }

    destroy() {
        this.colorTexture.destroy();
        this.scaleTexture.destroy();
        this.rotationTexture.destroy();
        this.centerTexture.destroy();
        this.material.destroy();
        this.mesh.destroy();
    }

    updateColorData(f_dc_0, f_dc_1, f_dc_2, opacity) {
        const SH_C0 = 0.28209479177387814;
        const texture = this.colorTexture;
        const data = texture.lock();

        const sigmoid = (v) => {
            if (v > 0) {
                return 1 / (1 + Math.exp(-v));
            }

            const t = Math.exp(v);
            return t / (1 + t);
        };

        for (let i = 0; i < this.numSplats; ++i) {

            // colors
            if (f_dc_0 && f_dc_1 && f_dc_2) {
                data[i * 4 + 0] = math.clamp((0.5 + SH_C0 * f_dc_0[i]) * 255, 0, 255);
                data[i * 4 + 1] = math.clamp((0.5 + SH_C0 * f_dc_1[i]) * 255, 0, 255);
                data[i * 4 + 2] = math.clamp((0.5 + SH_C0 * f_dc_2[i]) * 255, 0, 255);
            }

            // opacity
            data[i * 4 + 3] = opacity ? math.clamp(sigmoid(opacity[i]) * 255, 0, 255) : 255;
        }

        texture.unlock();
    }

    updateScaleData(scale_0, scale_1, scale_2) {
        const { numComponents, isHalf } = this.format;
        const texture = this.scaleTexture;
        const data = texture.lock();
        const float2Half = FloatPacking.float2Half;

        for (let i = 0; i < this.numSplats; i++) {

            const sx = Math.exp(scale_0[i]);
            const sy = Math.exp(scale_1[i]);
            const sz = Math.exp(scale_2[i]);

            if (isHalf) {
                data[i * numComponents + 0] = float2Half(sx);
                data[i * numComponents + 1] = float2Half(sy);
                data[i * numComponents + 2] = float2Half(sz);
            } else {
                data[i * numComponents + 0] = sx;
                data[i * numComponents + 1] = sy;
                data[i * numComponents + 2] = sz;
            }
        }

        texture.unlock();
    }

    updateRotationData(rot_0, rot_1, rot_2, rot_3) {
        const { numComponents, isHalf } = this.format;
        const quat = new Quat();

        const texture = this.rotationTexture;
        const data = texture.lock();
        const float2Half = FloatPacking.float2Half;

        for (let i = 0; i < this.numSplats; i++) {

            quat.set(rot_0[i], rot_1[i], rot_2[i], rot_3[i]).normalize();

            if (quat.w < 0) {
                quat.conjugate();
            }

            if (isHalf) {
                data[i * numComponents + 0] = float2Half(quat.x);
                data[i * numComponents + 1] = float2Half(quat.y);
                data[i * numComponents + 2] = float2Half(quat.z);
            } else {
                data[i * numComponents + 0] = quat.x;
                data[i * numComponents + 1] = quat.y;
                data[i * numComponents + 2] = quat.z;
            }
        }

        texture.unlock();
    }

    updateCenterData(x, y, z) {
        const { numComponents, isHalf } = this.format;

        const texture = this.centerTexture;
        const data = texture.lock();
        const float2Half = FloatPacking.float2Half;

        for (let i = 0; i < this.numSplats; i++) {

            if (isHalf) {
                data[i * numComponents + 0] = float2Half(x[i]);
                data[i * numComponents + 1] = float2Half(y[i]);
                data[i * numComponents + 2] = float2Half(z[i]);
            } else {
                data[i * numComponents + 0] = x[i];
                data[i * numComponents + 1] = y[i];
                data[i * numComponents + 2] = z[i];
            }
        }

        texture.unlock();
    }
}

export { Splat };
