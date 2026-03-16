import { Script, Vec3, BoundingBox, GSplatFormat, GSplatContainer, FloatPacking } from 'playcanvas';

/**
 * @import { Color } from 'playcanvas'
 */

/**
 * Calculate the number of splats needed for a line segment based on length and thickness.
 *
 * @param {Vec3} start - Start point of the line.
 * @param {Vec3} end - End point of the line.
 * @param {number} thickness - Thickness of the line.
 * @returns {number} Number of splats needed.
 */
function calculateSplatCount(start, end, thickness) {
    const length = start.distance(end);
    // Ensure at least 1 splat, and enough density for smooth lines
    return Math.max(1, Math.ceil(length / (thickness * 0.5)));
}

/**
 * A script that renders line-based debug primitives using gaussian splats.
 * Supports lines, arrows, and AABBs (wireframe boxes).
 *
 * @example
 * // Add the script to an entity
 * entity.addComponent('script');
 * const lines = entity.script.create(GsplatLines);
 *
 * // Add primitives
 * const lineHandle = lines.addLine(
 *     new Vec3(0, 0, 0),
 *     new Vec3(1, 1, 1),
 *     new Color(1, 0, 0),
 *     new Color(0, 0, 1),
 *     0.05
 * );
 *
 * // Remove a primitive
 * lines.removePrimitive(lineHandle);
 */
class GsplatLines extends Script {
    static scriptName = 'gsplatLines';

    /**
     * Map of handle -> primitive data (lines array + splatCount).
     *
     * @type {Map<number, {lines: Array<{start: Vec3, end: Vec3, startColor: Color, endColor: Color, thickness: number}>, splatCount: number}>}
     * @private
     */
    _primitives = new Map();

    /**
     * Next handle ID.
     *
     * @type {number}
     * @private
     */
    _nextHandle = 1;

    /**
     * Dirty flag for rebuild.
     *
     * @type {boolean}
     * @private
     */
    _dirty = false;

    /**
     * GSplatContainer instance.
     *
     * @type {GSplatContainer|null}
     * @private
     */
    _container = null;

    /**
     * GSplatFormat instance.
     *
     * @type {GSplatFormat|null}
     * @private
     */
    _format = null;

    /**
     * Reusable Vec3 for calculations.
     *
     * @type {Vec3}
     * @private
     */
    _tempVec = new Vec3();

    /**
     * Reusable BoundingBox for calculations.
     *
     * @type {BoundingBox}
     * @private
     */
    _tempBox = new BoundingBox();

    initialize() {
        // Create the gsplat component (will set resource later when we have data)
        if (!this.entity.gsplat) {
            this.entity.addComponent('gsplat', {
                unified: true
            });
        }
    }

    /**
     * Add a line with different start and end colors.
     *
     * @param {Vec3} start - Start point of the line.
     * @param {Vec3} end - End point of the line.
     * @param {Color} startColor - Color at the start point.
     * @param {Color} endColor - Color at the end point.
     * @param {number} thickness - Thickness of the line (splat size).
     * @returns {number} Handle to the primitive for later removal.
     */
    addLine(start, end, startColor, endColor, thickness) {
        const handle = this._nextHandle++;
        const splatCount = calculateSplatCount(start, end, thickness);

        this._primitives.set(handle, {
            lines: [{
                start: start.clone(),
                end: end.clone(),
                startColor: startColor.clone(),
                endColor: endColor.clone(),
                thickness
            }],
            splatCount
        });

        this._dirty = true;
        return handle;
    }

    /**
     * Add a line with a single color.
     *
     * @param {Vec3} start - Start point of the line.
     * @param {Vec3} end - End point of the line.
     * @param {Color} color - Color of the line.
     * @param {number} thickness - Thickness of the line (splat size).
     * @returns {number} Handle to the primitive for later removal.
     */
    addLineSimple(start, end, color, thickness) {
        return this.addLine(start, end, color, color, thickness);
    }

