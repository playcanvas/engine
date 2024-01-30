import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { Button } = ReactPCUI;
    return fragment(
        jsx(Button, {
            text: 'Custom Shader',
            onClick: () => {
                observer.set('shader', !observer.get('shader'));
            }
        })
    );
}

/**
 * @typedef {{ 'shader.vert': string, 'shader.frag': string }} Files
 * @typedef {import('../../options.mjs').ExampleOptions<Files>} Options
 * @param {Options} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, data, assetPath, scriptsPath, glslangPath, twgslPath, files }) {

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js',

        // disable antialiasing as gaussian splats do not benefit from it and it's expensive
        antialias: false
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);
    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;
    createOptions.mouse = new pc.Mouse(document.body);
    createOptions.touch = new pc.TouchDevice(document.body);

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.LightComponentSystem,
        pc.ScriptComponentSystem,
        pc.GSplatComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
        pc.ContainerHandler,
        // @ts-ignore
        pc.ScriptHandler,
        // @ts-ignore
        pc.GSplatHandler
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

    const assets = {
        gallery: new pc.Asset('gallery', 'container', { url: assetPath + 'models/vr-gallery.glb' }),
        guitar: new pc.Asset('gsplat', 'gsplat', { url: assetPath + 'splats/guitar.ply' }),
        biker: new pc.Asset('gsplat', 'gsplat', { url: assetPath + 'splats/biker.ply' }),
        orbit: new pc.Asset('script', 'script', { url: scriptsPath + 'camera/orbit-camera.js' })
    };

    const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
    assetListLoader.load(() => {

        app.start();

        app.scene.toneMapping = pc.TONEMAP_ACES;

        // get the instance of the gallery and set up with render component
        const galleryEntity = assets.gallery.resource.instantiateRenderEntity();
        app.root.addChild(galleryEntity);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.2, 0.2, 0.2)
        });
        camera.setLocalPosition(-3, 1, 2);

        const createSplatInstance = (name, resource, px, py, pz, scale, vertex, fragment) => {

            const splat = resource.instantiate({
                debugRender: false,
                fragment: fragment,
                vertex: vertex
            });
            splat.name = name;
            splat.setLocalPosition(px, py, pz);
            splat.setLocalScale(scale, scale, scale);
            app.root.addChild(splat);
            return splat;
        };

        const guitar = createSplatInstance('guitar', assets.guitar.resource, 0, 0.8, 0, 0.4, files['shader.vert'], files['shader.frag']);
        const biker1 = createSplatInstance('biker1', assets.biker.resource, -1.5, 0.05, 0, 0.7);

        // clone the biker and add the clone to the scene
        const biker2 = biker1.clone();
        biker2.setLocalPosition(1.5, 0.05, 0);
        biker2.rotate(0, 150, 0);
        app.root.addChild(biker2);

        // add orbit camera script with a mouse and a touch support
        camera.addComponent("script");
        camera.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2,
                focusEntity: guitar,
                distanceMax: 60,
                frameOnStart: false
            }
        });
        camera.script.create("orbitCameraInputMouse");
        camera.script.create("orbitCameraInputTouch");
        app.root.addChild(camera);

        let useCustomShader = true;
        data.on('shader:set', () => {

            // Apply custom or default material options to the splats when the button is clicked. Note
            // that this uses non-public API, which is subject to change when a proper API is added.
            const materialOptions = {
                fragment: files['shader.frag'],
                vertex: files['shader.vert']
            };
            biker1.gsplat.materialOptions = useCustomShader ? materialOptions : null;
            biker2.gsplat.materialOptions = useCustomShader ? materialOptions : null;
            useCustomShader = !useCustomShader;
        });

        let currentTime = 0;
        app.on("update", function (dt) {
            currentTime += dt;

            const material = guitar.gsplat.material;
            material.setParameter('uTime', currentTime);
        });
    });
    return app;
}

export class GSplatManyExample {
    static CATEGORY = 'Loaders';
    static example = example;
    static controls = controls;
    static FILES = {
        'shader.vert': /* glsl */`
            uniform float uTime;
            varying float height;

            void main(void)
            {
                // evaluate center of the splat in object space
                vec3 centerLocal = evalCenter();

                // modify it
                float heightIntensity = centerLocal.y * 0.2;
                centerLocal.x += sin(uTime * 5.0 + centerLocal.y) * 0.3 * heightIntensity;

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
