import { Debug } from '../../core/debug.js';
import { path } from '../../core/path.js';
import { Mat4 } from '../../core/math/mat4.js';
import { math } from '../../core/math/math.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';

import {
    typedArrayTypes, typedArrayTypesByteSize,
    ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT,
    BUFFER_STATIC,
    CULLFACE_NONE, CULLFACE_BACK,
    FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR,
    INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32,
    SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT,
    SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7,
    TYPE_FLOAT32
} from '../../platform/graphics/constants.js';
import { IndexBuffer } from '../../platform/graphics/index-buffer.js';
import { Texture } from '../../platform/graphics/texture.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { http } from '../../platform/net/http.js';

import {
    BLEND_NONE, BLEND_NORMAL,
    PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE,
    ASPECT_MANUAL, ASPECT_AUTO, SPECOCC_AO
} from '../../scene/constants.js';
import { GraphNode } from '../../scene/graph-node.js';
import { Mesh } from '../../scene/mesh.js';
import { Morph } from '../../scene/morph.js';
import { MorphTarget } from '../../scene/morph-target.js';
import { calculateNormals } from '../../scene/geometry/geometry-utils.js';
import { Render } from '../../scene/render.js';
import { Skin } from '../../scene/skin.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';

import { Entity } from '../entity.js';
import { INTERPOLATION_CUBIC, INTERPOLATION_LINEAR, INTERPOLATION_STEP } from '../anim/constants.js';
import { AnimCurve } from '../anim/evaluator/anim-curve.js';
import { AnimData } from '../anim/evaluator/anim-data.js';
import { AnimTrack } from '../anim/evaluator/anim-track.js';
import { Asset } from '../asset/asset.js';
import { ABSOLUTE_URL } from '../asset/constants.js';

import { createInstancing } from './glb/extensions/ext-mesh-gpu-instancing.js';
import { createDracoMesh } from './glb/extensions/khr-draco-mesh-compression.js';
import { createLights } from './glb/extensions/khr-lights-punctual.js';
import { createVariants, registerMeshVariants } from './glb/extensions/khr-materials-variants.js';
import { getTextureSource } from './glb/extensions/texture-source.js';
import { glbMaterialExtensions } from './glb/extensions/index.js';
import { extractTextureTransform } from './glb/extensions/khr-texture-transform.js';
import { GltfAccessor, getPrimitiveType, gltfToEngineSemanticMap } from './glb/gltf-accessor.js';

// resources loaded from GLB file that the parser returns
class GlbResources {
    gltf;

    nodes;

    scenes;

    animations;

    textures;

    materials;

    variants;

    meshVariants;

    meshDefaultMaterials;

    renders;

    skins;

    lights;

    cameras;

    nodeInstancingMap;

    destroy() {
        // render needs to dec ref meshes
        if (this.renders) {
            this.renders.forEach((render) => {
                render.meshes = null;
            });
        }
    }
}

const isDataURI = (uri) => {
    return /^data:[^\n\r,\u2028\u2029]*,.*$/i.test(uri);
};

const getDataURIMimeType = (uri) => {
    return uri.substring(uri.indexOf(':') + 1, uri.indexOf(';'));
};

// order vertexDesc to match the rest of the engine
const attributeOrder = {
    [SEMANTIC_POSITION]: 0,
    [SEMANTIC_NORMAL]: 1,
    [SEMANTIC_TANGENT]: 2,
    [SEMANTIC_COLOR]: 3,
    [SEMANTIC_BLENDINDICES]: 4,
    [SEMANTIC_BLENDWEIGHT]: 5,
    [SEMANTIC_TEXCOORD0]: 6,
    [SEMANTIC_TEXCOORD1]: 7,
    [SEMANTIC_TEXCOORD2]: 8,
    [SEMANTIC_TEXCOORD3]: 9,
    [SEMANTIC_TEXCOORD4]: 10,
    [SEMANTIC_TEXCOORD5]: 11,
    [SEMANTIC_TEXCOORD6]: 12,
    [SEMANTIC_TEXCOORD7]: 13
};

const generateIndices = (numVertices) => {
    const dummyIndices = new Uint16Array(numVertices);
    for (let i = 0; i < numVertices; i++) {
        dummyIndices[i] = i;
    }
    return dummyIndices;
};

const generateNormals = (sourceDesc, indices) => {
    // get positions
    const p = sourceDesc[SEMANTIC_POSITION];
    if (!p || p.components !== 3) {
        return;
    }

    let positions;
    if (p.size !== p.stride) {
        // extract positions which aren't tightly packed
        const srcStride = p.stride / typedArrayTypesByteSize[p.type];
        const src = new typedArrayTypes[p.type](p.buffer, p.offset, p.count * srcStride);
        positions = new typedArrayTypes[p.type](p.count * 3);
        for (let i = 0; i < p.count; ++i) {
            positions[i * 3 + 0] = src[i * srcStride + 0];
            positions[i * 3 + 1] = src[i * srcStride + 1];
            positions[i * 3 + 2] = src[i * srcStride + 2];
        }
    } else {
        // position data is tightly packed so we can use it directly
        positions = new typedArrayTypes[p.type](p.buffer, p.offset, p.count * 3);
    }

    const numVertices = p.count;

    // generate indices if necessary
    if (!indices) {
        indices = generateIndices(numVertices);
    }

    // generate normals
    const normalsTemp = calculateNormals(positions, indices);
    const normals = new Float32Array(normalsTemp.length);
    normals.set(normalsTemp);

    sourceDesc[SEMANTIC_NORMAL] = {
        buffer: normals.buffer,
        size: 12,
        offset: 0,
        stride: 12,
        count: numVertices,
        components: 3,
        type: TYPE_FLOAT32
    };
};

// given a texture, clone it
// NOTE: CPU-side texture data will be shared but GPU memory will be duplicated
const cloneTexture = (texture) => {
    const shallowCopyLevels = (texture) => {
        const result = [];
        for (let mip = 0; mip < texture._levels.length; ++mip) {
            let level = [];
            if (texture.cubemap) {
                for (let face = 0; face < 6; ++face) {
                    level.push(texture._levels[mip][face]);
                }
            } else {
                level = texture._levels[mip];
            }
            result.push(level);
        }
        return result;
    };

    const result = new Texture(texture.device, texture);   // duplicate texture
    result._levels = shallowCopyLevels(texture);            // shallow copy the levels structure
    return result;
};

// given a texture asset, clone it
const cloneTextureAsset = (src) => {
    const result = new Asset(`${src.name}_clone`,
        src.type,
        src.file,
        src.data,
        src.options);
    result.loaded = true;
    result.resource = cloneTexture(src.resource);
    src.registry.add(result);
    return result;
};

