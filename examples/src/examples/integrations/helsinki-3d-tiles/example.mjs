// @config
//
// The city of Helsinki, streamed as {accent:3D Tiles} by the
// [3DTilesRendererJS](https://github.com/NASA-AMMOS/3DTilesRendererJS) library from the city's
// photogrammetry model. The tileset is positioned on the globe, so a small plugin re-centers it
// on the city in double precision before the engine sees any of it. The sun of the dynamic sky
// matches the shadows baked into the photographs.
//
// @credit
// title: Helsinki 3D Mesh 2024
// author: City of Helsinki
// source: https://www.hel.fi/en/decision-making/information-on-helsinki/maps-and-geospatial-data/helsinki-3d
// license: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)

import { TilesRenderer } from '3d-tiles-renderer/playcanvas';

import {
    AppBase,
    AppOptions,
    CLOUDTYPE_VOLUMETRIC,
    CameraComponentSystem,
    CameraFrame,
    ContainerHandler,
    DynamicSkyEffect,
    Entity,
    FILLMODE_FILL_WINDOW,
    Mat4,
    Mouse,
    Quat,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    ScriptComponentSystem,
    TONEMAP_NEUTRAL,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    createGraphicsDevice,
    dracoInitialize
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// the textured mesh of the city. The root tileset also links an invisible collision layer, which
// is skipped by loading the mesh layer directly
const TILESET_URL = 'https://kartta.hel.fi/3d/mesh/Helsinki_2024/2/tileset.json';

// the point the city is centered on, the Senate Square, in degrees and meters above the ellipsoid
const ORIGIN_LATITUDE = 60.16952;
const ORIGIN_LONGITUDE = 24.9524;
const ORIGIN_HEIGHT = 0;

// the photographs of the city have the shadows of a morning sun baked in, and the model has no
// lighting of its own. The sun of the sky is placed where those shadows point from, in the
// east-south-east, measured from the shadows of trees and buildings seen from above
const SUN_COMPASS_BEARING = 110;
const SUN_ELEVATION = 38;

// the tiles are draco compressed
dracoInitialize({
    jsUrl: './assets/wasm/draco/draco.wasm.js',
    wasmUrl: './assets/wasm/draco/draco.wasm.wasm',
    numWorkers: 4
});

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, ScriptComponentSystem];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

app.start();

data.set('data', {
    tiles: {
        errorTarget: 12
    }
});

// the WGS84 ellipsoid, which the tileset positions are given on
const WGS84_RADIUS = 6378137;
const WGS84_ECCENTRICITY_SQUARED = 6.69437999014e-3;

/**
 * Converts a position on the globe to Earth-centered coordinates, in double precision.
 *
 * @param {number} longitude - The longitude in radians.
 * @param {number} latitude - The latitude in radians.
 * @param {number} height - The height above the ellipsoid in meters.
 * @returns {number[]} The Earth-centered position in meters.
 */
const toEarthCentered = (longitude, latitude, height) => {
    const sinLatitude = Math.sin(latitude);
    const cosLatitude = Math.cos(latitude);
    const n = WGS84_RADIUS / Math.sqrt(1 - WGS84_ECCENTRICITY_SQUARED * sinLatitude * sinLatitude);
    return [
        (n + height) * cosLatitude * Math.cos(longitude),
        (n + height) * cosLatitude * Math.sin(longitude),
        (n * (1 - WGS84_ECCENTRICITY_SQUARED) + height) * sinLatitude
    ];
};

/**
 * Returns the east, north and up directions on the globe, in Earth-centered coordinates.
 *
 * @param {number} longitude - The longitude in radians.
 * @param {number} latitude - The latitude in radians.
 * @returns {number[][]} The east, north and up directions.
 */
const localAxes = (longitude, latitude) => {
    const sinLongitude = Math.sin(longitude);
    const cosLongitude = Math.cos(longitude);
    const sinLatitude = Math.sin(latitude);
    const cosLatitude = Math.cos(latitude);
    return [
        [-sinLongitude, cosLongitude, 0],
        [-sinLatitude * cosLongitude, -sinLatitude * sinLongitude, cosLatitude],
        [cosLatitude * cosLongitude, cosLatitude * sinLongitude, sinLatitude]
    ];
};

/**
 * @param {number[]} a - The first vector.
 * @param {number[]} b - The second vector.
 * @returns {number} The dot product.
 */
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const DEG_TO_RAD = Math.PI / 180;
const origin = toEarthCentered(ORIGIN_LONGITUDE * DEG_TO_RAD, ORIGIN_LATITUDE * DEG_TO_RAD, ORIGIN_HEIGHT);

/**
 * Returns a box bounding a region of the globe, aligned to the directions on the globe at its
 * center and positioned relative to the origin.
 *
 * @param {number[]} region - The west, south, east and north edges in radians, and the minimum
 * and maximum height in meters.
 * @returns {number[]} The center and the three half axes of the box.
 */
const regionToBox = (region) => {
    const [west, south, east, north, minHeight, maxHeight] = region;
    const axes = localAxes((west + east) / 2, (south + north) / 2);

    // the extent along each axis of points sampled over the region, as the surface curves
    // between the edges
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
        for (let j = 0; j <= steps; j++) {
            for (const height of [minHeight, maxHeight]) {
                const point = toEarthCentered(
                    west + ((east - west) * i) / steps,
                    south + ((north - south) * j) / steps,
                    height
                );
                const offset = [point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]];
                for (let k = 0; k < 3; k++) {
                    const distance = dot(offset, axes[k]);
                    min[k] = Math.min(min[k], distance);
                    max[k] = Math.max(max[k], distance);
                }
            }
        }
    }

    const box = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
        // a meter of margin covers the curvature between the samples
        const center = (min[k] + max[k]) / 2;
        const halfSize = (max[k] - min[k]) / 2 + 1;
        for (let c = 0; c < 3; c++) {
            box[c] += axes[k][c] * center;
            box.push(axes[k][c] * halfSize);
        }
    }
    return box;
};

