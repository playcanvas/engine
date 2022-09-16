import { Vec3 } from '../math/vec3.js';
import { BoundingBox } from '../shape/bounding-box.js';

/** @typedef {import('../shape/ray.js').Ray} Ray */
/** @typedef {import('../math/tri.js').Tri} Tri */

// Temporary variables for calculations
const _tempVec1 = new Vec3();

/**
 * Class for storing a single BVH node
 *
 * @ignore
 */
class BVHNode {
    /**
     * Create a new BVHNode
     *
     * @param {Vec3} [aabbMin] - The bounds of the BVH node
     * @param {Vec3} [aabbMax] - The bounds of the BVH node
     * @param {number} [leftFirst] - The index of the left child of the BVH node
     * @param {number} [triCount] - The number of primitives
     * @ignore
     */
    constructor(aabbMin = new Vec3(), aabbMax = new Vec3(), leftFirst = null, triCount = 0) {
        this.aabbMin = aabbMin || new Vec3();
        this.aabbMax = aabbMax || new Vec3();
        this.leftFirst = leftFirst || null;
        this.triCount = triCount || 0;
    }

    /**
     *
     * @returns {boolean} whether the BVHNode is a leaf node
     * @ignore
     */
    isLeaf() {
        return this.triCount > 0;
    }
}


/**
 * Bin used for BVH Tree construction
 *
 * @ignore
 */
class Bin {
    constructor(BINS) {
        this.BINS = BINS;
        this.bounds = new BoundingBox(new Vec3(), new Vec3());
        this.triCount = 0;
    }
}

/**
 * Used to store the BVH, triangles and minimum ray intersection distance for a single mesh
 *
 * @ignore
 */
class Bvh {
    /**
     * Create a new array to store the BVH and helpers
     *
     * @param {Tri[]} [triangles] - the triangles used to build the BVH
     * @param {object} [args] - Pass in optional parameters such as number of bins
     * @ignore
     */
    constructor(triangles, args = {}) {
        this.bvhNode = [];
        this.triangles = triangles || [];
        this.triIdx = [];
        this.minDist = null;

        this.updateNodeBounds = this.updateNodeBounds.bind(this);
        this.subdivide = this.subdivide.bind(this);
        this.build = this.build.bind(this);
        this.intersectAABB = this.intersectAABB.bind(this);
        this.intersect = this.intersect.bind(this);

        this.bins = args.bins || 10;

        this.stack = [];

        this.build();
    }

    /**
     * Updates the bounds of a leaf bvh node
     *
     * @param {number} nodeIdx - The node to be updated
     * @ignore
     */
    updateNodeBounds(nodeIdx) {
        const node = this.bvhNode[nodeIdx];
        node.aabbMin.set(Infinity, Infinity, Infinity);
        node.aabbMax.set(-Infinity, -Infinity, -Infinity);
        const first = node.leftFirst;
        const triCount = node.triCount;
        const { triangles } = this;
        for (let i = 0; i < triCount; i++) {
            const leafTriIdx = this.triIdx[first + i];
            const leafTri = triangles[leafTriIdx];
            node.aabbMin.min(leafTri.vertex0);
            node.aabbMin.min(leafTri.vertex1);
            node.aabbMin.min(leafTri.vertex2);
            node.aabbMax.max(leafTri.vertex0);
            node.aabbMax.max(leafTri.vertex1);
            node.aabbMax.max(leafTri.vertex2);
        }
    }

