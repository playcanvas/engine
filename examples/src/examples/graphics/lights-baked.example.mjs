import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` })
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.lightmapper = pc.Lightmapper;

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem, pc.ScriptComponentSystem];
createOptions.resourceHandlers = [pc.ScriptHandler];

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

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // create material used on the geometry
    const material = new pc.StandardMaterial();
    material.gloss = 0.6;
    material.metalness = 0.4;
    material.useMetalness = true;
    material.update();

    // ground plane
    const ground = new pc.Entity();
    ground.addComponent('render', {
        castShadows: false,
        lightmapped: true,
        type: 'plane',
        material: material
    });
    app.root.addChild(ground);
    ground.setLocalPosition(0, 0, 0);
    ground.setLocalScale(20, 20, 20);

    // All render component primitive shape types
    const shapes = ['box', 'cone', 'cylinder', 'sphere', 'capsule', 'torus'];

    // Create objects in an 8x8 grid
    const gridSize = 8;
    const spacing = 1.0;
    const startOffset = -((gridSize - 1) * spacing) / 2;

    for (let x = 0; x < gridSize; x++) {
        for (let z = 0; z < gridSize; z++) {
            // deterministic shape based on grid position
            const shapeIndex = (x + z * gridSize) % shapes.length;
            const shape = shapes[shapeIndex];

            // Create an entity with a render component that is set up to be lightmapped with baked direct lighting
            const entity = new pc.Entity();
            entity.addComponent('render', {
                castShadows: false,
                castShadowsLightmap: true,
                lightmapped: true,
                type: shape,
                material: material
            });
            app.root.addChild(entity);

            // position in grid
            const posX = startOffset + x * spacing;
            const posZ = startOffset + z * spacing;
            entity.setLocalPosition(posX, 1.5, posZ);
            entity.setLocalScale(0.5, 0.5, 0.5);
        }
    }

    // Position for lights - halfway between center and corners
    const lightOffset = 2.5;
    const lightHeight = 4;

    // Create emissive material for omni light visualization (green)
    const emissiveMaterialGreen = new pc.StandardMaterial();
    emissiveMaterialGreen.emissive = pc.Color.GREEN;
    emissiveMaterialGreen.emissiveIntensity = 5;
    emissiveMaterialGreen.useLighting = false;
    emissiveMaterialGreen.update();

    // Create emissive material for spot light visualization (red)
    const emissiveMaterialRed = new pc.StandardMaterial();
    emissiveMaterialRed.emissive = pc.Color.RED;
    emissiveMaterialRed.emissiveIntensity = 5;
    emissiveMaterialRed.useLighting = false;
    emissiveMaterialRed.update();

    // Create emissive material for directional light visualization (yellow)
    const emissiveMaterialYellow = new pc.StandardMaterial();
    emissiveMaterialYellow.emissive = pc.Color.YELLOW;
    emissiveMaterialYellow.emissiveIntensity = 5;
    emissiveMaterialYellow.useLighting = false;
    emissiveMaterialYellow.update();

    // Create an entity with an omni light component that is configured as a baked light
    const lightOmni = new pc.Entity();
    lightOmni.addComponent('light', {
        affectDynamic: false,
        affectLightmapped: true,
        bake: true,
        castShadows: true,
        normalOffsetBias: 0.05,
        shadowBias: 0.2,
        shadowDistance: 50,
        shadowResolution: 512,
        shadowType: pc.SHADOW_PCF3_32F,
        color: pc.Color.GREEN,
        range: 7,
        type: 'omni'
    });
    // Add visible sphere to represent omni light
    lightOmni.addComponent('render', {
        type: 'sphere',
        material: emissiveMaterialGreen,
        castShadows: false,
        castShadowsLightmap: false
    });
    app.root.addChild(lightOmni);
    lightOmni.setLocalPosition(-lightOffset, lightHeight, -lightOffset);

    // Create an entity with a spot light component that is configured as a baked light
    const lightSpot = new pc.Entity();
    lightSpot.addComponent('light', {
        affectDynamic: false,
        affectLightmapped: true,
        bake: true,
        castShadows: true,
        normalOffsetBias: 0.05,
        shadowBias: 0.2,
        shadowDistance: 50,
        shadowResolution: 512,
        shadowType: pc.SHADOW_PCF3_32F,
        color: pc.Color.RED,
        range: 15,
        innerConeAngle: 30,
        outerConeAngle: 45,
        type: 'spot'
    });
    lightSpot.setLocalPosition(lightOffset, lightHeight, lightOffset);
    lightSpot.setLocalEulerAngles(0, 0, 0);  // Point straight down (spotlight shines along -Y by default)
    app.root.addChild(lightSpot);

    // Add visible cone as child entity, rotated to point down visually
    const spotCone = new pc.Entity();
    spotCone.addComponent('render', {
        type: 'cone',
        material: emissiveMaterialRed,
        castShadows: false,
        castShadowsLightmap: false
    });
    spotCone.setLocalEulerAngles(0, 0, 0);  // Cone points up by default, same as light direction visualization
    lightSpot.addChild(spotCone);

    // Create an entity with a directional light component that is configured as a baked light
    const lightDirectional = new pc.Entity();
    lightDirectional.addComponent('light', {
        affectDynamic: false,
        affectLightmapped: true,
        bake: true,
        castShadows: true,
        normalOffsetBias: 0.05,
        shadowBias: 0.2,
        shadowDistance: 50,
        shadowResolution: 2048,
        shadowType: pc.SHADOW_PCF3_32F,
        color: pc.Color.YELLOW,
        intensity: 0.33,
        type: 'directional'
    });
    app.root.addChild(lightDirectional);
    lightDirectional.setLocalPosition(0, lightHeight, 0);
    lightDirectional.setLocalEulerAngles(60, -45, 0);  // Point straight down (light shines along -Y)

    // Add visible slim cylinder as child entity for directional light
    const dirCylinder = new pc.Entity();
    dirCylinder.addComponent('render', {
        type: 'cylinder',
        material: emissiveMaterialYellow,
        castShadows: false,
        castShadowsLightmap: false
    });
    dirCylinder.setLocalScale(0.2, 1, 0.2);  // Slim cylinder
    lightDirectional.addChild(dirCylinder);

    // Create an entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.4, 0.45, 0.5),
        farClip: 100,
        nearClip: 0.05
    });
    camera.setLocalPosition(1, 3, -1);

    // add orbit camera script with mouse and touch support
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            distanceMax: 15
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    // lightmap baking properties
    const bakeType = pc.BAKE_COLOR;
    app.scene.lightmapMode = bakeType;
    app.scene.lightmapMaxResolution = 2048;

    // For baked lights, this property perhaps has the biggest impact on lightmap resolution:
    app.scene.lightmapSizeMultiplier = 32;

    // bake when settings are changed only
    let needBake = false;

    // handle data changes from HUD to modify light enabled state
    data.on('*:set', (/** @type {string} */ path, value) => {
        let bakeSettingChanged = true;
        const pathArray = path.split('.');

        if (pathArray[1] === 'lights') {
            if (pathArray[2] === 'omni') {
                lightOmni.enabled = value;
            } else if (pathArray[2] === 'spot') {
                lightSpot.enabled = value;
            } else if (pathArray[2] === 'directional') {
                lightDirectional.enabled = value;
            } else if (pathArray[2] === 'soft') {
                // Enable soft shadows for directional light
                lightDirectional.light.bakeNumSamples = value ? 15 : 1;
                lightDirectional.light.bakeArea = value ? 20 : 0;
                // Enable lightmap filtering when soft is on
                app.scene.lightmapFilterEnabled = value;
                app.scene.lightmapFilterRange = 5;
                app.scene.lightmapFilterSmoothness = 0.1;
            }
        } else {
            bakeSettingChanged = false;
        }

        // trigger bake on the next frame if relevant settings were changed
        needBake ||= bakeSettingChanged;
    });

    // Initial data for controls
    data.set('data', {
        lights: {
            omni: true,
            spot: true,
            directional: true,
            soft: false
        }
    });

    // Set an update function on the app's update event
    app.on('update', (dt) => {
        // bake lightmaps when HUD properties change
        if (needBake) {
            needBake = false;
            app.lightmapper.bake(null, bakeType);
        }
    });

    // initial bake
    app.lightmapper.bake(null, bakeType);
});

export { app };
