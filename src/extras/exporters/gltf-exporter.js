import { CoreExporter } from './core-exporter.js';
import { math } from '../../core/math/math.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';
import { Color } from '../../core/math/color.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import {
    CULLFACE_NONE,
    INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32,
    ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT,
    FILTER_LINEAR, FILTER_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST,
    SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_COLOR,
    SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_TEXCOORD0,
    SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4,
    SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7, TYPE_INT8,
    TYPE_UINT8, TYPE_INT16, TYPE_UINT16,
    TYPE_INT32, TYPE_UINT32, TYPE_FLOAT32
} from '../../platform/graphics/constants.js';
import { IndexBuffer } from '../../platform/graphics/index-buffer.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';
import { BLEND_NONE, BLEND_NORMAL, PROJECTION_ORTHOGRAPHIC } from '../../scene/constants.js';

/**
 * @import { Entity } from '../../framework/entity.js'
 */

const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

const getIndexComponentType = (indexFormat) => {
    switch (indexFormat) {
        case INDEXFORMAT_UINT8: return 5121;
        case INDEXFORMAT_UINT16: return 5123;
        case INDEXFORMAT_UINT32: return 5125;
    }
    return 0;
};

const getComponentType = (dataType) => {
    switch (dataType) {
        case TYPE_INT8: return 5120;
        case TYPE_UINT8: return 5121;
        case TYPE_INT16: return 5122;
        case TYPE_UINT16: return 5123;
        case TYPE_INT32: return 5124;
        case TYPE_UINT32: return 5125;
        case TYPE_FLOAT32: return 5126;
    }
    return 0;
};

const getAccessorType = (componentCount) => {
    switch (componentCount) {
        case 1: return 'SCALAR';
        case 2: return 'VEC2';
        case 3: return 'VEC3';
        case 4: return 'VEC4';
    }
    return 0;
};

const getSemantic = (engineSemantic) => {
    switch (engineSemantic) {
        case SEMANTIC_POSITION: return 'POSITION';
        case SEMANTIC_NORMAL: return 'NORMAL';
        case SEMANTIC_TANGENT: return 'TANGENT';
        case SEMANTIC_COLOR: return 'COLOR_0';
        case SEMANTIC_BLENDINDICES: return 'JOINTS_0';
        case SEMANTIC_BLENDWEIGHT: return 'WEIGHTS_0';
        case SEMANTIC_TEXCOORD0: return 'TEXCOORD_0';
        case SEMANTIC_TEXCOORD1: return 'TEXCOORD_1';
        case SEMANTIC_TEXCOORD2: return 'TEXCOORD_2';
        case SEMANTIC_TEXCOORD3: return 'TEXCOORD_3';
        case SEMANTIC_TEXCOORD4: return 'TEXCOORD_4';
        case SEMANTIC_TEXCOORD5: return 'TEXCOORD_5';
        case SEMANTIC_TEXCOORD6: return 'TEXCOORD_6';
        case SEMANTIC_TEXCOORD7: return 'TEXCOORD_7';
    }
    return '';
};

const getFilter = function (filter) {
    switch (filter) {
        case FILTER_NEAREST: return 9728;
        case FILTER_LINEAR: return 9729;
        case FILTER_NEAREST_MIPMAP_NEAREST: return 9984;
        case FILTER_LINEAR_MIPMAP_NEAREST: return 9985;
        case FILTER_NEAREST_MIPMAP_LINEAR: return 9986;
        case FILTER_LINEAR_MIPMAP_LINEAR: return 9987;
    }
    return 0;
};

const getWrap = function (wrap) {
    switch (wrap) {
        case ADDRESS_CLAMP_TO_EDGE: return 33071;
        case ADDRESS_MIRRORED_REPEAT: return 33648;
        case ADDRESS_REPEAT: return 10497;
    }
    return 0;
};

function isCanvasTransparent(canvas) {
    const context = canvas.getContext('2d');
    const pixelData = context.getImageData(0, 0, canvas.width, canvas.height).data;

    for (let i = 3; i < pixelData.length; i += 4) {
        if (pixelData[i] < 255) {
            return true;
        }
    }

    return false;
}

// supported texture semantics on a material
const textureSemantics = [
    'anisotropyMap',
    'clearCoatGlossMap',
    'clearCoatMap',
    'clearCoatNormalMap',
    'colorMap',
    'diffuseMap',
    'emissiveMap',
    'iridescenceMap',
    'iridescenceThicknessMap',
    'metalnessMap',
    'normalMap',
    'refractionMap',
    'sheenGlossMap',
    'sheenMap',
    'specularityFactorMap',
    'specularMap',
    'thicknessMap'
];

/**
 * Implementation of the GLTF 2.0 format exporter.
 *
 * @category Exporter
 */
