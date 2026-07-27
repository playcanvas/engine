import {
    AnimClip,
    AnimEvaluator,
    BoundingBox,
    DefaultAnimBinder,
    Mat4,
    SEMANTIC_BLENDINDICES,
    SEMANTIC_BLENDWEIGHT,
    Vec3
} from 'playcanvas';

import { VAT_TEXTURE_LIMIT, VAT_VERSION, vatTextureSize, writeContainer } from './vat-data.mjs';

/**
 * @import { AppBase, ContainerResource } from 'playcanvas'
 */

/**
 * The largest number of texels the VAT texture can hold, and so the largest value of
 * `vertexCount * frameCount` a character can be baked with. The vertices of a character are not
 * limited to a single texture dimension, so this trades off against the frame count - at 10 fps and
 * a couple of seconds of animation it allows several hundred thousand vertices.
 *
 * @type {number}
 */
export const VAT_MAX_TEXELS = VAT_TEXTURE_LIMIT * VAT_TEXTURE_LIMIT;

/**
 * @typedef {object} VatConvertOptions
 * @property {number} [fps] - The rate at which the animations are sampled, defaults to 10. Frames
 * are interpolated at runtime, so a low rate is usually enough.
 * @property {boolean} [embedAlbedo] - Embeds the base color texture of the material in the
 * generated file, so it is fully self contained. Defaults to true.
 * @property {number} [albedoMaxSize] - The largest size the embedded base color texture is resized
 * to, defaults to 1024.
 * @property {number} [albedoQuality] - The jpeg quality the embedded base color texture is encoded
 * with, defaults to 0.9.
 * @property {boolean} [normalize] - Scales and offsets the character to be one unit tall and
 * centered on the origin, with its feet at y = 0. Defaults to true.
 */

/**
 * Encodes a unit vector into its octahedral representation, two values in the -1..1 range. See
 * `octDecode` in `vat-data.mjs` for the inverse.
 *
 * @param {number} x - The x component of the normal.
 * @param {number} y - The y component of the normal.
 * @param {number} z - The z component of the normal.
 * @returns {number[]} The two encoded components.
 * @ignore
 */
function octEncode(x, y, z) {
    const l1 = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1;
    let ex = x / l1;
    let ey = y / l1;
    if (z < 0) {
        const sx = ex >= 0 ? 1 : -1;
        const sy = ey >= 0 ? 1 : -1;
        const fx = (1 - Math.abs(ey)) * sx;
        const fy = (1 - Math.abs(ex)) * sy;
        ex = fx;
        ey = fy;
    }
    return [ex, ey];
}

/**
 * Quantizes a -1..1 value to a byte.
 *
 * @param {number} value - The value to quantize.
 * @returns {number} The quantized value.
 * @ignore
 */
const toByte = value => Math.max(0, Math.min(255, Math.round((value * 0.5 + 0.5) * 255)));

/**
 * Converts the animations of a skinned glb into a VAT (Vertex Animation Texture), returned as the
 * binary container `vat-data.mjs` parses. The skinned position and normal of every vertex is
 * evaluated on the CPU for each sampled frame and stored in an RGBA16U texture, one texel per vertex
 * per frame. A texel holds the whole vertex for that frame - the position quantized to 16 bits per
 * axis over the bounds of the animation in xyz, and the normal octahedrally encoded into two bytes
 * packed into w. The texels are addressed by the flat index `vertex * frameCount + frame`, wrapped
 * at the power of two width of the texture, so the vertex count is bounded by the total number of
 * texels rather than by a single texture dimension.
 *
 * All animations are assumed to loop, and so the first frame of each animation is duplicated after
 * its last one, which allows the final frame to be interpolated back towards the start of the loop.
 *
 * The container mirrors the layout of a glb: a header, a json chunk describing the content, and a
 * binary chunk holding the texture, the mesh and the optional base color image. Like a glb it is
 * stored uncompressed and left to the transport to compress - see `parseVat`.
 *
 * @param {AppBase} app - The application.
 * @param {ContainerResource} container - The resource of a loaded glb container asset.
 * @param {VatConvertOptions} [options] - The conversion options.
 * @returns {Promise<ArrayBuffer>} The generated container.
 */
