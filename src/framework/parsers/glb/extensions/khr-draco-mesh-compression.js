import { Debug } from '../../../../core/debug.js';
import {
    BUFFER_STATIC, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32,
    SEMANTIC_COLOR, SEMANTIC_NORMAL, TYPE_UINT8, TYPE_UINT16
} from '../../../../platform/graphics/constants.js';
import { IndexBuffer } from '../../../../platform/graphics/index-buffer.js';
import { VertexBuffer } from '../../../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../../../platform/graphics/vertex-format.js';
import { Mesh } from '../../../../scene/mesh.js';
import { dracoDecode } from '../../draco-decoder.js';
import { GltfAccessor, getPrimitiveType, gltfToEngineSemanticMap } from '../gltf-accessor.js';
import { registerMeshVariants } from './khr-materials-variants.js';

// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_draco_mesh_compression
const createDracoMesh = (device, primitive, accessors, bufferViews, meshVariants, meshDefaultMaterials, promises) => {
    // create the mesh
    const result = new Mesh(device);
    result.aabb = GltfAccessor.getBoundingBox(accessors[primitive.attributes.POSITION]);

    promises.push(new Promise((resolve, reject) => {
        // decode draco data
        const dracoExt = primitive.extensions.KHR_draco_mesh_compression;
        const initialized = dracoDecode(bufferViews[dracoExt.bufferView].slice().buffer, (err, decompressedData) => {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                // create a mapping from draco attribute id to glTF semantic name
                const idToSemantic = {};
                for (const [name, id] of Object.entries(dracoExt.attributes)) {
                    idToSemantic[id] = gltfToEngineSemanticMap[name];
                }
                // special id -1 is used for generated normals
                idToSemantic[-1] = SEMANTIC_NORMAL;

                // build vertex description from worker-provided attribute metadata
                // this ensures we use the actual data types, sizes, and offsets from Draco decoding
                const vertexDesc = [];
                for (const attr of decompressedData.attributes) {
                    const semantic = idToSemantic[attr.id];
                    if (semantic !== undefined) {
                        // get normalization info from glTF accessor if available
                        let normalize = false;
                        if (attr.id !== -1) {
                            // find the glTF attribute name for this draco id
                            for (const [name, id] of Object.entries(dracoExt.attributes)) {
                                if (id === attr.id && primitive.attributes[name] !== undefined) {
                                    const accessor = accessors[primitive.attributes[name]];
                                    normalize = accessor.normalized ?? (semantic === SEMANTIC_COLOR && (attr.dataType === TYPE_UINT8 || attr.dataType === TYPE_UINT16));
                                    break;
                                }
                            }
                        }

                        vertexDesc.push({
                            semantic: semantic,
                            components: attr.numComponents,
                            type: attr.dataType,
                            normalize: normalize,
                            // use offset and stride from worker to handle cases where Draco mesh
                            // has additional attributes not listed in glTF
                            offset: attr.offset,
                            stride: decompressedData.stride
                        });
                    }
                }

                const vertexFormat = new VertexFormat(device, vertexDesc);

                // use stride from worker to correctly calculate vertex count
                const numVertices = decompressedData.vertices.byteLength / decompressedData.stride;
                const indexFormat = numVertices <= 65535 ? INDEXFORMAT_UINT16 : INDEXFORMAT_UINT32;
                const numIndices = decompressedData.indices.byteLength / (numVertices <= 65535 ? 2 : 4);

                Debug.call(() => {
                    if (numVertices !== accessors[primitive.attributes.POSITION].count) {
                        Debug.warn('mesh has invalid vertex count');
                    }
                    if (primitive.indices !== undefined && numIndices !== accessors[primitive.indices].count) {
                        Debug.warn('mesh has invalid index count');
                    }
                });

                const vertexBuffer = new VertexBuffer(device, vertexFormat, numVertices, {
                    data: decompressedData.vertices
                });
                const indexBuffer = new IndexBuffer(device, indexFormat, numIndices, BUFFER_STATIC, decompressedData.indices);

                result.vertexBuffer = vertexBuffer;
                result.indexBuffer[0] = indexBuffer;
                result.primitive[0].type = getPrimitiveType(primitive);
                result.primitive[0].base = 0;
                result.primitive[0].count = indexBuffer ? numIndices : numVertices;
                result.primitive[0].indexed = !!indexBuffer;

                resolve();
            }
        });

        if (!initialized) {
            const message = 'glTF file contains Draco compressed meshes, but the Draco decoder is not configured. Call dracoInitialize() or WasmModule.setConfig(\'DracoDecoderModule\', ...) before loading the asset.';
            Debug.warnOnce(message);
            reject(new Error(message));
        }
    }));

    // handle material variants
    registerMeshVariants(primitive, result.id, meshVariants);

    meshDefaultMaterials[result.id] = primitive.material;

    return result;
};

export { createDracoMesh };
