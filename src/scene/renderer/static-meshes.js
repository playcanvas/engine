import { now } from '../../core/time.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Mat4 } from '../../core/math/mat4.js';

import { BoundingBox } from '../../core/shape/bounding-box.js';
import { BoundingSphere } from '../../core/shape/bounding-sphere.js';

import { PRIMITIVE_TRIANGLES, SEMANTIC_POSITION } from '../../platform/graphics/constants.js';
import { IndexBuffer } from '../../platform/graphics/index-buffer.js';

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

        const drawCalls = meshInstances;
        const drawCallsCount = drawCalls.length;

        const newDrawCalls = [];
        const minVec = new Vec3();
        const maxVec = new Vec3();
        const localLightBounds = new BoundingBox();
        const invMatrix = new Mat4();
        const triLightComb = [];
        const lightAabb = [];
        const triBounds = [];
        const staticLights = [];

        for (let i = 0; i < drawCallsCount; i++) {
            const drawCall = drawCalls[i];
            if (!drawCall.isStatic) {
                newDrawCalls.push(drawCall);
            } else {
                const aabb = drawCall.aabb;
                staticLights.length = 0;
                for (let lightTypePass = LIGHTTYPE_OMNI; lightTypePass <= LIGHTTYPE_SPOT; lightTypePass++) {
                    for (let j = 0; j < lights.length; j++) {
                        const light = lights[j];
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
                                        lightAabb[j].halfExtents.set(tempSphere.radius, tempSphere.radius, tempSphere.radius);
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

                const mesh = drawCall.mesh;
                const vertexBuffer = mesh.vertexBuffer;
                const indexBuffer = mesh.indexBuffer[drawCall.renderStyle];
                const indices = indexBuffer.bytesPerIndex === 2 ? new Uint16Array(indexBuffer.lock()) : new Uint32Array(indexBuffer.lock());
                const numTris = mesh.primitive[drawCall.renderStyle].count / 3;
                const baseIndex = mesh.primitive[drawCall.renderStyle].base;
                const elems = vertexBuffer.format.elements;
                const vertSize = vertexBuffer.format.size / 4; // / 4 because float
                const verts = new Float32Array(vertexBuffer.storage);

                let offsetP;
                for (let k = 0; k < elems.length; k++) {
                    if (elems[k].name === SEMANTIC_POSITION) {
                        offsetP = elems[k].offset / 4; // / 4 because float
                    }
                }

                // #if _PROFILER
                subTriAabbTime = now();
                // #endif

                triLightComb.length = numTris;
                for (let k = 0; k < numTris; k++) {
                    // triLightComb[k] = ""; // uncomment to remove 32 lights limit
                    triLightComb[k] = 0; // comment to remove 32 lights limit
                }
                let triLightCombUsed = false;

                triBounds.length = numTris * 6;
                for (let k = 0; k < numTris; k++) {
                    let minx = Number.MAX_VALUE;
                    let miny = Number.MAX_VALUE;
                    let minz = Number.MAX_VALUE;
                    let maxx = -Number.MAX_VALUE;
                    let maxy = -Number.MAX_VALUE;
                    let maxz = -Number.MAX_VALUE;
                    for (let v = 0; v < 3; v++) {
                        let index = indices[k * 3 + v + baseIndex];
                        index = index * vertSize + offsetP;
                        const _x = verts[index];
                        const _y = verts[index + 1];
                        const _z = verts[index + 2];
                        if (_x < minx) minx = _x;
                        if (_y < miny) miny = _y;
                        if (_z < minz) minz = _z;
                        if (_x > maxx) maxx = _x;
                        if (_y > maxy) maxy = _y;
                        if (_z > maxz) maxz = _z;
                    }
                    const index = k * 6;
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
                for (let s = 0; s < staticLights.length; s++) {
                    const j = staticLights[s];

                    invMatrix.copy(drawCall.node.worldTransform).invert();
                    localLightBounds.setFromTransformedAabb(lightAabb[j], invMatrix);
                    const minv = localLightBounds.getMin();
                    const maxv = localLightBounds.getMax();
                    const bit = 1 << s;

                    for (let k = 0; k < numTris; k++) {
                        const index = k * 6;
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

                    const combIndices = {};
                    for (let k = 0; k < numTris; k++) {
                        const j = k * 3 + baseIndex; // can go beyond 0xFFFF if base was non-zero?
                        const combIbName = triLightComb[k];
                        if (!combIndices[combIbName]) combIndices[combIbName] = [];
                        const combIb = combIndices[combIbName];
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

                    for (const combIbName in combIndices) {
                        const combIb = combIndices[combIbName];
                        const ib = new IndexBuffer(device, indexBuffer.format, combIb.length, indexBuffer.usage);
                        const ib2 = ib.bytesPerIndex === 2 ? new Uint16Array(ib.lock()) : new Uint32Array(ib.lock());
                        ib2.set(combIb);
                        ib.unlock();

                        let minx = Number.MAX_VALUE;
                        let miny = Number.MAX_VALUE;
                        let minz = Number.MAX_VALUE;
                        let maxx = -Number.MAX_VALUE;
                        let maxy = -Number.MAX_VALUE;
                        let maxz = -Number.MAX_VALUE;
                        for (let k = 0; k < combIb.length; k++) {
                            const index = combIb[k];
                            const _x = verts[index * vertSize + offsetP];
                            const _y = verts[index * vertSize + offsetP + 1];
                            const _z = verts[index * vertSize + offsetP + 2];
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
                        for (let k = 0; k < staticLights.length; k++) {
                            const bit = 1 << k;
                            if (combIbName & bit) {
                                const lht = lights[staticLights[k]];
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
        for (let i = 0; i < newDrawCalls.length; i++) {
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