    /**
     * Finds the best split plane to split along at a particular node
     *
     * @param {object} splitDetails - The object to assign the details of the most optimal split to,
     * also contains the node to split at
     * @returns {number} The cost of the most optimal split
     * @ignore
     */
    findBestSplitPlane(splitDetails) {
        const node = splitDetails.node;
        let bestCost = Infinity;
        const { triangles, triIdx } = this;
        for (let a = 0; a < 3; a++) {
            const b = ['x', 'y', 'z'][a];
            let boundsMin = Infinity;
            let boundsMax = -1 * Infinity;
            for (let i = 0; i < node.triCount; i++) {
                const triangle = triangles[triIdx[node.leftFirst + i]];
                boundsMin = Math.min(boundsMin, triangle.centroid[b]);
                boundsMax = Math.max(boundsMax, triangle.centroid[b]);
            }
            if (boundsMin === boundsMax) continue;

            const bin = Array.apply(null, Array(this.bins)).map(function () {
                return new Bin();
            });
            let scale = this.bins / (boundsMax - boundsMin);
            for (let i = 0; i < node.triCount; i++) {
                const triangle = triangles[triIdx[node.leftFirst + i]];
                const binIdx = Math.min(this.bins - 1, Math.floor((triangle.centroid[b] - boundsMin) * scale));
                bin[binIdx].triCount++;
                bin[binIdx].bounds.setMinMax(_tempVec1.min2(bin[binIdx].bounds.getMin(), triangle.vertex0), _tempVec1.max2(bin[binIdx].bounds.getMax(), triangle.vertex0));
                bin[binIdx].bounds.setMinMax(_tempVec1.min2(bin[binIdx].bounds.getMin(), triangle.vertex1), _tempVec1.max2(bin[binIdx].bounds.getMax(), triangle.vertex1));
                bin[binIdx].bounds.setMinMax(_tempVec1.min2(bin[binIdx].bounds.getMin(), triangle.vertex2), _tempVec1.max2(bin[binIdx].bounds.getMax(), triangle.vertex2));
            }
            const leftArea = Array(this.bins - 1);
            const rightArea = Array(this.bins - 1);
            const leftCount = Array(this.bins - 1);
            const rightCount = Array(this.bins - 1);

            const leftBox = new BoundingBox(new Vec3(), new Vec3());
            const rightBox = new BoundingBox(new Vec3(), new Vec3());
            let leftSum = 0;
            let rightSum = 0;

            for (let i = 0; i < this.bins - 1; i++) {
                leftSum += bin[i].triCount;
                leftCount[i]  = leftSum;
                leftBox.setMinMax(_tempVec1.min2(leftBox.getMin(), bin[i].bounds.getMin()), _tempVec1.max2(leftBox.getMax(), bin[i].bounds.getMax()));
                leftArea[i] = leftBox.area();
                rightSum += bin[this.bins - 1 - i].triCount;
                rightCount[this.bins - 2 - i] = rightSum;
                rightBox.setMinMax(_tempVec1.min2(rightBox.getMin(), bin[this.bins - 1 - i].bounds.getMin()), _tempVec1.max2(rightBox.getMax(), bin[this.bins - 1 - i].bounds.getMax()));
                rightArea[this.bins - 2 - i] = rightBox.area();
            }

            scale = (boundsMax - boundsMin) / this.bins;
            for (let i = 0; i < this.bins - 1; i++) {
                const planeCost = leftCount[i] * leftArea[i] + rightCount[i] * rightArea[i];
                if (planeCost < bestCost) {
                    splitDetails.axis = b;
                    splitDetails.splitPos = boundsMin + scale * (i + 1);
                    bestCost = planeCost;
                }
            }
        }
        return bestCost;
    }

    /**
     * Calculates the estimated cost of raycasting through a node
     *
     * @param {BVHNode} node - The node to be evaluated
     * @returns {number} The cost of the raycast
     * @ignore
     */
    calculateNodeCost(node) {
        // Calculate the extent of the node's aabb
        _tempVec1.sub2(node.aabbMax, node.aabbMin);

        const surfaceArea = _tempVec1.x * _tempVec1.y + _tempVec1.y * _tempVec1.z + _tempVec1.z * _tempVec1.x;

        return node.triCount * surfaceArea;
    }

