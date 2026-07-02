import {
    ANIM_LAYER_ADDITIVE,
    ANIM_LAYER_OVERWRITE,
    AnimClipHandler,
    AnimComponentSystem,
    AnimStateGraphHandler,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ContainerHandler,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    SHADOW_PCF5_32F,
    TEXTURETYPE_RGBP,
    TextureHandler,
    TouchDevice,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    model: new Asset('model', 'container', { url: './assets/models/bitmoji.glb' }),
    idleAnim: new Asset('idleAnim', 'container', { url: './assets/animations/bitmoji/idle.glb' }),
    idleEagerAnim: new Asset('idleEagerAnim', 'container', {
        url: './assets/animations/bitmoji/idle-eager.glb'
    }),
    walkAnim: new Asset('walkAnim', 'container', { url: './assets/animations/bitmoji/walk.glb' }),
    danceAnim: new Asset('danceAnim', 'container', {
        url: './assets/animations/bitmoji/win-dance.glb'
    }),
    helipad: new Asset(
        'helipad-env-atlas',
        'texture',
        { url: './assets/cubemaps/helipad-env-atlas.png' },
        { type: TEXTURETYPE_RGBP, mipmaps: false }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new Mouse(document.body);
createOptions.touch = new TouchDevice(document.body);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    AnimComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, ContainerHandler, AnimClipHandler, AnimStateGraphHandler];

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

await new Promise((resolve) => {
    new AssetListLoader(Object.values(assets), app.assets).load(resolve);
});

// setup data
data.set('fullBodyLayer', {
    state: 'Idle',
    blendType: ANIM_LAYER_OVERWRITE
});
data.set('upperBodyLayer', {
    state: 'Eager',
    blendType: ANIM_LAYER_ADDITIVE,
    useMask: true
});
data.set('options', {
    blend: 0.5,
    skeleton: true
});

// setup skydome
app.scene.exposure = 2;
app.scene.skyboxMip = 2;
app.scene.envAtlas = assets.helipad.resource;

// Create an Entity with a camera component
const cameraEntity = new Entity();
cameraEntity.addComponent('camera', {
    clearColor: new Color(0.1, 0.1, 0.1)
});
cameraEntity.translate(0, 0.75, 3);
app.root.addChild(cameraEntity);

// Create an entity with a light component
const lightEntity = new Entity();
lightEntity.addComponent('light', {
    castShadows: true,
    intensity: 1.5,
    normalOffsetBias: 0.02,
    shadowType: SHADOW_PCF5_32F,
    shadowDistance: 6,
    shadowResolution: 2048,
    shadowBias: 0.02
});
app.root.addChild(lightEntity);
lightEntity.setLocalEulerAngles(45, 30, 0);

// create an entity from the loaded model using the render component
const modelEntity = assets.model.resource.instantiateRenderEntity({
    castShadows: true
});
modelEntity.addComponent('anim', {
    activate: true
});
app.root.addChild(modelEntity);

// retrieve the animation assets
const idleTrack = assets.idleAnim.resource.animations[0].resource;
const walkTrack = assets.walkAnim.resource.animations[0].resource;
const danceTrack = assets.danceAnim.resource.animations[0].resource;
const idleEagerTrack = assets.idleEagerAnim.resource.animations[0].resource;

// create the full body layer by assigning full body animations to the anim component
modelEntity.anim.assignAnimation('Idle', idleTrack);
modelEntity.anim.assignAnimation('Walk', walkTrack);

// set the default weight for the base layer
modelEntity.anim.baseLayer.weight = 1.0 - data.get('options.blend');

// create a mask for the upper body layer
const upperBodyMask = {
    // set a path with the children property as true to include that path and all of its children in the mask
    'RootNode/AVATAR/C_spine0001_bind_JNT/C_spine0002_bind_JNT': {
        children: true
    },
    // set a path to true in the mask to include only that specific path
    'RootNode/AVATAR/C_spine0001_bind_JNT/C_spine0002_bind_JNT/C_Head': true
};

// create a new layer for the upper body, with additive layer blending
const upperBodyLayer = modelEntity.anim.addLayer(
    'UpperBody',
    data.get('options.blend'),
    upperBodyMask,
    data.get('upperBodyLayer.blendType')
);
upperBodyLayer.assignAnimation('Eager', idleEagerTrack);
upperBodyLayer.assignAnimation('Idle', idleTrack);
upperBodyLayer.assignAnimation('Dance', danceTrack);

// respond to changes in the data object made by the control panel
data.on('*:set', (/** @type {string} */ path, /** @type {any} */ value) => {
    if (path === 'fullBodyLayer.state') {
        modelEntity.anim.baseLayer.transition(value, 0.4);
    }
    if (path === 'upperBodyLayer.state') {
        upperBodyLayer.transition(value, 0.4);
    }
    if (path === 'fullBodyLayer.blendType') {
        modelEntity.anim.baseLayer.blendType = value;
    }
    if (path === 'upperBodyLayer.blendType') {
        upperBodyLayer.blendType = value;
    }
    if (path === 'upperBodyLayer.useMask') {
        upperBodyLayer.mask = value
            ? {
                  'RootNode/AVATAR/C_spine0001_bind_JNT/C_spine0002_bind_JNT': {
                      children: true
                  }
              }
            : null;
    }
    if (path === 'options.blend') {
        modelEntity.anim.baseLayer.weight = 1.0 - value;
        upperBodyLayer.weight = value;
    }
});

/**
 * @param {Entity} entity - The entity to draw the skeleton for.
 */
const drawSkeleton = (entity) => {
    entity.children.forEach((/** @type {Entity} */ c) => {
        const target = modelEntity.anim._targets[`${entity.path}/graph/localPosition`];
        if (target) {
            app.drawLine(
                entity.getPosition(),
                c.getPosition(),
                new Color(target.getWeight(0), 0, target.getWeight(1), 1),
                false
            );
        }
        drawSkeleton(c);
    });
};

app.start();

app.on('update', () => {
    if (data.get('options.skeleton')) {
        drawSkeleton(modelEntity);
    }
});