const createVertexBufferInternal = (device, sourceDesc) => {
    const positionDesc = sourceDesc[SEMANTIC_POSITION];
    if (!positionDesc) {
        // ignore meshes without positions
        return null;
    }
    const numVertices = positionDesc.count;

    // generate vertexDesc elements
    const vertexDesc = [];
    for (const semantic in sourceDesc) {
        if (sourceDesc.hasOwnProperty(semantic)) {
            const element = {
                semantic: semantic,
                components: sourceDesc[semantic].components,
                type: sourceDesc[semantic].type,
                normalize: !!sourceDesc[semantic].normalize
            };

            if (!VertexFormat.isElementValid(device, element)) {
                // WebGP does not support some formats and we need to remap it to one larger, for example int16x3 -> int16x4
                // TODO: this might need the actual data changes if this element is the last one in the vertex, as it might
                // try to read outside of the vertex buffer.
                element.components++;
            }
            vertexDesc.push(element);
        }
    }

    // sort vertex elements by engine-ideal order
    vertexDesc.sort((lhs, rhs) => {
        return attributeOrder[lhs.semantic] - attributeOrder[rhs.semantic];
    });

    let i, j, k;
    let source, target, sourceOffset;

    const vertexFormat = new VertexFormat(device, vertexDesc);

    // check whether source data is correctly interleaved
    let isCorrectlyInterleaved = true;
    for (i = 0; i < vertexFormat.elements.length; ++i) {
        target = vertexFormat.elements[i];
        source = sourceDesc[target.name];
        sourceOffset = source.offset - positionDesc.offset;
        if ((source.buffer !== positionDesc.buffer) ||
            (source.stride !== target.stride) ||
            (source.size !== target.size) ||
            (sourceOffset !== target.offset)) {
            isCorrectlyInterleaved = false;
            break;
        }
    }

    // create vertex buffer
    const vertexBuffer = new VertexBuffer(device, vertexFormat, numVertices);

    const vertexData = vertexBuffer.lock();
    const targetArray = new Uint32Array(vertexData);
    let sourceArray;

    if (isCorrectlyInterleaved) {
        // copy data
        sourceArray = new Uint32Array(positionDesc.buffer,
            positionDesc.offset,
            numVertices * vertexBuffer.format.size / 4);
        targetArray.set(sourceArray);
    } else {
        let targetStride, sourceStride;
        // copy data and interleave
        for (i = 0; i < vertexBuffer.format.elements.length; ++i) {
            target = vertexBuffer.format.elements[i];
            targetStride = target.stride / 4;

            source = sourceDesc[target.name];
            sourceStride = source.stride / 4;
            // ensure we don't go beyond the end of the arraybuffer when dealing with
            // interlaced vertex formats
            sourceArray = new Uint32Array(source.buffer, source.offset, (source.count - 1) * sourceStride + (source.size + 3) / 4);

            let src = 0;
            let dst = target.offset / 4;
            const kend = Math.floor((source.size + 3) / 4);
            for (j = 0; j < numVertices; ++j) {
                for (k = 0; k < kend; ++k) {
                    targetArray[dst + k] = sourceArray[src + k];
                }
                src += sourceStride;
                dst += targetStride;
            }
        }
    }

    vertexBuffer.unlock();

    return vertexBuffer;
};

const createVertexBuffer = (device, attributes, indices, accessors, bufferViews, vertexBufferDict) => {

    // extract list of attributes to use
    const useAttributes = {};
    const attribIds = [];

    for (const attrib in attributes) {
        if (attributes.hasOwnProperty(attrib) && gltfToEngineSemanticMap.hasOwnProperty(attrib)) {
            useAttributes[attrib] = attributes[attrib];

            // build unique id for each attribute in format: Semantic:accessorIndex
            attribIds.push(`${attrib}:${attributes[attrib]}`);
        }
    }

    // sort unique ids and create unique vertex buffer ID
    attribIds.sort();
    const vbKey = attribIds.join();

    // return already created vertex buffer if identical
    let vb = vertexBufferDict[vbKey];
    if (!vb) {
        // build vertex buffer format desc and source
        const sourceDesc = {};
        for (const attrib in useAttributes) {
            const accessor = accessors[attributes[attrib]];
            const accessorData = GltfAccessor.getData(accessor, bufferViews);
            const bufferView = bufferViews[accessor.bufferView];
            const semantic = gltfToEngineSemanticMap[attrib];
            const size = GltfAccessor.getNumComponents(accessor.type) * GltfAccessor.getComponentSizeInBytes(accessor.componentType);
            const stride = bufferView && bufferView.hasOwnProperty('byteStride') ? bufferView.byteStride : size;
            sourceDesc[semantic] = {
                buffer: accessorData.buffer,
                size: size,
                offset: accessorData.byteOffset,
                stride: stride,
                count: accessor.count,
                components: GltfAccessor.getNumComponents(accessor.type),
                type: GltfAccessor.getComponentType(accessor.componentType),
                normalize: accessor.normalized
            };
        }

        // generate normals if they're missing (this should probably be a user option)
        if (!sourceDesc.hasOwnProperty(SEMANTIC_NORMAL)) {
            generateNormals(sourceDesc, indices);
        }

        // create and store it in the dictionary
        vb = createVertexBufferInternal(device, sourceDesc);
        vertexBufferDict[vbKey] = vb;
    }

    return vb;
};

const createSkin = (device, gltfSkin, accessors, bufferViews, nodes, glbSkins) => {
    let i, j, bindMatrix;
    const joints = gltfSkin.joints;
    const numJoints = joints.length;
    const ibp = [];
    if (gltfSkin.hasOwnProperty('inverseBindMatrices')) {
        const inverseBindMatrices = gltfSkin.inverseBindMatrices;
        const ibmData = GltfAccessor.getData(accessors[inverseBindMatrices], bufferViews, true);
        const ibmValues = [];

        for (i = 0; i < numJoints; i++) {
            for (j = 0; j < 16; j++) {
                ibmValues[j] = ibmData[i * 16 + j];
            }
            bindMatrix = new Mat4();
            bindMatrix.set(ibmValues);
            ibp.push(bindMatrix);
        }
    } else {
        for (i = 0; i < numJoints; i++) {
            bindMatrix = new Mat4();
            ibp.push(bindMatrix);
        }
    }

    const boneNames = [];
    for (i = 0; i < numJoints; i++) {
        boneNames[i] = nodes[joints[i]].name;
    }

    // create a cache key from bone names and see if we have matching skin
    const key = boneNames.join('#');
    let skin = glbSkins.get(key);
    if (!skin) {

        // create the skin and add it to the cache
        skin = new Skin(device, ibp, boneNames);
        glbSkins.set(key, skin);
    }

    return skin;
};