class GltfExporter extends CoreExporter {
    /**
     * @ignore
     */
    collectResources(root) {
        const resources = {
            buffers: [],
            cameras: [],
            entities: [],
            materials: [],
            skins: [],
            textures: [],

            // entry: { node, meshInstances}
            entityMeshInstances: [],

            // maps a buffer (vertex or index) to an array of bufferview indices
            bufferViewMap: new Map(),

            compressableTexture: new Set()
        };

        const { materials, buffers, entityMeshInstances, textures } = resources;

        // Collect entities
        root.forEach((entity) => {
            resources.entities.push(entity);
        });

        const collectMeshInstances = (meshInstances) => {
            meshInstances.forEach((meshInstance) => {

                // Collect material
                const material = meshInstance.material;
                if (materials.indexOf(material) < 0) {
                    resources.materials.push(material);

                    // collect textures
                    textureSemantics.forEach((semantic) => {
                        const texture = material[semantic];
                        if (texture && textures.indexOf(texture) < 0) {
                            // NOTE: don't store normal maps as jpeg,
                            // because of the way they are sampled, they don't compress well
                            if (semantic !== 'normalMap') {
                                resources.compressableTexture.add(texture);
                            }

                            textures.push(texture);
                        }
                    });
                }

                // collect mesh instances per node
                const node = meshInstance.node;
                let nodeMeshInstances = entityMeshInstances.find(e => e.node === node);
                if (!nodeMeshInstances) {
                    nodeMeshInstances = { node: node, meshInstances: [] };
                    entityMeshInstances.push(nodeMeshInstances);
                }
                nodeMeshInstances.meshInstances.push(meshInstance);

                // Collect buffers
                const mesh = meshInstance.mesh;
                const vertexBuffer = mesh.vertexBuffer;
                if (buffers.indexOf(vertexBuffer) < 0) {
                    buffers.unshift(vertexBuffer);
                }

                const indexBuffer = mesh.indexBuffer[0];
                if (buffers.indexOf(indexBuffer) < 0) {
                    buffers.push(indexBuffer);
                }

                // Collect skin
                if (mesh.skin && resources.skins.indexOf(mesh.skin) < 0) {
                    resources.skins.push(mesh.skin);
                }
            });
        };

        resources.entities.forEach((entity) => {
            if (entity.camera) {
                resources.cameras.push(entity.camera);
            }

            if (entity.render && entity.render.enabled) {
                collectMeshInstances(entity.render.meshInstances);
            }

            if (entity.model && entity.model.enabled && entity.model.meshInstances) {
                collectMeshInstances(entity.model.meshInstances);
            }
        });

        return resources;
    }

    writeBufferViews(resources, json) {
        json.bufferViews = [];

        for (const buffer of resources.buffers) {
            GltfExporter.writeBufferView(resources, json, buffer);
        }
    }

    static writeBufferView(resources, json, buffer) {
        // NOTE: right now we only use one buffer per gltf file
        json.buffers = json.buffers ?? [];

        json.buffers[0] = json.buffers[0] ?? { byteLength: 0 };
        const bufferInfo = json.buffers[0];

        // To be sure that the buffer is aligned to 4 bytes
        // so that it can be read as a Uint32Array or Float32Array
        bufferInfo.byteLength = math.roundUp(bufferInfo.byteLength, 4);
        const offset = bufferInfo.byteLength;

        // FIXME: don't create the function every time
        const addBufferView = (target, byteLength, byteOffset, byteStride) => {
            const bufferView = {
                buffer: 0,
                byteLength: byteLength,
                byteOffset: byteOffset
            };

            // Only add target if it's a vertex or index buffer
            if (target === ARRAY_BUFFER || target === ELEMENT_ARRAY_BUFFER) {
                bufferView.target = target;
            }

            if (byteStride !== undefined) {
                bufferView.byteStride = byteStride;
            }

            return json.bufferViews.push(bufferView) - 1;
        };

        let arrayBuffer;
        if (buffer instanceof VertexBuffer) {
            arrayBuffer = buffer.lock();

            const format = buffer.getFormat();
            if (format.interleaved) {
                const bufferViewIndex = addBufferView(ARRAY_BUFFER, arrayBuffer.byteLength, offset, format.size);
                resources.bufferViewMap.set(buffer, [bufferViewIndex]);
            } else {
                // generate buffer view per element
                const bufferViewIndices = [];
                for (const element of format.elements) {
                    const bufferViewIndex = addBufferView(
                        ARRAY_BUFFER,
                        element.size * format.vertexCount,
                        offset + element.offset,
                        element.size
                    );
                    bufferViewIndices.push(bufferViewIndex);
                }
                resources.bufferViewMap.set(buffer, bufferViewIndices);
            }
        } else if (buffer instanceof IndexBuffer) {
            arrayBuffer = buffer.lock();
            const bufferViewIndex = addBufferView(ELEMENT_ARRAY_BUFFER, arrayBuffer.byteLength, offset);
            resources.bufferViewMap.set(buffer, [bufferViewIndex]);
        } else {
            // buffer is an array buffer (for images)
            arrayBuffer = buffer;
            const bufferViewIndex = addBufferView(undefined, arrayBuffer.byteLength, offset);
            resources.bufferViewMap.set(buffer, [bufferViewIndex]);
        }

        // increment buffer by the size of the array buffer to allocate buffer with enough space
        bufferInfo.byteLength += arrayBuffer.byteLength;
    }

