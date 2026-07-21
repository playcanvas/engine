// @config
//
// Animate a globe-scale network of thick, blooming, world-width WideLines. Connections travel
// between cities and launch towards a new destination on arrival, while every line shares one
// instanced draw.

import {
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    CameraFrame,
    Color,
    Entity,
    EnvLighting,
    FILLMODE_FILL_WINDOW,
    LINECAP_ROUND,
    LINEJOIN_ROUND,
    LINEWIDTH_WORLD,
    LightComponentSystem,
    Mouse,
    PIXELFORMAT_RGBA16F,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SKYTYPE_INFINITE,
    ScriptComponentSystem,
    StandardMaterial,
    TONEMAP_ACES,
    TextureHandler,
    TouchDevice,
    Vec2,
    Vec3,
    WideLine,
    WideLineRenderer,
    createGraphicsDevice
} from 'playcanvas';
import { CameraControls } from 'playcanvas/scripts/esm/camera-controls.mjs';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const device = await createGraphicsDevice(canvas, {
    deviceTypes: [deviceType]
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);
createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    ScriptComponentSystem
];
createOptions.resourceHandlers = [TextureHandler];

const app = new AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

const assets = {
    sky: new Asset('sky', 'texture', { url: './assets/hdri/space.webp' }, { mipmaps: false })
};

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

app.start();

app.scene.skybox = EnvLighting.generateSkyboxCubemap(assets.sky.resource, 1024);
app.scene.sky.type = SKYTYPE_INFINITE;
app.scene.ambientLight = new Color(0.16, 0.2, 0.3);
app.scene.exposure = 1.05;

const planetMaterial = new StandardMaterial();
planetMaterial.diffuse = new Color(0.035, 0.18, 0.3);
planetMaterial.emissive = new Color(0.002, 0.008, 0.018);
planetMaterial.metalness = 0.52;
planetMaterial.useMetalness = true;
planetMaterial.gloss = 0.72;
planetMaterial.clearCoat = 0.25;
planetMaterial.clearCoatGloss = 0.85;
planetMaterial.update();

const sphereRadius = 5;
const planet = new Entity('Network Planet');
planet.addComponent('render', {
    type: 'sphere',
    material: planetMaterial
});
planet.setLocalScale(sphereRadius * 2, sphereRadius * 2, sphereRadius * 2);
app.root.addChild(planet);

const keyLight = new Entity('Key Light');
keyLight.addComponent('light', {
    type: 'directional',
    color: new Color(0.55, 0.72, 1),
    intensity: 1.15
});
keyLight.setLocalEulerAngles(35, 135, 0);
app.root.addChild(keyLight);

const rimLight = new Entity('Rim Light');
rimLight.addComponent('light', {
    type: 'directional',
    color: new Color(1, 0.25, 0.5),
    intensity: 0.65
});
rimLight.setLocalEulerAngles(-25, -55, 0);
app.root.addChild(rimLight);

const camera = new Entity('Camera');
camera.addComponent('camera', {
    clearColor: new Color(0.003, 0.006, 0.018),
    nearClip: 0.1,
    farClip: 100,
    toneMapping: TONEMAP_ACES
});
camera.addComponent('script');
camera.setLocalPosition(10.5, 6.5, 13.5);
camera.lookAt(0, 0, 0);
app.root.addChild(camera);

const cameraControls = /** @type {CameraControls} */ (camera.script.create(CameraControls));
cameraControls.focusPoint = new Vec3(0, 0, 0);
cameraControls.enableFly = false;
cameraControls.pitchRange = new Vec2(-85, 85);
cameraControls.zoomRange = new Vec2(10, 68);

const cameraFrame = new CameraFrame(app, camera.camera);
cameraFrame.rendering.renderFormats = [PIXELFORMAT_RGBA16F];
cameraFrame.rendering.samples = 4;
cameraFrame.rendering.toneMapping = TONEMAP_ACES;
cameraFrame.bloom.intensity = 0.035;
cameraFrame.bloom.blurLevel = 8;
cameraFrame.update();

const cityCount = 48;
const connectionCount = 144;
const pointCount = 28;
const cityRadius = sphereRadius + 0.055;
const goldenAngle = Math.PI * (3 - Math.sqrt(5));
const cities = [];

