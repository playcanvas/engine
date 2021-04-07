import { Vec3 } from '../math/vec3.js';
import { math } from '../math/math.js';
import { BoundingBox } from '../shape/bounding-box.js';
import { Texture } from '../graphics/texture.js';
import { PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_RGBA32F, ADDRESS_CLAMP_TO_EDGE, TEXTURETYPE_DEFAULT, FILTER_NEAREST } from '../graphics/constants.js';
import { LIGHTTYPE_DIRECTIONAL } from './constants.js';

let tempVec3 = new Vec3();
let tempMin3 = new Vec3();
let tempMax3 = new Vec3();
let tempBox = new BoundingBox();

const epsilon = 0.000001;
const oneDiv255 = 1 / 255;

// packs a float value in [0..1) range to 4 bytes and stores them in an array with start offset
// based on: https://aras-p.info/blog/2009/07/30/encoding-floats-to-rgba-the-final/
// Note: calls to Math.round are only needed on iOS, precision is somehow really bad without it,
// looks like an issue with their implementation of Uint8ClampedArray
function packFloatTo4Bytes(value, array, offset) {
    const enc1 = (255.0 * value) % 1;
    const enc2 = (65025.0 * value) % 1;
    const enc3 = (16581375.0 * value) % 1;

    array[offset + 0] = Math.round(((value % 1) - oneDiv255 * enc1) * 255);
    array[offset + 1] = Math.round((enc1 - oneDiv255 * enc2) * 255);
    array[offset + 2] = Math.round((enc2 - oneDiv255 * enc3) * 255);
    array[offset + 3] = Math.round(enc3 * 255);
}

// packs a float value in [0..1) range to 2 bytes and stores them in an array with start offset
function packFloatTo2Bytes(value, array, offset) {
    const enc1 = (255.0 * value) % 1;
    const enc2 = (65025.0 * value) % 1;

    array[offset + 0] = Math.round(((value % 1) - oneDiv255 * enc1) * 255);
    array[offset + 1] = Math.round((enc1 - oneDiv255 * enc2) * 255);
}

class WorldClusters {

    // format for high precision light texture - float
    static FORMAT_FLOAT = 0;

    // format for high precision light texture - half
    static FORMAT_HALF = 1;

    // format for high precision light texture - 8bit
    static FORMAT_8BIT = 2;

    // active light texture format, initialized at app start
    static lightTextureFormat = WorldClusters.FORMAT_FLOAT;

    // executes when the app starts
    static init(device) {
        // lights high precision texture format
        if (device.extTextureFloat) {
            WorldClusters.lightTextureFormat = WorldClusters.FORMAT_FLOAT;
        } else {
            WorldClusters.lightTextureFormat = WorldClusters.FORMAT_8BIT;
        }
    }

    constructor(device, cells, maxCellLightCount) {
        this.device = device;

        // bounds of all lights
        this._bounds = new BoundingBox();

        // bounds of all light volumes (volume covered by the clusters)
        this.boundsMin = new Vec3();
        this.boundsMax = new Vec3();
        this.boundsDelta = new Vec3();

        // number of cells along 3 axes
        this._cells = new Vec3();       // number of cells
        this._cellsLimit = new Vec3();   // number of cells minus one
        this.cells = cells;

        // limits on some light properties, used for compression to 8bit texture
        this._maxAttenuation = 0;
        this._maxColorValue = 0;

        // internal list of lights
        this._usedLights = [];

        // each cell stores 4 lights (xyzw), so round up the count
        this._maxCellLightCount = math.roundUp(maxCellLightCount, 4);
        this._pixelsPerCellCount = this._maxCellLightCount / 4;

        // register shader uniforms
        this.registerUniforms(device);

        // alocate textures to store lights
        this.initLightsTexture();
    }

    destroy() {

        // TODO
        // release textures
    }