    writeCameras(resources, json) {
        if (resources.cameras.length > 0) {
            json.cameras = resources.cameras.map((cam) => {
                const projection = cam.projection;
                const nearClip = cam.nearClip;
                const farClip = cam.farClip;

                const camera = {};

                if (projection === PROJECTION_ORTHOGRAPHIC) {
                    camera.type = 'orthographic';
                    camera.orthographic = {
                        xmag: 1,
                        ymag: 1,
                        znear: nearClip,
                        zfar: farClip
                    };
                } else {
                    const fov = cam.fov;

                    camera.type = 'perspective';
                    camera.perspective = {
                        yfov: fov * math.DEG_TO_RAD,
                        znear: nearClip,
                        zfar: farClip
                    };
                }

                return camera;
            });
        }
    }

    attachTexture(resources, material, destination, name, textureSemantic, json) {
        const texture = material[textureSemantic];

        if (texture) {
            const textureIndex = resources.textures.indexOf(texture);
            if (textureIndex < 0) console.warn(`Texture ${texture.name} wasn't collected.`);
            destination[name] = {
                index: textureIndex
            };

            const scale = material[`${textureSemantic}Tiling`];
            const offset = material[`${textureSemantic}Offset`];
            const rotation = material[`${textureSemantic}Rotation`];

            if ((scale && !scale.equals(Vec2.ONE)) || (offset && !offset.equals(Vec2.ZERO)) || rotation !== 0) {
                destination[name].extensions = {
                    KHR_texture_transform: {}
                };

                json.extensionsUsed = json.extensionsUsed ?? [];
                if (!json.extensionsUsed.includes('KHR_texture_transform')) {
                    json.extensionsUsed.push('KHR_texture_transform');
                }

                json.extensionsRequired = json.extensionsRequired ?? [];
                if (!json.extensionsRequired.includes('KHR_texture_transform')) {
                    json.extensionsRequired.push('KHR_texture_transform');
                }

                if (scale && !scale.equals(Vec2.ONE)) {
                    destination[name].extensions.KHR_texture_transform.scale = [scale.x, scale.y];
                }

                if (offset && !offset.equals(Vec2.ZERO)) {
                    destination[name].extensions.KHR_texture_transform.offset = [offset.x, offset.y - 1 + scale.y];
                }

                if (rotation !== 0) {
                    destination[name].extensions.KHR_texture_transform.rotation = rotation * math.DEG_TO_RAD;
                }
            }
        }
    }

    addExtension(json, output, name, data = {}) {
        output.extensions = output.extensions || {};
        output.extensions[name] = data;

        json.extensionsUsed = json.extensionsUsed ?? [];
        if (!json.extensionsUsed.includes(name)) {
            json.extensionsUsed.push(name);
        }
    }

