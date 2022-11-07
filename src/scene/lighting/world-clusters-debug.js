import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';

import { PRIMITIVE_TRIANGLES } from '../../platform/graphics/constants.js';

import { BLEND_ADDITIVEALPHA } from '../constants.js';
import { GraphNode } from '../graph-node.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { StandardMaterial } from '../materials/standard-material.js';

class WorldClustersDebug {
    static gridPositions = [];

    static gridColors = [];

    static mesh = null;

    static meshInstance = null;

    static colorLow = new Vec3(1, 1, 1);

    static colorHigh = new Vec3(40, 0, 0);

    static render(worldClusters, scene) {

        const device = scene.device;
        const cells = worldClusters.cells;
        const lightsBuffer = worldClusters.lightsBuffer;
        const boundsMin = lightsBuffer.boundsMin;
        const boundsDelta = lightsBuffer.boundsDelta;
        const boundsMax = boundsMin.clone().add(boundsDelta);
        const cellDelta = lightsBuffer.boundsDelta.clone().div(cells);

        const gridPositions = WorldClustersDebug.gridPositions;
        const gridColors = WorldClustersDebug.gridColors;

        const c1 = new Color(0.3, 0.3, 0.3);

        const renderCellLines = (countA, countB, minA, deltaA, minB, deltaB, minC, maxC, order) => {
            for (let a = 0; a <= countA; a++) {
                for (let b = 0; b <= countB; b++) {
                    const aa = minA + a * deltaA;
                    const bb = minB + b * deltaB;
                    if (order === 0)
                        gridPositions.push(aa, minC, bb, aa, maxC, bb);
                    else if (order === 1)
                        gridPositions.push(aa, bb, minC, aa, bb, maxC);
                    else if (order === 2)
                        gridPositions.push(minC, aa, bb, maxC, aa, bb);
                }
            }
        };

        // generate grid lines
        renderCellLines(cells.x, cells.z, boundsMin.x, cellDelta.x, boundsMin.z, cellDelta.z, boundsMin.y, boundsMax.y, 0);
        renderCellLines(cells.x, cells.y, boundsMin.x, cellDelta.x, boundsMin.y, cellDelta.y, boundsMin.z, boundsMax.z, 1);
        renderCellLines(cells.y, cells.z, boundsMin.y, cellDelta.y, boundsMin.z, cellDelta.z, boundsMin.x, boundsMax.x, 2);

        // render grid lines
        if (gridPositions.length) {

            // update colors only when needed
            const numVerts = gridPositions.length / 3;
            if (numVerts !== gridColors.length / 4) {
                gridColors.length = 0;
                for (let i = 0; i < numVerts; i++) {
                    gridColors.push(c1.r, c1.g, c1.b, c1.a);
                }
            }

            scene.drawLineArrays(gridPositions, gridColors);
            gridPositions.length = 0;
        }

        // render cell occupancy
        let mesh = WorldClustersDebug.mesh;
        if (!mesh) {
            mesh = new Mesh(device);
            mesh.clear(true, true);
            WorldClustersDebug.mesh = mesh;
        }

        const positions = [];
        const colors = [];
        const indices = [];

        const divX = worldClusters._cells.x;
        const divZ = worldClusters._cells.z;
        const counts = worldClusters.counts;
        const limit = worldClusters._maxCellLightCount;

        const min = new Vec3();
        const max = new Vec3();
        const col = new Vec3();
        const step = boundsDelta.clone().div(cells);

        // add cubes with a color representing cell occupancy to the dynamic mesh
        let cubes = 0;
        for (let x = 0; x < cells.x; x++) {
            for (let z = 0; z < cells.z; z++) {
                for (let y = 0; y < cells.y; y++) {

                    const clusterIndex = x + divX * (z + y * divZ);
                    const count = counts[clusterIndex];

                    if (count > 0) {

                        // cube corners
                        min.x = boundsMin.x + step.x * x;
                        min.y = boundsMin.y + step.y * y;
                        min.z = boundsMin.z + step.z * z;
                        max.add2(min, step);

                        positions.push(min.x, min.y, max.z);
                        positions.push(max.x, min.y, max.z);
                        positions.push(max.x, max.y, max.z);
                        positions.push(min.x, max.y, max.z);

                        positions.push(max.x, min.y, min.z);
                        positions.push(min.x, min.y, min.z);
                        positions.push(min.x, max.y, min.z);
                        positions.push(max.x, max.y, min.z);

                        col.lerp(WorldClustersDebug.colorLow, WorldClustersDebug.colorHigh, count / limit).round();
                        for (let c = 0; c < 8; c++) {
                            colors.push(col.x, col.y, col.z, 1);
                        }

                        // back
                        indices.push(cubes * 8 + 0, cubes * 8 + 1, cubes * 8 + 3);
                        indices.push(cubes * 8 + 3, cubes * 8 + 1, cubes * 8 + 2);

                        // front
                        indices.push(cubes * 8 + 4, cubes * 8 + 5, cubes * 8 + 7);
                        indices.push(cubes * 8 + 7, cubes * 8 + 5, cubes * 8 + 6);

                        // top
                        indices.push(cubes * 8 + 3, cubes * 8 + 2, cubes * 8 + 6);
                        indices.push(cubes * 8 + 2, cubes * 8 + 7, cubes * 8 + 6);

                        // bottom
                        indices.push(cubes * 8 + 1, cubes * 8 + 0, cubes * 8 + 4);
                        indices.push(cubes * 8 + 0, cubes * 8 + 5, cubes * 8 + 4);

                        // right
                        indices.push(cubes * 8 + 1, cubes * 8 + 4, cubes * 8 + 2);
                        indices.push(cubes * 8 + 4, cubes * 8 + 7, cubes * 8 + 2);

                        // left
                        indices.push(cubes * 8 + 5, cubes * 8 + 0, cubes * 8 + 6);
                        indices.push(cubes * 8 + 0, cubes * 8 + 3, cubes * 8 + 6);

                        cubes++;
                    }
                }
            }
        }

        if (cubes) {
            mesh.setPositions(positions);
            mesh.setColors32(colors);
            mesh.setIndices(indices);
            mesh.update(PRIMITIVE_TRIANGLES, false);


            if (!WorldClustersDebug.meshInstance) {
                const material = new StandardMaterial();
                material.useLighting = false;
                material.emissive = new Color(1, 1, 1);
                material.emissiveVertexColor = true;
                material.emissiveTint = false;
                material.blendType = BLEND_ADDITIVEALPHA;
                material.depthWrite = false;
                material.update();

                const node = new GraphNode('WorldClustersDebug');
                node.worldTransform = Mat4.IDENTITY;
                node._dirtyWorld = node._dirtyNormal = false;

                WorldClustersDebug.meshInstance = new MeshInstance(mesh, material, node);
                WorldClustersDebug.meshInstance.cull = false;
            }

            // render
            const meshInstance = WorldClustersDebug.meshInstance;
            scene.immediate.drawMesh(meshInstance.material, meshInstance.node.worldTransform, null, meshInstance, scene.defaultDrawLayer);
        }
    }
}

export { WorldClustersDebug };