const createMesh = (device, gltfMesh, accessors, bufferViews, vertexBufferDict, meshVariants, meshDefaultMaterials, assetOptions, promises) => {
    const meshes = [];

    gltfMesh.primitives.forEach((primitive) => {

        if (primitive.extensions?.KHR_draco_mesh_compression) {
            // handle draco compressed mesh
            meshes.push(createDracoMesh(device, primitive, accessors, bufferViews, meshVariants, meshDefaultMaterials, promises));
        } else {
            // handle uncompressed mesh
            let indices = primitive.hasOwnProperty('indices') ? GltfAccessor.getData(accessors[primitive.indices], bufferViews, true) : null;
            const vertexBuffer = createVertexBuffer(device, primitive.attributes, indices, accessors, bufferViews, vertexBufferDict);
            const primitiveType = getPrimitiveType(primitive);

            // build the mesh
            const mesh = new Mesh(device);
            mesh.vertexBuffer = vertexBuffer;
            mesh.primitive[0].type = primitiveType;
            mesh.primitive[0].base = 0;
            mesh.primitive[0].indexed = (indices !== null);

            // index buffer
            if (indices !== null) {
                let indexFormat;
                if (indices instanceof Uint8Array) {
                    indexFormat = INDEXFORMAT_UINT8;
                } else if (indices instanceof Uint16Array) {
                    indexFormat = INDEXFORMAT_UINT16;
                } else {
                    indexFormat = INDEXFORMAT_UINT32;
                }

                if (indexFormat === INDEXFORMAT_UINT8 && device.isWebGPU) {
                    // silently convert to 16bit
                    indexFormat = INDEXFORMAT_UINT16;
                    indices = new Uint16Array(indices);
                }

                const indexBuffer = new IndexBuffer(device, indexFormat, indices.length, BUFFER_STATIC, indices);
                mesh.indexBuffer[0] = indexBuffer;
                mesh.primitive[0].count = indices.length;
            } else {
                mesh.primitive[0].count = vertexBuffer.numVertices;
            }

            // handle material variants
            registerMeshVariants(primitive, mesh.id, meshVariants);

            meshDefaultMaterials[mesh.id] = primitive.material;

            let accessor = accessors[primitive.attributes.POSITION];
            mesh.aabb = GltfAccessor.getBoundingBox(accessor);

            // morph targets
            if (primitive.hasOwnProperty('targets')) {
                const targets = [];

                primitive.targets.forEach((target, index) => {
                    const options = {};

                    if (target.hasOwnProperty('POSITION')) {
                        accessor = accessors[target.POSITION];
                        options.deltaPositions = GltfAccessor.getDataFloat32(accessor, bufferViews);
                        options.aabb = GltfAccessor.getBoundingBox(accessor);
                    }

                    if (target.hasOwnProperty('NORMAL')) {
                        accessor = accessors[target.NORMAL];
                        // NOTE: the morph targets can't currently accept quantized normals
                        options.deltaNormals = GltfAccessor.getDataFloat32(accessor, bufferViews);
                    }

                    // name if specified
                    if (gltfMesh.hasOwnProperty('extras') &&
                        gltfMesh.extras.hasOwnProperty('targetNames')) {
                        options.name = gltfMesh.extras.targetNames[index];
                    } else {
                        options.name = index.toString(10);
                    }

                    // default weight if specified
                    if (gltfMesh.hasOwnProperty('weights')) {
                        options.defaultWeight = gltfMesh.weights[index];
                    }

                    options.preserveData = assetOptions.morphPreserveData;
                    targets.push(new MorphTarget(options));
                });

                mesh.morph = new Morph(targets, device, {
                    preferHighPrecision: assetOptions.morphPreferHighPrecision
                });
            }
            meshes.push(mesh);
        }
    });

    return meshes;
};

const createMaterial = (gltfMaterial, textures) => {
    const material = new StandardMaterial();

    if (gltfMaterial.hasOwnProperty('name')) {
        material.name = gltfMaterial.name;
    }

    // glTF doesn't define how to occlude specular
    material.occludeSpecular = SPECOCC_AO;

    material.diffuseVertexColor = true;
    material.specularTint = true;
    material.specularVertexColor = true;

    // Set glTF spec defaults
    material.specular.set(1, 1, 1);
    material.gloss = 1;
    material.glossInvert = true;
    material.useMetalness = true;

    let texture;
    if (gltfMaterial.hasOwnProperty('pbrMetallicRoughness')) {
        const pbrData = gltfMaterial.pbrMetallicRoughness;

        if (pbrData.hasOwnProperty('baseColorFactor')) {
            const [r, g, b, a] = pbrData.baseColorFactor;
            material.diffuse.set(r, g, b).gamma();
            material.opacity = a;
        }
        if (pbrData.hasOwnProperty('baseColorTexture')) {
            const baseColorTexture = pbrData.baseColorTexture;
            texture = textures[baseColorTexture.index];

            material.diffuseMap = texture;
            material.diffuseMapChannel = 'rgb';
            material.opacityMap = texture;
            material.opacityMapChannel = 'a';

            extractTextureTransform(baseColorTexture, material, ['diffuse', 'opacity']);
        }
        if (pbrData.hasOwnProperty('metallicFactor')) {
            material.metalness = pbrData.metallicFactor;
        }
        if (pbrData.hasOwnProperty('roughnessFactor')) {
            material.gloss = pbrData.roughnessFactor;
        }
        if (pbrData.hasOwnProperty('metallicRoughnessTexture')) {
            const metallicRoughnessTexture = pbrData.metallicRoughnessTexture;
            material.metalnessMap = material.glossMap = textures[metallicRoughnessTexture.index];
            material.metalnessMapChannel = 'b';
            material.glossMapChannel = 'g';

            extractTextureTransform(metallicRoughnessTexture, material, ['gloss', 'metalness']);
        }
    }

    if (gltfMaterial.hasOwnProperty('normalTexture')) {
        const normalTexture = gltfMaterial.normalTexture;
        material.normalMap = textures[normalTexture.index];

        extractTextureTransform(normalTexture, material, ['normal']);

        if (normalTexture.hasOwnProperty('scale')) {
            material.bumpiness = normalTexture.scale;
        }
    }

    if (gltfMaterial.hasOwnProperty('occlusionTexture')) {
        const occlusionTexture = gltfMaterial.occlusionTexture;
        material.aoMap = textures[occlusionTexture.index];
        material.aoMapChannel = 'r';

        extractTextureTransform(occlusionTexture, material, ['ao']);
        // TODO: support 'strength'
    }

    if (gltfMaterial.hasOwnProperty('emissiveFactor')) {
        const [r, g, b] = gltfMaterial.emissiveFactor;
        material.emissive.set(r, g, b).gamma();
    }

    if (gltfMaterial.hasOwnProperty('emissiveTexture')) {
        const emissiveTexture = gltfMaterial.emissiveTexture;
        material.emissiveMap = textures[emissiveTexture.index];

        extractTextureTransform(emissiveTexture, material, ['emissive']);
    }

    if (gltfMaterial.hasOwnProperty('alphaMode')) {
        switch (gltfMaterial.alphaMode) {
            case 'MASK':
                material.blendType = BLEND_NONE;
                if (gltfMaterial.hasOwnProperty('alphaCutoff')) {
                    material.alphaTest = gltfMaterial.alphaCutoff;
                } else {
                    material.alphaTest = 0.5;
                }
                break;
            case 'BLEND':
                material.blendType = BLEND_NORMAL;

                // note: by default don't write depth on semitransparent materials
                material.depthWrite = false;
                break;
            default:
            case 'OPAQUE':
                material.blendType = BLEND_NONE;
                break;
        }
    } else {
        material.blendType = BLEND_NONE;
    }

    if (gltfMaterial.hasOwnProperty('doubleSided')) {
        material.twoSidedLighting = gltfMaterial.doubleSided;
        material.cull = gltfMaterial.doubleSided ? CULLFACE_NONE : CULLFACE_BACK;
    } else {
        material.twoSidedLighting = false;
        material.cull = CULLFACE_BACK;
    }

    // Handle extensions
    if (gltfMaterial.hasOwnProperty('extensions')) {
        for (const key in gltfMaterial.extensions) {
            const extension = glbMaterialExtensions[key];
            if (extension !== undefined) {
                extension.apply(gltfMaterial.extensions[key], material, textures);
            }
        }
    }

    material.update();

    return material;
};

