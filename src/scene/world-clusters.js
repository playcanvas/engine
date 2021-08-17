import { Vec3 } from '../math/vec3.js';
import { math } from '../math/math.js';
import { BoundingBox } from '../shape/bounding-box.js';
import { Texture } from '../graphics/texture.js';
import { PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_RGBA32F, ADDRESS_CLAMP_TO_EDGE, TEXTURETYPE_DEFAULT, FILTER_NEAREST } from '../graphics/constants.js';
import { LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_SPOT } from './constants.js';

const tempVec3 = new Vec3();
const tempMin3 = new Vec3();
const tempMax3 = new Vec3();
const tempBox = new BoundingBox();

const epsilon = 0.000001;
const oneDiv255 = 1 / 255;
const maxTextureSize = 4096;    // maximum texture size allowed to work on all devices

// packs a float value in [0..1) range to specified number of bytes and stores them in an array with start offset
// based on: https://aras-p.info/blog/2009/07/30/encoding-floats-to-rgba-the-final/
// Note: calls to Math.round are only needed on iOS, precision is somehow really bad without it,
// looks like an issue with their implementation of Uint8ClampedArray
function packFloatToBytes(value, array, offset, numBytes) {
    const enc1 = (255.0 * value) % 1;
    array[offset + 0] = Math.round(((value % 1) - oneDiv255 * enc1) * 255);

    if (numBytes > 1) {
        const enc2 = (65025.0 * value) % 1;
        array[offset + 1] = Math.round((enc1 - oneDiv255 * enc2) * 255);

        if (numBytes > 2) {
            const enc3 = (16581375.0 * value) % 1;
            array[offset + 2] = Math.round((enc2 - oneDiv255 * enc3) * 255);

            if (numBytes > 3) {
                array[offset + 3] = Math.round(enc3 * 255);
            }
        }
    }
}

// helper class to store properties of a light used by clustering
class ClusterLight {
    constructor() {
        // the light itself
        this.light = null;

        // bounding box
        this.min = new Vec3();
        this.max = new Vec3();
    }
}

class WorldClusters {
    // format for high precision light texture - float
    static FORMAT_FLOAT = 0;

    // format for high precision light texture - 8bit
    static FORMAT_8BIT = 1;

    // active light texture format, initialized at app start
    static lightTextureFormat = WorldClusters.FORMAT_8BIT;

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
        this.name = "Untitled";

        // number of times a warning was reported
        this.reportCount = 0;

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

        // number of lights each cell can store, and number of pixels this takes (4 lights per pixel)
        this._maxCellLightCount = 0;
        this._pixelsPerCellCount = 0;
        this.maxCellLightCount = maxCellLightCount;

        // limits on some light properties, used for compression to 8bit texture
        this._maxAttenuation = 0;
        this._maxColorValue = 0;

        // internal list of lights (of type ClusterLight)
        this._usedLights = [];

        // light 0 is always reserverd for 'no light' index
        this._usedLights.push(new ClusterLight());

        // register shader uniforms
        this.registerUniforms(device);

