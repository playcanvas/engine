import { Script, Vec3, Mat4, BoundingBox, GSplatFormat, GSplatContainer, FloatPacking, StandardMaterial } from 'playcanvas';

/**
 * @import { Entity } from 'playcanvas'
 * @import { RenderComponent } from 'playcanvas'
 */

/**
 * Temporary vectors and matrices for calculations.
 */
const tempVec0 = new Vec3();
const tempVec1 = new Vec3();
const tempVec2 = new Vec3();
const tempEdge1 = new Vec3();
const tempEdge2 = new Vec3();
const tempNormal = new Vec3();
const tempEdgeDir = new Vec3();
const tempPerpDir = new Vec3();
const tempMat = new Mat4();
const tempInverseMat = new Mat4();

/**
 * Rasterize a triangle using scanline approach to generate uniformly spaced splat positions.
 * Generates parallel scanlines from base edge toward apex, with guaranteed margin from all edges.
 *
 * @param {Vec3} v0 - First vertex of triangle (world space).
 * @param {Vec3} v1 - Second vertex of triangle (world space).
 * @param {Vec3} v2 - Third vertex of triangle (world space).
 * @param {number} splatSize - Size of each splat.
 * @param {number} marginFactor - Margin as a factor of splatSize (0 = no margin, 0.65 = default).
 * @param {{r: number, g: number, b: number, a: number}} color - Color for splats.
 * @param {Array<{x: number, y: number, z: number, r: number, g: number, b: number, a: number}>} outSplats - Array to append splats to.
 */
