// @config
//
// This example demonstrates how to use the Anim Component to animate the properties of other
// Components.

import {
    AnimClipHandler,
    AnimComponentSystem,
    AnimStateGraphHandler,
    AppBase,
    AppOptions,
    Asset,
    AssetListLoader,
    CameraComponentSystem,
    Color,
    ElementInput,
    Entity,
    FILLMODE_FILL_WINDOW,
    LightComponentSystem,
    Mouse,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    StandardMaterial,
    TextureHandler,
    TouchDevice,
    createGraphicsDevice
} from 'playcanvas';

import { data, deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    playcanvasGreyTexture: new Asset('playcanvasGreyTexture', 'texture', {
        url: './assets/textures/playcanvas-grey.png'
    })
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
createOptions.elementInput = new ElementInput(canvas);

createOptions.componentSystems = [
    RenderComponentSystem,
    CameraComponentSystem,
    LightComponentSystem,
    AnimComponentSystem
];
createOptions.resourceHandlers = [TextureHandler, AnimClipHandler, AnimStateGraphHandler];

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

// Create the animation data for two static spot lights
const animClipStaticLightData = {
    name: 'staticLight',
    duration: 1.0,
    // Curve keyframe inputs
    inputs: [[0.0]],
    // Curve keyframe outputs
    outputs: [
        // A single RGBA color keyframe value of a green light
        {
            components: 4,
            data: [0.0, 1.0, 0.0, 1.0]
        },
        // A single quaternion keyframe value with no rotation
        {
            components: 4,
            data: [0.0, 0.0, 0.0, 0.0]
        }
    ],
    // The curves contained in the clip, each with the path to the property they animation, the index of
    // their input and output keyframes and the method of interpolation to be used
    curves: [
        {
            path: { entityPath: ['lights', 'spotLight1'], component: 'light', propertyPath: ['color'] },
            inputIndex: 0,
            outputIndex: 0,
            interpolation: 1
        },
        {
            path: { entityPath: ['lights', 'spotLight2'], component: 'light', propertyPath: ['color'] },
            inputIndex: 0,
            outputIndex: 0,
            interpolation: 1
        },
        {
            path: { entityPath: ['lights', 'spotLight1'], component: 'entity', propertyPath: ['localEulerAngles'] },
            inputIndex: 0,
            outputIndex: 1,
            interpolation: 1
        },
        {
            path: { entityPath: ['lights', 'spotLight2'], component: 'entity', propertyPath: ['localEulerAngles'] },
            inputIndex: 0,
            outputIndex: 1,
            interpolation: 1
        }
    ]
};

// Create the animation data for two flashing spot lights
const animClipFlashingLightData = {
    name: 'flashingLight',
    duration: 2.0,
    // Curve keyframe inputs
    inputs: [
        [0.0, 0.5, 1.0, 1.5, 2.0],
        [0, 1, 2]
    ],
    // Curve keyframe outputs
    outputs: [
        //  Keyframe outputs for a flashing red RGBA color
        {
            components: 4,
            data: [1.0, 0.0, 0.0, 1.0, 0.4, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.4, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0]
        },
        //  Keyframe outputs for a quaternion rotation
        {
            components: 4,
            data: [4.0, 0.0, 0.0, 0.0, 4.0, 180.0, 0.0, 0.0, 4.0, 0.0, 0.0, 0.0]
        },
        //  Keyframe outputs for a quaternion rotation
        {
            components: 4,
            data: [-4.0, 0.0, 0.0, 0.0, -4.0, 180.0, 0.0, 0.0, -4.0, 0.0, 0.0, 0.0]
        }
    ],
    // The curves contained in the clip, each with the path to the property they animation, the index of
    // their input and output keyframes and the method of interpolation to be used
    curves: [
        {
            path: { entityPath: ['lights', 'spotLight1'], component: 'light', propertyPath: ['color'] },
            inputIndex: 0,
            outputIndex: 0,
            interpolation: 1
        },
        {
            path: { entityPath: ['lights', 'spotLight2'], component: 'light', propertyPath: ['color'] },
            inputIndex: 0,
            outputIndex: 0,
            interpolation: 1
        },
        {
            path: { entityPath: ['lights', 'spotLight1'], component: 'entity', propertyPath: ['localEulerAngles'] },
            inputIndex: 1,
            outputIndex: 1,
            interpolation: 1
        },
        {
            path: { entityPath: ['lights', 'spotLight2'], component: 'entity', propertyPath: ['localEulerAngles'] },
            inputIndex: 1,
            outputIndex: 2,
            interpolation: 1
        }
    ]
};

const animClipHandler = new AnimClipHandler(app);
const animClipStaticLight = animClipHandler.open(undefined, animClipStaticLightData);
const animClipFlashingLight = animClipHandler.open(undefined, animClipFlashingLightData);

// Create an Entity with a camera component
const cameraEntity = new Entity();
cameraEntity.name = 'camera';
cameraEntity.addComponent('camera', {
    clearColor: new Color(0, 0, 0.0)
});
cameraEntity.translateLocal(7, 10, 7);
cameraEntity.lookAt(0, 0, 0);

const boxEntity = new Entity();
boxEntity.addComponent('render', {
    type: 'box'
});
boxEntity.name = 'model';
boxEntity.setPosition(0, 0.25, 0);
boxEntity.setLocalScale(0.5, 0.5, 0.5);
const material = new StandardMaterial();
material.diffuseMap = assets.playcanvasGreyTexture.resource;
material.update();
boxEntity.render.meshInstances[0].material = material;

const planeEntity = new Entity();
planeEntity.name = 'plane';
planeEntity.addComponent('render', {
    type: 'plane'
});
planeEntity.setLocalScale(15, 1, 15);
planeEntity.setPosition(0, 0, 0);

// Create the animatible lights
const lightsEntity = new Entity();
lightsEntity.name = 'lights';

const light1 = new Entity();
light1.name = 'spotLight1';
light1.addComponent('light', {
    type: 'spot',
    color: new Color(0.0, 0.0, 0.0, 1.0),
    intensity: 1,
    range: 15,
    innerConeAngle: 5,
    outerConeAngle: 10
});
light1.setPosition(0, 10, 0);

const light2 = new Entity();
light2.name = 'spotLight2';
light2.addComponent('light', {
    type: 'spot',
    color: new Color(0.0, 0.0, 0.0, 1.0),
    intensity: 1,
    range: 15,
    innerConeAngle: 5,
    outerConeAngle: 10
});
light2.setPosition(0, 10, 0);

// Add Entities into the scene hierarchy
app.root.addChild(cameraEntity);
lightsEntity.addChild(light1);
lightsEntity.addChild(light2);
app.root.addChild(lightsEntity);
app.root.addChild(boxEntity);
app.root.addChild(planeEntity);

// Add the anim component to the lights entity
lightsEntity.addComponent('anim', {
    speed: 1.0,
    activate: true
});

// Assign animation clip asset resources to the appropriate states
lightsEntity.anim.assignAnimation('Static', animClipStaticLight);
lightsEntity.anim.assignAnimation('Flash', animClipFlashingLight);

app.start();

data.on('flash:set', () => {
    if (lightsEntity.anim.baseLayer.activeState === 'Static') {
        lightsEntity.anim.baseLayer.transition('Flash', 0.5);
    } else {
        lightsEntity.anim.baseLayer.transition('Static', 0.5);
    }
});
