import * as pc from 'playcanvas';

/**
 * @typedef {import('../../options.mjs').ExampleOptions} ExampleOptions
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, assetPath, scriptsPath, glslangPath, twgslPath, pcx, files }) {

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;
    createOptions.mouse = new pc.Mouse(document.body);
    createOptions.touch = new pc.TouchDevice(document.body);

    createOptions.componentSystems = [
        // @ts-ignore
        pc.RenderComponentSystem,
        // @ts-ignore
        pc.CameraComponentSystem,
        // @ts-ignore
        pc.LightComponentSystem,
        // @ts-ignore
        pc.ScriptComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
        pc.ContainerHandler,
        // @ts-ignore
        pc.ScriptHandler
    ];

    const app = new pc.AppBase(canvas);
    app.init(createOptions);

    pcx.registerPlyParser(app);

    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    const assets = {
        splat: new pc.Asset('splat', 'container', { url: assetPath + 'splats/guitar.ply' }),
        orbit: new pc.Asset('script', 'script', { url: scriptsPath + 'camera/orbit-camera.js' })
    };

    const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
    assetListLoader.load(() => {

        app.start();

        app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.2, 0.2, 0.2)
        });
        camera.setLocalPosition(-4, 1, 4);

        // add orbit camera script with a mouse and a touch support
        camera.addComponent("script");
        camera.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2,
                distanceMax: 60,
                frameOnStart: false
            }
        });
        camera.script.create("orbitCameraInputMouse");
        camera.script.create("orbitCameraInputTouch");
        app.root.addChild(camera);

        const entity = assets.splat.resource.instantiateRenderEntity({
            cameraEntity: camera,
            debugRender: false,
            fragment: files['shader.frag'],
            vertex: files['shader.vert']
        });
        app.root.addChild(entity);

        let currentTime = 0;
        app.on("update", function (dt) {
            currentTime += dt;

            const material = entity.render.meshInstances[0].material;
            material.setParameter('uTime', currentTime);
        });
    });
    return app;
}

export class SplatExample {
    static CATEGORY = 'Loaders';
    static NAME = 'Splat';
    static example = example;

    static FILES = {
        'shader.vert': /* glsl */`
            uniform float uTime;
            varying float height;

            void main(void)
            {
                // evaluate center of the splat in object space
                vec3 centerLocal = evalCenter();

                // modify it
                centerLocal.x += sin(uTime * 5.0 + centerLocal.y) * 0.3;

                // output y-coordinate
                height = centerLocal.y;

                // evaluate the rest of the splat using world space center
                vec4 centerWorld = matrix_model * vec4(centerLocal, 1.0);
                gl_Position = evalSplat(centerWorld);
            }
        `,

        'shader.frag': /* glsl */`
            uniform float uTime;
            varying float height;

            void main(void)
            {
                // get splat color and alpha
                gl_FragColor = evalSplat();

                // modify it
                vec3 gold = vec3(1.0, 0.85, 0.0);
                float sineValue = abs(sin(uTime * 5.0 + height));
                float blend = smoothstep(0.9, 1.0, sineValue);
                gl_FragColor.xyz = mix(gl_FragColor.xyz, gold, blend);
            }
        `
    };
}