    writeStandardMaterial(resources, mat, output, json) {

        const { diffuse, emissive, opacity, metalness, gloss, glossInvert } = mat;
        const pbr = output.pbrMetallicRoughness;

        // For unlit materials, the parser copies baseColor to emissive and sets diffuse to white.
        // So we need to use emissive as the source for baseColorFactor.
        const baseColor = mat.useLighting ? diffuse : emissive;

        if (!baseColor.equals(Color.WHITE) || opacity !== 1) {
            const { r, g, b } = baseColor.clone().linear();
            pbr.baseColorFactor = [r, g, b, opacity];
        }

        // For spec-gloss materials (useMetalness=false), always export as dielectric (metallicFactor=0)
        // For metallic-roughness materials, export the actual metalness value
        if (mat.useMetalness) {
            if (metalness !== 1) {
                pbr.metallicFactor = metalness;
            }
        } else {
            pbr.metallicFactor = 0;
        }

        const roughness = glossInvert ? gloss : 1 - gloss;
        if (roughness !== 1) {
            pbr.roughnessFactor = roughness;
        }

        // For unlit, use emissiveMap as baseColorTexture source (parser copies diffuseMap to emissiveMap)
        this.attachTexture(resources, mat, pbr, 'baseColorTexture', mat.useLighting ? 'diffuseMap' : 'emissiveMap', json);
        this.attachTexture(resources, mat, pbr, 'metallicRoughnessTexture', 'metalnessMap', json);

        // Emissive (skip for unlit - emissive holds the baseColor)
        if (mat.useLighting && !emissive.equals(Color.BLACK)) {
            const { r, g, b } = emissive.clone().linear();
            output.emissiveFactor = [r, g, b];
        }

        // === Material Extensions ===

        // KHR_materials_anisotropy
        if (mat.enableGGXSpecular && (mat.anisotropyIntensity !== 0 || mat.anisotropyRotation !== 0 || mat.anisotropyMap)) {
            const anisotropyExt = {};

            if (mat.anisotropyIntensity !== 0) {
                anisotropyExt.anisotropyStrength = mat.anisotropyIntensity;
            }

            if (mat.anisotropyRotation !== 0) {
                anisotropyExt.anisotropyRotation = mat.anisotropyRotation * math.DEG_TO_RAD;
            }

            this.attachTexture(resources, mat, anisotropyExt, 'anisotropyTexture', 'anisotropyMap', json);

            if (Object.keys(anisotropyExt).length > 0) {
                this.addExtension(json, output, 'KHR_materials_anisotropy', anisotropyExt);
            }
        }

        // KHR_materials_clearcoat
        if (mat.clearCoat > 0) {
            const clearcoatExt = {
                // Parser multiplies by 0.25, so we divide by 0.25 (multiply by 4) to reverse
                clearcoatFactor: Math.min(mat.clearCoat * 4, 1)
            };

            // clearcoatRoughnessFactor: parser sets clearCoatGlossInvert=true, so gloss is roughness
            if (mat.clearCoatGloss !== 0) {
                clearcoatExt.clearcoatRoughnessFactor = mat.clearCoatGloss;
            }

            this.attachTexture(resources, mat, clearcoatExt, 'clearcoatTexture', 'clearCoatMap', json);
            this.attachTexture(resources, mat, clearcoatExt, 'clearcoatRoughnessTexture', 'clearCoatGlossMap', json);

            // clearcoatNormalTexture with scale
            if (mat.clearCoatNormalMap) {
                this.attachTexture(resources, mat, clearcoatExt, 'clearcoatNormalTexture', 'clearCoatNormalMap', json);
                if (mat.clearCoatBumpiness !== 1) {
                    clearcoatExt.clearcoatNormalTexture.scale = mat.clearCoatBumpiness;
                }
            }

            this.addExtension(json, output, 'KHR_materials_clearcoat', clearcoatExt);
        }

        // KHR_materials_dispersion
        if (mat.dispersion !== 0) {
            this.addExtension(json, output, 'KHR_materials_dispersion', {
                dispersion: mat.dispersion
            });
        }

        // KHR_materials_emissive_strength
        if (mat.useLighting && mat.emissiveIntensity !== 1) {
            this.addExtension(json, output, 'KHR_materials_emissive_strength', {
                emissiveStrength: mat.emissiveIntensity
            });
        }

        // KHR_materials_ior
        const defaultRefractionIndex = 1.0 / 1.5;
        if (mat.refractionIndex !== defaultRefractionIndex && mat.refractionIndex > 0) {
            this.addExtension(json, output, 'KHR_materials_ior', {
                ior: 1.0 / mat.refractionIndex
            });
        }

        // KHR_materials_iridescence
        if (mat.useIridescence) {
            const iridescenceExt = {};

            if (mat.iridescence !== 0) {
                iridescenceExt.iridescenceFactor = mat.iridescence;
            }

            if (mat.iridescenceRefractionIndex !== 1.3) {
                iridescenceExt.iridescenceIor = mat.iridescenceRefractionIndex;
            }

            if (mat.iridescenceThicknessMin !== 100) {
                iridescenceExt.iridescenceThicknessMinimum = mat.iridescenceThicknessMin;
            }

            if (mat.iridescenceThicknessMax !== 400) {
                iridescenceExt.iridescenceThicknessMaximum = mat.iridescenceThicknessMax;
            }

            this.attachTexture(resources, mat, iridescenceExt, 'iridescenceTexture', 'iridescenceMap', json);
            this.attachTexture(resources, mat, iridescenceExt, 'iridescenceThicknessTexture', 'iridescenceThicknessMap', json);

            if (Object.keys(iridescenceExt).length > 0) {
                this.addExtension(json, output, 'KHR_materials_iridescence', iridescenceExt);
            }
        }

        // KHR_materials_sheen
        if (mat.useSheen) {
            const sheenExt = {};

            if (!mat.sheen.equals(Color.BLACK)) {
                const { r, g, b } = mat.sheen.clone().linear();
                sheenExt.sheenColorFactor = [r, g, b];
            }

            if (mat.sheenGloss !== 0) {
                sheenExt.sheenRoughnessFactor = mat.sheenGloss;
            }

            this.attachTexture(resources, mat, sheenExt, 'sheenColorTexture', 'sheenMap', json);
            this.attachTexture(resources, mat, sheenExt, 'sheenRoughnessTexture', 'sheenGlossMap', json);

            if (Object.keys(sheenExt).length > 0) {
                this.addExtension(json, output, 'KHR_materials_sheen', sheenExt);
            }
        }

        // KHR_materials_specular
        // Export when:
        // 1. useMetalnessSpecularColor is true (metallic workflow with specular color tint)
        // 2. useMetalness is false (spec-gloss material) - preserve the specular color as F0
        if (mat.useMetalnessSpecularColor || !mat.useMetalness) {
            const specularExt = {};

            if (!mat.specular.equals(Color.WHITE)) {
                const { r, g, b } = mat.specular.clone().linear();
                specularExt.specularColorFactor = [r, g, b];
            }

            if (mat.specularityFactor !== 1) {
                specularExt.specularFactor = mat.specularityFactor;
            }

            this.attachTexture(resources, mat, specularExt, 'specularColorTexture', 'specularMap', json);
            this.attachTexture(resources, mat, specularExt, 'specularTexture', 'specularityFactorMap', json);

            if (Object.keys(specularExt).length > 0) {
                this.addExtension(json, output, 'KHR_materials_specular', specularExt);
            }
        }

        // KHR_materials_transmission
        if (mat.useDynamicRefraction && (mat.refraction !== 0 || mat.refractionMap)) {
            const transmissionExt = {};

            if (mat.refraction !== 0) {
                transmissionExt.transmissionFactor = mat.refraction;
            }

            this.attachTexture(resources, mat, transmissionExt, 'transmissionTexture', 'refractionMap', json);

            if (Object.keys(transmissionExt).length > 0) {
                this.addExtension(json, output, 'KHR_materials_transmission', transmissionExt);
            }
        }

        // KHR_materials_unlit
        if (!mat.useLighting) {
            this.addExtension(json, output, 'KHR_materials_unlit');
        }

        // KHR_materials_volume
        if (mat.useDynamicRefraction && (mat.thickness !== 0 || mat.attenuationDistance !== 0 || !mat.attenuation.equals(Color.WHITE) || mat.thicknessMap)) {
            const volumeExt = {};

            if (mat.thickness !== 0) {
                volumeExt.thicknessFactor = mat.thickness;
            }

            if (mat.attenuationDistance !== 0) {
                volumeExt.attenuationDistance = mat.attenuationDistance;
            }

            if (!mat.attenuation.equals(Color.WHITE)) {
                const { r, g, b } = mat.attenuation.clone().linear();
                volumeExt.attenuationColor = [r, g, b];
            }

            this.attachTexture(resources, mat, volumeExt, 'thicknessTexture', 'thicknessMap', json);

            if (Object.keys(volumeExt).length > 0) {
                this.addExtension(json, output, 'KHR_materials_volume', volumeExt);
            }
        }
    }

