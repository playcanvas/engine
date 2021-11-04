import { now } from '../../core/time.js';
import { Vec3 } from '../../math/vec3.js';
import { Mat4 } from '../../math/mat4.js';

import { BoundingBox } from '../../shape/bounding-box.js';
import { BoundingSphere } from '../../shape/bounding-sphere.js';

import { PRIMITIVE_TRIANGLES, SEMANTIC_POSITION } from '../../graphics/constants.js';
import { IndexBuffer } from '../../graphics/index-buffer.js';

import { LIGHTTYPE_OMNI, LIGHTTYPE_SPOT } from '../constants.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';

const tempSphere = new BoundingSphere();

class StaticMeshes {
    static lightCompare(lightA, lightB) {
        return lightA.key - lightB.key;
    }

    static prepare(device, scene, meshInstances, lights) {
        // #if _PROFILER
        const prepareTime = now();
        let searchTime = 0;
        let subSearchTime = 0;
        let triAabbTime = 0;
        let subTriAabbTime = 0;
        let writeMeshTime = 0;
        let subWriteMeshTime = 0;
        let combineTime = 0;
        let subCombineTime = 0;
        // #endif

        let i, j, k, v, s, index;

        const drawCalls = meshInstances;
        const drawCallsCount = drawCalls.length;
        let drawCall, light;

        const newDrawCalls = [];
        let mesh;
        let indices, verts, numTris, elems, vertSize, offsetP, baseIndex;
        let _x, _y, _z;
        let minx, miny, minz, maxx, maxy, maxz;
        let minv, maxv;
        const minVec = new Vec3();
        const maxVec = new Vec3();
        const localLightBounds = new BoundingBox();
        const invMatrix = new Mat4();
        const triLightComb = [];
        let triLightCombUsed;
        let indexBuffer, vertexBuffer;
        let combIndices, combIbName, combIb;
        let lightTypePass;
        const lightAabb = [];
        let aabb;
        const triBounds = [];
        const staticLights = [];
        let bit;
        let lht;
        for (i = 0; i < drawCallsCount; i++) {
            drawCall = drawCalls[i];
            if (!drawCall.isStatic) {
                newDrawCalls.push(drawCall);
            } else {
                aabb = drawCall.aabb;
                staticLights.length = 0;
                for (lightTypePass = LIGHTTYPE_OMNI; lightTypePass <= LIGHTTYPE_SPOT; lightTypePass++) {
                    for (j = 0; j < lights.length; j++) {
                        light = lights[j];
                        if (light._type !== lightTypePass) continue;
                        if (light.enabled) {
                            if (light.mask & drawCall.mask) {
                                if (light.isStatic) {
                                    if (!lightAabb[j]) {
                                        lightAabb[j] = new BoundingBox();
                                        // light.getBoundingBox(lightAabb[j]); // box from sphere seems to give better granularity
                                        light._node.getWorldTransform();
                                        light.getBoundingSphere(tempSphere);
                                        lightAabb[j].center.copy(tempSphere.center);
                                        lightAabb[j].halfExtents.x = tempSphere.radius;
                                        lightAabb[j].halfExtents.y = tempSphere.radius;
                                        lightAabb[j].halfExtents.z = tempSphere.radius;
                                    }
                                    if (!lightAabb[j].intersects(aabb)) continue;
                                    staticLights.push(j);
                                }
                            }
                        }
                    }
                }

                if (staticLights.length === 0) {
                    newDrawCalls.push(drawCall);
                    continue;
                }

                mesh = drawCall.mesh;
                vertexBuffer = mesh.vertexBuffer;
                indexBuffer = mesh.indexBuffer[drawCall.renderStyle];
                indices = indexBuffer.bytesPerIndex === 2 ? new Uint16Array(indexBuffer.lock()) : new Uint32Array(indexBuffer.lock());
                numTris = mesh.primitive[drawCall.renderStyle].count / 3;
                baseIndex = mesh.primitive[drawCall.renderStyle].base;
                elems = vertexBuffer.format.elements;
                vertSize = vertexBuffer.format.size / 4; // / 4 because float
                verts = new Float32Array(vertexBuffer.storage);

                for (k = 0; k < elems.length; k++) {
                    if (elems[k].name === SEMANTIC_POSITION) {
                        offsetP = elems[k].offset / 4; // / 4 because float
                    }
                }

                // #if _PROFILER
                subTriAabbTime = now();
                // #endif

                triLightComb.length = numTris;
                for (k = 0; k < numTris; k++) {
                    // triLightComb[k] = ""; // uncomment to remove 32 lights limit
                    triLightComb[k] = 0; // comment to remove 32 lights limit
                }
                triLightCombUsed = false;

                triBounds.length = numTris * 6;
                for (k = 0; k < numTris; k++) {
                    minx = Number.MAX_VALUE;
                    miny = Number.MAX_VALUE;
                    minz = Number.MAX_VALUE;
                    maxx = -Number.MAX_VALUE;
                    maxy = -Number.MAX_VALUE;
                    maxz = -Number.MAX_VALUE;
                    for (v = 0; v < 3; v++) {
                        index = indices[k * 3 + v + baseIndex];
                        index = index * vertSize + offsetP;
                        _x = verts[index];
                        _y = verts[index + 1];
                        _z = verts[index + 2];
                        if (_x < minx) minx = _x;
                        if (_y < miny) miny = _y;
                        if (_z < minz) minz = _z;
                        if (_x > maxx) maxx = _x;
                        if (_y > maxy) maxy = _y;
                        if (_z > maxz) maxz = _z;
                    }
                    index = k * 6;
                    triBounds[index] = minx;
                    triBounds[index + 1] = miny;
                    triBounds[index + 2] = minz;
                    triBounds[index + 3] = maxx;
                    triBounds[index + 4] = maxy;
                    triBounds[index + 5] = maxz;
                }
                // #if _PROFILER
                triAabbTime += now() - subTriAabbTime;
                // #endif

                // #if _PROFILER
                subSearchTime = now();
                // #endif
                for (s = 0; s < staticLights.length; s++) {
                    j = staticLights[s];
                    light = lights[j];

                    invMatrix.copy(drawCall.node.worldTransform).invert();
                    localLightBounds.setFromTransformedAabb(lightAabb[j], invMatrix);
                    minv = localLightBounds.getMin();
                    maxv = localLightBounds.getMax();
                    bit = 1 << s;

                    for (k = 0; k < numTris; k++) {
                        index = k * 6;
                        if ((triBounds[index] <= maxv.x) && (triBounds[index + 3] >= minv.x) &&
                            (triBounds[index + 1] <= maxv.y) && (triBounds[index + 4] >= minv.y) &&
                            (triBounds[index + 2] <= maxv.z) && (triBounds[index + 5] >= minv.z)) {

                            // triLightComb[k] += j + "_";  // uncomment to remove 32 lights limit
                            triLightComb[k] |= bit; // comment to remove 32 lights limit
                            triLightCombUsed = true;
                        }
                    }
                }
                // #if _PROFILER
                searchTime += now() - subSearchTime;
                // #endif

                if (triLightCombUsed) {

                    // #if _PROFILER
                    subCombineTime = now();
                    // #endif

                    combIndices = {};
                    for (k = 0; k < numTris; k++) {
                        j = k * 3 + baseIndex; // can go beyond 0xFFFF if base was non-zero?
                        combIbName = triLightComb[k];
                        if (!combIndices[combIbName]) combIndices[combIbName] = [];
                        combIb = combIndices[combIbName];
                        combIb.push(indices[j]);
                        combIb.push(indices[j + 1]);
                        combIb.push(indices[j + 2]);
                    }

                    // #if _PROFILER
                    combineTime += now() - subCombineTime;
                    // #endif

                    // #if _PROFILER
                    subWriteMeshTime = now();
                    // #endif

                    for (combIbName in combIndices) {
                        combIb = combIndices[combIbName];
                        const ib = new IndexBuffer(device, indexBuffer.format, combIb.length, indexBuffer.usage);
                        const ib2 = ib.bytesPerIndex === 2 ? new Uint16Array(ib.lock()) : new Uint32Array(ib.lock());
                        ib2.set(combIb);
                        ib.unlock();

                        minx = Number.MAX_VALUE;
                        miny = Number.MAX_VALUE;
                        minz = Number.MAX_VALUE;
                        maxx = -Number.MAX_VALUE;
                        maxy = -Number.MAX_VALUE;
                        maxz = -Number.MAX_VALUE;
                        for (k = 0; k < combIb.length; k++) {
                            index = combIb[k];
                            _x = verts[index * vertSize + offsetP];
                            _y = verts[index * vertSize + offsetP + 1];
                            _z = verts[index * vertSize + offsetP + 2];
                            if (_x < minx) minx = _x;
                            if (_y < miny) miny = _y;
                            if (_z < minz) minz = _z;
                            if (_x > maxx) maxx = _x;
                            if (_y > maxy) maxy = _y;
                            if (_z > maxz) maxz = _z;
                        }
                        minVec.set(minx, miny, minz);
                        maxVec.set(maxx, maxy, maxz);
                        const chunkAabb = new BoundingBox();
                        chunkAabb.setMinMax(minVec, maxVec);

                        const mesh2 = new Mesh(device);
                        mesh2.vertexBuffer = vertexBuffer;
                        mesh2.indexBuffer[0] = ib;
                        mesh2.primitive[0].type = PRIMITIVE_TRIANGLES;
                        mesh2.primitive[0].base = 0;
                        mesh2.primitive[0].count = combIb.length;
                        mesh2.primitive[0].indexed = true;
                        mesh2.aabb = chunkAabb;

                        const instance = new MeshInstance(mesh2, drawCall.material, drawCall.node);
                        instance.isStatic = drawCall.isStatic;
                        instance.visible = drawCall.visible;
                        instance.layer = drawCall.layer;
                        instance.castShadow = drawCall.castShadow;
                        instance._receiveShadow = drawCall._receiveShadow;
                        instance.cull = drawCall.cull;
                        instance.pick = drawCall.pick;
                        instance.mask = drawCall.mask;
                        instance.parameters = drawCall.parameters;
                        instance._shaderDefs = drawCall._shaderDefs;
                        instance._staticSource = drawCall;

                        if (drawCall._staticLightList) {
                            instance._staticLightList = drawCall._staticLightList; // add forced assigned lights
                        } else {
                            instance._staticLightList = [];
                        }

                        // uncomment to remove 32 lights limit
                        // let lnames = combIbName.split("_");
                        // lnames.length = lnames.length - 1;
                        // for(k = 0; k < lnames.length; k++) {
                        //     instance._staticLightList[k] = lights[parseInt(lnames[k])];
                        // }

                        // comment to remove 32 lights limit
                        for (k = 0; k < staticLights.length; k++) {
                            bit = 1 << k;
                            if (combIbName & bit) {
                                lht = lights[staticLights[k]];
                                if (instance._staticLightList.indexOf(lht) < 0) {
                                    instance._staticLightList.push(lht);
                                }
                            }
                        }

                        instance._staticLightList.sort(StaticMeshes.lightCompare);

                        newDrawCalls.push(instance);
                    }

                    // #if _PROFILER
                    writeMeshTime += now() - subWriteMeshTime;
                    // #endif
                } else {
                    newDrawCalls.push(drawCall);
                }
            }
        }
        // Set array to new
        meshInstances.length = newDrawCalls.length;
        for (i = 0; i < newDrawCalls.length; i++) {
            meshInstances[i] = newDrawCalls[i];
        }
        // #if _PROFILER
        scene._stats.lastStaticPrepareFullTime = now() - prepareTime;
        scene._stats.lastStaticPrepareSearchTime = searchTime;
        scene._stats.lastStaticPrepareWriteTime = writeMeshTime;
        scene._stats.lastStaticPrepareTriAabbTime = triAabbTime;
        scene._stats.lastStaticPrepareCombineTime = combineTime;
        // #endif
    }

    static revert(meshInstances) {
        const drawCalls = meshInstances;
        const drawCallsCount = drawCalls.length;
        const newDrawCalls = [];

        let prevStaticSource;
        for (let i = 0; i < drawCallsCount; i++) {
            const drawCall = drawCalls[i];
            if (drawCall._staticSource) {
                if (drawCall._staticSource !== prevStaticSource) {
                    newDrawCalls.push(drawCall._staticSource);
                    prevStaticSource = drawCall._staticSource;
                }
            } else {
                newDrawCalls.push(drawCall);
            }
        }

        // Set array to new
        meshInstances.length = newDrawCalls.length;
        for (let i = 0; i < newDrawCalls.length; i++) {
            meshInstances[i] = newDrawCalls[i];
        }
    }
}

export { StaticMeshes };