export async function convertToVat(app, container, options = {}) {

    const {
        fps = 10,
        embedAlbedo = true,
        albedoMaxSize = 1024,
        albedoQuality = 0.9,
        normalize = true
    } = options;

    const device = app.graphicsDevice;

    // the whole character has to be a single mesh, as it is rendered with a single instanced draw
    const meshes = container.renders.map(render => render.resource.meshes).flat();
    if (meshes.length !== 1) {
        throw new Error(`The glb contains ${meshes.length} meshes, but exactly one is required.`);
    }

    const vertexCount = meshes[0].vertexBuffer.numVertices;

    const tracks = container.animations.map(animation => animation.resource);
    if (tracks.length === 0) {
        throw new Error('The glb does not contain any animations.');
    }

    // work out the layout of the texture - each animation stores one extra frame, holding a copy of
    // its first frame, so the last frame can be interpolated towards the start of the loop
    const animations = [];
    let frameCount = 0;
    tracks.forEach((track) => {
        const duration = track.duration > 0 ? track.duration : 1 / fps;
        const frames = Math.max(1, Math.round(duration * fps));
        animations.push({
            name: track.name,
            frameStart: frameCount,
            frameCount: frames,
            duration: duration
        });
        frameCount += frames + 1;
    });

    // the frames of a vertex are stored consecutively and wrap at the end of a row, so only the
    // total number of texels is bounded
    const { width, height } = vatTextureSize(vertexCount, frameCount);
    if (height > VAT_TEXTURE_LIMIT) {
        const maxVertices = Math.floor(VAT_MAX_TEXELS / frameCount);
        throw new Error(`The mesh has ${vertexCount} vertices, but at ${frameCount} sampled frames at most ${maxVertices} are supported.`);
    }
    if (width > device.maxTextureSize || height > device.maxTextureSize) {
        throw new Error(`The animations need a ${width}x${height} texture, but the device supports at most ${device.maxTextureSize}.`);
    }

    // instantiate the character so its animations can be evaluated
    const entity = container.instantiateRenderEntity();
    app.root.addChild(entity);

    let data;
    try {
        data = sampleAnimations(entity, tracks, { vertexCount, animations, frameCount, width, height, fps, normalize });
    } finally {
        entity.destroy();
    }

    // optionally embed the base color texture of the material
    let albedo = null;
    if (embedAlbedo) {
        albedo = await encodeAlbedo(container, albedoMaxSize, albedoQuality);
    }

    return assemble(data, albedo);
}

/**
 * Evaluates the animations of the instantiated character and bakes the skinned vertices into the
 * texture data.
 *
 * @param {import('playcanvas').Entity} entity - The instantiated character.
 * @param {import('playcanvas').AnimTrack[]} tracks - The animation tracks of the glb.
 * @param {object} layout - The texture layout worked out by {@link convertToVat}.
 * @returns {object} The generated data.
 * @ignore
 */