    writeMaterials(resources, json) {

        if (resources.materials.length > 0) {
            json.materials = resources.materials.map((mat) => {
                const { name, blendType, cull, alphaTest } = mat;
                const material = {
                    pbrMetallicRoughness: {}
                };

                if (name && name.length > 0) {
                    material.name = name;
                }

                if (mat instanceof StandardMaterial) {
                    this.writeStandardMaterial(resources, mat, material, json);
                }

                if (blendType === BLEND_NORMAL) {
                    material.alphaMode = 'BLEND';
                } else if (blendType === BLEND_NONE) {
                    if (alphaTest !== 0) {
                        material.alphaMode = 'MASK';
                        material.alphaCutoff = alphaTest;
                    }
                }

                if (cull === CULLFACE_NONE) {
                    material.doubleSided = true;
                }

                this.attachTexture(resources, mat, material, 'normalTexture', 'normalMap', json);
                this.attachTexture(resources, mat, material, 'occlusionTexture', 'aoMap', json);
                this.attachTexture(resources, mat, material, 'emissiveTexture', 'emissiveMap', json);

                return material;
            });
        }
    }

    writeNodes(resources, json) {
        if (resources.entities.length > 0) {
            json.nodes = resources.entities.map((entity) => {
                const name = entity.name;
                const t = entity.getLocalPosition();
                const r = entity.getLocalRotation();
                const s = entity.getLocalScale();

                const node = {};

                if (name && name.length > 0) {
                    node.name = name;
                }

                if (!t.equals(Vec3.ZERO)) {
                    node.translation = [t.x, t.y, t.z];
                }

                if (!r.equals(Quat.IDENTITY)) {
                    node.rotation = [r.x, r.y, r.z, r.w];
                }

                if (!s.equals(Vec3.ONE)) {
                    node.scale = [s.x, s.y, s.z];
                }

                if (entity.camera && entity.camera.enabled) {
                    node.camera = resources.cameras.indexOf(entity.camera);
                }

                const entityMeshInstance = resources.entityMeshInstances.find(e => e.node === entity);
                if (entityMeshInstance) {
                    node.mesh = resources.entityMeshInstances.indexOf(entityMeshInstance);

                    // Add skin reference if this node has a skinned mesh
                    const meshInstance = entityMeshInstance.meshInstances[0];
                    if (meshInstance && meshInstance.mesh.skin) {
                        node.skin = resources.skins.indexOf(meshInstance.mesh.skin);
                    }
                }

                if (entity.children.length > 0) {
                    node.children = [];

                    entity.children.forEach((child) => {
                        node.children.push(resources.entities.indexOf(child));
                    });
                }

                return node;
            });
        }
    }

