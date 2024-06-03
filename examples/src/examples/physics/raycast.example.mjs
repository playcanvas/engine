import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

pc.WasmModule.setConfig('Ammo', {
    glueUrl: rootPath + '/static/lib/ammo/ammo.wasm.js',
    wasmUrl: rootPath + '/static/lib/ammo/ammo.wasm.wasm',
    fallbackUrl: rootPath + '/static/lib/ammo/ammo.js'
});
await new Promise((resolve) => {
    pc.WasmModule.getInstance('Ammo', () => resolve());
});

const assets = {
    font: new pc.Asset('font', 'font', { url: rootPath + '/static/assets/fonts/arial.json' })
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
createOptions.keyboard = new pc.Keyboard(document.body);

createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem,
    pc.ScriptComponentSystem,
    pc.CollisionComponentSystem,
    pc.RigidBodyComponentSystem,
    pc.ElementComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler,
    pc.ContainerHandler,
    pc.ScriptHandler,
    pc.JsonHandler,
    pc.FontHandler
];

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

    app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

    /**
     * @param {pc.Color} color - The color.
     * @returns {pc.StandardMaterial} - The material.
     */
    function createMaterial(color) {
        const material = new pc.StandardMaterial();
        material.diffuse = color;
        material.update();
        return material;
    }

    // Create a couple of materials
    const red = createMaterial(new pc.Color(1, 0, 0));
    const green = createMaterial(new pc.Color(0, 1, 0));

    // Create light
    const light = new pc.Entity();
    light.addComponent('light', {
        type: 'directional'
    });

    app.root.addChild(light);
    light.setEulerAngles(45, 30, 0);

    // Create camera
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.5, 0.5, 0.8)
    });

    app.root.addChild(camera);
    camera.setPosition(5, 0, 15);

    /**
     * @param {string} type - The shape type.
     * @param {pc.Material} material - The material.
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {number} z - The z coordinate.
     * @returns {pc.Entity} - The created entity.
     */
    function createPhysicalShape(type, material, x, y, z) {
        const e = new pc.Entity();

        // Have to set the position of the entity before adding the static rigidbody
        // component because static bodies cannot be moved after creation
        app.root.addChild(e);
        e.setPosition(x, y, z);

        e.addComponent('render', {
            type: type,
            material: material
        });
        e.addComponent('rigidbody', {
            type: 'static'
        });
        e.addComponent('collision', {
            type: type,
            height: type === 'capsule' ? 2 : 1
        });

        return e;
    }

    // Create two rows of physical geometric shapes
    const types = ['box', 'capsule', 'cone', 'cylinder', 'sphere'];
    types.forEach(function (type, idx) {
        createPhysicalShape(type, green, idx * 2 + 1, 2, 0);
    });
    types.forEach(function (type, idx) {
        createPhysicalShape(type, green, idx * 2 + 1, -2, 0);
    });

    // Allocate some colors
    const white = new pc.Color(1, 1, 1);
    const blue = new pc.Color(0, 0, 1);

    // Allocate some vectors
    const start = new pc.Vec3();
    const end = new pc.Vec3();
    const temp = new pc.Vec3();

    // Set an update function on the application's update event
    let time = 0;
    let y = 0;
    app.on('update', function (dt) {
        time += dt;

        // Reset all shapes to green
        app.root.findComponents('render').forEach(function (/** @type {pc.RenderComponent}*/ render) {
            render.material = green;
        });

        y = 2 + 1.2 * Math.sin(time);
        start.set(0, y, 0);
        end.set(10, y, 0);

        // Render the ray used in the raycast
        app.drawLine(start, end, white);

        const result = app.systems.rigidbody.raycastFirst(start, end);
        if (result) {
            result.entity.render.material = red;

            // Render the normal on the surface from the hit point
            temp.copy(result.normal).mulScalar(0.3).add(result.point);
            app.drawLine(result.point, temp, blue);
        }

        y = -2 + 1.2 * Math.sin(time);
        start.set(0, y, 0);
        end.set(10, y, 0);

        // Render the ray used in the raycast
        app.drawLine(start, end, white);

        const results = app.systems.rigidbody.raycastAll(start, end);
        results.forEach(function (result) {
            result.entity.render.material = red;

            // Render the normal on the surface from the hit point
            temp.copy(result.normal).mulScalar(0.3).add(result.point);
            app.drawLine(result.point, temp, blue);
        }, this);
    });

    /**
     * @param {pc.Asset} fontAsset - The font asset.
     * @param {string} message - The message.
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {number} z - The z coordinate.
     * @param {number} rot - Euler-rotation around z coordinate.
     */
    const createText = function (fontAsset, message, x, y, z, rot) {
        // Create a text element-based entity
        const text = new pc.Entity();
        text.addComponent('element', {
            anchor: [0.5, 0.5, 0.5, 0.5],
            fontAsset: fontAsset,
            fontSize: 0.5,
            pivot: [0, 0.5],
            text: message,
            type: pc.ELEMENTTYPE_TEXT
        });
        text.setLocalPosition(x, y, z);
        text.setLocalEulerAngles(0, 0, rot);
        app.root.addChild(text);
    };

    createText(assets.font, 'raycastFirst', 0.5, 3.75, 0, 0);
    createText(assets.font, 'raycastAll', 0.5, -0.25, 0, 0);
});

export { app };