// create the anim structure
const createAnimation = (gltfAnimation, animationIndex, gltfAccessors, bufferViews, nodes, meshes, gltfNodes) => {

    // create animation data block for the accessor
    const createAnimData = (gltfAccessor) => {
        return new AnimData(GltfAccessor.getNumComponents(gltfAccessor.type), GltfAccessor.getDataFloat32(gltfAccessor, bufferViews));
    };

    const interpMap = {
        'STEP': INTERPOLATION_STEP,
        'LINEAR': INTERPOLATION_LINEAR,
        'CUBICSPLINE': INTERPOLATION_CUBIC
    };

    // Input and output maps reference data by sampler input/output key.
    const inputMap = { };
    const outputMap = { };
    // The curve map stores temporary curve data by sampler index. Each curves input/output value will be resolved to an inputs/outputs array index after all samplers have been processed.
    // Curves and outputs that are deleted from their maps will not be included in the final AnimTrack
    const curveMap = { };
    let outputCounter = 1;

    let i;

    // convert samplers
    for (i = 0; i < gltfAnimation.samplers.length; ++i) {
        const sampler = gltfAnimation.samplers[i];

        // get input data
        if (!inputMap.hasOwnProperty(sampler.input)) {
            inputMap[sampler.input] = createAnimData(gltfAccessors[sampler.input]);
        }

        // get output data
        if (!outputMap.hasOwnProperty(sampler.output)) {
            outputMap[sampler.output] = createAnimData(gltfAccessors[sampler.output]);
        }

        const interpolation =
            sampler.hasOwnProperty('interpolation') &&
            interpMap.hasOwnProperty(sampler.interpolation) ?
                interpMap[sampler.interpolation] : INTERPOLATION_LINEAR;

        // create curve
        const curve = {
            paths: [],
            input: sampler.input,
            output: sampler.output,
            interpolation: interpolation
        };

        curveMap[i] = curve;
    }

    const quatArrays = [];

    const transformSchema = {
        'translation': 'localPosition',
        'rotation': 'localRotation',
        'scale': 'localScale'
    };

    const constructNodePath = (node) => {
        const path = [];
        while (node) {
            path.unshift(node.name);
            node = node.parent;
        }
        return path;
    };

    // All morph targets are included in a single channel of the animation, with all targets output data interleaved with each other.
    // This function splits each morph target out into it a curve with its own output data, allowing us to animate each morph target independently by name.
    const createMorphTargetCurves = (curve, gltfNode, entityPath) => {
        const out = outputMap[curve.output];
        if (!out) {
            Debug.warn(`glb-parser: No output data is available for the morph target curve (${entityPath}/graph/weights). Skipping.`);
            return;
        }

        // names of morph targets
        let targetNames;
        if (meshes && meshes[gltfNode.mesh]) {
            const mesh = meshes[gltfNode.mesh];
            if (mesh.hasOwnProperty('extras') && mesh.extras.hasOwnProperty('targetNames')) {
                targetNames = mesh.extras.targetNames;
            }
        }

        const outData = out.data;
        const morphTargetCount = outData.length / inputMap[curve.input].data.length;
        const keyframeCount = outData.length / morphTargetCount;

        // single array buffer for all keys, 4 bytes per entry
        const singleBufferSize = keyframeCount * 4;
        const buffer = new ArrayBuffer(singleBufferSize * morphTargetCount);

        for (let j = 0; j < morphTargetCount; j++) {
            const morphTargetOutput = new Float32Array(buffer, singleBufferSize * j, keyframeCount);

            // the output data for all morph targets in a single curve is interleaved. We need to retrieve the keyframe output data for a single morph target
            for (let k = 0; k < keyframeCount; k++) {
                morphTargetOutput[k] = outData[k * morphTargetCount + j];
            }
            const output = new AnimData(1, morphTargetOutput);
            const weightName = targetNames?.[j] ? `name.${targetNames[j]}` : j;

            // add the individual morph target output data to the outputMap using a negative value key (so as not to clash with sampler.output values)
            outputMap[-outputCounter] = output;
            const morphCurve = {
                paths: [{
                    entityPath: entityPath,
                    component: 'graph',
                    propertyPath: [`weight.${weightName}`]
                }],
                // each morph target curve input can use the same sampler.input from the channel they were all in
                input: curve.input,
                // but each morph target curve should reference its individual output that was just created
                output: -outputCounter,
                interpolation: curve.interpolation
            };
            outputCounter++;
            // add the morph target curve to the curveMap
            curveMap[`morphCurve-${i}-${j}`] = morphCurve;
        }
    };

    // convert anim channels
    for (i = 0; i < gltfAnimation.channels.length; ++i) {
        const channel = gltfAnimation.channels[i];
        const target = channel.target;
        const curve = curveMap[channel.sampler];

        const node = nodes[target.node];
        const gltfNode = gltfNodes[target.node];
        const entityPath = constructNodePath(node);

        if (target.path.startsWith('weights')) {
            createMorphTargetCurves(curve, gltfNode, entityPath);
            // as all individual morph targets in this morph curve have their own curve now, this morph curve should be flagged
            // so it's not included in the final output
            curveMap[channel.sampler].morphCurve = true;
        } else {
            curve.paths.push({
                entityPath: entityPath,
                component: 'graph',
                propertyPath: [transformSchema[target.path]]
            });
        }
    }

    const inputs = [];
    const outputs = [];
    const curves = [];

    // Add each input in the map to the final inputs array. The inputMap should now reference the index of input in the inputs array instead of the input itself.
    for (const inputKey in inputMap) {
        inputs.push(inputMap[inputKey]);
        inputMap[inputKey] = inputs.length - 1;
    }
    // Add each output in the map to the final outputs array. The outputMap should now reference the index of output in the outputs array instead of the output itself.
    for (const outputKey in outputMap) {
        outputs.push(outputMap[outputKey]);
        outputMap[outputKey] = outputs.length - 1;
    }
    // Create an AnimCurve for each curve object in the curveMap. Each curve object's input value should be resolved to the index of the input in the
    // inputs arrays using the inputMap. Likewise for output values.
    for (const curveKey in curveMap) {
        const curveData = curveMap[curveKey];
        // if the curveData contains a morph curve then do not add it to the final curve list as the individual morph target curves are included instead
        if (curveData.morphCurve) {
            continue;
        }
        curves.push(new AnimCurve(
            curveData.paths,
            inputMap[curveData.input],
            outputMap[curveData.output],
            curveData.interpolation
        ));

        // if this target is a set of quaternion keys, make note of its index so we can perform
        // quaternion-specific processing on it.
        if (curveData.paths.length > 0 && curveData.paths[0].propertyPath[0] === 'localRotation' && curveData.interpolation !== INTERPOLATION_CUBIC) {
            quatArrays.push(curves[curves.length - 1].output);
        }
    }

    // sort the list of array indexes so we can skip dups
    quatArrays.sort();

    // run through the quaternion data arrays flipping quaternion keys
    // that don't fall in the same winding order.
    let prevIndex = null;
    let data;
    for (i = 0; i < quatArrays.length; ++i) {
        const index = quatArrays[i];
        // skip over duplicate array indices
        if (i === 0 || index !== prevIndex) {
            data = outputs[index];
            if (data.components === 4) {
                const d = data.data;
                const len = d.length - 4;
                for (let j = 0; j < len; j += 4) {
                    const dp = d[j + 0] * d[j + 4] +
                             d[j + 1] * d[j + 5] +
                             d[j + 2] * d[j + 6] +
                             d[j + 3] * d[j + 7];

                    if (dp < 0) {
                        d[j + 4] *= -1;
                        d[j + 5] *= -1;
                        d[j + 6] *= -1;
                        d[j + 7] *= -1;
                    }
                }
            }
            prevIndex = index;
        }
    }

    // calculate duration of the animation as maximum time value
    let duration = 0;
    for (i = 0; i < inputs.length; i++) {
        data  = inputs[i]._data;
        duration = Math.max(duration, data.length === 0 ? 0 : data[data.length - 1]);
    }

    return new AnimTrack(
        gltfAnimation.hasOwnProperty('name') ? gltfAnimation.name : (`animation_${animationIndex}`),
        duration,
        inputs,
        outputs,
        curves);
};