    writeMeshes(resources, json, options) {
        if (resources.entityMeshInstances.length > 0) {
            json.accessors = [];
            json.meshes = [];

            resources.entityMeshInstances.forEach((entityMeshInstances) => {
                const mesh = {
                    primitives: []
                };

                // all mesh instances of a single node are stored as a single gltf mesh with multiple primitives
                const meshInstances = entityMeshInstances.meshInstances;
                meshInstances.forEach((meshInstance) => {
                    const primitive = GltfExporter.createPrimitive(resources, json, meshInstance.mesh, options);

                    primitive.material = resources.materials.indexOf(meshInstance.material);

                    mesh.primitives.push(primitive);
                });

                json.meshes.push(mesh);
            });
        }
    }

    static createPrimitive(resources, json, mesh, options = {}) {
        const primitive = {
            attributes: {}
        };

        // vertex buffer
        const { vertexBuffer } = mesh;
        const { format } = vertexBuffer;
        const { interleaved, elements } = format;
        const numVertices = vertexBuffer.getNumVertices();
        elements.forEach((element, elementIndex) => {
            const semantic = getSemantic(element.name);

            // Skip unused attributes if stripping is enabled
            if (options.stripUnusedAttributes) {
                let isUsed = true;

                // Check texture coordinates
                if (semantic.startsWith('TEXCOORD_')) {
                    const texCoordIndex = parseInt(semantic.split('_')[1], 10);
                    isUsed = resources.materials.some((material) => {
                        return textureSemantics.some((texSemantic) => {
                            const texture = material[texSemantic];
                            // Most materials use UV0 by default, so keep TEXCOORD_0 unless explicitly using a different UV set
                            return texture && (texCoordIndex === 0 || material[`${texSemantic}Tiling`]?.uv === texCoordIndex);
                        });
                    });
                }

                // Check vertex colors
                if (semantic === 'COLOR_0') {
                    isUsed = resources.materials.some(material => material.vertexColors);
                }

                // Check tangents
                if (semantic === 'TANGENT') {
                    isUsed = resources.materials.some(material => material.normalMap);
                }

                // Check skinning attributes
                if (semantic === 'JOINTS_0' || semantic === 'WEIGHTS_0') {
                    isUsed = resources.entityMeshInstances.some(emi => emi.meshInstances.some(mi => mi.mesh.skin));
                }

                if (!isUsed) {
                    return; // Skip this attribute
                }
            }

            let bufferView = resources.bufferViewMap.get(vertexBuffer);
            if (!bufferView) {
                GltfExporter.writeBufferView(resources, json, vertexBuffer);
                resources.buffers.push(vertexBuffer);

                bufferView = resources.bufferViewMap.get(vertexBuffer);
            }
            const viewIndex = bufferView[interleaved ? 0 : elementIndex];

            const accessor = {
                bufferView: viewIndex,
                byteOffset: interleaved ? element.offset : 0,
                componentType: getComponentType(element.dataType),
                type: getAccessorType(element.numComponents),
                count: numVertices
            };

            const idx = json.accessors.push(accessor) - 1;
            primitive.attributes[semantic] = idx;

            // Position accessor also requires min and max properties
            if (element.name === SEMANTIC_POSITION) {
                // compute min and max from positions, as the BoundingBox stores center and extents,
                // and we get precision warnings from gltf validator
                const positions = [];
                mesh.getPositions(positions);
                const min = new Vec3();
                const max = new Vec3();
                BoundingBox.computeMinMax(positions, min, max);

                accessor.min = [min.x, min.y, min.z];
                accessor.max = [max.x, max.y, max.z];
            }
        });

        // index buffer
        const indexBuffer = mesh.indexBuffer[0];
        if (indexBuffer) {
            let bufferView = resources.bufferViewMap.get(indexBuffer);
            if (!bufferView) {
                GltfExporter.writeBufferView(resources, json, indexBuffer);
                resources.buffers.push(indexBuffer);

                bufferView = resources.bufferViewMap.get(indexBuffer);
            }
            const viewIndex = bufferView[0];

            const accessor = {
                bufferView: viewIndex,
                componentType: getIndexComponentType(indexBuffer.getFormat()),
                count: indexBuffer.getNumIndices(),
                type: 'SCALAR'
            };

            const idx = json.accessors.push(accessor) - 1;
            primitive.indices = idx;
        }

        return primitive;
    }

