// @config DESCRIPTION Procedural mesh converted to gaussian splats. Demonstrates converting a terrain scene with animated clouds to splat representation.
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { GsplatMesh } = await fileImport(`${rootPath}/static/scripts/esm/gsplat/gsplat-mesh.mjs`);
const { GsplatBoxShaderEffect } = await fileImport(`${rootPath}/static/scripts/esm/gsplat/shader-effect-box.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    script: new pc.Asset('script', 'script', { url: `${rootPath}/static/scripts/camera/orbit-camera.js` }),
    terrain: new pc.Asset('terrain', 'container', { url: `${rootPath}/static/assets/models/terrain.glb` }),
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/helipad-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],
    // disable antialiasing as gaussian splats do not benefit from it and it's expensive
    antialias: false
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.GSplatHandler];

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

// Load assets
const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Setup skydome
    app.scene.skyboxMip = 3;
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, -70, 0);

    // Instantiate the terrain and add to scene
    /** @type {pc.Entity} */
    const terrain = assets.terrain.resource.instantiateRenderEntity();
    terrain.setLocalScale(30, 30, 30);
    app.root.addChild(terrain);

    // Find source clouds (Icosphere nodes)
    /** @type {Array<pc.Entity>} */
    const srcClouds = terrain.find((node) => {
        return node.name.includes('Icosphere');
    });

    // Store cloud parents for later and remove clouds from terrain hierarchy
    const cloudParents = srcClouds.map(cloud => cloud.parent);
    srcClouds.forEach((cloud) => {
        cloud.parent.removeChild(cloud);
    });

    // Create gsplat entity for terrain (without clouds) - attach as child of terrain
    // so it inherits the terrain's transform (scale 30)
    const gsplatTerrain = new pc.Entity('GsplatTerrain');
    gsplatTerrain.addComponent('script');
    terrain.addChild(gsplatTerrain);

    const gsplatMeshTerrain = gsplatTerrain.script.create(GsplatMesh);
    gsplatMeshTerrain.buildFromEntity(terrain, {
        splatSize: 0.03,
        margin: 0,
        recursive: true
    });

    // Add reveal effect to terrain
    const revealScript = gsplatTerrain.script.create(GsplatBoxShaderEffect);
    revealScript.aabbMin.set(-1000, -200, -1000);
    revealScript.aabbMax.set(1000, 250, 1000);
    revealScript.direction.set(0, 1, 0);
    revealScript.duration = 2;
    revealScript.visibleStart = false;
    revealScript.visibleEnd = true;
    revealScript.interval = 0.3;
    revealScript.baseTint.set(1, 1, 1);
    revealScript.edgeTint.set(5, 2, 0);   // orange/gold edge
    revealScript.tint.set(1, 1, 1);

    // Now disable the original terrain render components (keep gsplat visible)
    const terrainRenders = terrain.find(node => node.render && !node.name.includes('Gsplat'));
    terrainRenders.forEach((node) => {
        node.render.enabled = false;
    });

    // Create gsplat entities for each source cloud (bake once per cloud)
    // Then create additional entities sharing the same gsplat container
    /** @type {Array<pc.Entity>} */
    const clouds = [];

    srcClouds.forEach((srcCloud, srcIndex) => {
        const cloudParent = cloudParents[srcIndex];

        // Temporarily add cloud back to parent for correct world transform during conversion
        cloudParent.addChild(srcCloud);

        // Set cloud to semi-transparent for fluffy look
        if (srcCloud.render) {
            srcCloud.render.meshInstances.forEach((mi) => {
                if (mi.material) {
                    mi.material.blendType = pc.BLEND_NORMAL;
                    mi.material.opacity = 0.2;
                }
            });
        }

        // Create the first gsplat entity with script to build the gsplat
        // Position it same as the source cloud
        const gsplatCloud = new pc.Entity(`GsplatCloud-${srcIndex}-0`);
        gsplatCloud.addComponent('script');
        cloudParent.addChild(gsplatCloud);

        // Build gsplat from the source cloud entity
        const gsplatMeshCloud = gsplatCloud.script.create(GsplatMesh);
        gsplatMeshCloud.buildFromEntity(srcCloud, {
            splatSize: 0.15,  // Larger splats for fluffy cloud look
            margin: 0,       // No margin - allow splats to extend to edges
            recursive: false
        });

        // Remove source cloud again
        cloudParent.removeChild(srcCloud);

        clouds.push(gsplatCloud);

        // Get the container resource from the gsplat component
        const container = gsplatCloud.gsplat.resource;

        // Create 3 more gsplat entities sharing the same container
        for (let i = 1; i < 4; i++) {
            const cloneCloud = new pc.Entity(`GsplatCloud-${srcIndex}-${i}`);
            cloneCloud.addComponent('gsplat', {
                unified: true,
                resource: container
            });
            cloudParent.addChild(cloneCloud);
            clouds.push(cloneCloud);
        }
    });

    // Shuffle the clouds array for random order (same as shadow-cascades)
    clouds.sort(() => Math.random() - 0.5);

    // Find a tree to use as focus point (same as shadow-cascades)
    // @ts-ignore
    const tree = terrain.findOne('name', 'Arbol 2.002');

    // Create camera with orbit controls (same setup as shadow-cascades)
    const camera = new pc.Entity('Camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.9, 0.9, 0.9),
        farClip: 1000
    });

    // Position camera in the world
    camera.setLocalPosition(-500, 160, 300);

    // Add orbit camera script with mouse and touch support
    camera.addComponent('script');
    camera.script.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: tree,
            distanceMax: 600
        }
    });
    camera.script.create('orbitCameraInputMouse');
    camera.script.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    // Animate clouds (same as shadow-cascades)
    const cloudSpeed = 0.2;
    let frameNumber = 0;
    let time = 0;

    app.on('update', (/** @type {number} */ dt) => {
        time += dt;

        // On the first frame, move camera further away
        if (frameNumber === 0) {
            // @ts-ignore
            camera.script.orbitCamera.distance = 470;
        }

        // Disable reveal effect when complete
        if (revealScript.enabled && revealScript.effectTime >= revealScript.duration) {
            revealScript.enabled = false;
        }

        // Move the clouds around (exact same logic as shadow-cascades)
        clouds.forEach((cloud, index) => {
            const redialOffset = (index / clouds.length) * (6.24 / cloudSpeed);
            const radius = 9 + 4 * Math.sin(redialOffset);
            const cloudTime = time + redialOffset;
            cloud.setLocalPosition(
                2 + radius * Math.sin(cloudTime * cloudSpeed),
                4,
                -5 + radius * Math.cos(cloudTime * cloudSpeed)
            );
        });

        frameNumber++;
    });
});

export { app };
