import { Vec3 } from '../math/vec3.js';
import { BoundingBox } from '../shape/bounding-box.js';

class BVHNode {
    /**
     * Create a new BVHNode
     *
     * @param {Vec3} [aabbMin] - The bounds of the BVH node
     * @param {Vec3} [aabbMax] - The bounds of the BVH node
     * @param {number} [leftFirst] - The index of the left child of the BVH node
     * @param {number} [triCount] - The number of primitives
     */
    constructor(aabbMin, aabbMax, leftFirst, triCount) {
        this.aabbMin = aabbMin || new Vec3();
        this.aabbMax = aabbMax || new Vec3();
        this.leftFirst = leftFirst || null;
        this.triCount = triCount || 0;
    }

    isLeaf() {
        return this.triCount > 0;
    }
}

class BVHGlobal {
    constructor(bvhNode, triangles) {
        this.bvhNode = [];
        this.triangles = triangles || [];
        this.tri = [];
        this.triIdx = [];
        this.minDist = null;

        this.UpdateNodeBounds = this.UpdateNodeBounds.bind(this);
        this.Subdivide = this.Subdivide.bind(this);
        this.BuildBVH = this.BuildBVH.bind(this);
        this.IntersectAABB = this.IntersectAABB.bind(this);
        this.IntersectBVH = this.IntersectBVH.bind(this);
    }

    UpdateNodeBounds(nodeIdx) {
        const node = this.bvhNode[nodeIdx];
        node.aabbMin = new Vec3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
        node.aabbMax = new Vec3(-Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER);
        const first = node.leftFirst;
        for (let i = 0; i < node.triCount; i++) {
            const leafTriIdx = this.triIdx[first + i];
            const leafTri = this.triangles[leafTriIdx];
            node.aabbMin = vec3Min(node.aabbMin, leafTri.vertex0);
            node.aabbMin = vec3Min(node.aabbMin, leafTri.vertex1);
            node.aabbMin = vec3Min(node.aabbMin, leafTri.vertex2);
            node.aabbMax = vec3Max(node.aabbMax, leafTri.vertex0);
            node.aabbMax = vec3Max(node.aabbMax, leafTri.vertex1);
            node.aabbMax = vec3Max(node.aabbMax, leafTri.vertex2);
        }
    }

    EvaluateSAH(node, axis, pos) {
        const leftBox = new BoundingBox(new Vec3(), new Vec3());
        const rightBox = new BoundingBox(new Vec3(), new Vec3());
        let leftCount = 0, rightCount = 0;
        axis = ['x', 'y', 'z'][axis];

        for (let i = 0; i < node.triCount; i++) {
            const triangle = this.triangles[this.triIdx[node.leftFirst + i]];
            if (triangle.centroid[axis] < pos) {
                leftCount++;
                leftBox.setMinMax(vec3Min(leftBox.getMin(), triangle.vertex0), vec3Max(leftBox.getMax(), triangle.vertex0));
                leftBox.setMinMax(vec3Min(leftBox.getMin(), triangle.vertex1), vec3Max(leftBox.getMax(), triangle.vertex1));
                leftBox.setMinMax(vec3Min(leftBox.getMin(), triangle.vertex2), vec3Max(leftBox.getMax(), triangle.vertex2));
            } else {
                rightCount++;
                rightBox.setMinMax(vec3Min(rightBox.getMin(), triangle.vertex0), vec3Max(rightBox.getMax(), triangle.vertex0));
                rightBox.setMinMax(vec3Min(rightBox.getMin(), triangle.vertex1), vec3Max(rightBox.getMax(), triangle.vertex1));
                rightBox.setMinMax(vec3Min(rightBox.getMin(), triangle.vertex2), vec3Max(rightBox.getMax(), triangle.vertex2));
            }
        }
        const cost = leftCount * leftBox.area() + rightCount * rightBox.area();
        return cost > 0 ? cost : Number.MAX_SAFE_INTEGER;
    }

    findBestSplitPane(splitDetails) {
        const node = splitDetails.node;
        let bestCost = Number.MAX_SAFE_INTEGER;
        for (let a = 0; a < 3; a++) {
            const b = ['x', 'y', 'z'][a];
            for (let i = 0; i < node.triCount; i++) {
                const triangle = this.triangles[this.triIdx[node.leftFirst + i]];
                const candidatePos = triangle.centroid[b];
                const cost = this.EvaluateSAH(node, a, candidatePos);
                if (cost < bestCost) {
                    splitDetails.splitPos = candidatePos;
                    splitDetails.axis = b;
                    bestCost = cost;
                }
            }
        }
        return bestCost;
    }