function rasterizeTriangle(v0, v1, v2, splatSize, marginFactor, color, outSplats) {
    // Create local 2D coordinate system on triangle plane
    // Use v0->v1 as base edge (x-axis)
    tempEdge1.sub2(v1, v0);
    const baseLen = tempEdge1.length();

    // Skip degenerate triangles
    if (baseLen < 0.0001) return;

    tempEdgeDir.copy(tempEdge1).normalize();

    // v0->v2 edge
    tempEdge2.sub2(v2, v0);

    // Triangle normal
    tempNormal.cross(tempEdge1, tempEdge2);
    const doubleArea = tempNormal.length();

    // Skip degenerate triangles
    if (doubleArea < 0.0001) return;

    tempNormal.normalize();

    // Perpendicular direction in triangle plane (y-axis, pointing toward v2)
    tempPerpDir.cross(tempNormal, tempEdgeDir);

    // Project apex (v2) to local 2D coordinates
    // v0 is at origin (0, 0), v1 is at (baseLen, 0)
    const apexX = tempEdge2.dot(tempEdgeDir);
    const apexY = tempEdge2.dot(tempPerpDir);

    // Height of triangle (perpendicular distance from apex to base)
    const height = Math.abs(apexY);
    if (height < 0.0001) return;  // Degenerate

    // Edge lengths for margin calculations
    const len02 = Math.sqrt(apexX * apexX + apexY * apexY);
    const len12 = Math.sqrt((apexX - baseLen) * (apexX - baseLen) + apexY * apexY);

    // Spacing between splats and scanlines
    const spacing = splatSize * 1.5;
    // Margin: perpendicular distance from edges to avoid overlap at shared triangle edges
    const margin = splatSize * marginFactor;

    // Compute margin offsets along scanline for side edges
    // For edge at angle θ to horizontal, offset along x = margin / sin(θ)
    const marginOffset02 = (len02 > 0.0001) ? margin * len02 / Math.abs(apexY) : margin;
    const marginOffset12 = (len12 > 0.0001) ? margin * len12 / Math.abs(apexY) : margin;

    // Direction of y (handle both orientations)
    const ySign = apexY >= 0 ? 1 : -1;

    // Generate scanlines parallel to base edge
    // Start at margin from base, end at margin from apex
    const startScanY = margin;
    const endScanY = height - margin;

    if (startScanY >= endScanY) return;  // Triangle too small

    // Calculate number of scanlines and distribute evenly
    const scanRange = endScanY - startScanY;
    const numScanlines = Math.max(1, Math.floor(scanRange / spacing) + 1);
    const scanStep = numScanlines > 1 ? scanRange / (numScanlines - 1) : 0;

    for (let scanIdx = 0; scanIdx < numScanlines; scanIdx++) {
        // Current scanline distance from base (always positive)
        const scanDist = numScanlines > 1 ? startScanY + scanIdx * scanStep : (startScanY + endScanY) * 0.5;

        // Local y coordinate (accounting for triangle orientation)
        const localY = scanDist * ySign;

        // Parametric t along height (0 at base, 1 at apex)
        const t = scanDist / height;

        // Find intersection of scanline with side edges
        // Edge v0-v2: x = t * apexX
        // Edge v1-v2: x = baseLen + t * (apexX - baseLen)
        const intersect02 = t * apexX;
        const intersect12 = baseLen + t * (apexX - baseLen);

        // Determine left and right intersections
        const leftX = Math.min(intersect02, intersect12);
        const rightX = Math.max(intersect02, intersect12);

        // Apply margin offsets (perpendicular to side edges)
        const leftMargin = (intersect02 < intersect12) ? marginOffset02 : marginOffset12;
        const rightMargin = (intersect02 < intersect12) ? marginOffset12 : marginOffset02;

        const scanStartX = leftX + leftMargin;
        const scanEndX = rightX - rightMargin;

        if (scanStartX >= scanEndX) continue;  // Scanline too short

        // Calculate number of points along scanline
        const scanLength = scanEndX - scanStartX;
        const numPoints = Math.max(1, Math.floor(scanLength / spacing) + 1);

        // Generate points evenly distributed along scanline
        if (numPoints === 1) {
            // Single point in center
            const px = (scanStartX + scanEndX) * 0.5;

            const x = v0.x + px * tempEdgeDir.x + localY * tempPerpDir.x;
            const y = v0.y + px * tempEdgeDir.y + localY * tempPerpDir.y;
            const z = v0.z + px * tempEdgeDir.z + localY * tempPerpDir.z;

            outSplats.push({ x, y, z, r: color.r, g: color.g, b: color.b, a: color.a });
        } else {
            // Multiple points evenly distributed
            const pointStep = scanLength / (numPoints - 1);

            for (let pointIdx = 0; pointIdx < numPoints; pointIdx++) {
                const px = scanStartX + pointIdx * pointStep;

                const x = v0.x + px * tempEdgeDir.x + localY * tempPerpDir.x;
                const y = v0.y + px * tempEdgeDir.y + localY * tempPerpDir.y;
                const z = v0.z + px * tempEdgeDir.z + localY * tempPerpDir.z;

                outSplats.push({ x, y, z, r: color.r, g: color.g, b: color.b, a: color.a });
            }
        }
    }
}

/**
 * Extract color from a material, preferring emissive over diffuse.
 *
 * @param {import('playcanvas').Material} material - The material to extract color from.
 * @returns {{r: number, g: number, b: number, a: number}} The extracted color.
 */
function getMaterialColor(material) {
    let r = 1, g = 1, b = 1, a = 1;

    if (material instanceof StandardMaterial) {
        // Try emissive first
        const emissive = material.emissive;
        if (emissive && (emissive.r > 0.001 || emissive.g > 0.001 || emissive.b > 0.001)) {
            r = emissive.r;
            g = emissive.g;
            b = emissive.b;
        } else {
            // Fall back to diffuse
            const diffuse = material.diffuse;
            if (diffuse) {
                r = diffuse.r;
                g = diffuse.g;
                b = diffuse.b;
            }
        }
        // Get opacity - only use material opacity if transparent, otherwise fully opaque
        a = material.transparent ? (material.opacity ?? 1) : 1;

        // For transparent materials, halve alpha to compensate for overlap and double-sided rendering
        if (a < 1) {
            a *= 0.5;
        }
    } else {
        // Non-StandardMaterial, use default white opaque
    }

    return { r, g, b, a };
}