    /**
     * Add an arrow (line with arrowhead).
     *
     * @param {Vec3} start - Start point of the arrow.
     * @param {Vec3} end - End point (tip) of the arrow.
     * @param {Color} color - Color of the arrow.
     * @param {number} thickness - Thickness of the arrow line.
     * @param {number} [headSize] - Size of the arrowhead. Defaults to thickness * 9.
     * @returns {number} Handle to the primitive for later removal.
     */
    addArrow(start, end, color, thickness, headSize) {
        const handle = this._nextHandle++;
        headSize = headSize ?? thickness * 9;

        // Calculate direction and perpendicular vectors
        const dir = this._tempVec.sub2(end, start).normalize();
        const length = start.distance(end);

        // Find two perpendicular vectors for 3D arrowhead pyramid
        const perpX = new Vec3();
        const perpY = new Vec3();

        // Choose a vector not parallel to dir
        if (Math.abs(dir.y) < 0.9) {
            perpX.cross(dir, Vec3.UP).normalize();
        } else {
            perpX.cross(dir, Vec3.RIGHT).normalize();
        }
        perpY.cross(dir, perpX).normalize();

        // Main line stops short of the tip
        const mainEnd = new Vec3().lerp(start, end, Math.max(0, (length - headSize) / length));

        // Arrowhead base point (center of pyramid base)
        const headBase = new Vec3().lerp(start, end, Math.max(0, (length - headSize) / length));

        // 4-sided pyramid corners at the base
        const wingOffset = headSize * 0.4;
        const corner1 = new Vec3().add2(headBase, perpX.clone().mulScalar(wingOffset));
        const corner2 = new Vec3().sub2(headBase, perpX.clone().mulScalar(wingOffset));
        const corner3 = new Vec3().add2(headBase, perpY.clone().mulScalar(wingOffset));
        const corner4 = new Vec3().sub2(headBase, perpY.clone().mulScalar(wingOffset));

        const lines = [
            // Main line
            {
                start: start.clone(),
                end: mainEnd,
                startColor: color.clone(),
                endColor: color.clone(),
                thickness
            },
            // 4 lines from pyramid corners to tip
            {
                start: corner1,
                end: end.clone(),
                startColor: color.clone(),
                endColor: color.clone(),
                thickness
            },
            {
                start: corner2,
                end: end.clone(),
                startColor: color.clone(),
                endColor: color.clone(),
                thickness
            },
            {
                start: corner3,
                end: end.clone(),
                startColor: color.clone(),
                endColor: color.clone(),
                thickness
            },
            {
                start: corner4,
                end: end.clone(),
                startColor: color.clone(),
                endColor: color.clone(),
                thickness
            }
        ];

        // Calculate total splat count
        let splatCount = 0;
        for (const line of lines) {
            splatCount += calculateSplatCount(line.start, line.end, line.thickness);
        }

        this._primitives.set(handle, { lines, splatCount });
        this._dirty = true;
        return handle;
    }

    /**
     * Add an AABB (axis-aligned bounding box) as a wireframe.
     *
     * @param {Vec3} min - Minimum corner of the box.
     * @param {Vec3} max - Maximum corner of the box.
     * @param {Color} color - Color of the box edges.
     * @param {number} thickness - Thickness of the box edges.
     * @returns {number} Handle to the primitive for later removal.
     */
    addAABB(min, max, color, thickness) {
        const handle = this._nextHandle++;

        // 8 corners of the box
        const corners = [
            new Vec3(min.x, min.y, min.z), // 0: min
            new Vec3(max.x, min.y, min.z), // 1
            new Vec3(max.x, max.y, min.z), // 2
            new Vec3(min.x, max.y, min.z), // 3
            new Vec3(min.x, min.y, max.z), // 4
            new Vec3(max.x, min.y, max.z), // 5
            new Vec3(max.x, max.y, max.z), // 6: max
            new Vec3(min.x, max.y, max.z)  // 7
        ];

        // 12 edges connecting the corners
        const edges = [
            // Bottom face
            [0, 1], [1, 2], [2, 3], [3, 0],
            // Top face
            [4, 5], [5, 6], [6, 7], [7, 4],
            // Vertical edges
            [0, 4], [1, 5], [2, 6], [3, 7]
        ];

        const lines = edges.map(([i, j]) => ({
            start: corners[i].clone(),
            end: corners[j].clone(),
            startColor: color.clone(),
            endColor: color.clone(),
            thickness
        }));

        // Calculate total splat count
        let splatCount = 0;
        for (const line of lines) {
            splatCount += calculateSplatCount(line.start, line.end, line.thickness);
        }

        this._primitives.set(handle, { lines, splatCount });
        this._dirty = true;
        return handle;
    }

    /**
     * Remove a primitive by its handle.
     *
     * @param {number} handle - Handle returned by add* methods.
     * @returns {boolean} True if the primitive was found and removed.
     */
    removePrimitive(handle) {
        const removed = this._primitives.delete(handle);
        if (removed) {
            this._dirty = true;
        }
        return removed;
    }