    writeSkins(resources, json) {
        if (resources.skins.length > 0) {
            json.skins = resources.skins.map((skin) => {
                // Create float32 array for inverse bind matrices
                const matrices = new Float32Array(skin.inverseBindPose.length * 16);
                for (let i = 0; i < skin.inverseBindPose.length; i++) {
                    const ibm = skin.inverseBindPose[i];
                    matrices.set(ibm.data, i * 16);
                }

                // Create buffer view for matrices
                const matrixBuffer = matrices.buffer;
                GltfExporter.writeBufferView(resources, json, matrixBuffer);
                resources.buffers.push(matrixBuffer);
                const bufferView = resources.bufferViewMap.get(matrixBuffer);

                // Create accessor for inverse bind matrices
                const accessor = {
                    bufferView: bufferView[0],
                    componentType: getComponentType(TYPE_FLOAT32),
                    count: skin.inverseBindPose.length,
                    type: 'MAT4'
                };
                const accessorIndex = json.accessors.push(accessor) - 1;

                // Find joint nodes by bone names
                const joints = skin.boneNames.map((boneName) => {
                    const node = resources.entities.find(entity => entity.name === boneName);
                    return resources.entities.indexOf(node);
                });

                // Create skin
                return {
                    inverseBindMatrices: accessorIndex,
                    joints: joints
                };
            });
        }
    }

    convertTextures(srcTextures, options) {

        const textureOptions = {
            maxTextureSize: options.maxTextureSize
        };

        const promises = [];
        srcTextures.forEach((srcTexture) => {
            const promise = this.textureToCanvas(srcTexture, textureOptions);
            promise.then((canvas) => {
                // eslint-disable-next-line no-promise-executor-return
                return new Promise(resolve => resolve(canvas));
            });
            promises.push(promise);
        });
        return promises;
    }

    writeTextures(resources, textureCanvases, json, options) {
        const textures = resources.textures;

        const promises = [];

        for (let i = 0; i < textureCanvases.length; i++) {

            // convert texture data to uri
            const texture = textures[i];
            const canvas = textureCanvases[i];

            const isRGBA = isCanvasTransparent(canvas) || !resources.compressableTexture.has(texture);
            const mimeType = isRGBA ? 'image/png' : 'image/jpeg';

            promises.push(
                this.getBlob(canvas, mimeType)
                .then((blob) => {
                    const reader = new FileReader();
                    reader.readAsArrayBuffer(blob);

                    return new Promise((resolve) => {
                        reader.onloadend = () => {
                            resolve(reader);
                        };
                    });
                })
                .then((reader) => {
                    const buffer = this.getPaddedArrayBuffer(reader.result);

                    GltfExporter.writeBufferView(resources, json, buffer);
                    resources.buffers.push(buffer);

                    const bufferView = resources.bufferViewMap.get(buffer);

                    json.images[i] = {
                        mimeType: mimeType,
                        bufferView: bufferView[0]
                    };

                    json.samplers[i] = {
                        minFilter: getFilter(texture.minFilter),
                        magFilter: getFilter(texture.magFilter),
                        wrapS: getWrap(texture.addressU),
                        wrapT: getWrap(texture.addressV)
                    };

                    json.textures[i] = {
                        sampler: i,
                        source: i
                    };
                })
            );
        }

        return Promise.all(promises);
    }

    getBlob(canvas, mimeType) {
        if (canvas.toBlob !== undefined) {
            return new Promise((resolve) => {
                canvas.toBlob(resolve, mimeType);
            });
        }

        let quality = 1.0;
        if (mimeType === 'image/jpeg') {
            quality = 0.92;
        }

        return canvas.convertToBlob({
            type: mimeType,
            quality: quality
        });
    }