/**
 * Recursively collect render components from an entity hierarchy.
 *
 * @param {Entity} entity - The entity to start from.
 * @param {boolean} recursive - Whether to include children.
 * @param {RenderComponent[]} results - Array to store results.
 */
function collectRenderComponents(entity, recursive, results) {
    if (entity.render) {
        results.push(entity.render);
    }

    if (recursive) {
        const children = entity.children;
        for (let i = 0; i < children.length; i++) {
            collectRenderComponents(children[i], true, results);
        }
    }
}

/**
 * A script that converts mesh geometry into gaussian splats. Extracts triangles from
 * render components and generates uniformly distributed splats across the mesh surface
 * using triangle rasterization.
 *
 * @example
 * // Add the script to an entity
 * entity.addComponent('script');
 * const meshSplat = entity.script.create(GsplatMesh);
 *
 * // Build splats from another entity's mesh hierarchy
 * meshSplat.buildFromEntity(sourceEntity, {
 *     splatSize: 0.02,
 *     recursive: true
 * });
 */
class GsplatMesh extends Script {
    static scriptName = 'gsplatMesh';

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
     * Reusable BoundingBox for calculations.
     *
     * @type {BoundingBox}
     * @private
     */
    _tempBox = new BoundingBox();

    /**
     * Reusable arrays for mesh data extraction.
     *
     * @private
     */
    _positionsArray = [];

    /**
     * Reusable arrays for mesh data extraction.
     *
     * @private
     */
    _indicesArray = [];

    initialize() {
        // Create the gsplat component (will set resource later when we have data)
        if (!this.entity.gsplat) {
            this.entity.addComponent('gsplat', {
                unified: true
            });
        }
    }

