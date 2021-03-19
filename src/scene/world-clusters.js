import { Vec3 } from '../math/vec3.js';
import { math } from '../math/math.js';
import { BoundingBox } from '../shape/bounding-box.js';
import { BoundingSphere } from '../shape/bounding-sphere.js';
import { Texture } from '../graphics/texture.js';
import { PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_RGBA32F, ADDRESS_CLAMP_TO_EDGE, TEXTURETYPE_DEFAULT, FILTER_NEAREST } from '../graphics/constants.js';
import { LIGHTTYPE_DIRECTIONAL } from './constants.js';

let boundsSize = new Vec3();
let boundsMin = new Vec3();
let boundsLimit = new Vec3();
let min3 = new Vec3();
let max3 = new Vec3();
let rad3 = new Vec3();
let tempSphere = new BoundingSphere();

class WorldClusters {
    constructor(device, bounds, cells, maxCellLightCount) {

        this.device = device;

        this._bounds = new BoundingBox();
        this.bounds = bounds;

        this._cells = new Vec3();
        this.cells = cells;

        // each cell stores 4 lights (xyzw), so round up the count
        this._maxCellLightCount = math.roundUp(maxCellLightCount, 4);
        this._pixelsPerCellCount = this._maxCellLightCount / 4;

        // register shader uniforms
        this._clusterWorldTextureId = device.scope.resolve("clusterWorldTexture");
        this._clusterPixelsPerCellId = device.scope.resolve("clusterPixelsPerCell");

        this._clusterTextureSizeId = device.scope.resolve("clusterTextureSize");
        this._clusterTextureSizeData = new Float32Array(3);

        this._clusterBoundsMinId = device.scope.resolve("clusterBoundsMin");
        this._clusterBoundsMinData = new Float32Array(3);

        this._clusterCellsCountByBoundsSizeId = device.scope.resolve("clusterCellsCountByBoundsSize");
        this._clusterCellsCountByBoundsSizeData = new Float32Array(3);

        this._clusterCellsDotId = device.scope.resolve("clusterCellsDot");
        this._clusterCellsDotData = new Float32Array(3);

        this.initLightsTexture();
    }

    get bounds() {
        return this._bounds;
    }

    set bounds(value) {
        this._bounds.copy(value);
        this._boundsDirty = true;
    }

    get cells() {
        return this._cells;
    }

    set cells(value) {
        this._cells.copy(value);
        this._cellsDirty = true;
    }

    createTexture(width, height, format) {
        var tex = new Texture(this.device, {
            width: width,
            height: height,
            mipmaps: false,
            format: format,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            type: TEXTURETYPE_DEFAULT,
            magFilter: FILTER_NEAREST,
            minFilter: FILTER_NEAREST,
            anisotropy: 1
        });

        return tex;
    }

    initLightsTexture() {

        // using 8 bit index so this is maximum supported number of lights
        this.maxLights = 255;

        // 8bit texture - to store data that can fit into 8bits to lower the bandwidth requirements
        const pixelsPerLight8 = 1;
        this.lights8 = new Uint8ClampedArray(4 * pixelsPerLight8 * this.maxLights);
        this.lightsTexture8 = this.createTexture(pixelsPerLight8, this.maxLights, PIXELFORMAT_R8_G8_B8_A8);
        this._lightsTexture8Id = this.device.scope.resolve("lightsTexture8");

        // float texture - large precision data
        const pixelsPerLightFloat = 2;
        this.lightsFloat = new Float32Array(4 * pixelsPerLightFloat * this.maxLights);
        this.lightsTextureFloat = this.createTexture(pixelsPerLightFloat, this.maxLights, PIXELFORMAT_RGBA32F);
        this._lightsTextureFloatId = this.device.scope.resolve("lightsTextureFloat");

        // inverse sizes for both textures
        this._lightsTextureInvSizeId = this.device.scope.resolve("lightsTextureInvSize");
        this._lightsTextureInvSizeData = new Float32Array(4);
        this._lightsTextureInvSizeData[0] = 1.0 / this.lightsTextureFloat.width;
        this._lightsTextureInvSizeData[1] = 1.0 / this.lightsTextureFloat.height;
        this._lightsTextureInvSizeData[2] = 1.0 / this.lightsTexture8.width;
        this._lightsTextureInvSizeData[3] = 1.0 / this.lightsTexture8.height;
    }

