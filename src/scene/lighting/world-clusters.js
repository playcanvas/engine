import { Vec3 } from '../../core/math/vec3.js';
import { math } from '../../core/math/math.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { PIXELFORMAT_R8 } from '../../platform/graphics/constants.js';
import { LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_SPOT, MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED } from '../constants.js';
import { LightsBuffer } from './lights-buffer.js';
import { Debug } from '../../core/debug.js';

const tempVec3 = new Vec3();
const tempMin3 = new Vec3();
const tempMax3 = new Vec3();
const tempBox = new BoundingBox();

const epsilon = 0.000001;
const maxTextureSize = 4096;    // maximum texture size allowed to work on all devices

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

// Main class implementing clustered lighting. Internally it organizes the omni / spot lights placement in world space 3d cell structure,
// and also uses LightsBuffer class to store light properties in textures
class WorldClusters {
    /** @type {import('../../platform/graphics/texture.js').Texture} */
    clusterTexture;

    constructor(device) {
        this.device = device;
        this.name = 'Untitled';

        // number of times a warning was reported
        this.reportCount = 0;

        // bounds of all light volumes (volume covered by the clusters)
        this.boundsMin = new Vec3();
        this.boundsMax = new Vec3();
        this.boundsDelta = new Vec3();

        // number of cells along 3 axes
        this._cells = new Vec3(1, 1, 1);       // number of cells
        this._cellsLimit = new Vec3();  // number of cells minus one
        this.cells = this._cells;

        // number of lights each cell can store
        this.maxCellLightCount = 4;

        // limits on some light properties, used for compression to 8bit texture
        this._maxAttenuation = 0;
        this._maxColorValue = 0;

        // internal list of lights (of type ClusterLight)
        this._usedLights = [];

        // light 0 is always reserved for 'no light' index
        this._usedLights.push(new ClusterLight());

        // allocate textures to store lights
        this.lightsBuffer = new LightsBuffer(device);

        // register shader uniforms
        this.registerUniforms(device);
    }

    set maxCellLightCount(count) {

        if (count !== this._maxCellLightCount) {
            this._maxCellLightCount = count;
            this._cellsDirty = true;
        }
    }