function sampleAnimations(entity, tracks, layout) {

    const { vertexCount, animations, frameCount, width, height, fps, normalize } = layout;

    const meshInstance = entity.findComponents('render')
    .map(render => render.meshInstances)
    .flat()
    .find(instance => instance.mesh.skin);

    if (!meshInstance?.skinInstance) {
        throw new Error('The mesh of the glb is not skinned.');
    }

    const mesh = meshInstance.mesh;

    // vertex data of the rest pose
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    /** @type {number[]} */
    const boneIndices = [];
    /** @type {number[]} */
    const boneWeights = [];
    mesh.getPositions(positions);
    mesh.getNormals(normals);
    mesh.getUvs(0, uvs);
    mesh.getVertexStream(SEMANTIC_BLENDINDICES, boneIndices);
    mesh.getVertexStream(SEMANTIC_BLENDWEIGHT, boneWeights);

    const indexCount = mesh.primitive[0].count;
    const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
    mesh.getIndices(indices);

    // sampled positions are kept as floats, as the range they are quantized over is only known once
    // every frame has been evaluated
    const sampledPositions = new Float32Array(frameCount * vertexCount * 3);
    const vat = new Uint16Array(width * height * 4);

    const skinInstance = meshInstance.skinInstance;
    const boneCount = skinInstance.bones.length;
    const boneMatrices = [];
    for (let i = 0; i < boneCount; i++) {
        boneMatrices.push(new Mat4());
    }

    const min = new Vec3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    const max = new Vec3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);

    const evaluator = new AnimEvaluator(new DefaultAnimBinder(entity));
    let skinUpdateIndex = 0;

    animations.forEach((animation, animationIndex) => {

        const clip = new AnimClip(tracks[animationIndex], 0, 1, true, true);
        evaluator.addClip(clip);

        for (let frame = 0; frame <= animation.frameCount; frame++) {

            // the extra frame at the end is a copy of the first frame of the loop
            const loopedFrame = frame % animation.frameCount;
            clip.time = loopedFrame * animation.duration / animation.frameCount;

            // apply the animation to the hierarchy and evaluate the bone matrices
            evaluator.update(0);
            entity.syncHierarchy();
            skinInstance.updateMatrixPalette(meshInstance.node, ++skinUpdateIndex);

            // the skinning matrices are relative to the node of the mesh instance, so fold its
            // world transform in, matching what the engine does in the vertex shader
            const nodeWorld = meshInstance.node.getWorldTransform();
            for (let i = 0; i < boneCount; i++) {
                boneMatrices[i].mul2(nodeWorld, skinInstance.matrices[i]);
            }

            const column = animation.frameStart + frame;
            const frameOffset = column * vertexCount * 3;

            for (let v = 0; v < vertexCount; v++) {

                const px = positions[v * 3];
                const py = positions[v * 3 + 1];
                const pz = positions[v * 3 + 2];
                const nx = normals[v * 3];
                const ny = normals[v * 3 + 1];
                const nz = normals[v * 3 + 2];

                let sx = 0, sy = 0, sz = 0;
                let tx = 0, ty = 0, tz = 0;

                for (let b = 0; b < 4; b++) {
                    const weight = boneWeights[v * 4 + b];
                    if (weight === 0) {
                        continue;
                    }

                    const m = boneMatrices[boneIndices[v * 4 + b]].data;

                    sx += weight * (m[0] * px + m[4] * py + m[8] * pz + m[12]);
                    sy += weight * (m[1] * px + m[5] * py + m[9] * pz + m[13]);
                    sz += weight * (m[2] * px + m[6] * py + m[10] * pz + m[14]);

                    tx += weight * (m[0] * nx + m[4] * ny + m[8] * nz);
                    ty += weight * (m[1] * nx + m[5] * ny + m[9] * nz);
                    tz += weight * (m[2] * nx + m[6] * ny + m[10] * nz);
                }

                sampledPositions[frameOffset + v * 3] = sx;
                sampledPositions[frameOffset + v * 3 + 1] = sy;
                sampledPositions[frameOffset + v * 3 + 2] = sz;

                min.x = Math.min(min.x, sx); max.x = Math.max(max.x, sx);
                min.y = Math.min(min.y, sy); max.y = Math.max(max.y, sy);
                min.z = Math.min(min.z, sz); max.z = Math.max(max.z, sz);

                // normals are not affected by the normalization below, so pack them right away -
                // octahedral in two bytes, which is under a degree of error
                const length = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
                const encoded = octEncode(tx / length, ty / length, tz / length);
                vat[(v * frameCount + column) * 4 + 3] = toByte(encoded[0]) | (toByte(encoded[1]) << 8);
            }
        }

        evaluator.removeClips();
    });

    // optionally make the character one unit tall, standing on the origin
    let scale = 1;
    const offset = [0, 0, 0];
    if (normalize) {
        scale = 1 / Math.max(max.y - min.y, 1e-6);
        offset[0] = -(min.x + max.x) * 0.5;
        offset[1] = -min.y;
        offset[2] = -(min.z + max.z) * 0.5;
    }

    // the bounds the positions are quantized over, which is also what the shader dequantizes with
    const bounds = new BoundingBox();
    bounds.setMinMax(
        new Vec3((min.x + offset[0]) * scale, (min.y + offset[1]) * scale, (min.z + offset[2]) * scale),
        new Vec3((max.x + offset[0]) * scale, (max.y + offset[1]) * scale, (max.z + offset[2]) * scale)
    );

    const boundsMin = [bounds.getMin().x, bounds.getMin().y, bounds.getMin().z];
    const boundsSize = [
        Math.max(bounds.halfExtents.x * 2, 1e-6),
        Math.max(bounds.halfExtents.y * 2, 1e-6),
        Math.max(bounds.halfExtents.z * 2, 1e-6)
    ];

    for (let frame = 0; frame < frameCount; frame++) {
        const frameOffset = frame * vertexCount * 3;
        for (let v = 0; v < vertexCount; v++) {
            const texel = (v * frameCount + frame) * 4;
            for (let c = 0; c < 3; c++) {
                const value = (sampledPositions[frameOffset + v * 3 + c] + offset[c]) * scale;
                const quantized = Math.round(((value - boundsMin[c]) / boundsSize[c]) * 65535);
                vat[texel + c] = Math.max(0, Math.min(65535, quantized));
            }
        }
    }

    return { vertexCount, frameCount, width, height, fps, animations, bounds, vat, indices, uvs };
}

