import * as pc from 'playcanvas';
import { deviceType, rootPath } from 'examples/utils';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: rootPath + '/static/assets/cubemaps/helipad-env-atlas.png' },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    )
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

createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler];

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

    // setup skydome
    app.scene.skyboxMip = 2;
    app.scene.exposure = 0.2;
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, 30, 0);

    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.1, 0.1, 0.1)
    });
    camera.setLocalPosition(80, 40, 80);
    camera.lookAt(new pc.Vec3(0, -35, 0));
    app.root.addChild(camera);

    // Create a directional light
    const directionallight = new pc.Entity();
    directionallight.addComponent('light', {
        type: 'directional',
        color: pc.Color.WHITE,
        castShadows: false
    });
    app.root.addChild(directionallight);

    // create a circle of meshes
    /** @type {Array<pc.Entity>} */
    const meshes = [];
    const numMeshes = 10;
    for (let i = 0; i < numMeshes; i++) {
        const entity = new pc.Entity();
        entity.setLocalScale(4, 4, 4);

        // use material with random color
        const material = new pc.StandardMaterial();
        material.diffuse = new pc.Color(Math.random(), Math.random(), Math.random());
        material.update();

        // create render component
        entity.addComponent('render', {
            type: i % 2 ? 'sphere' : 'cylinder',
            material: material,
            receiveShadows: false
        });

        if (!(i % 2)) {
            entity.setLocalScale(3, 5, 3);
        }

        // add entity for rendering
        app.root.addChild(entity);
        meshes.push(entity);
    }

    /**
     * helper function to generate elevation of a point with [x, y] coordinates
     * @param {number} time - The time.
     * @param {number} x - The x coordinate.
     * @param {number} z - The z coordinate.
     * @returns {number} The returned ground elevation.
     */
    function groundElevation(time, x, z) {
        return Math.sin(time + 0.2 * x) * 2 + Math.cos(time * 0.2 + 0.5 * z + 0.2 * x);
    }

    /**
     * helper function to generate a color for 3d point by lerping between green and red color
     * based on its y coordinate
     * @param {pc.Color} color - The color.
     * @param {pc.Vec3} point - The point.
     */
    function groundColor(color, point) {
        color.lerp(pc.Color.GREEN, pc.Color.RED, pc.math.clamp((point.y + 3) * 0.25, 0, 1));
    }

    // Set an update function on the app's update event
    let time = 0;
    app.on('update', function (dt) {
        time += dt;

        // generate grid of lines - store positions and colors as an arrays of numbers instead of
        // Vec3s and Colors to improve performance
        const positions = [];
        const colors = [];

        // temporary instances for calculations
        const pt1 = new pc.Vec3();
        const pt2 = new pc.Vec3();
        const pt3 = new pc.Vec3();
        const c1 = new pc.Color();
        const c2 = new pc.Color();
        const c3 = new pc.Color();

        for (let x = 1; x < 60; x++) {
            for (let z = 1; z < 60; z++) {
                // generate 3 points: one start point, one along x and one along z axis
                pt1.set(x, groundElevation(time, x, z), z);
                pt2.set(x - 1, groundElevation(time, x - 1, z), z);
                pt3.set(x, groundElevation(time, x, z - 1), z - 1);

                // generate colors for the 3 points
                groundColor(c1, pt1);
                groundColor(c2, pt2);
                groundColor(c3, pt3);

                // add line connecting points along z axis
                if (x > 1) {
                    positions.push(pt1.x, pt1.y, pt1.z, pt2.x, pt2.y, pt2.z);
                    colors.push(c1.r, c1.g, c1.b, c1.a, c2.r, c2.g, c2.b, c2.a);
                }

                // add line connecting points along x axis
                if (z > 1) {
                    positions.push(pt1.x, pt1.y, pt1.z, pt3.x, pt3.y, pt3.z);
                    colors.push(c1.r, c1.g, c1.b, c1.a, c3.r, c3.g, c3.b, c3.a);
                }
            }
        }

        // submit the generated arrays of lines and colors for rendering
        app.drawLineArrays(positions, colors);

        // array of Vec3 and Color classes for different way to render lines
        const grayLinePositions = [];
        const grayLineColors = [];

        // handle the array of meshes
        for (let i = 0; i < numMeshes; i++) {
            // move them equally spaced out around in the circle
            const offset = (i * Math.PI * 2) / numMeshes;
            const entity = meshes[i];
            entity.setLocalPosition(
                30 + 20 * Math.sin(time * 0.2 + offset),
                5 + 2 * Math.sin(time + (3 * i) / numMeshes),
                30 + 20 * Math.cos(time * 0.2 + offset)
            );

            // rotate the meshes
            entity.rotate((i + 1) * dt, 4 * (i + 1) * dt, 6 * (i + 1) * dt);

            // draw a single magenta line from this mesh to the next mesh
            const nextEntity = meshes[(i + 1) % meshes.length];
            app.drawLine(entity.getPosition(), nextEntity.getPosition(), pc.Color.MAGENTA);

            // store positions and colors of lines connecting objects to a center point
            grayLinePositions.push(entity.getPosition(), new pc.Vec3(0, 10, 0));
            grayLineColors.push(pc.Color.GRAY, pc.Color.GRAY);
        }

        // render all gray lines
        app.drawLines(grayLinePositions, grayLineColors);
    });
});

export { app };