    get maxCellLightCount() {
        return this._maxCellLightCount;
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

    get cells() {
        return this._cells;
    }

    destroy() {

        this.lightsBuffer.destroy();

        this.releaseClusterTexture();
    }

    releaseClusterTexture() {
        if (this.clusterTexture) {
            this.clusterTexture.destroy();
            this.clusterTexture = null;
        }
    }

    registerUniforms(device) {

        this._clusterSkipId = device.scope.resolve('clusterSkip');

        this._clusterMaxCellsId = device.scope.resolve('clusterMaxCells');

        this._clusterWorldTextureId = device.scope.resolve('clusterWorldTexture');

        this._clusterTextureSizeId = device.scope.resolve('clusterTextureSize');
        this._clusterTextureSizeData = new Float32Array(3);

        this._clusterBoundsMinId = device.scope.resolve('clusterBoundsMin');
        this._clusterBoundsMinData = new Float32Array(3);

        this._clusterBoundsDeltaId = device.scope.resolve('clusterBoundsDelta');
        this._clusterBoundsDeltaData = new Float32Array(3);

        this._clusterCellsCountByBoundsSizeId = device.scope.resolve('clusterCellsCountByBoundsSize');
        this._clusterCellsCountByBoundsSizeData = new Float32Array(3);

        this._clusterCellsDotId = device.scope.resolve('clusterCellsDot');
        this._clusterCellsDotData = new Float32Array(3);

        // number of cells in each direction (vec3)
        this._clusterCellsMaxId = device.scope.resolve('clusterCellsMax');
        this._clusterCellsMaxData = new Float32Array(3);

        // compression limit 0
        this._clusterCompressionLimit0Id = device.scope.resolve('clusterCompressionLimit0');
        this._clusterCompressionLimit0Data = new Float32Array(2);
    }

    // updates itself based on parameters stored in the scene
    updateParams(lightingParams) {
        if (lightingParams) {
            this.cells = lightingParams.cells;
            this.maxCellLightCount = lightingParams.maxLightsPerCell;

            this.lightsBuffer.cookiesEnabled = lightingParams.cookiesEnabled;
            this.lightsBuffer.shadowsEnabled = lightingParams.shadowsEnabled;

            this.lightsBuffer.areaLightsEnabled = lightingParams.areaLightsEnabled;
        }
    }

    updateCells() {
        if (this._cellsDirty) {
            this._cellsDirty = false;

            const cx = this._cells.x;
            const cy = this._cells.y;
            const cz = this._cells.z;

            // storing 1 light per pixel
            const numCells = cx * cy * cz;
            const totalPixels = this.maxCellLightCount * numCells;

            // cluster texture size - roughly square that fits all cells. The width is multiply of numPixels to simplify shader math
            let width = Math.ceil(Math.sqrt(totalPixels));
            width = math.roundUp(width, this.maxCellLightCount);
            const height = Math.ceil(totalPixels / width);

            // if the texture is allowed size
            Debug.assert(width <= maxTextureSize && height <= maxTextureSize,
                         'Clustered lights parameters cause the texture size to be over the limit, please adjust them.');

            // maximum range of cells
            this._clusterCellsMaxData[0] = cx;
            this._clusterCellsMaxData[1] = cy;
            this._clusterCellsMaxData[2] = cz;

            // vector to allow single dot product to convert from world coordinates to cluster index
            this._clusterCellsDotData[0] = this.maxCellLightCount;
            this._clusterCellsDotData[1] = cx * cz * this.maxCellLightCount;
            this._clusterCellsDotData[2] = cx * this.maxCellLightCount;

            // cluster data and number of lights per cell
            this.clusters = new Uint8ClampedArray(totalPixels);
            this.counts = new Int32Array(numCells);

            this._clusterTextureSizeData[0] = width;
            this._clusterTextureSizeData[1] = 1.0 / width;
            this._clusterTextureSizeData[2] = 1.0 / height;

            this.releaseClusterTexture();
            this.clusterTexture = this.lightsBuffer.createTexture(this.device, width, height, PIXELFORMAT_R8, 'ClusterTexture');
        }
    }

    uploadTextures() {

        this.clusterTexture.lock().set(this.clusters);
        this.clusterTexture.unlock();

        this.lightsBuffer.uploadTextures();
    }

    updateUniforms() {

        // skip clustered lights shader evaluation if only the dummy light exists
        this._clusterSkipId.setValue(this._usedLights.length > 1 ? 0 : 1);

        this.lightsBuffer.updateUniforms();

        // texture
        this._clusterWorldTextureId.setValue(this.clusterTexture);

        // uniform values
        this._clusterMaxCellsId.setValue(this.maxCellLightCount);

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

        const maxLights = this.lightsBuffer.maxLights;

        // skip index 0 as that is used for unused light
        const usedLights = this._usedLights;
        let lightIndex = 1;

        lights.forEach((light) => {
            const runtimeLight = !!(light.mask & (MASK_AFFECT_DYNAMIC | MASK_AFFECT_LIGHTMAPPED));
            const zeroAngleSpotlight = light.type === LIGHTTYPE_SPOT && light._outerConeAngle === 0;
            if (light.enabled && light.type !== LIGHTTYPE_DIRECTIONAL && light.visibleThisFrame && light.intensity > 0 && runtimeLight && !zeroAngleSpotlight) {

                // within light limit
                if (lightIndex < maxLights) {

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
                    Debug.warnOnce(`Clustered lighting: more than ${maxLights - 1} lights in the frame, ignoring some.`);
                }
            }
        });

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

        this.lightsBuffer.setBounds(min, this.boundsDelta);
    }

    // evaluate ranges of variables compressed to 8bit texture to allow their scaling to 0..1 range
    evaluateCompressionLimits() {

        let maxAttenuation = 0;
        let maxColorValue = 0;

        const usedLights = this._usedLights;
        for (let i = 1; i < usedLights.length; i++) {
            const light = usedLights[i].light;
            maxAttenuation = Math.max(light.attenuationEnd, maxAttenuation);

            const color = light._colorLinear;
            maxColorValue = Math.max(color[0], maxColorValue);
            maxColorValue = Math.max(color[1], maxColorValue);
            maxColorValue = Math.max(color[2], maxColorValue);
        }

        // increase slightly as compression needs value < 1
        this._maxAttenuation = maxAttenuation + epsilon;
        this._maxColorValue = maxColorValue + epsilon;

        this.lightsBuffer.setCompressionRanges(this._maxAttenuation, this._maxColorValue);
    }

    updateClusters() {

        // clear clusters
        this.counts.fill(0);
        this.clusters.fill(0);

        // local accessors
        const divX = this._cells.x;
        const divZ = this._cells.z;
        const counts = this.counts;
        const limit = this._maxCellLightCount;
        const clusters = this.clusters;
        const pixelsPerCellCount = this.maxCellLightCount;
        let tooManyLights = false;

        // started from index 1, zero is "no-light" index
        const usedLights = this._usedLights;
        for (let i = 1; i < usedLights.length; i++) {
            const clusteredLight = usedLights[i];
            const light = clusteredLight.light;

            // add light data into textures
            this.lightsBuffer.addLightData(light, i);

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
                            clusters[pixelsPerCellCount * clusterIndex + count] = i;
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
                console.warn('Too many lights in light cluster ' + this.name + ', please adjust parameters.' +
                (this.reportCount === reportLimit - 1 ? ' Giving up on reporting it.' : ''));
                this.reportCount++;
            }
        }
        // #endif
    }

    // internal update of the cluster data, executes once per frame
    update(lights, lightingParams) {
        this.updateParams(lightingParams);
        this.updateCells();
        this.collectLights(lights);
        this.evaluateBounds();
        this.evaluateCompressionLimits();
        this.updateClusters();
        this.uploadTextures();
    }

    // called on already updated clusters, activates for rendering by setting up uniforms / textures on the device
    activate() {
        this.updateUniforms();
    }
}

export { WorldClusters };
