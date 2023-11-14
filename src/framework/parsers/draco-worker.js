function DracoWorker(jsUrl, wasmUrl) {
    let draco;

    // https://github.com/google/draco/blob/master/src/draco/attributes/geometry_attribute.h#L43
    const POSITION_ATTRIBUTE = 0;
    const NORMAL_ATTRIBUTE = 1;

    const wrap = (typedArray, dataType) => {
        switch (dataType) {
            case draco.DT_INT8: return new Int8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
            case draco.DT_INT16: return new Int16Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength / 2);
            case draco.DT_INT32: return new Int32Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength / 4);
            case draco.DT_UINT8: return new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
            case draco.DT_UINT16: return new Uint16Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength / 2);
            case draco.DT_UINT32: return new Uint32Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength / 4);
            case draco.DT_FLOAT32: return new Float32Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength / 4);
        }
        return null;
    };

    const componentSizeInBytes = (dataType) => {
        switch (dataType) {
            case draco.DT_INT8: return 1;
            case draco.DT_INT16: return 2;
            case draco.DT_INT32: return 4;
            case draco.DT_UINT8: return 1;
            case draco.DT_UINT16: return 2;
            case draco.DT_UINT32: return 4;
            case draco.DT_FLOAT32: return 4;
        }
        return 1;
    };

    const attributeSizeInBytes = (attribute) => {
        return attribute.num_components() * componentSizeInBytes(attribute.data_type());
    };

    const attributeOrder = {
        0: 0,   // position
        1: 1,   // normal
        5: 2,   // tangent
        2: 3,   // color
        7: 4,   // joints
        8: 5,   // weights
        4: 6,   // generic (used for blend indices and weights)
        3: 7    // texcoord
    };

    const generateNormals = (vertices, indices) => {
        const subtract = (dst, a, b) => {
            dst[0] = a[0] - b[0];
            dst[1] = a[1] - b[1];
            dst[2] = a[2] - b[2];
        };

        const cross = (dst, a, b) => {
            dst[0] = a[1] * b[2] - b[1] * a[2];
            dst[1] = a[2] * b[0] - b[2] * a[0];
            dst[2] = a[0] * b[1] - b[0] * a[1];
        };

        const normalize = (dst, offset) => {
            const a = dst[offset + 0];
            const b = dst[offset + 1];
            const c = dst[offset + 2];
            const l = 1.0 / Math.sqrt(a * a + b * b + c * c);
            dst[offset + 0] *= l;
            dst[offset + 1] *= l;
            dst[offset + 2] *= l;
        };

        const copy = (dst, src, srcOffset) => {
            for (let i = 0; i < 3; ++i) {
                dst[i] = src[srcOffset + i];
            }
        };

        const numTriangles = indices.length / 3;
        const numVertices = vertices.length / 3;
        const result = new Float32Array(vertices.length);
        const a = [0, 0, 0],
            b = [0, 0, 0],
            c = [0, 0, 0],
            t1 = [0, 0, 0],
            t2 = [0, 0, 0],
            n = [0, 0, 0];

        for (let i = 0; i < numTriangles; ++i) {
            const v0 = indices[i * 3 + 0] * 3;
            const v1 = indices[i * 3 + 1] * 3;
            const v2 = indices[i * 3 + 2] * 3;

            copy(a, vertices, v0);
            copy(b, vertices, v1);
            copy(c, vertices, v2);

            subtract(t1, b, a);
            subtract(t2, c, a);
            cross(n, t1, t2);
            normalize(n, 0);

            for (let j = 0; j < 3; ++j) {
                result[v0 + j] += n[j];
                result[v1 + j] += n[j];
                result[v2 + j] += n[j];
            }
        }

        for (let i = 0; i < numVertices; ++i) {
            normalize(result, i * 3);
        }

        return new Uint8Array(result.buffer);
    };

    const decodeMesh = (inputBuffer) => {
        const result = { };

        const buffer = new draco.DecoderBuffer();
        buffer.Init(inputBuffer, inputBuffer.length);

        const decoder = new draco.Decoder();
        if (decoder.GetEncodedGeometryType(buffer) !== draco.TRIANGULAR_MESH) {
            result.error = 'Failed to decode draco mesh: not a mesh';
            return result;
        }

        const mesh = new draco.Mesh();
        const status = decoder.DecodeBufferToMesh(buffer, mesh);

        if (!status || !status.ok() || mesh.ptr === 0) {
            result.error = 'Failed to decode draco asset';
            return result;
        }

        // indices
        const numIndices = mesh.num_faces() * 3;
        const shortIndices = mesh.num_points() <= 65535;
        const indicesSize = numIndices * (shortIndices ? 2 : 4);
        const indicesPtr = draco._malloc(indicesSize);
        if (shortIndices) {
            decoder.GetTrianglesUInt16Array(mesh, indicesSize, indicesPtr);
            result.indices = new Uint16Array(draco.HEAPU16.buffer, indicesPtr, numIndices).slice().buffer;
        } else {
            decoder.GetTrianglesUInt32Array(mesh, indicesSize, indicesPtr);
            result.indices = new Uint32Array(draco.HEAPU32.buffer, indicesPtr, numIndices).slice().buffer;
        }
        draco._free(indicesPtr);

        // vertices
        const attributes = [];
        for (let i = 0; i < mesh.num_attributes(); ++i) {
            attributes.push(decoder.GetAttribute(mesh, i));
        }

        // order attributes
        attributes.sort((a, b) => {
            return (attributeOrder[a.attribute_type()] ?? attributeOrder.length) - (attributeOrder[b.attribute_type()] ?? attributeOrder.length);
        });

        // store attribute order by unique_id
        result.attributes = attributes.map(a => a.unique_id());

        // calculate total vertex size and attribute offsets
        let totalVertexSize = 0;
        const offsets = attributes.map((a) => {
            const offset = totalVertexSize;
            totalVertexSize += Math.ceil(attributeSizeInBytes(a) / 4) * 4;
            return offset;
        });

        // we will generate normals if they're missing
        const hasNormals = attributes.some(a => a.attribute_type() === NORMAL_ATTRIBUTE);
        const normalOffset = offsets[1];
        if (!hasNormals) {
            for (let i = 1; i < offsets.length; ++i) {
                offsets[i] += 12;
            }
            totalVertexSize += 12;
        }

        // create vertex buffer
        result.vertices = new ArrayBuffer(mesh.num_points() * totalVertexSize);

        // decode and interleave the vertex data
        const dst = new Uint8Array(result.vertices);
        for (let i = 0; i < mesh.num_attributes(); ++i) {
            const attribute = attributes[i];
            const sizeInBytes = attributeSizeInBytes(attribute);
            const ptrSize = mesh.num_points() * sizeInBytes;
            const ptr = draco._malloc(ptrSize);
            decoder.GetAttributeDataArrayForAllPoints(mesh, attribute, attribute.data_type(), ptrSize, ptr);
            const src = new Uint8Array(draco.HEAPU8.buffer, ptr, ptrSize);

            // pack
            for (let j = 0; j < mesh.num_points(); ++j) {
                for (let c = 0; c < sizeInBytes; ++c) {
                    dst[j * totalVertexSize + offsets[i] + c] = src[j * sizeInBytes + c];
                }
            }

            if (!hasNormals && attribute.attribute_type() === POSITION_ATTRIBUTE) {
                // generate normals just after position
                const normals = generateNormals(wrap(src, attribute.data_type()),
                                                shortIndices ? new Uint16Array(result.indices) : new Uint32Array(result.indices));

                // pack normals
                for (let j = 0; j < mesh.num_points(); ++j) {
                    for (let c = 0; c < 12; ++c) {
                        dst[j * totalVertexSize + normalOffset + c] = normals[j * 12 + c];
                    }
                }
            }

            draco._free(ptr);
        }

        // cleanup
        draco.destroy(mesh);
        draco.destroy(decoder);
        draco.destroy(buffer);

        return result;
    };

    const decode = (data) => {
        const result = decodeMesh(new Uint8Array(data.buffer));
        self.postMessage({
            jobId: data.jobId,
            error: result.error,
            indices: result.indices,
            vertices: result.vertices,
            attributes: result.attributes
        }, [result.indices, result.vertices].filter(t => t != null));
    };

    const workQueue = [];

    // handle incoming message
    self.onmessage = (message) => {
        const data = message.data;
        switch (data.type) {
            case 'init':
                // initialize draco module
                self.DracoDecoderModule({
                    instantiateWasm: (imports, successCallback) => {
                        WebAssembly.instantiate(data.module, imports)
                            .then(result => successCallback(result))
                            .catch(reason => console.error('instantiate failed + ' + reason));
                        return {};
                    }
                })
                    .then((instance) => {
                        draco = instance;
                        workQueue.forEach(data => decode(data));
                    });
                break;
            case 'decodeMesh':
                if (draco) {
                    decode(data);
                } else {
                    workQueue.push(data);
                }
                break;
        }
    };
}

export {
    DracoWorker
};