        // allocate textures to store lights
        this.initLightsTexture();
    }

    destroy() {

        // release textures
        if (this.lightsTexture8) {
            this.lightsTexture8.destroy();
            this.lightsTexture8 = null;
        }

        if (this.lightsTextureFloat) {
            this.lightsTextureFloat.destroy();
            this.lightsTextureFloat = null;
        }

        this.releaseClusterTexture();
    }

    releaseClusterTexture() {
        if (this.clusterTexture) {
            this.clusterTexture.destroy();
            this.clusterTexture = null;
        }
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

    get maxCellLightCount() {
        return this._maxCellLightCount;
    }

    set maxCellLightCount(count) {

        // each cell stores 4 lights (xyzw), so round up the count
        const maxCellLightCount = math.roundUp(count, 4);
        if (maxCellLightCount !== this._maxCellLightCount) {
            this._maxCellLightCount = maxCellLightCount;
            this._pixelsPerCellCount = this._maxCellLightCount / 4;
            this._cellsDirty = true;
        }
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
        const tex = new Texture(this.device, {
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
        // 3: spotInner, spotInner, spotOuter, spotOuter
        let pixelsPerLight8 = 4;
        let pixelsPerLightFloat = 0;

        // float texture format
        if (WorldClusters.lightTextureFormat === WorldClusters.FORMAT_FLOAT) {

            // 0: pos.x, pos.y, pos.z, attenuationEnd
            // 1: spotDir.x, spotDir.y, spotDir.z, unused
            pixelsPerLightFloat = 2;

        } else { // 8bit texture

            // each line is a pixel
            //  4:  pos.x
            //  5:  pox.y
            //  6:  pos.z
            //  7:  attenuationEnd
            //  8:  spotDir.x
            //  9:  spotDir.y
            // 10:  spotDir.z
            pixelsPerLight8 = 11;
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

    getSpotDirection(direction, spot) {

        // Spots shine down the negative Y axis
        const mat = spot._node.getWorldTransform();
        mat.getY(direction).mulScalar(-1);
        direction.normalize();
    }

    // fill up both float and 8bit texture data with light properties
    addLightData(light, lightIndex, gammaCorrection) {

        const isSpot = light._type === LIGHTTYPE_SPOT;
        const pos = light._node.getPosition();

        // data always stored in 8bit texture
        const data8 = this.lights8;
        let data8Index = lightIndex * this.lightsTexture8.width * 4;

        // light type & shape && falloffMode
        data8[data8Index + 0] = isSpot ? 255 : 0;
        data8[data8Index + 1] = light._shape * 255;
        data8[data8Index + 2] = light._falloffMode * 255;   // we should consider making this global instead of per light
        // here we still have unused byte
        data8Index += 4;

        // light color
        const invMaxColorValue = 1.0 / this._maxColorValue;
        const color = gammaCorrection ? light._linearFinalColor : light._finalColor;
        packFloatToBytes(color[0] * invMaxColorValue, data8, data8Index + 0, 2);
        packFloatToBytes(color[1] * invMaxColorValue, data8, data8Index + 2, 2);
        packFloatToBytes(color[2] * invMaxColorValue, data8, data8Index + 4, 2);
        // here we still have unused 2 bytes
        data8Index += 8;

        // spot light angles, 2 bytes each
        if (isSpot) {
            packFloatToBytes(light._innerConeAngleCos * (0.5 - epsilon) + 0.5, data8, data8Index + 0, 2);
            packFloatToBytes(light._outerConeAngleCos * (0.5 - epsilon) + 0.5, data8, data8Index + 2, 2);
        }
        data8Index += 4;

        // high precision data stored using float texture
        if (WorldClusters.lightTextureFormat === WorldClusters.FORMAT_FLOAT) {

            const dataFloat = this.lightsFloat;
            const dataFloatIndex = lightIndex * this.lightsTextureFloat.width * 4;

            // pos and range
            dataFloat[dataFloatIndex + 0] = pos.x;
            dataFloat[dataFloatIndex + 1] = pos.y;
            dataFloat[dataFloatIndex + 2] = pos.z;
            dataFloat[dataFloatIndex + 3] = light.attenuationEnd;

            // spot direction
            if (isSpot) {
                this.getSpotDirection(tempVec3, light);
                dataFloat[dataFloatIndex + 4] = tempVec3.x;
                dataFloat[dataFloatIndex + 5] = tempVec3.y;
                dataFloat[dataFloatIndex + 6] = tempVec3.z;
            }
            // here we have unused float

        } else {    // high precision data stored using 8bit texture

            // position and range scaled to 0..1 range
            const normPos = tempVec3.sub2(pos, this.boundsMin).div(this.boundsDelta);
            packFloatToBytes(normPos.x, data8, data8Index + 0, 4);
            packFloatToBytes(normPos.y, data8, data8Index + 4, 4);
            packFloatToBytes(normPos.z, data8, data8Index + 8, 4);
            packFloatToBytes(light.attenuationEnd / this._maxAttenuation, data8, data8Index + 12, 4);
            data8Index += 16;

            // spot direction
            if (isSpot) {
                this.getSpotDirection(tempVec3, light);
                packFloatToBytes(tempVec3.x * (0.5 - epsilon) + 0.5, data8, data8Index + 0, 4);
                packFloatToBytes(tempVec3.y * (0.5 - epsilon) + 0.5, data8, data8Index + 4, 4);
                packFloatToBytes(tempVec3.z * (0.5 - epsilon) + 0.5, data8, data8Index + 8, 4);
            }
        }
    }

    updateCells() {
        if (this._cellsDirty) {
            this._cellsDirty = false;

            const cx = this._cells.x;
            const cy = this._cells.y;
            const cz = this._cells.z;

            // storing 4 lights per pixels
            const numCells = cx * cy * cz;
            const totalPixels = this._pixelsPerCellCount * numCells;

            // cluster texture size - roughly square that fits all cells. The width is multiply of numPixels to simplify shader math
            let width = Math.ceil(Math.sqrt(totalPixels));
            width = math.roundUp(width, this._pixelsPerCellCount);
            const height = Math.ceil(totalPixels / width);

            // if the texture is allowed size
            if (width > maxTextureSize || height > maxTextureSize) {
                // #if _DEBUG
                console.error("LightCluster parameters cause the texture size to be over the limit.");
                // #endif
            }

            // maximum range of cells
            this._clusterCellsMaxData[0] = cx;
            this._clusterCellsMaxData[1] = cy;
            this._clusterCellsMaxData[2] = cz;

            // vector to allow single dot product to convert from world coordinates to cluster index
            this._clusterCellsDotData[0] = this._pixelsPerCellCount;
            this._clusterCellsDotData[1] = cx * cz * this._pixelsPerCellCount;
            this._clusterCellsDotData[2] = cx * this._pixelsPerCellCount;

            // cluster data and number of lights per cell
            this.clusters = new Uint8ClampedArray(4 * totalPixels);
            this.counts = new Int32Array(numCells);

            this._clusterTextureSizeData[0] = width;
            this._clusterTextureSizeData[1] = 1.0 / width;
            this._clusterTextureSizeData[2] = 1.0 / height;

            this.releaseClusterTexture();
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
    evalLightCellMinMax(clusteredLight, min, max) {

        // min point of AABB in cell space
        min.copy(clusteredLight.min);
        min.sub(this.boundsMin);
        min.div(this.boundsDelta);
        min.mul2(min, this.cells);
        min.floor();

        // max point of AABB in cell space
        max.copy(clusteredLight.max);
        max.sub(this.boundsMin);
        max.div(this.boundsDelta);
        max.mul2(max, this.cells);
        max.ceil();

        // clamp to limits
        min.max(Vec3.ZERO);
        max.min(this._cellsLimit);
    }

    collectLights(lights) {

        // skip index 0 as that is used for unused light
        const usedLights = this._usedLights;
        let lightIndex = 1;

        for (let i = 0; i < lights.length; i++) {

            // use enabled and visible lights
            const light = lights[i];
            if (light.enabled && light.type !== LIGHTTYPE_DIRECTIONAL && light.visibleThisFrame && light.intensity > 0) {

                // within light limit
                if (lightIndex < this.maxLights) {

                    // reuse allocated spot
                    let clusteredLight;
                    if (lightIndex < usedLights.length) {
                        clusteredLight = usedLights[lightIndex];
                    } else {
                        // allocate new spot
                        clusteredLight = new ClusterLight();
                        usedLights.push(clusteredLight);
                    }

                    // store light properties
                    clusteredLight.light = light;
                    light.getBoundingBox(tempBox);
                    clusteredLight.min.copy(tempBox.getMin());
                    clusteredLight.max.copy(tempBox.getMax());

                    lightIndex++;
                } else {
                    console.warn("Clustered lighting: more than " + (this.maxLights - 1) + " lights in the frame, ignoring some.");
                    break;
                }
            }
        }

        usedLights.length = lightIndex;
    }

    // evaluate the area all lights cover
    evaluateBounds() {

        const usedLights = this._usedLights;

        // bounds of the area the lights cover
        const min = this.boundsMin;
        const max = this.boundsMax;

        // if at least one light (index 0 is null, so ignore that one)
        if (usedLights.length > 1) {

            // AABB of the first light
            min.copy(usedLights[1].min);
            max.copy(usedLights[1].max);

            for (let i = 2; i < usedLights.length; i++) {

                // expand by AABB of this light
                min.min(usedLights[i].min);
                max.max(usedLights[i].max);
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
            const light = usedLights[i].light;
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
        const usedLights = this._usedLights;
        for (let i = 1; i < usedLights.length; i++) {
            const clusteredLight = usedLights[i];
            const light = clusteredLight.light;

            // add light data into textures
            this.addLightData(light, i, gammaCorrection);

            // light's bounds in cell space
            this.evalLightCellMinMax(clusteredLight, tempMin3, tempMax3);

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

        // #if _DEBUG
        if (tooManyLights) {
            const reportLimit = 5;
            if (this.reportCount < reportLimit) {
                console.warn("Too many lights in light cluster " + this.name + ", please adjust parameters." +
                (this.reportCount == reportLimit - 1 ? " Giving up on reporting it." : ""));
                this.reportCount++;
            }
        }
        // #endif
    }

    // internal update of the cluster data, executes once per frame
    update(lights, gammaCorrection) {
        this.updateCells();
        this.collectLights(lights);
        this.evaluateBounds();
        this.evaluateCompressionLimits(gammaCorrection);
        this.updateClusters(gammaCorrection);
        this.uploadTextures();
    }

    // called on already updated clusters, activates for rendering by setting up uniforms / textures on the device
    activate() {
        this.updateUniforms();
    }
}

export { WorldClusters };