    calculateNodeCost(node) {
        const negativeAabbMin = node.aabbMin.clone();
        negativeAabbMin.mulScalar(-1);
        const extent = new Vec3();
        extent.add2(node.aabbMax, negativeAabbMin);

        const surfaceArea = extent.x * extent.y + extent.y * extent.z + extent.z * extent.x;

        return node.triCount * surfaceArea;
    }

    Subdivide(nodeIdx) {
        const node = this.bvhNode[nodeIdx];

        const splitDetails = { node: node, axis: null, splitPos: null, splitCost: null };

        const splitCost = this.findBestSplitPane(splitDetails);

        const axis = splitDetails.axis;

        const splitPos = splitDetails.splitPos;

        const noSplitCost = this.calculateNodeCost(node);

        if (splitCost >= noSplitCost) {
            return;
        }

        // if (node.triCount <= 2) return;

        // const negativeAabbMin = node.aabbMin.clone();
        // negativeAabbMin.mulScalar(-1);
        // const extent = new Vec3();
        // extent.add2(node.aabbMax, negativeAabbMin);
        // let axis = 'x';
        // if (extent.y > extent.x) {
        //     axis = 'y';
        // }
        // if (extent.z > extent[axis]) {
        //     axis = 'z';
        // }
        // const splitPos = node.aabbMin[axis] + extent[axis] * 0.5;

        // Perform the split
        let i = node.leftFirst;
        let j = i + node.triCount - 1;
        while (i <= j) {
            if (this.triangles[this.triIdx[i]].centroid[axis] < splitPos) {
                i++;
            } else {
                j--;
                [this.triIdx[i], this.triIdx[j]] = [this.triIdx[j], this.triIdx[i]];
            }
        }
        const leftCount = i - node.leftFirst;
        if (leftCount === 0 || leftCount === node.triCount) {
            return;
        }
        // Create child nodes for each half
        const leftChildIdx = this.nodesUsed++;
        const rightChildIdx = this.nodesUsed++;
        this.bvhNode[leftChildIdx].leftFirst = node.leftFirst;
        this.bvhNode[leftChildIdx].triCount = leftCount;
        this.bvhNode[rightChildIdx].leftFirst = i;
        this.bvhNode[rightChildIdx].triCount = node.triCount - leftCount;
        node.leftFirst = leftChildIdx;
        node.triCount = 0;
        this.UpdateNodeBounds(leftChildIdx);
        this.UpdateNodeBounds(rightChildIdx);
        // Recurse into each of the child nodes
        this.Subdivide(leftChildIdx);
        this.Subdivide(rightChildIdx);
    }

    /**
     * Builds the BVH
     *
     * @param {Array} [triangles] - The array of triangles to use
     */
    BuildBVH(triangles) {
        this.triangles = triangles;
        const N = triangles.length;
        this.triIdx = Array.from({ length: N }, (x, i) => i);
        this.bvhNode = Array.apply(null, Array(N * 2)).map(function () {
            return new BVHNode();
        });
        const rootNodeIdx = 0;
        this.nodesUsed = 1;

        for (let i = 0; i < N; i++) {
            this.triangles[i].centroid = new Vec3();
            this.triangles[i].centroid.add(this.triangles[i].vertex0);
            this.triangles[i].centroid.add(this.triangles[i].vertex1);
            this.triangles[i].centroid.add(this.triangles[i].vertex2);
            this.triangles[i].centroid.mulScalar(1 / 3);
        }

        const root = this.bvhNode[0];
        root.leftFirst = 0;
        root.triCount = N;
        this.UpdateNodeBounds(rootNodeIdx);
        this.Subdivide(rootNodeIdx);
    }

    // recursive
    // IntersectBVH(ray, nodeIdx) {
    //     const node = this.bvhNode[nodeIdx];
    //     if (!this.IntersectAABB(ray, node.aabbMin, node.aabbMax)) return;
    //     if (node.isLeaf()) {
    //         for (let i = 0; i < node.triCount; i++) {
    //             const dist = this.triangles[this.triIdx[node.leftFirst + i]].intersectWithRay(ray);
                // if (dist != null) {
                //     if (this.minDist == null) {
                //         this.minDist = dist;
                //     }
                //     this.minDist = Math.min(this.minDist, dist);
                // }
    //         }
    //     }
    //     else {
    //         this.IntersectBVH(ray, node.leftFirst);
    //         this.IntersectBVH(ray, node.leftFirst + 1);
    //     }
    // }