    /**
     * Build gaussian splats from an entity's mesh hierarchy.
     *
     * @param {Entity} entity - The entity to extract meshes from.
     * @param {object} [options] - Build options.
     * @param {number} [options.splatSize=0.01] - Size of each splat and spacing between them.
     * Smaller values create more splats for higher density coverage.
     * @param {boolean} [options.recursive=true] - Whether to recursively search children for
     * render components.
     * @param {number} [options.margin=0.65] - Margin factor relative to splatSize. Controls the
     * distance from triangle edges where no splats are placed. Use 0 for no margin (splats extend
     * to edges), higher values to avoid overlap artifacts at shared triangle edges.
     */
    buildFromEntity(entity, options = {}) {
        const splatSize = options.splatSize ?? 0.01;
        const recursive = options.recursive ?? true;
        const margin = options.margin ?? 0.65;

        // Collect all render components
        const renderComponents = [];
        collectRenderComponents(entity, recursive, renderComponents);

        if (renderComponents.length === 0) {
            this._destroyContainer();
            return;
        }

        // Get root entity's world transform and compute inverse
        // This allows splats to be in local space relative to the root entity
        const rootWorldTransform = entity.getWorldTransform();
        tempInverseMat.copy(rootWorldTransform).invert();

        // Array to collect all splats
        /** @type {Array<{x: number, y: number, z: number, r: number, g: number, b: number, a: number}>} */
        const allSplats = [];

        // Process all mesh instances
        for (const renderComponent of renderComponents) {
            const meshInstances = renderComponent.meshInstances;
            if (!meshInstances) continue;

            for (const meshInstance of meshInstances) {
                const mesh = meshInstance.mesh;
                if (!mesh) continue;

                // Extract positions
                this._positionsArray.length = 0;
                const vertexCount = mesh.getPositions(this._positionsArray);
                if (vertexCount === 0) continue;

                // Extract indices
                this._indicesArray.length = 0;
                const indexCount = mesh.getIndices(this._indicesArray);

                // If no indices, create sequential indices (non-indexed mesh)
                if (indexCount === 0) {
                    const numVertices = this._positionsArray.length / 3;
                    for (let i = 0; i < numVertices; i++) {
                        this._indicesArray.push(i);
                    }
                }

                // Skip if not enough vertices for triangles
                if (this._indicesArray.length < 3) continue;

                // Compute transform relative to root entity
                // This transforms vertices from mesh local space to root entity local space
                const meshWorldTransform = meshInstance.node.getWorldTransform();
                tempMat.mul2(tempInverseMat, meshWorldTransform);

                // Get material color
                const material = meshInstance.material;
                const color = getMaterialColor(material);

                // Process each triangle
                const positions = this._positionsArray;
                const indices = this._indicesArray;

                for (let i = 0; i < indices.length; i += 3) {
                    const i0 = indices[i] * 3;
                    const i1 = indices[i + 1] * 3;
                    const i2 = indices[i + 2] * 3;

                    // Get vertices and transform to root entity's local space
                    tempVec0.set(positions[i0], positions[i0 + 1], positions[i0 + 2]);
                    tempVec1.set(positions[i1], positions[i1 + 1], positions[i1 + 2]);
                    tempVec2.set(positions[i2], positions[i2 + 1], positions[i2 + 2]);

                    tempMat.transformPoint(tempVec0, tempVec0);
                    tempMat.transformPoint(tempVec1, tempVec1);
                    tempMat.transformPoint(tempVec2, tempVec2);

                    // Rasterize triangle to generate splats
                    rasterizeTriangle(tempVec0, tempVec1, tempVec2, splatSize, margin, color, allSplats);
                }
            }
        }

        const totalSplats = allSplats.length;

        if (totalSplats === 0) {
            this._destroyContainer();
            return;
        }

        // Destroy old container and create new one
        this._destroyContainer();

        const device = this.app.graphicsDevice;

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

        // Write all splat data
        for (let i = 0; i < totalSplats; i++) {
            const splat = allSplats[i];

            // Write center data (RGBA32F: x, y, z, size)
            centerData[i * 4 + 0] = splat.x;
            centerData[i * 4 + 1] = splat.y;
            centerData[i * 4 + 2] = splat.z;
            centerData[i * 4 + 3] = splatSize;

            // Write color data (RGBA16F)
            colorData[i * 4 + 0] = FloatPacking.float2Half(splat.r);
            colorData[i * 4 + 1] = FloatPacking.float2Half(splat.g);
            colorData[i * 4 + 2] = FloatPacking.float2Half(splat.b);
            colorData[i * 4 + 3] = FloatPacking.float2Half(splat.a);

            // Write centers for sorting
            centers[i * 3 + 0] = splat.x;
            centers[i * 3 + 1] = splat.y;
            centers[i * 3 + 2] = splat.z;

            // Update bounding box
            minX = Math.min(minX, splat.x);
            minY = Math.min(minY, splat.y);
            minZ = Math.min(minZ, splat.z);
            maxX = Math.max(maxX, splat.x);
            maxY = Math.max(maxY, splat.y);
            maxZ = Math.max(maxZ, splat.z);
        }

        // Unlock textures
        centerTex.unlock();
        colorTex.unlock();

        // Build bounding box from min/max, expanded by splat size
        const aabb = this._tempBox;
        aabb.center.set(
            (minX + maxX) * 0.5,
            (minY + maxY) * 0.5,
            (minZ + maxZ) * 0.5
        );
        aabb.halfExtents.set(
            (maxX - minX) * 0.5 + splatSize,
            (maxY - minY) * 0.5 + splatSize,
            (maxZ - minZ) * 0.5 + splatSize
        );

        // Update container
        this._container.aabb = aabb;
        this._container.update(totalSplats);
    }

    /**
     * Clear all splats and destroy the container.
     */
    clear() {
        this._destroyContainer();
    }

    /**
     * Get the current number of splats.
     *
     * @returns {number} Number of splats, or 0 if no container exists.
     */
    get splatCount() {
        return this._container?.numSplats ?? 0;
    }

    /**
     * Destroy the current container.
     *
     * @private
     */
    _destroyContainer() {
        if (this._container) {
            this._container.destroy();
            this._container = null;
        }
    }
}

export { GsplatMesh };