    getPaddedArrayBuffer(arrayBuffer, paddingByte = 0) {
        const paddedLength = math.roundUp(arrayBuffer.byteLength, 4);
        if (paddedLength !== arrayBuffer.byteLength) {
            const array = new Uint8Array(paddedLength);
            array.set(new Uint8Array(arrayBuffer));
            if (paddingByte !== 0) {
                for (let i = arrayBuffer.byteLength; i < paddedLength; i++) {
                    array[i] = paddingByte;
                }
            }
            return array.buffer;
        }
        return arrayBuffer;
    }

    buildJson(resources, options) {

        const promises = this.convertTextures(resources.textures, options);
        return Promise.all(promises).then(async (textureCanvases) => {

            const json = {
                asset: {
                    version: '2.0',
                    generator: 'PlayCanvas GltfExporter'
                },
                scenes: [
                    {
                        nodes: [
                            0
                        ]
                    }
                ],
                images: [
                ],
                samplers: [
                ],
                textures: [
                ],
                scene: 0
            };

            this.writeBufferViews(resources, json);
            this.writeCameras(resources, json);
            this.writeMeshes(resources, json, options);
            this.writeMaterials(resources, json);
            this.writeNodes(resources, json, options);
            this.writeSkins(resources, json);
            await this.writeTextures(resources, textureCanvases, json, options);

            // delete unused properties
            if (!json.images.length) delete json.images;
            if (!json.samplers.length) delete json.samplers;
            if (!json.textures.length) delete json.textures;

            return json;
        });
    }

    /**
     * Converts a hierarchy of entities to GLB format.
     *
     * @param {Entity} entity - The root of the entity hierarchy to convert.
     * @param {object} options - Object for passing optional arguments.
     * @param {number} [options.maxTextureSize] - Maximum texture size. Texture is resized if over the size.
     * @param {boolean} [options.stripUnusedAttributes] - If true, removes unused vertex attributes:
     *
     * - Texture coordinates not referenced by materials
     * - Vertex colors if not used by materials
     * - Tangents if no normal maps are used
     * - Skinning data if no skinned meshes exist
     *
     * Defaults to false.
     * @returns {Promise<ArrayBuffer>} - The GLB file content.
     */
    build(entity, options = {}) {
        const resources = this.collectResources(entity);

        return this.buildJson(resources, options).then((json) => {
            const encoder = new TextEncoder();
            const jsonData = encoder.encode(JSON.stringify(json));

            const headerLength = 12;

            const jsonHeaderLength = 8;
            const jsonDataLength = jsonData.length;
            const jsonPaddingLength = (4 - (jsonDataLength & 3)) & 3;

            const binaryHeaderLength = 8;
            const binaryDataLength = json.buffers.reduce(
                (total, buffer) => math.roundUp(total + buffer.byteLength, 4),
                0
            );

            let totalLength = headerLength + jsonHeaderLength + jsonDataLength + jsonPaddingLength;
            if (binaryDataLength > 0) {
                totalLength += binaryHeaderLength + binaryDataLength;
            }

            const glbBuffer = new ArrayBuffer(totalLength);
            const glbView = new DataView(glbBuffer);

            // GLB header
            glbView.setUint32(0, 0x46546C67, true);
            glbView.setUint32(4, 2, true);
            glbView.setUint32(8, totalLength, true);

            // JSON chunk header
            glbView.setUint32(12, jsonDataLength + jsonPaddingLength, true);
            glbView.setUint32(16, 0x4E4F534A, true);

            let offset = headerLength + jsonHeaderLength;

            // JSON data
            new Uint8Array(glbBuffer, offset, jsonDataLength).set(jsonData);

            offset += jsonDataLength;

            for (let i = 0; i < jsonPaddingLength; i++) {
                glbView.setUint8(offset + i, 0x20);
            }

            offset += jsonPaddingLength;

            if (binaryDataLength > 0) {
                // Binary chunk header
                glbView.setUint32(offset, binaryDataLength, true);
                glbView.setUint32(offset + 4, 0x004E4942, true);

                offset += binaryHeaderLength;

                resources.buffers.forEach((buffer) => {
                    let src;

                    const bufferViewId = resources.bufferViewMap.get(buffer)[0];

                    const bufferOffset = json.bufferViews[bufferViewId].byteOffset;

                    if (buffer instanceof ArrayBuffer) {
                        src = new Uint8Array(buffer);
                    } else {
                        const srcBuffer = buffer.lock();
                        if (srcBuffer instanceof ArrayBuffer) {
                            src = new Uint8Array(srcBuffer);
                        } else {
                            src = new Uint8Array(srcBuffer.buffer, srcBuffer.byteOffset, srcBuffer.byteLength);
                        }
                    }
                    const dst = new Uint8Array(glbBuffer, offset + bufferOffset, src.byteLength);
                    dst.set(src);
                });
            }

            return Promise.resolve(glbBuffer);
        });
    }
}

export { GltfExporter };
