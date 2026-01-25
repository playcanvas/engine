// @config WEBGPU_DISABLED
import files from 'examples/files';
import { deviceType, fileImport, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

// Import the XR scripts
const { XrSession } = await fileImport(`${rootPath}/static/scripts/esm/xr-session.mjs`);
const { XrControllers } = await fileImport(`${rootPath}/static/scripts/esm/xr-controllers.mjs`);
const { XrMenu } = await fileImport(`${rootPath}/static/scripts/esm/xr-menu.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

// create UI
// html
const div = document.createElement('div');
div.innerHTML = files['ui.html'];
document.body.appendChild(div);
// css
const css = document.createElement('style');
css.innerHTML = files['ui.css'];
document.head.appendChild(css);

/**
 * @param {string} msg - The message.
 */
const message = function (msg) {
    /** @type {HTMLElement | null} */
    const el = document.querySelector('.message');
    if (el) {
        el.textContent = msg;
    }
};

// Assets
const assets = {
    font: new pc.Asset('font', 'font', { url: `${rootPath}/static/assets/fonts/roboto-extralight.json` }),
    buttonTexture: new pc.Asset('buttonTexture', 'texture', { url: `${rootPath}/static/assets/textures/blue-button.png` })
};

// Make font asset available by ID
assets.font.id = 42;

// Create graphics device
const gfxOptions = {
    deviceTypes: [deviceType],
    alpha: true
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

// Create application with required component systems for UI
const createOptions = new pc.AppOptions();
createOptions.xr = pc.XrManager;
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(window);
createOptions.elementInput = new pc.ElementInput(canvas);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScreenComponentSystem,
    pc.ButtonComponentSystem,
    pc.ElementComponentSystem,
    pc.ScriptComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.FontHandler, pc.ContainerHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
    div.remove();
    css.remove();
});

// use device pixel ratio
app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;

// Load assets
const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

    const colorCamera = new pc.Color(44 / 255, 62 / 255, 80 / 255);

    // create camera parent for locomotion (XrSession attaches to this)
    const cameraParent = new pc.Entity('CameraParent');
    app.root.addChild(cameraParent);

    // create camera
    const cameraEntity = new pc.Entity('Camera');
    cameraEntity.addComponent('camera', {
        clearColor: colorCamera
    });
    cameraParent.addChild(cameraEntity);

    // Add XrSession script to camera parent - handles XR lifecycle
    cameraParent.addComponent('script');
    cameraParent.script.create(XrSession, {
        properties: {
            startVrEvent: 'vr:start',
            startArEvent: 'ar:start',
            endEvent: 'xr:end'
        }
    });

    // Add XrControllers script - handles skinned hand/controller models
    cameraParent.script.create(XrControllers);

    // add directional light
    const light = new pc.Entity('Light');
    light.addComponent('light', {
        type: 'directional',
        castShadows: true,
        shadowBias: 0.05,
        normalOffsetBias: 0.05,
        shadowDistance: 10
    });
    light.setEulerAngles(45, 135, 0);
    app.root.addChild(light);

    // create floor
    const floor = new pc.Entity('Floor');
    floor.addComponent('render', {
        type: 'plane'
    });
    floor.setLocalScale(10, 1, 10);
    const floorMaterial = new pc.StandardMaterial();
    // @ts-ignore engine-tsd
    floorMaterial.diffuse.set(0.3, 0.3, 0.3);
    floorMaterial.update();
    floor.render.material = floorMaterial;
    app.root.addChild(floor);

    // cube colors for visual feedback
    const cubeColors = [
        new pc.Color(1, 0.3, 0.3),   // Red
        new pc.Color(0.3, 1, 0.3),   // Green
        new pc.Color(0.3, 0.3, 1),   // Blue
        new pc.Color(1, 1, 0.3)      // Yellow
    ];

    /** @type {pc.StandardMaterial[]} */
    const cubeMaterials = [];

    /**
     * Creates a colored cube at the specified position.
     *
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {number} z - The z coordinate.
     * @param {pc.Color} color - The cube color.
     * @returns {pc.Entity} The created cube entity.
     */
    const createCube = function (x, y, z, color) {
        const cube = new pc.Entity();
        const material = new pc.StandardMaterial();
        // @ts-ignore engine-tsd
        material.diffuse.copy(color);
        // @ts-ignore engine-tsd
        material.emissive.set(color.r * 0.1, color.g * 0.1, color.b * 0.1);
        material.update();

        // Store the material for later modification
        cubeMaterials.push(material);

        cube.addComponent('render', {
            type: 'box',
            material: material
        });
        cube.setLocalPosition(x, y, z);
        cube.setLocalScale(0.3, 0.3, 0.3);
        app.root.addChild(cube);
        return cube;
    };

    // Create some cubes in a circle around the user
    const cubes = [];
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const x = Math.sin(angle) * 2;
        const z = Math.cos(angle) * 2;
        const cube = createCube(x, 0.5, z, cubeColors[i]);
        cubes.push(cube);
    }

    // XR Menu Script Entity
    const menuEntity = new pc.Entity('XrMenu');
    menuEntity.addComponent('script');
    menuEntity.script.create(XrMenu, {
        properties: {
            menuItems: [
                { label: 'Red Cube', eventName: 'menu:red' },
                { label: 'Green Cube', eventName: 'menu:green' },
                { label: 'Blue Cube', eventName: 'menu:blue' },
                { label: 'Exit VR', eventName: 'xr:end' }
            ],
            fontAsset: assets.font,
            buttonTexture: assets.buttonTexture,
            preferredHand: 'left',
            menuOffset: new pc.Vec3(0, 0.03, 0.042),
            buttonWidth: 0.072,
            buttonHeight: 0.015,
            buttonSpacing: 0.0025,
            fontSize: 8,
            followSpeed: 15,
            buttonColor: new pc.Color(1, 1, 1, 0.9),
            hoverColor: new pc.Color(1.2, 1.2, 1.2, 1.0),
            pressColor: new pc.Color(0.8, 0.8, 0.8, 1.0),
            textColor: new pc.Color(1, 1, 1)
        }
    });
    app.root.addChild(menuEntity);

    /**
     * Highlights a cube by scaling it up and making it glow.
     *
     * @param {number} index - The index of the cube to highlight.
     */
    const highlightCube = (index) => {
        // Reset all cubes to normal state
        for (let i = 0; i < cubes.length; i++) {
            cubes[i].setLocalScale(0.3, 0.3, 0.3);
            const color = cubeColors[i];
            // @ts-ignore engine-tsd
            cubeMaterials[i].emissive.set(color.r * 0.1, color.g * 0.1, color.b * 0.1);
            cubeMaterials[i].update();
        }
        // Highlight selected - scale up and make it glow brightly
        if (index >= 0 && index < cubes.length) {
            cubes[index].setLocalScale(0.5, 0.5, 0.5);
            const color = cubeColors[index];
            // Make it glow brightly
            // @ts-ignore engine-tsd
            cubeMaterials[index].emissive.set(color.r * 0.8, color.g * 0.8, color.b * 0.8);
            cubeMaterials[index].update();
        }
    };

    // Handle menu events
    let selectedCubeIndex = -1;

    app.on('menu:red', () => {
        message('Red cube selected!');
        selectedCubeIndex = 0;
        highlightCube(0);
    });

    app.on('menu:green', () => {
        message('Green cube selected!');
        selectedCubeIndex = 1;
        highlightCube(1);
    });

    app.on('menu:blue', () => {
        message('Blue cube selected!');
        selectedCubeIndex = 2;
        highlightCube(2);
    });

    // Listen for menu active state to show in message
    app.on('xr:menu:active', (active) => {
        if (active) {
            message('Menu opened - point and touch to select');
        } else if (selectedCubeIndex >= 0) {
            message(`${['Red', 'Green', 'Blue', 'Yellow'][selectedCubeIndex]} cube selected`);
        } else {
            message('Open palm toward face to show menu');
        }
    });

    if (app.xr.supported) {
        // XR availability
        document
        .querySelector('.container > .button[data-xr="immersive-ar"]')
        ?.classList.toggle('active', app.xr.isAvailable(pc.XRTYPE_AR));
        document
        .querySelector('.container > .button[data-xr="immersive-vr"]')
        ?.classList.toggle('active', app.xr.isAvailable(pc.XRTYPE_VR));

        // XR availability events
        app.xr.on('available', (type, available) => {
            const element = document.querySelector(`.container > .button[data-xr="${type}"]`);
            element?.classList.toggle('active', available);
        });

        // XR session events
        app.xr.on('start', () => {
            message('Open palm toward face to show menu');
        });

        app.xr.on('end', () => {
            message('XR session ended');
        });

        // Button handler - fires events that XrSession listens to
        const onXrButtonClick = function () {
            // @ts-ignore
            if (!this.classList.contains('active')) return;

            // @ts-ignore
            const type = this.getAttribute('data-xr');

            // Fire the appropriate event that XrSession is listening for
            if (type === pc.XRTYPE_AR) {
                app.fire('ar:start');
            } else {
                app.fire('vr:start');
            }
        };

        // Button clicks
        const buttons = document.querySelectorAll('.container > .button');
        for (let i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener('click', onXrButtonClick);
        }

        if (window.XRHand) {
            message('Click to enter VR, use hand tracking or controllers');
        } else {
            message('Click to enter VR (hand tracking not available)');
        }

        // Animate cubes
        let pulseTime = 0;
        app.on('update', (dt) => {
            pulseTime += dt;

            for (let i = 0; i < cubes.length; i++) {
                cubes[i].rotate(0, 0.5, 0);

                // Pulse the selected cube
                if (i === selectedCubeIndex) {
                    // Pulsing scale between 0.45 and 0.55
                    const pulse = 0.5 + Math.sin(pulseTime * 5) * 0.05;
                    cubes[i].setLocalScale(pulse, pulse, pulse);

                    // Pulsing glow
                    const color = cubeColors[i];
                    const glow = 0.6 + Math.sin(pulseTime * 5) * 0.3;
                    // @ts-ignore engine-tsd
                    cubeMaterials[i].emissive.set(color.r * glow, color.g * glow, color.b * glow);
                    cubeMaterials[i].update();
                }
            }
        });
    } else {
        message('WebXR is not supported');
    }
});

export { app };