const tempMat = new Mat4();
const tempVec = new Vec3();
const tempQuat = new Quat();

const createNode = (gltfNode, nodeIndex, nodeInstancingMap) => {
    const entity = new GraphNode();

    if (gltfNode.hasOwnProperty('name') && gltfNode.name.length > 0) {
        entity.name = gltfNode.name;
    } else {
        entity.name = `node_${nodeIndex}`;
    }

    // Parse transformation properties
    if (gltfNode.hasOwnProperty('matrix')) {
        tempMat.data.set(gltfNode.matrix);
        tempMat.getTranslation(tempVec);
        entity.setLocalPosition(tempVec);
        // Use Quat.setFromMat4 which properly handles negative determinant (mirrored matrices)
        // by normalizing the rotation before extraction
        tempQuat.setFromMat4(tempMat);
        entity.setLocalRotation(tempQuat);
        tempMat.getScale(tempVec);
        // Apply negative sign to X scale if the matrix is mirrored (negative determinant).
        // This matches the convention used in Quat.setFromMat4 which flips the X axis.
        tempVec.x *= tempMat.scaleSign;
        entity.setLocalScale(tempVec);
    }

    if (gltfNode.hasOwnProperty('rotation')) {
        const r = gltfNode.rotation;
        entity.setLocalRotation(r[0], r[1], r[2], r[3]);
    }

    if (gltfNode.hasOwnProperty('translation')) {
        const t = gltfNode.translation;
        entity.setLocalPosition(t[0], t[1], t[2]);
    }

    if (gltfNode.hasOwnProperty('scale')) {
        const s = gltfNode.scale;
        entity.setLocalScale(s[0], s[1], s[2]);
    }

    if (gltfNode.hasOwnProperty('extensions') && gltfNode.extensions.EXT_mesh_gpu_instancing) {
        nodeInstancingMap.set(gltfNode, {
            ext: gltfNode.extensions.EXT_mesh_gpu_instancing
        });
    }

    return entity;
};

// creates a camera component on the supplied node, and returns it
const createCamera = (gltfCamera, node) => {
    const isOrthographic = gltfCamera.type === 'orthographic';
    const gltfProperties = isOrthographic ? gltfCamera.orthographic : gltfCamera.perspective;

    const componentData = {
        enabled: false,
        projection: isOrthographic ? PROJECTION_ORTHOGRAPHIC : PROJECTION_PERSPECTIVE,
        nearClip: gltfProperties.znear,
        aspectRatioMode: ASPECT_AUTO
    };

    if (gltfProperties.zfar) {
        componentData.farClip = gltfProperties.zfar;
    }

    if (isOrthographic) {
        // glTF ymag defines the half-height of the orthographic view volume
        componentData.orthoHeight = gltfProperties.ymag;

        if (gltfProperties.xmag && gltfProperties.ymag) {
            componentData.aspectRatioMode = ASPECT_MANUAL;
            componentData.aspectRatio = gltfProperties.xmag / gltfProperties.ymag;
        }
    } else {
        componentData.fov = gltfProperties.yfov * math.RAD_TO_DEG;

        if (gltfProperties.aspectRatio) {
            componentData.aspectRatioMode = ASPECT_MANUAL;
            componentData.aspectRatio = gltfProperties.aspectRatio;
        }
    }

    const cameraEntity = new Entity(gltfCamera.name);
    cameraEntity.addComponent('camera', componentData);
    return cameraEntity;
};

const createSkins = (device, gltf, nodes, bufferViews) => {
    if (!gltf.hasOwnProperty('skins') || gltf.skins.length === 0) {
        return [];
    }

    // cache for skins to filter out duplicates
    const glbSkins = new Map();

    return gltf.skins.map((gltfSkin) => {
        return createSkin(device, gltfSkin, gltf.accessors, bufferViews, nodes, glbSkins);
    });
};

const createMeshes = (device, gltf, bufferViews, options) => {
    // dictionary of vertex buffers to avoid duplicates
    const vertexBufferDict = {};
    const meshVariants = {};
    const meshDefaultMaterials = {};
    const promises = [];

    const valid = (!options.skipMeshes && gltf?.meshes?.length && gltf?.accessors?.length && gltf?.bufferViews?.length);
    const meshes = valid ? gltf.meshes.map((gltfMesh) => {
        return createMesh(device, gltfMesh, gltf.accessors, bufferViews, vertexBufferDict, meshVariants, meshDefaultMaterials, options, promises);
    }) : [];

    return {
        meshes,
        meshVariants,
        meshDefaultMaterials,
        promises
    };
};

const createMaterials = (gltf, textures, options) => {
    if (!gltf.hasOwnProperty('materials') || gltf.materials.length === 0) {
        return [];
    }

    const preprocess = options?.material?.preprocess;
    const process = options?.material?.process ?? createMaterial;
    const postprocess = options?.material?.postprocess;

    return gltf.materials.map((gltfMaterial) => {
        if (preprocess) {
            preprocess(gltfMaterial);
        }
        const material = process(gltfMaterial, textures);
        if (postprocess) {
            postprocess(gltfMaterial, material);
        }
        return material;
    });
};

const createAnimations = (gltf, nodes, bufferViews, options) => {
    if (!gltf.hasOwnProperty('animations') || gltf.animations.length === 0) {
        return [];
    }

    const preprocess = options?.animation?.preprocess;
    const postprocess = options?.animation?.postprocess;

    return gltf.animations.map((gltfAnimation, index) => {
        if (preprocess) {
            preprocess(gltfAnimation);
        }
        const animation = createAnimation(gltfAnimation, index, gltf.accessors, bufferViews, nodes, gltf.meshes, gltf.nodes);
        if (postprocess) {
            postprocess(gltfAnimation, animation);
        }
        return animation;
    });
};