    registerUniforms(device) {

        this._clusterWorldTextureId = device.scope.resolve("clusterWorldTexture");
        this._clusterPixelsPerCellId = device.scope.resolve("clusterPixelsPerCell");

        this._clusterTextureSizeId = device.scope.resolve("clusterTextureSize");
        this._clusterTextureSizeData = new Float32Array(3);

        this._clusterBoundsMinId = device.scope.resolve("clusterBoundsMin");
        this._clusterBoundsMinData = new Float32Array(3);

        this._clusterBoundsDeltaId = device.scope.resolve("clusterBoundsDelta");
        this._clusterBoundsDeltaData = new Float32Array(3);

        this._clusterCellsCountByBoundsSizeId = device.scope.resolve("clusterCellsCountByBoundsSize");
        this._clusterCellsCountByBoundsSizeData = new Float32Array(3);

        this._clusterCellsDotId = device.scope.resolve("clusterCellsDot");
        this._clusterCellsDotData = new Float32Array(3);

        // number of cells in each direction (vec3)
        this._clusterCellsMaxId = device.scope.resolve("clusterCellsMax");
        this._clusterCellsMaxData = new Float32Array(3);

        // compression limit 0
        this._clusterCompressionLimit0Id = device.scope.resolve("clusterCompressionLimit0");
        this._clusterCompressionLimit0Data = new Float32Array(2);
    }

    get cells() {
        return this._cells;
    }

    set cells(value) {

        // make sure we have whole numbers
        tempVec3.copy(value).floor();

        if (!this._cells.equals(tempVec3)) {
            this._cells.copy(tempVec3);
            this._cellsLimit.copy(tempVec3).sub(Vec3.ONE);
            this._cellsDirty = true;
        }
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

        // shared 8bit texture pixels:
        // 0: lightType, -, -, -
        // 1: color.r, color.r, color.g, color.g    // HDR color is stored using 2 bytes per channel
        // 2: color.b, color.b, -, -
        let pixelsPerLight8 = 3;
        let pixelsPerLightFloat = 0;

        // float texture format
        if (WorldClusters.lightTextureFormat === WorldClusters.FORMAT_FLOAT) {

            // 0: pos.x, pos.y, pos.z, attenuationEnd
            pixelsPerLightFloat = 1;

        } else { // 8bit texture

            // each line is a pixel
            //  3:  pos.x
            //  4:  pox.y
            //  5:  pos.z
            //  6:  attenuationEnd

            pixelsPerLight8 = 7;
        }

        // 8bit texture - to store data that can fit into 8bits to lower the bandwidth requirements
        this.lights8 = new Uint8ClampedArray(4 * pixelsPerLight8 * this.maxLights);
        this.lightsTexture8 = this.createTexture(pixelsPerLight8, this.maxLights, PIXELFORMAT_R8_G8_B8_A8);
        this._lightsTexture8Id = this.device.scope.resolve("lightsTexture8");

        // float texture
        if (pixelsPerLightFloat) {
            this.lightsFloat = new Float32Array(4 * pixelsPerLightFloat * this.maxLights);
            this.lightsTextureFloat = this.createTexture(pixelsPerLightFloat, this.maxLights, PIXELFORMAT_RGBA32F);
            this._lightsTextureFloatId = this.device.scope.resolve("lightsTextureFloat");
        } else {
            this.lightsFloat = null;
            this.lightsTextureFloat = null;
            this._lightsTextureFloatId = undefined;
        }

        // inverse sizes for both textures
        this._lightsTextureInvSizeId = this.device.scope.resolve("lightsTextureInvSize");
        this._lightsTextureInvSizeData = new Float32Array(4);
        this._lightsTextureInvSizeData[0] = pixelsPerLightFloat ? 1.0 / this.lightsTextureFloat.width : 0;
        this._lightsTextureInvSizeData[1] = pixelsPerLightFloat ? 1.0 / this.lightsTextureFloat.height : 0;
        this._lightsTextureInvSizeData[2] = 1.0 / this.lightsTexture8.width;
        this._lightsTextureInvSizeData[3] = 1.0 / this.lightsTexture8.height;
    }