    /**
     * Remove all primitives.
     */
    clear() {
        if (this._primitives.size > 0) {
            this._primitives.clear();
            this._dirty = true;
        }
    }

    /**
     * Get the total number of primitives.
     *
     * @returns {number} Number of primitives.
     */
    get primitiveCount() {
        return this._primitives.size;
    }

    postUpdate() {
        if (!this._dirty) {
            return;
        }
        this._dirty = false;

        // Calculate total splat count needed
        let totalSplats = 0;
        for (const primitive of this._primitives.values()) {
            totalSplats += primitive.splatCount;
        }

        // Handle empty case
        if (totalSplats === 0) {
            if (this._container) {
                this._container.destroy();
                this._container = null;
            }
            return;
        }

        const device = this.app.graphicsDevice;

        // Always destroy old container and create new one to avoid sorting frame-late issues
        if (this._container) {
            this._container.destroy();
        }

        // Create format if needed
        if (!this._format) {
            this._format = GSplatFormat.createSimpleFormat(device);
        }

        // Create new container with exact capacity needed
        this._container = new GSplatContainer(device, totalSplats, this._format);

        // Update gsplat component resource
        if (this.entity.gsplat) {
            this.entity.gsplat.resource = this._container;
        }

        // Lock textures for writing
        const centerTex = this._container.getTexture('dataCenter');
        const colorTex = this._container.getTexture('dataColor');
        const centerData = centerTex.lock();
        const colorData = colorTex.lock();
        const centers = this._container.centers;

        // Track bounding box min/max
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        let maxThickness = 0;

        // Fill texture data
        let splatIndex = 0;
        for (const primitive of this._primitives.values()) {
            for (const line of primitive.lines) {
                const numSplats = calculateSplatCount(line.start, line.end, line.thickness);
                maxThickness = Math.max(maxThickness, line.thickness);

                for (let i = 0; i < numSplats; i++) {
                    // Interpolation factor (center splats along line)
                    const t = numSplats > 1 ? i / (numSplats - 1) : 0.5;

                    // Interpolate position
                    const x = line.start.x + (line.end.x - line.start.x) * t;
                    const y = line.start.y + (line.end.y - line.start.y) * t;
                    const z = line.start.z + (line.end.z - line.start.z) * t;

                    // Interpolate color
                    const r = line.startColor.r + (line.endColor.r - line.startColor.r) * t;
                    const g = line.startColor.g + (line.endColor.g - line.startColor.g) * t;
                    const b = line.startColor.b + (line.endColor.b - line.startColor.b) * t;
                    const a = line.startColor.a + (line.endColor.a - line.startColor.a) * t;

                    // Write center data (RGBA32F: x, y, z, size)
                    centerData[splatIndex * 4 + 0] = x;
                    centerData[splatIndex * 4 + 1] = y;
                    centerData[splatIndex * 4 + 2] = z;
                    centerData[splatIndex * 4 + 3] = line.thickness;

                    // Write color data (RGBA16F: r, g, b, a as half-floats)
                    colorData[splatIndex * 4 + 0] = FloatPacking.float2Half(r);
                    colorData[splatIndex * 4 + 1] = FloatPacking.float2Half(g);
                    colorData[splatIndex * 4 + 2] = FloatPacking.float2Half(b);
                    colorData[splatIndex * 4 + 3] = FloatPacking.float2Half(a);

                    // Write centers for sorting
                    centers[splatIndex * 3 + 0] = x;
                    centers[splatIndex * 3 + 1] = y;
                    centers[splatIndex * 3 + 2] = z;

                    // Update bounding box min/max
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    minZ = Math.min(minZ, z);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                    maxZ = Math.max(maxZ, z);

                    splatIndex++;
                }
            }
        }

        // Unlock textures
        centerTex.unlock();
        colorTex.unlock();

        // Build bounding box from min/max, expanded by max thickness
        const aabb = this._tempBox;
        aabb.center.set(
            (minX + maxX) * 0.5,
            (minY + maxY) * 0.5,
            (minZ + maxZ) * 0.5
        );
        aabb.halfExtents.set(
            (maxX - minX) * 0.5 + maxThickness,
            (maxY - minY) * 0.5 + maxThickness,
            (maxZ - minZ) * 0.5 + maxThickness
        );

        // Update container
        this._container.aabb = aabb;
        this._container.update(totalSplats);
    }

    destroy() {
        if (this._container) {
            this._container.destroy();
            this._container = null;
        }

        this._primitives.clear();
    }
}

export { GsplatLines };