    updateBounds() {
        if (this._boundsDirty) {
            this._boundsDirty = false;

            const min = this._bounds.getMin();
            this._clusterBoundsMinData[0] = min.x;
            this._clusterBoundsMinData[1] = min.y;
            this._clusterBoundsMinData[2] = min.z;
        }
    }

    updateCells() {
        if (this._cellsDirty) {
            this._cellsDirty = false;

            const cx = this._cells.x;
            const cy = this._cells.y;
            const cz = this._cells.z;

            // vector to allow single dot product to convert from world coordinates to cluster index
            this._clusterCellsDotData[0] = this._pixelsPerCellCount;
            this._clusterCellsDotData[1] = cx * cz * this._pixelsPerCellCount;
            this._clusterCellsDotData[2] = cx * this._pixelsPerCellCount;

            // storing 4 lights per pixels
            const numCells = cx * cy * cz;
            const totalPixels = this._pixelsPerCellCount * numCells;

            // cluster data and number of lights per cell
            this.clusters = new Uint8ClampedArray(4 * totalPixels);
            this.counts = new Int32Array(numCells);

            // cluster texture size - roughly square that fits all cells. The width is multiply of numPixels to simplify shader math
            // TODO: handle the case where this goes over texture limit - either report error, or drop down number of cells / lights per cell
            let width = Math.ceil(Math.sqrt(totalPixels));
            width = math.roundUp(width, this._pixelsPerCellCount);
            let height = Math.ceil(totalPixels / width);

            this._clusterTextureSizeData[0] = width;
            this._clusterTextureSizeData[1] = 1.0 / width;
            this._clusterTextureSizeData[2] = 1.0 / height;

            this.texture = this.createTexture(width, height, PIXELFORMAT_R8_G8_B8_A8);
        }
    }

    uploadTextures() {

        let pixels = this.texture.lock();
        pixels.set(this.clusters);
        this.texture.unlock();

        pixels = this.lightsTextureFloat.lock();
        pixels.set(this.lightsFloat);
        this.lightsTextureFloat.unlock();

        pixels = this.lightsTexture8.lock();
        pixels.set(this.lights8);
        this.lightsTexture8.unlock();
    }

    updateUniforms() {

        this._clusterWorldTextureId.setValue(this.texture);
        this._lightsTextureFloatId.setValue(this.lightsTextureFloat);
        this._lightsTexture8Id.setValue(this.lightsTexture8);

        this._clusterPixelsPerCellId.setValue(this._pixelsPerCellCount);
        this._lightsTextureInvSizeId.setValue(this._lightsTextureInvSizeData);
        this._clusterTextureSizeId.setValue(this._clusterTextureSizeData);
        this._clusterBoundsMinId.setValue(this._clusterBoundsMinData);
        this._clusterCellsDotId.setValue(this._clusterCellsDotData);

        const boundsHalf = this._bounds.halfExtents;
        this._clusterCellsCountByBoundsSizeData[0] = this._cells.x / (boundsHalf.x * 2);
        this._clusterCellsCountByBoundsSizeData[1] = this._cells.y / (boundsHalf.y * 2);
        this._clusterCellsCountByBoundsSizeData[2] = this._cells.z / (boundsHalf.z * 2);
        this._clusterCellsCountByBoundsSizeId.setValue(this._clusterCellsCountByBoundsSizeData);
    }