const createNodes = (gltf, options, nodeInstancingMap) => {
    if (!gltf.hasOwnProperty('nodes') || gltf.nodes.length === 0) {
        return [];
    }

    const preprocess = options?.node?.preprocess;
    const process = options?.node?.process ?? createNode;
    const postprocess = options?.node?.postprocess;

    const nodes = gltf.nodes.map((gltfNode, index) => {
        if (preprocess) {
            preprocess(gltfNode);
        }
        const node = process(gltfNode, index, nodeInstancingMap);
        if (postprocess) {
            postprocess(gltfNode, node);
        }
        return node;
    });

    // build node hierarchy
    for (let i = 0; i < gltf.nodes.length; ++i) {
        const gltfNode = gltf.nodes[i];
        if (gltfNode.hasOwnProperty('children')) {
            const parent = nodes[i];
            const uniqueNames = { };
            for (let j = 0; j < gltfNode.children.length; ++j) {
                const child = nodes[gltfNode.children[j]];
                if (!child.parent) {
                    if (uniqueNames.hasOwnProperty(child.name)) {
                        child.name += uniqueNames[child.name]++;
                    } else {
                        uniqueNames[child.name] = 1;
                    }
                    parent.addChild(child);
                }
            }
        }
    }

    return nodes;
};

const createScenes = (gltf, nodes) => {
    const scenes = [];
    const count = gltf.scenes.length;

    // if there's a single scene with a single node in it, don't create wrapper nodes
    if (count === 1 && gltf.scenes[0].nodes?.length === 1) {
        const nodeIndex = gltf.scenes[0].nodes[0];
        scenes.push(nodes[nodeIndex]);
    } else {

        // create root node per scene
        for (let i = 0; i < count; i++) {
            const scene = gltf.scenes[i];
            if (scene.nodes) {
                const sceneRoot = new GraphNode(scene.name);
                for (let n = 0; n < scene.nodes.length; n++) {
                    const childNode = nodes[scene.nodes[n]];
                    sceneRoot.addChild(childNode);
                }
                scenes.push(sceneRoot);
            }
        }
    }

    return scenes;
};

const createCameras = (gltf, nodes, options) => {

    let cameras = null;

    if (gltf.hasOwnProperty('nodes') && gltf.hasOwnProperty('cameras') && gltf.cameras.length > 0) {

        const preprocess = options?.camera?.preprocess;
        const process = options?.camera?.process ?? createCamera;
        const postprocess = options?.camera?.postprocess;

        gltf.nodes.forEach((gltfNode, nodeIndex) => {
            if (gltfNode.hasOwnProperty('camera')) {
                const gltfCamera = gltf.cameras[gltfNode.camera];
                if (gltfCamera) {
                    if (preprocess) {
                        preprocess(gltfCamera);
                    }
                    const camera = process(gltfCamera, nodes[nodeIndex]);
                    if (postprocess) {
                        postprocess(gltfCamera, camera);
                    }

                    // add the camera to node->camera map
                    if (camera) {
                        if (!cameras) cameras = new Map();
                        cameras.set(gltfNode, camera);
                    }
                }
            }
        });
    }

    return cameras;
};

// link skins to the meshes
const linkSkins = (gltf, renders, skins) => {
    gltf.nodes.forEach((gltfNode) => {
        if (gltfNode.hasOwnProperty('mesh') && gltfNode.hasOwnProperty('skin')) {
            const meshGroup = renders[gltfNode.mesh].meshes;
            meshGroup.forEach((mesh) => {
                mesh.skin = skins[gltfNode.skin];
            });
        }
    });
};

// create engine resources from the downloaded GLB data
const createResources = async (device, gltf, bufferViews, textures, options) => {
    const preprocess = options?.global?.preprocess;
    const postprocess = options?.global?.postprocess;

    if (preprocess) {
        preprocess(gltf);
    }


    // The very first version of FACT generated incorrectly flipped V texture
    // coordinates. Since this first version was only ever available behind an
    // editor flag there should be very few such GLB models in the wild.
    // Instead of bloating the engine forevermore with code to handle this case,
    // we now issue a warning and prompt user to reconvert their FBX.
    if (gltf.asset && gltf.asset.generator === 'PlayCanvas') {
        Debug.warn('glTF model may have been generated with flipped UVs. Please reconvert.');
    }

    const nodeInstancingMap = new Map();
    const nodes = createNodes(gltf, options, nodeInstancingMap);
    const scenes = createScenes(gltf, nodes);
    const lights = createLights(gltf, nodes, options);
    const cameras = createCameras(gltf, nodes, options);
    const variants = createVariants(gltf);

    // buffer data must have finished loading in order to create meshes and animations
    const bufferViewData = await Promise.all(bufferViews);
    const { meshes, meshVariants, meshDefaultMaterials, promises } = createMeshes(device, gltf, bufferViewData, options);
    const animations = createAnimations(gltf, nodes, bufferViewData, options);
    createInstancing(device, gltf, nodeInstancingMap, bufferViewData);

    // textures must have finished loading in order to create materials
    const textureAssets = await Promise.all(textures);
    const textureInstances = textureAssets.map(t => t.resource);
    const materials = createMaterials(gltf, textureInstances, options);
    const skins = createSkins(device, gltf, nodes, bufferViewData);

    // create renders to wrap meshes
    const renders = [];
    for (let i = 0; i < meshes.length; i++) {
        renders[i] = new Render();
        renders[i].meshes = meshes[i];
    }

    // link skins to meshes
    linkSkins(gltf, renders, skins);

    const result = new GlbResources();
    result.gltf = gltf;
    result.nodes = nodes;
    result.scenes = scenes;
    result.animations = animations;
    result.textures = textureAssets;
    result.materials = materials;
    result.variants = variants;
    result.meshVariants = meshVariants;
    result.meshDefaultMaterials = meshDefaultMaterials;
    result.renders = renders;
    result.skins = skins;
    result.lights = lights;
    result.cameras = cameras;
    result.nodeInstancingMap = nodeInstancingMap;

    if (postprocess) {
        postprocess(gltf, result);
    }

    // wait for draco meshes to complete decoding
    await Promise.all(promises);

    return result;
};

const applySampler = (texture, gltfSampler) => {
    const getFilter = (filter, defaultValue) => {
        switch (filter) {
            case 9728: return FILTER_NEAREST;
            case 9729: return FILTER_LINEAR;
            case 9984: return FILTER_NEAREST_MIPMAP_NEAREST;
            case 9985: return FILTER_LINEAR_MIPMAP_NEAREST;
            case 9986: return FILTER_NEAREST_MIPMAP_LINEAR;
            case 9987: return FILTER_LINEAR_MIPMAP_LINEAR;
            default:   return defaultValue;
        }
    };

    const getWrap = (wrap, defaultValue) => {
        switch (wrap) {
            case 33071: return ADDRESS_CLAMP_TO_EDGE;
            case 33648: return ADDRESS_MIRRORED_REPEAT;
            case 10497: return ADDRESS_REPEAT;
            default:    return defaultValue;
        }
    };

    if (texture) {
        gltfSampler = gltfSampler ?? { };
        texture.minFilter = getFilter(gltfSampler.minFilter, FILTER_LINEAR_MIPMAP_LINEAR);
        texture.magFilter = getFilter(gltfSampler.magFilter, FILTER_LINEAR);
        texture.addressU = getWrap(gltfSampler.wrapS, ADDRESS_REPEAT);
        texture.addressV = getWrap(gltfSampler.wrapT, ADDRESS_REPEAT);
    }
};

let gltfTextureUniqueId = 0;

