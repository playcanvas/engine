import { data } from 'examples/observer';
import { deviceType, rootPath } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

pc.WasmModule.setConfig('Ammo', {
    glueUrl: `${rootPath}/static/lib/ammo/ammo.wasm.js`,
    wasmUrl: `${rootPath}/static/lib/ammo/ammo.wasm.wasm`,
    fallbackUrl: `${rootPath}/static/lib/ammo/ammo.js`
});
await new Promise((resolve) => {
    pc.WasmModule.getInstance('Ammo', () => resolve());
});

const assets = {
    font: new pc.Asset('font', 'font', { url: `${rootPath}/static/assets/fonts/arial.json` })
};

const gfxOptions = {
    deviceTypes: [deviceType]
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

    // Create a row of physical geometric shapes
    const types = ['box', 'capsule', 'cone', 'cylinder', 'sphere'];
    types.forEach((type, idx) => {
        createPhysicalShape(type, green, idx * 2 + 1, 0, 0);
    });

    // Allocate some colors
    const white = new pc.Color(1, 1, 1);
    const blue = new pc.Color(0, 0, 1);

    // Allocate some vectors
    const temp = new pc.Vec3();

    // Transform context for rotated wireframe drawing
    const drawCenter = new pc.Vec3();
    const drawRot = new pc.Quat();
    const _ta = new pc.Vec3();
    const _tb = new pc.Vec3();

    /**
     * Draw a line transformed by the current draw rotation around the draw center.
     *
     * @param {pc.Vec3} a - Start point.
     * @param {pc.Vec3} b - End point.
     * @param {pc.Color} color - The color.
     */
    function drawLineRotated(a, b, color) {
        _ta.sub2(a, drawCenter);
        drawRot.transformVector(_ta, _ta);
        _ta.add(drawCenter);

        _tb.sub2(b, drawCenter);
        drawRot.transformVector(_tb, _tb);
        _tb.add(drawCenter);

        app.drawLine(_ta, _tb, color);
    }

    // Number of segments used to draw shape wireframes
    const segments = 20;

    /**
     * Helper to draw a wireframe circle.
     *
     * @param {pc.Vec3} center - The center of the circle.
     * @param {number} radius - The radius.
     * @param {number} axisA - Index of the first planar axis (0=x, 1=y, 2=z).
     * @param {number} axisB - Index of the second planar axis.
     * @param {pc.Color} color - The color.
     */
    function drawWireCircle(center, radius, axisA, axisB, color) {
        const axes = ['x', 'y', 'z'];
        const a = axes[axisA];
        const b = axes[axisB];
        const p1 = new pc.Vec3();
        const p2 = new pc.Vec3();
        for (let i = 0; i < segments; i++) {
            const theta1 = (i / segments) * Math.PI * 2;
            const theta2 = ((i + 1) / segments) * Math.PI * 2;
            p1.copy(center);
            p2.copy(center);
            p1[a] += radius * Math.cos(theta1);
            p1[b] += radius * Math.sin(theta1);
            p2[a] += radius * Math.cos(theta2);
            p2[b] += radius * Math.sin(theta2);
            drawLineRotated(p1, p2, color);
        }
    }

    /**
     * Helper to draw a wireframe sphere.
     *
     * @param {pc.Vec3} center - The center of the sphere.
     * @param {number} radius - The radius of the sphere.
     * @param {pc.Color} color - The color.
     */
    function drawWireSphere(center, radius, color) {
        drawWireCircle(center, radius, 0, 1, color);
        drawWireCircle(center, radius, 0, 2, color);
        drawWireCircle(center, radius, 1, 2, color);
    }

    /**
     * Helper to draw a wireframe box.
     *
     * @param {pc.Vec3} center - The center of the box.
     * @param {pc.Vec3} halfExtents - The half-extents.
     * @param {pc.Color} color - The color.
     */
    function drawWireBox(center, halfExtents, color) {
        const hx = halfExtents.x;
        const hy = halfExtents.y;
        const hz = halfExtents.z;
        const corners = [
            new pc.Vec3(center.x - hx, center.y - hy, center.z - hz),
            new pc.Vec3(center.x + hx, center.y - hy, center.z - hz),
            new pc.Vec3(center.x + hx, center.y + hy, center.z - hz),
            new pc.Vec3(center.x - hx, center.y + hy, center.z - hz),
            new pc.Vec3(center.x - hx, center.y - hy, center.z + hz),
            new pc.Vec3(center.x + hx, center.y - hy, center.z + hz),
            new pc.Vec3(center.x + hx, center.y + hy, center.z + hz),
            new pc.Vec3(center.x - hx, center.y + hy, center.z + hz)
        ];
        // Bottom face
        drawLineRotated(corners[0], corners[1], color);
        drawLineRotated(corners[1], corners[2], color);
        drawLineRotated(corners[2], corners[3], color);
        drawLineRotated(corners[3], corners[0], color);
        // Top face
        drawLineRotated(corners[4], corners[5], color);
        drawLineRotated(corners[5], corners[6], color);
        drawLineRotated(corners[6], corners[7], color);
        drawLineRotated(corners[7], corners[4], color);
        // Vertical edges
        drawLineRotated(corners[0], corners[4], color);
        drawLineRotated(corners[1], corners[5], color);
        drawLineRotated(corners[2], corners[6], color);
        drawLineRotated(corners[3], corners[7], color);
    }

    /**
     * Helper to draw a wireframe capsule (Y-axis aligned).
     *
     * @param {pc.Vec3} center - The center of the capsule.
     * @param {number} radius - The radius.
     * @param {number} height - The total height.
     * @param {pc.Color} color - The color.
     */
    function drawWireCapsule(center, radius, height, color) {
        const halfCylinder = Math.max((height - 2 * radius) * 0.5, 0);
        const top = new pc.Vec3(center.x, center.y + halfCylinder, center.z);
        const bottom = new pc.Vec3(center.x, center.y - halfCylinder, center.z);

        // Top and bottom circles (at hemisphere centers)
        drawWireCircle(top, radius, 0, 2, color);
        drawWireCircle(bottom, radius, 0, 2, color);

        // Vertical lines connecting the two circles
        if (halfCylinder > 0) {
            drawLineRotated(new pc.Vec3(center.x - radius, top.y, center.z), new pc.Vec3(center.x - radius, bottom.y, center.z), color);
            drawLineRotated(new pc.Vec3(center.x + radius, top.y, center.z), new pc.Vec3(center.x + radius, bottom.y, center.z), color);
            drawLineRotated(new pc.Vec3(center.x, top.y, center.z - radius), new pc.Vec3(center.x, bottom.y, center.z - radius), color);
            drawLineRotated(new pc.Vec3(center.x, top.y, center.z + radius), new pc.Vec3(center.x, bottom.y, center.z + radius), color);
        }

        // Half-sphere caps (each sweeps a quarter turn: 0 to PI/2)
        const p1 = new pc.Vec3();
        const p2 = new pc.Vec3();
        const halfPi = Math.PI * 0.5;
        for (let i = 0; i < segments; i++) {
            const theta1 = (i / segments) * halfPi;
            const theta2 = ((i + 1) / segments) * halfPi;

            const cosT1 = Math.cos(theta1);
            const sinT1 = Math.sin(theta1);
            const cosT2 = Math.cos(theta2);
            const sinT2 = Math.sin(theta2);

            p1.set(top.x + radius * sinT1, top.y + radius * cosT1, top.z);
            p2.set(top.x + radius * sinT2, top.y + radius * cosT2, top.z);
            drawLineRotated(p1, p2, color);

            p1.set(top.x - radius * sinT1, top.y + radius * cosT1, top.z);
            p2.set(top.x - radius * sinT2, top.y + radius * cosT2, top.z);
            drawLineRotated(p1, p2, color);

            p1.set(top.x, top.y + radius * cosT1, top.z + radius * sinT1);
            p2.set(top.x, top.y + radius * cosT2, top.z + radius * sinT2);
            drawLineRotated(p1, p2, color);

            p1.set(top.x, top.y + radius * cosT1, top.z - radius * sinT1);
            p2.set(top.x, top.y + radius * cosT2, top.z - radius * sinT2);
            drawLineRotated(p1, p2, color);

            p1.set(bottom.x + radius * sinT1, bottom.y - radius * cosT1, bottom.z);
            p2.set(bottom.x + radius * sinT2, bottom.y - radius * cosT2, bottom.z);
            drawLineRotated(p1, p2, color);

            p1.set(bottom.x - radius * sinT1, bottom.y - radius * cosT1, bottom.z);
            p2.set(bottom.x - radius * sinT2, bottom.y - radius * cosT2, bottom.z);
            drawLineRotated(p1, p2, color);

            p1.set(bottom.x, bottom.y - radius * cosT1, bottom.z + radius * sinT1);
            p2.set(bottom.x, bottom.y - radius * cosT2, bottom.z + radius * sinT2);
            drawLineRotated(p1, p2, color);

            p1.set(bottom.x, bottom.y - radius * cosT1, bottom.z - radius * sinT1);
            p2.set(bottom.x, bottom.y - radius * cosT2, bottom.z - radius * sinT2);
            drawLineRotated(p1, p2, color);
        }
    }

    /**
     * Helper to draw a wireframe cylinder (Y-axis aligned).
     *
     * @param {pc.Vec3} center - The center.
     * @param {number} radius - The radius.
     * @param {number} height - The height.
     * @param {pc.Color} color - The color.
     */
    function drawWireCylinder(center, radius, height, color) {
        const halfH = height * 0.5;
        const top = new pc.Vec3(center.x, center.y + halfH, center.z);
        const bottom = new pc.Vec3(center.x, center.y - halfH, center.z);
        drawWireCircle(top, radius, 0, 2, color);
        drawWireCircle(bottom, radius, 0, 2, color);
        drawLineRotated(new pc.Vec3(center.x - radius, top.y, center.z), new pc.Vec3(center.x - radius, bottom.y, center.z), color);
        drawLineRotated(new pc.Vec3(center.x + radius, top.y, center.z), new pc.Vec3(center.x + radius, bottom.y, center.z), color);
        drawLineRotated(new pc.Vec3(center.x, top.y, center.z - radius), new pc.Vec3(center.x, bottom.y, center.z - radius), color);
        drawLineRotated(new pc.Vec3(center.x, top.y, center.z + radius), new pc.Vec3(center.x, bottom.y, center.z + radius), color);
    }

    /**
     * Draw the wireframe for a given shape config at a position.
     *
     * @param {object} shape - The shape config.
     * @param {pc.Vec3} pos - The position.
     * @param {pc.Color} color - The color.
     * @param {pc.Quat} [rot] - Optional rotation.
     */
    function drawWireShape(shape, pos, color, rot) {
        drawCenter.copy(pos);
        if (rot) {
            drawRot.copy(rot);
        } else {
            drawRot.set(0, 0, 0, 1);
        }
        switch (shape.type) {
            case 'box':
                drawWireBox(pos, shape.halfExtents, color);
                break;
            case 'capsule':
                drawWireCapsule(pos, shape.radius, shape.height, color);
                break;
            case 'cylinder':
                drawWireCylinder(pos, shape.radius, shape.height, color);
                break;
            case 'sphere':
                drawWireSphere(pos, shape.radius, color);
                break;
        }
    }

    // Base shape configs for each type
    const baseShapeConfigs = {
        box: { type: 'box', halfExtents: new pc.Vec3(0.5, 0.5, 0.5) },
        capsule: { type: 'capsule', radius: 0.3, height: 1.2 },
        cylinder: { type: 'cylinder', radius: 0.4, height: 1.0 },
        sphere: { type: 'sphere', radius: 0.5 }
    };

    /**
     * Create a scaled copy of a shape config.
     *
     * @param {object} base - The base shape config.
     * @param {number} scale - The scale factor.
     * @returns {object} The scaled shape config.
     */
    function scaleShape(base, scale) {
        const s = { type: base.type };
        if (base.halfExtents) s.halfExtents = base.halfExtents.clone().mulScalar(scale);
        if (base.radius !== undefined) s.radius = base.radius * scale;
        if (base.height !== undefined) s.height = base.height * scale;
        return s;
    }

    // Setup initial data values
    data.set('shape', {
        type: 'sphere',
        size: 1,
        sweepSpeed: 1,
        rotationSpeed: 0
    });

    // Set an update function on the application's update event
    let time = 0;
    const position = new pc.Vec3();
    const rotation = new pc.Quat();

    app.on('update', (dt) => {
        time += dt;

        // Reset all shapes to green
        app.root.findComponents('render').forEach((/** @type {pc.RenderComponent}*/ render) => {
            render.material = green;
        });

        // Get the selected settings from the controls
        const shapeType = data.get('shape.type') || 'sphere';
        const size = data.get('shape.size') ?? 1;
        const sweepSpeed = data.get('shape.sweepSpeed') ?? 1;
        const rotationSpeed = data.get('shape.rotationSpeed') ?? 0;

        const baseShape = baseShapeConfigs[shapeType];
        const shape = scaleShape(baseShape, size);

        // shapeCast moving horizontally with rotation
        const x = 5 + 4 * Math.sin(time * sweepSpeed);
        position.set(x, 0, 0);
        rotation.setFromEulerAngles(0, time * rotationSpeed * 90, time * rotationSpeed * 45);

        drawWireShape(shape, position, white, rotation);

        const results = app.systems.rigidbody.shapeCast(shape, position, {
            findAll: true,
            startRotation: rotation
        });
        results.forEach((result) => {
            result.entity.render.material = red;
            temp.copy(result.normal).mulScalar(0.3).add(result.point);
            app.drawLine(result.point, temp, blue);
        });
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

    createText(assets.font, 'shapeCast', 0.5, 1.75, 0, 0);
});

export { app };
