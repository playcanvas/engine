// @config DESCRIPTION Procedural shapes rendered using gaussian splats. Demonstrates lines, text and image-based splats.
import { data } from 'examples/observer';
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { GsplatLines } = await fileImport(`${rootPath}/static/scripts/esm/gsplat/gsplat-lines.mjs`);
const { GsplatImage } = await fileImport(`${rootPath}/static/scripts/esm/gsplat/gsplat-image.mjs`);
const { GsplatText } = await fileImport(`${rootPath}/static/scripts/esm/gsplat/gsplat-text.mjs`);
const { GsplatBoxShaderEffect } = await fileImport(`${rootPath}/static/scripts/esm/gsplat/shader-effect-box.mjs`);
const { CameraControls } = await fileImport(`${rootPath}/static/scripts/esm/camera-controls.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType],

    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.GSplatHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// Create an Entity with a camera component
const camera = new pc.Entity('Camera');
camera.addComponent('camera', {
    fov: 30,
    clearColor: new pc.Color(0.2, 0.2, 0.2)
});
camera.setLocalPosition(-3, 1.5, -3);

// Add camera controls
camera.addComponent('script');
camera.script.create(CameraControls, {
    properties: {
        enableFly: false,
        enablePan: true,
        focusPoint: new pc.Vec3(0, 0.3, 0),
        zoomRange: new pc.Vec2(1, 10)
    }
});
app.root.addChild(camera);

const assets = {
    bicycle: new pc.Asset('gsplat', 'gsplat', { url: `${rootPath}/static/assets/splats/bicycle.sog` }),
    groundTexture: new pc.Asset('ground', 'texture', { url: `${rootPath}/static/assets/textures/colors.webp` }),
    gearTexture: new pc.Asset('gear', 'texture', { url: `${rootPath}/static/assets/textures/gear.png` })
};

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Create the bicycle gsplat
    const bicycle = new pc.Entity('Bicycle');
    bicycle.addComponent('gsplat', {
        asset: assets.bicycle,
        unified: true
    });
    bicycle.setLocalEulerAngles(0, 0, 180);
    app.root.addChild(bicycle);

    // Add a reveal effect to the scene using box shader effect
    bicycle.addComponent('script');
    const revealScript = bicycle.script.create(GsplatBoxShaderEffect);
    revealScript.aabbMin.set(-2, -0.5, -2);
    revealScript.aabbMax.set(2, 1.5, 2);
    revealScript.direction.set(1, 1, 0);
    revealScript.duration = 3.5;
    revealScript.visibleStart = false;
    revealScript.visibleEnd = true;
    revealScript.interval = 0.3;
    revealScript.baseTint.set(1, 1, 1);
    revealScript.edgeTint.set(5, 2, 0);   // orange/gold edge
    revealScript.tint.set(1, 1, 1);

    // Create ground entity with GsplatImage script
    const ground = new pc.Entity('Ground');
    ground.addComponent('script');
    const groundImage = ground.script.create(GsplatImage);
    groundImage.imageAsset = assets.groundTexture;
    ground.setLocalPosition(0, -0.05, 0);
    ground.setLocalScale(3, 3, 3);
    app.root.addChild(ground);

    // Create gear wall entity with GsplatImage script (behind the bike)
    const gearWall = new pc.Entity('GearWall');
    gearWall.addComponent('script');
    const gearImage = gearWall.script.create(GsplatImage);
    gearImage.imageAsset = assets.gearTexture;
    gearWall.setLocalPosition(1, 0.5, 0);
    gearWall.setLocalEulerAngles(-90, -90, 0);
    gearWall.setLocalScale(1, 1, 1);
    app.root.addChild(gearWall);

    // CAD-style drawing parameters
    const thickness = 0.001;

    // Wheel parameters
    const wheelRadius = 0.35, wheelWidth = 0.06;
    const frontWheelZ = 0.58, rearWheelZ = -0.58, wheelY = 0.33;

    // Derived wheel box corners
    const wheelBottomY = wheelY - wheelRadius;
    const wheelTopY = wheelY + wheelRadius;
    const frontBoxZ = frontWheelZ + wheelRadius;
    const rearBoxZ = rearWheelZ - wheelRadius;

    // Bicycle dimensions (using wheel box edges for length)
    const bikeMinX = -0.35, bikeMaxX = 0.35;
    const bikeMinY = wheelBottomY, bikeMaxY = 1.2;
    const bikeMinZ = rearBoxZ, bikeMaxZ = frontBoxZ;
    const dimOffset = 0.15;
    const lengthY = wheelTopY + dimOffset; // above the wheel boxes
    const heightZ = bikeMinZ - dimOffset; // at front wheel (negative Z is front with handlebars)
    const widthY = bikeMaxY + dimOffset;
    const handlebarZ = -0.3; // Z position near handlebars (negative Z is front)

    // AABBs: [minX, minY, minZ, maxX, maxY, maxZ]
    const yellow = new pc.Color(1, 0.9, 0.2, 1);
    const aabbs = [
        [-wheelWidth, wheelY - wheelRadius, frontWheelZ - wheelRadius, wheelWidth, wheelY + wheelRadius, frontWheelZ + wheelRadius],
        [-wheelWidth, wheelY - wheelRadius, rearWheelZ - wheelRadius, wheelWidth, wheelY + wheelRadius, rearWheelZ + wheelRadius]
    ];

    // Arrows: [startX, startY, startZ, endX, endY, endZ]
    const cyan = new pc.Color(0.2, 0.9, 1, 1);
    const arrows = [
        // Length (Z axis) - bidirectional
        [0, lengthY, bikeMinZ, 0, lengthY, bikeMaxZ],
        [0, lengthY, bikeMaxZ, 0, lengthY, bikeMinZ],
        // Height (Y axis) - bidirectional
        [0, bikeMinY, heightZ, 0, bikeMaxY, heightZ],
        [0, bikeMaxY, heightZ, 0, bikeMinY, heightZ],
        // Width (X axis) - bidirectional (at handlebar position)
        [bikeMinX, widthY, handlebarZ, bikeMaxX, widthY, handlebarZ],
        [bikeMaxX, widthY, handlebarZ, bikeMinX, widthY, handlebarZ]
    ];

    // Extension lines: [startX, startY, startZ, endX, endY, endZ]
    const gray = new pc.Color(0.5, 0.5, 0.5, 0.8);
    const extLines = [
        // Length extension lines (from wheel box top corners, going up)
        [0, wheelTopY, rearBoxZ, 0, lengthY + 0.05, rearBoxZ],
        [0, wheelTopY, frontBoxZ, 0, lengthY + 0.05, frontBoxZ],
        // Height extension lines (at front wheel - negative Z side)
        [0, wheelBottomY, rearBoxZ, 0, wheelBottomY, heightZ - 0.05],
        [0, bikeMaxY, handlebarZ, 0, bikeMaxY, heightZ - 0.05], // top line extends from handlebars
        // Width extension lines (at handlebar Z position)
        [bikeMinX, bikeMaxY, handlebarZ, bikeMinX, widthY + 0.05, handlebarZ],
        [bikeMaxX, bikeMaxY, handlebarZ, bikeMaxX, widthY + 0.05, handlebarZ]
    ];

    // Calculate dimension values
    const lengthValue = (bikeMaxZ - bikeMinZ).toFixed(2);
    const heightValue = (bikeMaxY - bikeMinY).toFixed(2);
    const widthValue = (bikeMaxX - bikeMinX).toFixed(2);

    // Track current lines entity and text entities
    let linesEntity = null;
    const textEntities = [];

    // Helper to create a text label
    const createTextLabel = (text, x, y, z, rotX, rotY, rotZ) => {
        const textEntity = new pc.Entity(`Text-${text}`);
        textEntity.addComponent('script');
        const textScript = textEntity.script.create(GsplatText);
        textScript.text = text;
        textScript.fontSize = 48;
        textScript.fillStyle = '#00e5ff'; // Cyan to match arrows
        textScript.strokeStyle = 'rgba(0,0,0,0.9)';
        textScript.strokeWidth = 3;
        textScript.padding = 8;
        textEntity.setLocalPosition(x, y, z);
        textEntity.setLocalEulerAngles(rotX, rotY, rotZ);
        textEntity.setLocalScale(0.15, 0.15, 0.15);
        app.root.addChild(textEntity);
        textEntities.push(textEntity);
        return textEntity;
    };

    // Function to create the lines entity with all primitives
    const createLinesEntity = () => {
        linesEntity = new pc.Entity('Lines');
        linesEntity.addComponent('script');
        const lines = linesEntity.script.create(GsplatLines);
        app.root.addChild(linesEntity);

        // Add all primitives
        const arrowHeadSize = thickness * 27; // 3x default size
        for (const a of aabbs) {
            lines.addAABB(new pc.Vec3(a[0], a[1], a[2]), new pc.Vec3(a[3], a[4], a[5]), yellow, thickness * 0.5);
        }
        for (const a of arrows) {
            lines.addArrow(new pc.Vec3(a[0], a[1], a[2]), new pc.Vec3(a[3], a[4], a[5]), cyan, thickness * 0.8, arrowHeadSize);
        }
        for (const l of extLines) {
            lines.addLineSimple(new pc.Vec3(l[0], l[1], l[2]), new pc.Vec3(l[3], l[4], l[5]), gray, thickness * 0.5);
        }

        // Add text labels for each dimension
        // Length label
        const lengthMidZ = (bikeMinZ + bikeMaxZ) / 2;
        createTextLabel(lengthValue, 0.0, lengthY + 0.02, lengthMidZ, -90, -90, 0);

        // Height label
        const heightMidY = (bikeMinY + bikeMaxY) / 2;
        createTextLabel(heightValue, 0, heightMidY, heightZ - 0.02, 0, -180, -90);

        // Width label
        createTextLabel(widthValue, 0, widthY + 0.02, handlebarZ, -90, 180, 0);
    };

    // Function to destroy the lines entity and text labels
    const destroyLinesEntity = () => {
        if (linesEntity) {
            linesEntity.destroy();
            linesEntity = null;
        }
        // Destroy all text entities
        for (const textEntity of textEntities) {
            textEntity.destroy();
        }
        textEntities.length = 0;
    };

    // Set default value and create initial lines
    data.set('showLines', true);
    createLinesEntity();

    // Handle toggle changes
    data.on('showLines:set', (value) => {
        if (value) {
            createLinesEntity();
        } else {
            destroyLinesEntity();
        }
    });
});

export { app };