    // fill up both float and 8bit texture data with light properties
    addLightData(light, lightIndex, gammaCorrection) {

        // data always stored in 8bit texture
        const data8 = this.lights8;
        const data8Index = lightIndex * this.lightsTexture8.width * 4;

        // light type
        data8[data8Index + 0] = Math.random() * 255;

        // light color
        const invMaxColorValue = 1.0 / this._maxColorValue;
        const color = gammaCorrection ? light._linearFinalColor : light._finalColor;
        packFloatTo2Bytes(color[0] * invMaxColorValue, data8, data8Index + 4);
        packFloatTo2Bytes(color[1] * invMaxColorValue, data8, data8Index + 6);
        packFloatTo2Bytes(color[2] * invMaxColorValue, data8, data8Index + 8);

        // high precision data stored using float texture
        const pos = light._node.getPosition();

        if (WorldClusters.lightTextureFormat === WorldClusters.FORMAT_FLOAT) {

            const dataFloat = this.lightsFloat;
            const dataFloatIndex = lightIndex * this.lightsTextureFloat.width * 4;

            // pos / range
            dataFloat[dataFloatIndex + 0] = pos.x;
            dataFloat[dataFloatIndex + 1] = pos.y;
            dataFloat[dataFloatIndex + 2] = pos.z;
            dataFloat[dataFloatIndex + 3] = light.attenuationEnd;

        } else {    // high precision data stored using 8bit texture

            // position and range scaled to 0..1 range
            const normPos = tempVec3.sub2(pos, this.boundsMin).div(this.boundsDelta);
            packFloatTo4Bytes(normPos.x, data8, data8Index + 12);
            packFloatTo4Bytes(normPos.y, data8, data8Index + 16);
            packFloatTo4Bytes(normPos.z, data8, data8Index + 20);
            packFloatTo4Bytes(light.attenuationEnd / this._maxAttenuation, data8, data8Index + 24);
        }
    }

    updateCells() {
        if (this._cellsDirty) {
            this._cellsDirty = false;

            const cx = this._cells.x;
            const cy = this._cells.y;
            const cz = this._cells.z;

            // maximum range of cells
            this._clusterCellsMaxData[0] = cx;
            this._clusterCellsMaxData[1] = cy;
            this._clusterCellsMaxData[2] = cz;

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

            // TODO: release previous texture !!!!!!!!

            this.clusterTexture = this.createTexture(width, height, PIXELFORMAT_R8_G8_B8_A8);
        }
    }

    uploadTextures() {
        let pixels = this.clusterTexture.lock();
        pixels.set(this.clusters);
        this.clusterTexture.unlock();

        if (this.lightsTextureFloat) {
            pixels = this.lightsTextureFloat.lock();
            pixels.set(this.lightsFloat);
            this.lightsTextureFloat.unlock();
        }

        pixels = this.lightsTexture8.lock();
        pixels.set(this.lights8);
        this.lightsTexture8.unlock();
    }

    updateUniforms() {

        // textures
        this._clusterWorldTextureId.setValue(this.clusterTexture);
        this._lightsTexture8Id.setValue(this.lightsTexture8);

        if (WorldClusters.lightTextureFormat === WorldClusters.FORMAT_FLOAT) {
            this._lightsTextureFloatId.setValue(this.lightsTextureFloat);
        }

        // uniform values
        const boundsDelta = this.boundsDelta;
        this._clusterCellsCountByBoundsSizeData[0] = this._cells.x / boundsDelta.x;
        this._clusterCellsCountByBoundsSizeData[1] = this._cells.y / boundsDelta.y;
        this._clusterCellsCountByBoundsSizeData[2] = this._cells.z / boundsDelta.z;
        this._clusterCellsCountByBoundsSizeId.setValue(this._clusterCellsCountByBoundsSizeData);

        this._clusterBoundsMinData[0] = this.boundsMin.x;
        this._clusterBoundsMinData[1] = this.boundsMin.y;
        this._clusterBoundsMinData[2] = this.boundsMin.z;

        this._clusterBoundsDeltaData[0] = boundsDelta.x;
        this._clusterBoundsDeltaData[1] = boundsDelta.y;
        this._clusterBoundsDeltaData[2] = boundsDelta.z;

        this._clusterCompressionLimit0Data[0] = this._maxAttenuation;
        this._clusterCompressionLimit0Data[1] = this._maxColorValue;

        // assign values
        this._clusterPixelsPerCellId.setValue(this._pixelsPerCellCount);
        this._lightsTextureInvSizeId.setValue(this._lightsTextureInvSizeData);
        this._clusterTextureSizeId.setValue(this._clusterTextureSizeData);
        this._clusterBoundsMinId.setValue(this._clusterBoundsMinData);
        this._clusterBoundsDeltaId.setValue(this._clusterBoundsDeltaData);
        this._clusterCellsDotId.setValue(this._clusterCellsDotData);
        this._clusterCellsMaxId.setValue(this._clusterCellsMaxData);
        this._clusterCompressionLimit0Id.setValue(this._clusterCompressionLimit0Data);
    }