    // fill up both float and 8bit texture data with light properties
    addLightData(light, lightIndex) {

        // 8bit texture
        const data8 = this.lights8;
        const data8Index = lightIndex * this.lightsTexture8.width * 4;
        data8[data8Index + 0] = Math.random() * 255;

        // float texture
        const dataFloat = this.lightsFloat;
        const dataFloatIndex = lightIndex * this.lightsTextureFloat.width * 4;

        // pos / range
        const pos = light._node.getPosition();
        dataFloat[dataFloatIndex + 0] = pos.x;
        dataFloat[dataFloatIndex + 1] = pos.y;
        dataFloat[dataFloatIndex + 2] = pos.z;
        dataFloat[dataFloatIndex + 3] = light.attenuationEnd;

        // color
        dataFloat[dataFloatIndex + 4] = light._color.r;
        dataFloat[dataFloatIndex + 5] = light._color.g;
        dataFloat[dataFloatIndex + 6] = light._color.b;
        dataFloat[dataFloatIndex + 7] = 0;  // unused
    }

    evalLightCellMinMax(light, min, max) {

        light.getBoundingSphere(tempSphere);
        const worldPos = tempSphere.center;
        const rad = tempSphere.radius;
        rad3 = new Vec3(rad, rad, rad);

        min.copy(worldPos).sub(rad3);
        min.sub(boundsMin);
        min.div(boundsSize);
        min.mul2(min, this.cells);
        min.floor();

        max.copy(worldPos).add(rad3);
        max.sub(boundsMin);
        max.div(boundsSize);
        max.mul2(max, this.cells);
        max.ceil();

        // clamp to limits
        min.max(Vec3.ZERO);
        max.min(boundsLimit);
    }

    update(lights) {

        this.updateBounds();
        this.updateCells();

        // clear clusters
        this.counts.fill(0);
        this.clusters.fill(0);

        // bounds
        boundsMin.copy(this._bounds.getMin());
        boundsSize.copy(this._bounds.halfExtents).mulScalar(2);
        boundsLimit.copy(this.cells).sub(Vec3.ONE);

        // local accessors
        const divX = this._cells.x;
        const divZ = this._cells.z;
        const counts = this.counts;
        const limit = this._maxCellLightCount;
        const clusters = this.clusters;
        const pixelsPerCellCount = this._pixelsPerCellCount;
        let tooManyLights = false;
        let lightIndex = 1; // skip index 0 as that is used for unused light

        for (let i = 0; i < lights.length; i++) {
            const light = lights[i];

            // !!!!!!!!!!!!!!!!!!!!!!!
            // possibly skip culled lights when integrated into culling: light.visibleThisFrame

            if (light.enabled && light._type !== LIGHTTYPE_DIRECTIONAL) {

                // storing light index in 8bits
                if (lightIndex > 255) {
                    console.warn("Clustered lighting: more than 255 visible lights in the frame, ignoring some.");
                    break;
                }

                // add light data into textures
                this.addLightData(light, lightIndex);

                // light's bounds in cell space
                this.evalLightCellMinMax(light, min3, max3);

                const xStart = min3.x;
                const xEnd = max3.x;
                const yStart = min3.y;
                const yEnd = max3.y;
                const zStart = min3.z;
                const zEnd = max3.z;

                // add the light to the cells
                for (let x = xStart; x <= xEnd; x++) {
                    for (let z = zStart; z <= zEnd; z++) {
                        for (let y = yStart; y <= yEnd; y++) {

                            const clusterIndex = x + divX * (z + y * divZ);
                            const count = counts[clusterIndex];
                            if (count < limit) {
                                clusters[pixelsPerCellCount * clusterIndex * 4 + count] = lightIndex;
                                counts[clusterIndex] = count + 1;

                            } else {
                                tooManyLights = true;
                            }

                        }
                    }
                }

                lightIndex++;
            }
        }

        if (tooManyLights) {
            console.error("too many lights in some clusters");
        }

        this.uploadTextures();
        this.updateUniforms();
    }
}

export { WorldClusters };