    IntersectBVH(ray, nodeIdx) {
        let node = this.bvhNode[nodeIdx];
        const stack = [];
        let stackPtr = 0;
        while (true) {
            if (node.isLeaf()) {
                for (let i = 0; i < node.triCount; i++) {
                    const dist = this.triangles[this.triIdx[node.leftFirst + i]].intersectWithRay(ray);
                    if (dist != null) {
                        if (this.minDist == null) {
                            this.minDist = dist;
                        }
                        this.minDist = Math.min(this.minDist, dist);
                    }
                }
                if (stackPtr === 0) {
                    break;
                } else {
                    node = stack[--stackPtr];
                    continue;
                }
            }
            let child1 = this.bvhNode[node.leftFirst];
            let child2 = this.bvhNode[node.leftFirst + 1];
            let dist1 = this.IntersectAABB(ray, child1.aabbMin, child1.aabbMax);
            let dist2 = this.IntersectAABB(ray, child2.aabbMin, child2.aabbMax);
            if (dist1 > dist2) {
                [dist1, dist2] = [dist2, dist1];
                [child1, child2] = [child2, child1];
            }
            if (dist1 === Number.MAX_SAFE_INTEGER) {
                if (stackPtr === 0) {
                    break;
                } else {
                    node = stack[--stackPtr];
                }
            } else {
                node = child1;
                if (dist2 !== Number.MAX_SAFE_INTEGER) {
                    stack[stackPtr++] = child2;
                }
            }
        }
    }

    IntersectAABB(ray, bmin, bmax) {
        if (ray.rD == null) {
            ray.rDx = 1 / ray.direction.x;
            ray.rDy = 1 / ray.direction.y;
            ray.rDz = 1 / ray.direction.z;
        }
        const tx1 = (bmin.x - ray.origin.x) * ray.rDx;
        const tx2 = (bmax.x - ray.origin.x) * ray.rDx;
        let tmin = Math.min(tx1, tx2);
        let tmax = Math.max(tx1, tx2);
        const ty1 = (bmin.y - ray.origin.y) * ray.rDy;
        const ty2 = (bmax.y - ray.origin.y) * ray.rDy;
        tmin = Math.max(tmin, Math.min(ty1, ty2));
        tmax = Math.min(tmax, Math.max(ty1, ty2));
        const tz1 = (bmin.z - ray.origin.z) * ray.rDz;
        const tz2 = (bmax.z - ray.origin.z) * ray.rDz;
        tmin = Math.max(tmin, Math.min(tz1, tz2));
        tmax = Math.min(tmax, Math.max(tz1, tz2));
        if (tmax >= tmin  && tmax > 0 && (this.minDist == null || (this.minDist != null && tmin < this.minDist))) {
            return tmin;
        }
        return Number.MAX_SAFE_INTEGER;
    }

    // IntersectAABB(ray, bmin, bmax) {
    //     const tx1 = (bmin.x - ray.origin.x) / ray.direction.x;
    //     const tx2 = (bmax.x - ray.origin.x) / ray.direction.x;
    //     let tmin = Math.min(tx1, tx2);
    //     let tmax = Math.max(tx1, tx2);
    //     const ty1 = (bmin.y - ray.origin.y) / ray.direction.y;
    //     const ty2 = (bmax.y - ray.origin.y) / ray.direction.y;
    //     tmin = Math.max(tmin, Math.min(ty1, ty2));
    //     tmax = Math.min(tmax, Math.max(ty1, ty2));
    //     const tz1 = (bmin.z - ray.origin.z) / ray.direction.z;
    //     const tz2 = (bmax.z - ray.origin.z) / ray.direction.z;
    //     tmin = Math.max(tmin, Math.min(tz1, tz2));
    //     tmax = Math.min(tmax, Math.max(tz1, tz2));
    //     //return tmax >= tmin && tmin < ray.t && tmax > 0;
    //     return tmax >= tmin  && tmax > 0 && (this.minDist != null && tmin < this.minDist);
    // }
}

/**
 * Create a new BVHNode
 *
 * @param {Vec3} [a] - The bounds of the BVH node
 * @param {Vec3} [b] - The bounds of the BVH node
 */
function vec3Min(a, b) {
    const c = new Vec3();
    c.set(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z));
    return c;
}

/**
 * Create a new BVHNode
 *
 * @param {Vec3} [a] - The bounds of the BVH node
 * @param {Vec3} [b] - The bounds of the BVH node
 * @param {Vec3} [c] - The bounds of the BVH node
 */
function vec3Max(a, b) {
    const c = new Vec3();
    c.set(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z));
    return c;
}

export { BVHGlobal };