    // evaluates min and max coordinates of AABB of the light in the cell space
    evalLightCellMinMax(light, min, max) {

        // light's bounding box
        light.getBoundingBox(tempBox);

        // min point of AABB in cell space
        min.copy(tempBox.getMin());
        min.sub(this.boundsMin);
        min.div(this.boundsDelta);
        min.mul2(min, this.cells);
        min.floor();

        // max point of AABB in cell space
        max.copy(tempBox.getMax());
        max.sub(this.boundsMin);
        max.div(this.boundsDelta);
        max.mul2(max, this.cells);
        max.ceil();

        // clamp to limits
        min.max(Vec3.ZERO);
        max.min(this._cellsLimit);
    }

    collectLights(lights) {

        const usedLights = this._usedLights;
        usedLights.length = 0;

        // skip index 0 as that is used for unused light
        let lightIndex = 1;
        usedLights[0] = null;

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
            }

            usedLights[lightIndex] = light;
            lightIndex++;
        }
    }

    evaluateBounds() {

        const usedLights = this._usedLights;

        // bounds of the area the lights cover
        const min = this.boundsMin;
        const max = this.boundsMax;

        // if at least one light (index 0 is null, so ignore that one)
        if (usedLights.length > 1) {

            // AABB of the first light
            usedLights[1].getBoundingBox(tempBox);
            min.copy(tempBox.getMin());
            max.copy(tempBox.getMax());

            for (let i = 2; i < usedLights.length; i++) {

                // expand by AABB of this light
                usedLights[i].getBoundingBox(tempBox);
                min.min(tempBox.getMin());
                max.max(tempBox.getMax());
            }
        } else {

            // any small volume if no lights
            min.set(0, 0, 0);
            max.set(1, 1, 1);
        }

        // bounds range
        this.boundsDelta.sub2(max, min);
    }

    // evaluate ranges of variables compressed to 8bit texture to allow their scaling to 0..1 range
    evaluateCompressionLimits(gammaCorrection) {

        let maxAttenuation = 0;
        let maxColorValue = 0;

        const usedLights = this._usedLights;
        for (let i = 1; i < usedLights.length; i++) {
            const light = usedLights[i];
            maxAttenuation = Math.max(light.attenuationEnd, maxAttenuation);

            const color = gammaCorrection ? light._linearFinalColor : light._finalColor;
            maxColorValue = Math.max(color[0], maxColorValue);
            maxColorValue = Math.max(color[1], maxColorValue);
            maxColorValue = Math.max(color[2], maxColorValue);
        }

        // increase slightly as compression needs value < 1
        this._maxAttenuation = maxAttenuation + epsilon;
        this._maxColorValue = maxColorValue + epsilon;
    }

    updateClusters(gammaCorrection) {

        const useLights = this._usedLights;

        // clear clusters
        this.counts.fill(0);
        this.clusters.fill(0);

        // local accessors
        const divX = this._cells.x;
        const divZ = this._cells.z;
        const counts = this.counts;
        const limit = this._maxCellLightCount;
        const clusters = this.clusters;
        const pixelsPerCellCount = this._pixelsPerCellCount;
        let tooManyLights = false;

        // started from index 1, zero is "no-light" index
        for (let i = 1; i < useLights.length; i++) {
            const light = useLights[i];

            // add light data into textures
            this.addLightData(light, i, gammaCorrection);

            // light's bounds in cell space
            this.evalLightCellMinMax(light, tempMin3, tempMax3);

            const xStart = tempMin3.x;
            const xEnd = tempMax3.x;
            const yStart = tempMin3.y;
            const yEnd = tempMax3.y;
            const zStart = tempMin3.z;
            const zEnd = tempMax3.z;

            // add the light to the cells
            for (let x = xStart; x <= xEnd; x++) {
                for (let z = zStart; z <= zEnd; z++) {
                    for (let y = yStart; y <= yEnd; y++) {

                        const clusterIndex = x + divX * (z + y * divZ);
                        const count = counts[clusterIndex];
                        if (count < limit) {
                            clusters[pixelsPerCellCount * clusterIndex * 4 + count] = i;
                            counts[clusterIndex] = count + 1;

                        } else {
                            tooManyLights = true;
                        }

                    }
                }
            }
        }

        if (tooManyLights) {
            console.error("too many lights in some clusters");
        }
    }

    update(lights, gammaCorrection) {
        this.updateCells();
        this.collectLights(lights);
        this.evaluateBounds();
        this.evaluateCompressionLimits(gammaCorrection);
        this.updateClusters(gammaCorrection);
        this.uploadTextures();
        this.updateUniforms();
    }
}

export { WorldClusters };