for (let i = 0; i < cityCount; i++) {
    const y = 1 - ((i + 0.5) * 2) / cityCount;
    const radial = Math.sqrt(1 - y * y);
    const angle = i * goldenAngle;
    cities.push(new Vec3(Math.cos(angle) * radial, y, Math.sin(angle) * radial));
}

let randomState = 0x5f3759df;
const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 0x100000000;
};

const palette = [
    new Color(0.2, 2.8, 5.5),
    new Color(2.2, 0.5, 5.5),
    new Color(5.5, 0.3, 1.8),
    new Color(5.5, 2.3, 0.25)
];

const renderer = new WideLineRenderer(app);
renderer.widthUnits = LINEWIDTH_WORLD;
renderer.capacity = connectionCount * (pointCount - 1);

const chooseDestination = (source) => {
    let destination;
    do {
        destination = Math.floor(random() * cityCount);
    } while (destination === source || cities[source].dot(cities[destination]) < -0.82);
    return destination;
};

const connections = [];

const configureRoute = (connection, source, destination) => {
    connection.source = source;
    connection.destination = destination;
    connection.start = cities[source];
    connection.end = cities[destination];
    connection.angle = Math.acos(Math.max(-1, Math.min(1, connection.start.dot(connection.end))));
    connection.sinAngle = Math.sin(connection.angle);
    connection.height = 0.55 + connection.angle * 0.55 + random() * 0.45;
    connection.speed = 0.16 + random() * 0.14;

    const color = palette[destination % palette.length];
    for (let point = 0; point < pointCount; point++) {
        const t = point / (pointCount - 1);
        const brightness = 0.25 + t * 0.75;
        const offset = point * 3;
        connection.colors[offset] = color.r * brightness;
        connection.colors[offset + 1] = color.g * brightness;
        connection.colors[offset + 2] = color.b * brightness;
    }
    connection.line.setColors(connection.colors);
};

for (let i = 0; i < connectionCount; i++) {
    const positions = new Float32Array(pointCount * 3);
    const colors = new Float32Array(pointCount * 3);
    const widths = new Float32Array(pointCount);
    const baseWidth = 0.04 + random() * 0.06;

    for (let point = 0; point < pointCount; point++) {
        const t = point / (pointCount - 1);
        widths[point] = baseWidth * (0.25 + Math.sin(t * Math.PI) * 0.75);
    }
    widths[0] = 0;

    const line = new WideLine();
    line.set(positions, colors, widths);
    line.cap = LINECAP_ROUND;
    line.join = LINEJOIN_ROUND;
    renderer.add(line);

    const source = Math.floor(random() * cityCount);
    const connection = {
        line,
        positions,
        colors,
        progress: random(),
        source,
        destination: 0,
        start: cities[source],
        end: cities[source],
        angle: 0,
        sinAngle: 0,
        height: 0,
        speed: 0
    };
    configureRoute(connection, source, chooseDestination(source));
    connections.push(connection);
}

const writeArcPoint = (connection, point, t) => {
    let x;
    let y;
    let z;

    if (connection.sinAngle > 0.0001) {
        const startWeight = Math.sin((1 - t) * connection.angle) / connection.sinAngle;
        const endWeight = Math.sin(t * connection.angle) / connection.sinAngle;
        x = connection.start.x * startWeight + connection.end.x * endWeight;
        y = connection.start.y * startWeight + connection.end.y * endWeight;
        z = connection.start.z * startWeight + connection.end.z * endWeight;
    } else {
        x = connection.start.x + (connection.end.x - connection.start.x) * t;
        y = connection.start.y + (connection.end.y - connection.start.y) * t;
        z = connection.start.z + (connection.end.z - connection.start.z) * t;
    }

    const radius = cityRadius + Math.sin(t * Math.PI) * connection.height;
    const offset = point * 3;
    connection.positions[offset] = x * radius;
    connection.positions[offset + 1] = y * radius;
    connection.positions[offset + 2] = z * radius;
};

app.on('update', (dt) => {
    for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        connection.progress += dt * connection.speed;

        if (connection.progress >= 1) {
            connection.progress %= 1;
            const source = connection.destination;
            configureRoute(connection, source, chooseDestination(source));
        }

        const head = connection.progress;
        const tail = Math.max(0, head - 0.38);
        for (let point = 0; point < pointCount; point++) {
            const t = tail + ((head - tail) * point) / (pointCount - 1);
            writeArcPoint(connection, point, t);
        }
        connection.line.setPositions(connection.positions);
    }
});

app.on('destroy', () => renderer.destroy());