// create gltf images. returns an array of promises that resolve to texture assets.
const createImages = (gltf, bufferViews, urlBase, registry, options) => {
    if (!gltf.images || gltf.images.length === 0) {
        return [];
    }

    const preprocess = options?.image?.preprocess;
    const processAsync = options?.image?.processAsync;
    const postprocess = options?.image?.postprocess;

    const mimeTypeFileExtensions = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/basis': 'basis',
        'image/ktx': 'ktx',
        'image/ktx2': 'ktx2',
        'image/vnd-ms.dds': 'dds'
    };

    // a Set of image indices that use sRGB textures (base and emissive)
    const getGammaTextures = (gltf) => {
        const set = new Set();

        if (gltf.hasOwnProperty('materials')) {
            gltf.materials.forEach((gltfMaterial) => {

                // base texture
                if (gltfMaterial.hasOwnProperty('pbrMetallicRoughness')) {
                    const pbrData = gltfMaterial.pbrMetallicRoughness;
                    if (pbrData.hasOwnProperty('baseColorTexture')) {
                        const gltfTexture = gltf.textures[pbrData.baseColorTexture.index];
                        set.add(getTextureSource(gltfTexture));
                    }
                }

                // emissive
                if (gltfMaterial.hasOwnProperty('emissiveTexture')) {
                    const gltfTexture = gltf.textures[gltfMaterial.emissiveTexture.index];
                    set.add(getTextureSource(gltfTexture));
                }

                // color textures used by material extensions
                if (gltfMaterial.hasOwnProperty('extensions')) {
                    for (const key in gltfMaterial.extensions) {
                        const extension = glbMaterialExtensions[key];
                        if (extension?.getColorTextures) {
                            const textureInfos = extension.getColorTextures(gltfMaterial.extensions[key]);
                            for (const textureInfo of textureInfos) {
                                const gltfTexture = gltf.textures[textureInfo.index];
                                set.add(getTextureSource(gltfTexture));
                            }
                        }
                    }
                }
            });
        }
        return set;
    };

    const loadTexture = (gltfImage, url, bufferView, mimeType, options, srgb) => {
        return new Promise((resolve, reject) => {
            const continuation = (bufferViewData) => {
                const name = `${gltfImage.name || 'gltf-texture'}-${gltfTextureUniqueId++}`;

                // construct the asset file
                const file = {
                    url: url || name
                };
                if (bufferViewData) {
                    file.contents = bufferViewData.slice(0).buffer;
                }
                if (mimeType) {
                    const extension = mimeTypeFileExtensions[mimeType];
                    if (extension) {
                        file.filename = `${file.url}.${extension}`;
                    }
                }

                // create and load the asset
                const data = { srgb };

                const asset = new Asset(name, 'texture', file, data, options);
                asset.on('load', asset => resolve(asset));
                asset.on('error', err => reject(err));
                registry.add(asset);
                registry.load(asset);
            };

            if (bufferView) {
                bufferView.then(bufferViewData => continuation(bufferViewData));
            } else {
                continuation(null);
            }
        });
    };

    const gammaTextures = getGammaTextures(gltf);

    return gltf.images.map((gltfImage, i) => {
        if (preprocess) {
            preprocess(gltfImage);
        }

        let promise;

        if (processAsync) {
            promise = new Promise((resolve, reject) => {
                processAsync(gltfImage, (err, textureAsset) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(textureAsset);
                    }
                });
            });
        } else {
            promise = new Promise((resolve) => {
                resolve(null);
            });
        }

        promise = promise.then((textureAsset) => {

            // if the image uses sRGB, pass it as an option to the texture creation
            const srgb = gammaTextures.has(i);

            if (textureAsset) {
                return textureAsset;
            } else if (gltfImage.hasOwnProperty('uri')) {
                // uri specified
                if (isDataURI(gltfImage.uri)) {
                    return loadTexture(gltfImage, gltfImage.uri, null, getDataURIMimeType(gltfImage.uri), null, srgb);
                }
                return loadTexture(gltfImage, ABSOLUTE_URL.test(gltfImage.uri) ? gltfImage.uri : path.join(urlBase, gltfImage.uri), null, null, { crossOrigin: 'anonymous' }, srgb);
            } else if (gltfImage.hasOwnProperty('bufferView') && gltfImage.hasOwnProperty('mimeType')) {
                // bufferview
                return loadTexture(gltfImage, null, bufferViews[gltfImage.bufferView], gltfImage.mimeType, null, srgb);
            }

            // fail
            return Promise.reject(new Error(`Invalid image found in gltf (neither uri or bufferView found). index=${i}`));
        });

        if (postprocess) {
            promise = promise.then((textureAsset) => {
                postprocess(gltfImage, textureAsset);
                return textureAsset;
            });
        }

        return promise;
    });
};

// create gltf textures. returns an array of promises that resolve to texture assets.
const createTextures = (gltf, images, options) => {

    if (!gltf?.images?.length || !gltf?.textures?.length) {
        return [];
    }

    const preprocess = options?.texture?.preprocess;
    const processAsync = options?.texture?.processAsync;
    const postprocess = options?.texture?.postprocess;

    const seenImages = new Set();

    return gltf.textures.map((gltfTexture) => {
        if (preprocess) {
            preprocess(gltfTexture);
        }

        let promise;

        if (processAsync) {
            promise = new Promise((resolve, reject) => {
                processAsync(gltfTexture, gltf.images, (err, gltfImageIndex) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(gltfImageIndex);
                    }
                });
            });
        } else {
            promise = new Promise((resolve) => {
                resolve(null);
            });
        }

        promise = promise.then((gltfImageIndex) => {
            // resolve image index
            gltfImageIndex = gltfImageIndex ??
                getTextureSource(gltfTexture);

            const cloneAsset = seenImages.has(gltfImageIndex);
            seenImages.add(gltfImageIndex);

            return images[gltfImageIndex].then((imageAsset) => {
                const asset = cloneAsset ? cloneTextureAsset(imageAsset) : imageAsset;
                applySampler(asset.resource, (gltf.samplers ?? [])[gltfTexture.sampler]);
                return asset;
            });
        });

        if (postprocess) {
            promise = promise.then((textureAsset) => {
                postprocess(gltfTexture, textureAsset);
                return textureAsset;
            });
        }

        return promise;
    });
};