/**
 * Resizes and encodes the base color texture of the character as a jpeg.
 *
 * @param {ContainerResource} container - The container resource.
 * @param {number} maxSize - The largest size the texture is resized to.
 * @param {number} quality - The jpeg encoding quality.
 * @returns {Promise<{ mimeType: string, data: Uint8Array }|null>} The encoded image.
 * @ignore
 */
async function encodeAlbedo(container, maxSize, quality) {

    const texture = container.materials?.[0]?.resource?.diffuseMap;
    const source = texture?.getSource();
    if (!source) {
        return null;
    }

    const largest = Math.max(source.width, source.height);
    const factor = Math.min(1, maxSize / largest);

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(source.width * factor));
    canvas.height = Math.max(1, Math.round(source.height * factor));
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', quality);
    });
    return {
        mimeType: 'image/jpeg',
        data: new Uint8Array(await blob.arrayBuffer())
    };
}

/**
 * Packs the generated buffers into the binary chunk of the container and builds the json chunk
 * describing it.
 *
 * @param {object} data - The data generated by {@link sampleAnimations}.
 * @param {{ mimeType: string, data: Uint8Array }|null} albedo - The encoded base color image.
 * @returns {ArrayBuffer} The container.
 * @ignore
 */
function assemble(data, albedo) {

    const chunks = [
        { name: 'vat', bytes: new Uint8Array(data.vat.buffer, data.vat.byteOffset, data.vat.byteLength) },
        { name: 'indices', bytes: new Uint8Array(data.indices.buffer, data.indices.byteOffset, data.indices.byteLength) },
        { name: 'uvs', bytes: new Uint8Array(data.uvs.buffer, data.uvs.byteOffset, data.uvs.byteLength) }
    ];
    if (albedo) {
        chunks.push({ name: 'albedo', bytes: albedo.data });
    }

    // lay the chunks out one after the other, keeping each of them 4 byte aligned
    let byteLength = 0;
    chunks.forEach((chunk) => {
        chunk.byteOffset = byteLength;
        byteLength += (chunk.bytes.byteLength + 3) & ~3;
    });

    const binary = new Uint8Array(byteLength);
    chunks.forEach((chunk) => {
        binary.set(chunk.bytes, chunk.byteOffset);
    });

    const accessor = (name) => {
        const chunk = chunks.find(entry => entry.name === name);
        return { byteOffset: chunk.byteOffset, byteLength: chunk.bytes.byteLength };
    };

    const json = {
        version: VAT_VERSION,
        generator: 'PlayCanvas VAT converter',
        fps: data.fps,
        vertexCount: data.vertexCount,
        frameCount: data.frameCount,
        texture: {
            width: data.width,
            height: data.height,
            format: 'rgba16u',

            // xyz: position quantized over bounds, w: octahedral normal packed into two bytes,
            // addressed by the flat index (vertex * frameCount + frame) wrapped at the width
            layout: 'quant16'
        },
        bounds: {
            min: [data.bounds.getMin().x, data.bounds.getMin().y, data.bounds.getMin().z],
            max: [data.bounds.getMax().x, data.bounds.getMax().y, data.bounds.getMax().z]
        },
        animations: data.animations,
        binary: {
            byteLength: byteLength
        },
        vat: accessor('vat'),
        indices: {
            ...accessor('indices'),
            type: data.indices instanceof Uint32Array ? 'uint32' : 'uint16',
            count: data.indices.length
        },
        uvs: accessor('uvs'),
        albedo: albedo ? { ...accessor('albedo'), mimeType: albedo.mimeType } : undefined
    };

    return writeContainer(json, binary);
}

/**
 * Saves a generated VAT container as a file download.
 *
 * @param {ArrayBuffer} container - The container.
 * @param {string} filename - The name of the file to save.
 */
export function saveVat(container, filename) {
    const url = URL.createObjectURL(new Blob([container], { type: 'application/octet-stream' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
