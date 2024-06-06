// @config DESCRIPTION This example demonstrates how to use the Anim Component to animate the properties of other Components.
import * as pc from 'playcanvas';
import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    playcanvasGreyTexture: new pc.Asset('playcanvasGreyTexture', 'texture', {
        url: rootPath + '/static/assets/textures/playcanvas-grey.png'
    })
};
const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: rootPath + '/static/lib/glslang/glslang.js',
    twgslUrl: rootPath + '/static/lib/twgsl/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.elementInput = new pc.ElementInput(canvas);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.AnimComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.AnimClipHandler, pc.AnimStateGraphHandler];

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
    // create the animation data for two static spot lights
    const animClipStaticLightData = {
        name: 'staticLight',
        duration: 1.0,
        // curve keyframe inputs
        inputs: [[0.0]],
        // curve keyframe outputs
        outputs: [
            // a single RGBA color keyframe value of a green light
            {
                components: 4,
                data: [0.0, 1.0, 0.0, 1.0]
            },
            // a single quaternion keyframe value with no rotation
            {
                components: 4,
                data: [0.0, 0.0, 0.0, 0.0]
            }
        ],
        // the curves contained in the clip, each with the path to the property they animation, the index of
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

    // create the animation data for two flashing spot lights
    const animClipFlashingLightData = {
        name: 'flashingLight',
        duration: 2.0,
        // curve keyframe inputs
        inputs: [
            [0.0, 0.5, 1.0, 1.5, 2.0],
            [0, 1, 2]
        ],
        // curve keyframe outputs
        outputs: [
            //  keyframe outputs for a flashing red RGBA color
            {
                components: 4,
                data: [
                    1.0, 0.0, 0.0, 1.0, 0.4, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.4, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0
                ]
            },
            //  keyframe outputs for a quaternion rotation
            {
                components: 4,
                data: [4.0, 0.0, 0.0, 0.0, 4.0, 180.0, 0.0, 0.0, 4.0, 0.0, 0.0, 0.0]
            },
            //  keyframe outputs for a quaternion rotation
            {
                components: 4,
                data: [-4.0, 0.0, 0.0, 0.0, -4.0, 180.0, 0.0, 0.0, -4.0, 0.0, 0.0, 0.0]
            }
        ],
        // the curves contained in the clip, each with the path to the property they animation, the index of
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

    const animClipHandler = new pc.AnimClipHandler(app);
    const animClipStaticLight = animClipHandler.open(undefined, animClipStaticLightData);
    const animClipFlashingLight = animClipHandler.open(undefined, animClipFlashingLightData);

    // Create an Entity with a camera component
    const cameraEntity = new pc.Entity();
    cameraEntity.name = 'camera';
    cameraEntity.addComponent('camera', {
        clearColor: new pc.Color(0, 0, 0.0)
    });
    cameraEntity.translateLocal(7, 10, 7);
    cameraEntity.lookAt(0, 0, 0);

    const boxEntity = new pc.Entity();
    boxEntity.addComponent('render', {
        type: 'box'
    });
    boxEntity.name = 'model';
    boxEntity.setPosition(0, 0.25, 0);
    boxEntity.setLocalScale(0.5, 0.5, 0.5);
    const material = new pc.StandardMaterial();
    material.diffuseMap = assets.playcanvasGreyTexture.resource;
    material.update();
    boxEntity.render.meshInstances[0].material = material;

    const planeEntity = new pc.Entity();
    planeEntity.name = 'plane';
    planeEntity.addComponent('render', {
        type: 'plane'
    });
    planeEntity.setLocalScale(15, 1, 15);
    planeEntity.setPosition(0, 0, 0);

    // Create the animatible lights
    const lightsEntity = new pc.Entity();
    lightsEntity.name = 'lights';

    const light1 = new pc.Entity();
    light1.name = 'spotLight1';
    light1.addComponent('light', {
        type: 'spot',
        color: new pc.Color(0.0, 0.0, 0.0, 1.0),
        intensity: 1,
        range: 15,
        innerConeAngle: 5,
        outerConeAngle: 10
    });
    light1.setPosition(0, 10, 0);

    const light2 = new pc.Entity();
    light2.name = 'spotLight2';
    light2.addComponent('light', {
        type: 'spot',
        color: new pc.Color(0.0, 0.0, 0.0, 1.0),
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

    // add the anim component to the lights entity
    lightsEntity.addComponent('anim', {
        speed: 1.0,
        activate: true
    });

    // assign animation clip asset resources to the appropriate states
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
});

export { app };