// load gltf buffers. returns an array of promises that resolve to typed arrays.
const loadBuffers = (gltf, binaryChunk, urlBase, options) => {
    if (!gltf.buffers || gltf.buffers.length === 0) {
        return [];
    }

    const preprocess = options?.buffer?.preprocess;
    const processAsync = options?.buffer?.processAsync;
    const postprocess = options?.buffer?.postprocess;

    return gltf.buffers.map((gltfBuffer, i) => {
        if (preprocess) {
            preprocess(gltfBuffer);
        }

        let promise;

        if (processAsync) {
            promise = new Promise((resolve, reject) => {
                processAsync(gltfBuffer, (err, arrayBuffer) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(arrayBuffer);
                    }
                });
            });
        } else {
            promise = new Promise((resolve) => {
                resolve(null);
            });
        }

        promise = promise.then((arrayBuffer) => {
            if (arrayBuffer) {
                return arrayBuffer;
            } else if (gltfBuffer.hasOwnProperty('uri')) {
                if (isDataURI(gltfBuffer.uri)) {
                    // convert base64 to raw binary data held in a string
                    // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
                    const byteString = atob(gltfBuffer.uri.split(',')[1]);

                    // create a view into the buffer
                    const binaryArray = new Uint8Array(byteString.length);

                    // set the bytes of the buffer to the correct values
                    for (let j = 0; j < byteString.length; j++) {
                        binaryArray[j] = byteString.charCodeAt(j);
                    }

                    return binaryArray;
                }

                return new Promise((resolve, reject) => {
                    http.get(
                        ABSOLUTE_URL.test(gltfBuffer.uri) ? gltfBuffer.uri : path.join(urlBase, gltfBuffer.uri),
                        { cache: true, responseType: 'arraybuffer', retry: false },
                        (err, result) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(new Uint8Array(result));
                            }
                        }
                    );
                });
            }

            // glb buffer reference
            return binaryChunk;
        });

        if (postprocess) {
            promise = promise.then((buffer) => {
                postprocess(gltf.buffers[i], buffer);
                return buffer;
            });
        }

        return promise;
    });
};

// parse the gltf chunk, returns the gltf json
const parseGltf = (gltfChunk, callback) => {
    const decodeBinaryUtf8 = (array) => {
        if (typeof TextDecoder !== 'undefined') {
            return new TextDecoder().decode(array);
        }

        let str = '';
        for (let i = 0; i < array.length; i++) {
            str += String.fromCharCode(array[i]);
        }

        return decodeURIComponent(escape(str));
    };

    const gltf = JSON.parse(decodeBinaryUtf8(gltfChunk));

    // check gltf version
    if (gltf.asset && gltf.asset.version && parseFloat(gltf.asset.version) < 2) {
        callback(`Invalid gltf version. Expected version 2.0 or above but found version '${gltf.asset.version}'.`);
        return;
    }

    // check required extensions
    callback(null, gltf);
};

// parse glb data, returns the gltf and binary chunk
const parseGlb = (glbData, callback) => {
    const data = (glbData instanceof ArrayBuffer) ? new DataView(glbData) : new DataView(glbData.buffer, glbData.byteOffset, glbData.byteLength);

    // read header
    const magic = data.getUint32(0, true);
    const version = data.getUint32(4, true);
    const length = data.getUint32(8, true);

    if (magic !== 0x46546C67) {
        callback(`Invalid magic number found in glb header. Expected 0x46546C67, found 0x${magic.toString(16)}`);
        return;
    }

    if (version !== 2) {
        callback(`Invalid version number found in glb header. Expected 2, found ${version}`);
        return;
    }

    if (length <= 0 || length > data.byteLength) {
        callback(`Invalid length found in glb header. Found ${length}`);
        return;
    }

    // read chunks
    const chunks = [];
    let offset = 12;
    while (offset < length) {
        const chunkLength = data.getUint32(offset, true);
        if (offset + chunkLength + 8 > data.byteLength) {
            callback(`Invalid chunk length found in glb. Found ${chunkLength}`);
        }
        const chunkType = data.getUint32(offset + 4, true);
        const chunkData = new Uint8Array(data.buffer, data.byteOffset + offset + 8, chunkLength);
        chunks.push({ length: chunkLength, type: chunkType, data: chunkData });
        offset += chunkLength + 8;
    }

    if (chunks.length !== 1 && chunks.length !== 2) {
        callback('Invalid number of chunks found in glb file.');
        return;
    }

    if (chunks[0].type !== 0x4E4F534A) {
        callback(`Invalid chunk type found in glb file. Expected 0x4E4F534A, found 0x${chunks[0].type.toString(16)}`);
        return;
    }

    if (chunks.length > 1 && chunks[1].type !== 0x004E4942) {
        callback(`Invalid chunk type found in glb file. Expected 0x004E4942, found 0x${chunks[1].type.toString(16)}`);
        return;
    }

    callback(null, {
        gltfChunk: chunks[0].data,
        binaryChunk: chunks.length === 2 ? chunks[1].data : null
    });
};

// parse the chunk of data, which can be glb or gltf
const parseChunk = (filename, data, callback) => {
    const hasGlbHeader = () => {
        // glb format starts with 'glTF'
        const u8 = new Uint8Array(data);
        return u8[0] === 103 && u8[1] === 108 && u8[2] === 84 && u8[3] === 70;
    };

    if ((filename && filename.toLowerCase().endsWith('.glb')) || hasGlbHeader()) {
        parseGlb(data, callback);
    } else {
        callback(null, {
            gltfChunk: data,
            binaryChunk: null
        });
    }
};

// create buffer views
const createBufferViews = (gltf, buffers, options) => {

    const result = [];

    const preprocess = options?.bufferView?.preprocess;
    const processAsync = options?.bufferView?.processAsync;
    const postprocess = options?.bufferView?.postprocess;

    // handle case of no buffers
    if (!gltf.bufferViews?.length) {
        return result;
    }

    for (let i = 0; i < gltf.bufferViews.length; ++i) {
        const gltfBufferView = gltf.bufferViews[i];

        if (preprocess) {
            preprocess(gltfBufferView);
        }

        let promise;

        if (processAsync) {
            promise = new Promise((resolve, reject) => {
                processAsync(gltfBufferView, buffers, (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            });
        } else {
            promise = new Promise((resolve) => {
                resolve(null);
            });
        }

        promise = promise.then((buffer) => {
            if (buffer) {
                return buffer;
            }

            // convert buffer to typed array
            return buffers[gltfBufferView.buffer].then((buffer) => {
                return new Uint8Array(buffer.buffer,
                    buffer.byteOffset + (gltfBufferView.byteOffset || 0),
                    gltfBufferView.byteLength);
            });
        });

        // add a 'byteStride' member to the typed array so we have easy access to it later
        if (gltfBufferView.hasOwnProperty('byteStride')) {
            promise = promise.then((typedArray) => {
                typedArray.byteStride = gltfBufferView.byteStride;
                return typedArray;
            });
        }

        if (postprocess) {
            promise = promise.then((typedArray) => {
                postprocess(gltfBufferView, typedArray);
                return typedArray;
            });
        }

        result.push(promise);
    }

    return result;
};

class GlbParser {
    // parse the gltf or glb data asynchronously, loading external resources
    static parse(filename, urlBase, data, device, registry, options, callback) {
        // parse the data
        parseChunk(filename, data, (err, chunks) => {
            if (err) {
                callback(err);
                return;
            }

            // parse gltf
            parseGltf(chunks.gltfChunk, (err, gltf) => {
                if (err) {
                    callback(err);
                    return;
                }

                const buffers = loadBuffers(gltf, chunks.binaryChunk, urlBase, options);
                const bufferViews = createBufferViews(gltf, buffers, options);
                const images = createImages(gltf, bufferViews, urlBase, registry, options);
                const textures = createTextures(gltf, images, options);

                createResources(device, gltf, bufferViews, textures, options)
                .then(result => callback(null, result))
                .catch(err => callback(err));
            });
        });
    }

    static createDefaultMaterial() {
        return createMaterial({
            name: 'defaultGlbMaterial'
        }, []);
    }
}

export { GlbParser };