/**
 * Moves the RTC_CENTER position of a b3dm tile to be relative to the origin. The tile content
 * stays relative to that position, so the large Earth-centered values never reach the engine.
 *
 * @param {ArrayBuffer} buffer - The b3dm tile.
 * @returns {ArrayBuffer} The b3dm tile with the moved position.
 */
const recenterB3dm = (buffer) => {
    const featureTableLength = new DataView(buffer).getUint32(12, true);
    const featureTable = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 28, featureTableLength)));
    const center = featureTable.RTC_CENTER;
    if (!Array.isArray(center)) {
        return buffer;
    }
    featureTable.RTC_CENTER = [center[0] - origin[0], center[1] - origin[1], center[2] - origin[2]];

    // the feature table is padded with spaces to keep the data that follows it 8 byte aligned
    let json = JSON.stringify(featureTable);
    json += ' '.repeat((8 - ((28 + json.length) % 8)) % 8);
    const jsonBytes = new TextEncoder().encode(json);
    const rest = new Uint8Array(buffer, 28 + featureTableLength);

    const result = new Uint8Array(28 + jsonBytes.length + rest.length);
    result.set(new Uint8Array(buffer, 0, 28));
    result.set(jsonBytes, 28);
    result.set(rest, 28 + jsonBytes.length);
    const view = new DataView(result.buffer);
    view.setUint32(8, result.length, true);
    view.setUint32(12, jsonBytes.length, true);
    return result.buffer;
};

// a plugin which re-centers the tileset on the origin. Plugins see each tile before the renderer
// does, so the region bounding volumes are replaced with boxes, and the content positions are
// moved before the tile is parsed
const recenterPlugin = {
    name: 'RECENTER_PLUGIN',

    /**
     * @param {any} tile - The tile, as stored in the tileset.
     */
    preprocessNode(tile) {
        const { region } = tile.boundingVolume;
        if (region) {
            tile.boundingVolume.box = regionToBox(region);
            delete tile.boundingVolume.region;
        }
    },

    /**
     * @param {string} url - The URL to fetch.
     * @param {RequestInit} options - The fetch options.
     * @returns {Promise<Response> | null} The response, or null to fetch the URL as usual.
     */
    fetchData(url, options) {
        if (!new URL(url).pathname.endsWith('.b3dm')) {
            return null;
        }
        return fetch(url, options).then(async (response) => {
            return response.ok ? new Response(recenterB3dm(await response.arrayBuffer())) : response;
        });
    }
};

// the camera, high over the north of the city and looking south to its center. The left button
// drags the city like a map, and the other buttons turn the view
const camera = new Entity('Camera');
camera.addComponent('camera', {
    fov: 50,
    nearClip: 2,
    farClip: 30000
});
camera.setLocalPosition(-114.5, 1268.7, -1926.2);
app.root.addChild(camera);

camera.addComponent('script');
const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(-121.2, 30, -797.5);
cameraControls.leftButton = 'pan';
cameraControls.middleButton = 'orbit';
cameraControls.rightButton = 'orbit';
cameraControls.groundPan = true;
cameraControls.pitchRange = new Vec2(-89, -2);
cameraControls.zoomRange = new Vec2(30, 8000);
cameraControls.moveSpeed = 100;
cameraControls.moveFastSpeed = 400;
cameraControls.moveSlowSpeed = 20;

// the sky with clouds, and its haze over the distant city and the sea, which softens where the model
// ends. The azimuth of the sky is measured from the Z axis, which points south here, so the
// compass bearing of the sun is turned around
const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.toneMapping = TONEMAP_NEUTRAL;

const sky = new DynamicSkyEffect(device);
sky.azimuth = 180 - SUN_COMPASS_BEARING;
sky.elevation = SUN_ELEVATION;
sky.cloudType = CLOUDTYPE_VOLUMETRIC;
sky.cloudCoverage = 0.2;
sky.haze = true;
sky.hazeDensity = 0.000018;

// the model is unlit, so the sky does not need to light the scene
sky.lighting = false;
cameraFrame.addEffect(sky);
cameraFrame.update();

// the re-centered tileset is still oriented on the globe, so it is rotated to have the up
// direction at the origin as Y, with east as X and south as Z. Looking north gives that frame,
// and its inverse rotates the globe into it
const [, northAxis, upAxis] = localAxes(ORIGIN_LONGITUDE * DEG_TO_RAD, ORIGIN_LATITUDE * DEG_TO_RAD);
const lookNorth = new Mat4().setLookAt(Vec3.ZERO, new Vec3(...northAxis), new Vec3(...upAxis));
const city = new Entity('Helsinki');
city.setLocalRotation(new Quat().setFromMat4(lookNorth).invert());
app.root.addChild(city);

const tiles = new TilesRenderer(TILESET_URL, app);
tiles.fetchOptions.mode = 'cors';
tiles.registerPlugin(recenterPlugin);

// each tile has a large photo texture, so the cache needs more than its default budget to hold
// the tiles of a view over the city
tiles.lruCache.minBytesSize = 0.75 * 2 ** 30;
tiles.lruCache.maxBytesSize = 1 * 2 ** 30;
tiles.setCamera(camera.camera);
city.addChild(tiles.group);

// Downloads and parses can still be in flight when the example is switched. Disposing the
// renderer aborts them, so they do not touch the destroyed asset registry and device.
app.on('destroy', () => {
    tiles.dispose();
});

app.on('update', () => {
    tiles.errorTarget = data.get('data.tiles.errorTarget');
    tiles.update();
});