    /**
     * Subdivides the BVH on a node
     *
     * @param {number} nodeIdx - The index of the node to subdivide at
     * @ignore
     */
    subdivide(nodeIdx) {
        const node = this.bvhNode[nodeIdx];

        const { triangles, triIdx } = this;

        const splitDetails = { node: node, axis: null, splitPos: null, splitCost: null };

        // const splitCost = this.findBestSplitPlane(splitDetails);
        this.findBestSplitPlane(splitDetails);

        const axis = splitDetails.axis;

        const splitPos = splitDetails.splitPos;

        // terminates tree building when number of leafnodes is less than a threshold
        if (node.triCount < 10) {
            return;
        }

        // Perform the split
        let i = node.leftFirst;
        let j = i + node.triCount - 1;
        while (i <= j) {
            if (triangles[triIdx[i]].centroid[axis] < splitPos) {
                i++;
            } else {
                [triIdx[i], triIdx[j]] = [triIdx[j], triIdx[i]];
                j--;
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
        this.updateNodeBounds(leftChildIdx);
        this.updateNodeBounds(rightChildIdx);

        // Recurse into each of the child nodes
        this.subdivide(leftChildIdx);
        this.subdivide(rightChildIdx);
    }

    /**
     * Builds the BVH
     *
     * @ignore
     */
    build() {
        const { triangles } = this;
        const n = triangles.length;
        this.triIdx = Array.from({ length: n }, (x, i) => i);
        this.bvhNode = Array.apply(null, Array(n * 2)).map(function () {
            return new BVHNode();
        });
        const rootNodeIdx = 0;
        this.nodesUsed = 1;

        for (let i = 0; i < n; i++) {
            triangles[i].calculateCentroid();
        }
        const root = this.bvhNode[0];
        root.leftFirst = 0;
        root.triCount = n;
        this.updateNodeBounds(rootNodeIdx);
        this.subdivide(rootNodeIdx);
    }

    /**
     * Refits the BVH
     *
     * @param {Tri[]} triangles - The triangles to refit the BVH on
     * @ignore
     */
    refit(triangles) {
        this.triangles = triangles;
        for (let i = this.nodesUsed - 1; i >= 0; i--) {
            if (i !== 1) {
                const node = this.bvhNode[i];
                if (node.isLeaf()) {
                    // adjust bounds to contained triangles for leaf nodes
                    this.updateNodeBounds(i);
                    continue;
                }
                // adjust boudns to child node bounds in interior nodes
                const leftChild = this.bvhNode[node.leftFirst];
                const rightChild = this.bvhNode[node.leftFirst + 1];
                node.aabbMin.min2(leftChild.aabbMin, rightChild.aabbMin);
                node.aabbMax.max2(leftChild.aabbMax, rightChild.aabbMax);
            }
        }
    }

    /**
     * Calculates the shortest distance between the origin of a ray and its intersection with the mesh
     *
     * @param {Ray} ray - The ray to be traced
     * @param {number} nodeIdx - The index of the node to begin the raycast at (default is zero: the root)
     * @ignore
     */
    intersect(ray, nodeIdx = 0) {
        this.minDist = null;
        const stack = this.stack;
        stack.length = 0;

        ray.rDx = 1 / ray.direction.x;
        ray.rDy = 1 / ray.direction.y;
        ray.rDz = 1 / ray.direction.z;

        let node = this.bvhNode[nodeIdx];
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
            let dist1 = this.intersectAABB(ray, child1.aabbMin, child1.aabbMax);
            let dist2 = this.intersectAABB(ray, child2.aabbMin, child2.aabbMax);
            if (dist1 > dist2) {
                [dist1, dist2] = [dist2, dist1];
                [child1, child2] = [child2, child1];
            }
            if (dist1 === Infinity) {
                if (stackPtr === 0) {
                    break;
                } else {
                    node = stack[--stackPtr];
                }
            } else {
                node = child1;
                if (dist2 !== Infinity) {
                    stack[stackPtr++] = child2;
                }
            }
        }
    }

    /**
     * Calculates whether a ray intersects an aabb and returns the distance between the ray origin and aabb if it does
     * Ray.rdx, rdy and rdz must be calculated prior to this
     *
     * @param {Ray} ray - The ray to be traced
     * @param {Vec3} bmin - The min corner of the aabb
     * @param {Vec3} bmax - The max corner of the aabb
     * @returns {number} The distance between the ray origin and the aabb, Infinity if there is no intersection
     * @ignore
     */
    intersectAABB(ray, bmin, bmax) {

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
        return Infinity;
    }
}

export { Bvh };
