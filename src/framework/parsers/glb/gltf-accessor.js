import { Vec3 } from '../../../core/math/vec3.js';
import { BoundingBox } from '../../../core/shape/bounding-box.js';
import {
    PRIMITIVE_LINELOOP, PRIMITIVE_LINESTRIP, PRIMITIVE_LINES, PRIMITIVE_POINTS, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP,
    SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT,
    SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7,
    TYPE_INT8, TYPE_UINT8, TYPE_INT16, TYPE_UINT16, TYPE_INT32, TYPE_UINT32, TYPE_FLOAT32
} from '../../../platform/graphics/constants.js';

// map of glTF attribute names to engine semantics
const gltfToEngineSemanticMap = {
    'POSITION': SEMANTIC_POSITION,
    'NORMAL': SEMANTIC_NORMAL,
    'TANGENT': SEMANTIC_TANGENT,
    'COLOR_0': SEMANTIC_COLOR,
    'JOINTS_0': SEMANTIC_BLENDINDICES,
    'WEIGHTS_0': SEMANTIC_BLENDWEIGHT,
    'TEXCOORD_0': SEMANTIC_TEXCOORD0,
    'TEXCOORD_1': SEMANTIC_TEXCOORD1,
    'TEXCOORD_2': SEMANTIC_TEXCOORD2,
    'TEXCOORD_3': SEMANTIC_TEXCOORD3,
    'TEXCOORD_4': SEMANTIC_TEXCOORD4,
    'TEXCOORD_5': SEMANTIC_TEXCOORD5,
    'TEXCOORD_6': SEMANTIC_TEXCOORD6,
    'TEXCOORD_7': SEMANTIC_TEXCOORD7
};

const getPrimitiveType = (primitive) => {
    if (!primitive.hasOwnProperty('mode')) {
        return PRIMITIVE_TRIANGLES;
    }

    switch (primitive.mode) {
        case 0: return PRIMITIVE_POINTS;
        case 1: return PRIMITIVE_LINES;
        case 2: return PRIMITIVE_LINELOOP;
        case 3: return PRIMITIVE_LINESTRIP;
        case 4: return PRIMITIVE_TRIANGLES;
        case 5: return PRIMITIVE_TRISTRIP;
        case 6: return PRIMITIVE_TRIFAN;
        default: return PRIMITIVE_TRIANGLES;
    }
};

// returns a function for dequantizing the data type
const getDequantizeFunc = (srcType) => {
    // see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization#encoding-quantized-data
    switch (srcType) {
        case TYPE_INT8: return x => Math.max(x / 127.0, -1.0);
        case TYPE_UINT8: return x => x / 255.0;
        case TYPE_INT16: return x => Math.max(x / 32767.0, -1.0);
        case TYPE_UINT16: return x => x / 65535.0;
        default: return x => x;
    }
};

// dequantize an array of data
const dequantizeArray = (dstArray, srcArray, srcType) => {
    const convFunc = getDequantizeFunc(srcType);
    const len = srcArray.length;
    for (let i = 0; i < len; ++i) {
        dstArray[i] = convFunc(srcArray[i]);
    }
    return dstArray;
};

/**
 * Utility functions for decoding glTF accessor data.
 *
 * @ignore
 */
class GltfAccessor {
    static getNumComponents(accessorType) {
        switch (accessorType) {
            case 'SCALAR': return 1;
            case 'VEC2': return 2;
            case 'VEC3': return 3;
            case 'VEC4': return 4;
            case 'MAT2': return 4;
            case 'MAT3': return 9;
            case 'MAT4': return 16;
            default: return 3;
        }
    }

    static getComponentType(componentType) {
        switch (componentType) {
            case 5120: return TYPE_INT8;
            case 5121: return TYPE_UINT8;
            case 5122: return TYPE_INT16;
            case 5123: return TYPE_UINT16;
            case 5124: return TYPE_INT32;
            case 5125: return TYPE_UINT32;
            case 5126: return TYPE_FLOAT32;
            default: return 0;
        }
    }

    static getComponentSizeInBytes(componentType) {
        switch (componentType) {
            case 5120: return 1;    // int8
            case 5121: return 1;    // uint8
            case 5122: return 2;    // int16
            case 5123: return 2;    // uint16
            case 5124: return 4;    // int32
            case 5125: return 4;    // uint32
            case 5126: return 4;    // float32
            default: return 0;
        }
    }

    static getComponentDataType(componentType) {
        switch (componentType) {
            case 5120: return Int8Array;
            case 5121: return Uint8Array;
            case 5122: return Int16Array;
            case 5123: return Uint16Array;
            case 5124: return Int32Array;
            case 5125: return Uint32Array;
            case 5126: return Float32Array;
            default: return null;
        }
    }

    // get accessor data, making a copy and patching in the case of a sparse accessor
    static getData(gltfAccessor, bufferViews, flatten = false) {
        const numComponents = GltfAccessor.getNumComponents(gltfAccessor.type);
        const dataType = GltfAccessor.getComponentDataType(gltfAccessor.componentType);
        if (!dataType) {
            return null;
        }

        let result;

        if (gltfAccessor.sparse) {
            // handle sparse data
            const sparse = gltfAccessor.sparse;

            // get indices data
            const indicesAccessor = {
                count: sparse.count,
                type: 'SCALAR'
            };
            const indices = GltfAccessor.getData(Object.assign(indicesAccessor, sparse.indices), bufferViews, true);

            // data values data
            const valuesAccessor = {
                count: sparse.count,
                type: gltfAccessor.type,
                componentType: gltfAccessor.componentType
            };
            const values = GltfAccessor.getData(Object.assign(valuesAccessor, sparse.values), bufferViews, true);

            // get base data
            if (gltfAccessor.hasOwnProperty('bufferView')) {
                const baseAccessor = {
                    bufferView: gltfAccessor.bufferView,
                    byteOffset: gltfAccessor.byteOffset,
                    componentType: gltfAccessor.componentType,
                    count: gltfAccessor.count,
                    type: gltfAccessor.type
                };
                // make a copy of the base data since we'll patch the values
                result = GltfAccessor.getData(baseAccessor, bufferViews, true).slice();
            } else {
                // there is no base data, create empty 0'd out data
                result = new dataType(gltfAccessor.count * numComponents);
            }

            for (let i = 0; i < sparse.count; ++i) {
                const targetIndex = indices[i];
                for (let j = 0; j < numComponents; ++j) {
                    result[targetIndex * numComponents + j] = values[i * numComponents + j];
                }
            }
        } else {
            if (gltfAccessor.hasOwnProperty('bufferView')) {
                const bufferView = bufferViews[gltfAccessor.bufferView];
                if (flatten && bufferView.hasOwnProperty('byteStride')) {
                    // flatten stridden data
                    const bytesPerElement = numComponents * dataType.BYTES_PER_ELEMENT;
                    const storage = new ArrayBuffer(gltfAccessor.count * bytesPerElement);
                    const tmpArray = new Uint8Array(storage);

                    let dstOffset = 0;
                    for (let i = 0; i < gltfAccessor.count; ++i) {
                        // no need to add bufferView.byteOffset because accessor takes this into account
                        let srcOffset = (gltfAccessor.byteOffset || 0) + i * bufferView.byteStride;
                        for (let b = 0; b < bytesPerElement; ++b) {
                            tmpArray[dstOffset++] = bufferView[srcOffset++];
                        }
                    }

                    result = new dataType(storage);
                } else {
                    result = new dataType(bufferView.buffer,
                        bufferView.byteOffset + (gltfAccessor.byteOffset || 0),
                        gltfAccessor.count * numComponents);
                }
            } else {
                result = new dataType(gltfAccessor.count * numComponents);
            }
        }

        return result;
    }

    // extract a single component of an interleaved accessor data array into a new array
    static extractComponent(source, numComponents, component, count) {
        const result = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            result[i] = source[i * numComponents + component];
        }
        return result;
    }

    // get accessor data as (unnormalized, unquantized) Float32 data
    static getDataFloat32(gltfAccessor, bufferViews) {
        const data = GltfAccessor.getData(gltfAccessor, bufferViews, true);
        if (data instanceof Float32Array || !gltfAccessor.normalized) {
            // if the source data is quantized (say to int16), but not normalized
            // then reading the values of the array is the same whether the values
            // are stored as float32 or int16. so probably no need to convert to
            // float32.
            return data;
        }

        const float32Data = new Float32Array(data.length);
        dequantizeArray(float32Data, data, GltfAccessor.getComponentType(gltfAccessor.componentType));
        return float32Data;
    }

    // returns a dequantized bounding box for the accessor
    static getBoundingBox(gltfAccessor) {
        let min = gltfAccessor.min;
        let max = gltfAccessor.max;
        if (!min || !max) {
            return null;
        }

        if (gltfAccessor.normalized) {
            const ctype = GltfAccessor.getComponentType(gltfAccessor.componentType);
            min = dequantizeArray([], min, ctype);
            max = dequantizeArray([], max, ctype);
        }

        return new BoundingBox(
            new Vec3((max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5),
            new Vec3((max[0] - min[0]) * 0.5, (max[1] - min[1]) * 0.5, (max[2] - min[2]) * 0.5)
        );
    }
}

export { GltfAccessor, getPrimitiveType, gltfToEngineSemanticMap };
