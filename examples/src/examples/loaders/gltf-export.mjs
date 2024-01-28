import * as pc from 'playcanvas';

/**
 * @param {import('../../app/example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { Button } = ReactPCUI;
    return jsx(Button, {
        text: 'Download GLTF',
        onClick: () => observer.emit('download')
    });
}

/**
 * @param {import('../../options.mjs').ExampleOptions} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, assetPath, glslangPath, twgslPath, data, pcx, dracoPath }) {

    // set up and load draco module, as the glb we load is draco compressed
    pc.WasmModule.setConfig('DracoDecoderModule', {
        glueUrl:     dracoPath + 'draco.wasm.js',
        wasmUrl:     dracoPath + 'draco.wasm.wasm',
        fallbackUrl: dracoPath + 'draco.js'
    });
    await new Promise((resolve) => { pc.WasmModule.getInstance('DracoDecoderModule', () => resolve()) });

    const assets = {
        helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: assetPath + 'cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
        bench: new pc.Asset('bench', 'container', { url: assetPath + 'models/bench_wooden_01.glb' }),
        model: new pc.Asset('model', 'container', { url: assetPath + 'models/bitmoji.glb' }),
        board: new pc.Asset('statue', 'container', { url: assetPath + 'models/chess-board.glb' }),
        boombox: new pc.Asset('statue', 'container', { url: assetPath + 'models/boom-box.glb' }),
        color: new pc.Asset('color', 'texture', { url: assetPath + 'textures/seaside-rocks01-color.jpg' }),
    };

    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    const device = await pc.createGraphicsDevice(canvas, gfxOptions);

    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.LightComponentSystem
    ];
    createOptions.resourceHandlers = [
        // @ts-ignore
        pc.TextureHandler,
        // @ts-ignore
        pc.ContainerHandler
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

        // get the instance of the bench and set up with render component
        const entity1 = assets.bench.resource.instantiateRenderEntity();
        entity1.setLocalPosition(0, 0, -1.5);
        app.root.addChild(entity1);

        // the character
        const entity2 = assets.model.resource.instantiateRenderEntity();
        app.root.addChild(entity2);

        // chess board
        const entity3 = assets.board.resource.instantiateRenderEntity();
        entity3.setLocalScale(0.01, 0.01, 0.01);
        app.root.addChild(entity3);

        const entity4 = assets.boombox.resource.instantiateRenderEntity();
        entity4.setLocalPosition(0, 0.5, -3);
        entity4.setLocalScale(100, 100, 100);
        app.root.addChild(entity4);

        // a render component with a sphere and cone primitives
        const material = new pc.StandardMaterial();
        material.diffuse = pc.Color.RED;
        material.update();

        const entity = new pc.Entity("TwoMeshInstances");
        entity.addComponent('render', {
            type: 'asset',
            meshInstances: [
                new pc.MeshInstance(pc.createSphere(app.graphicsDevice), material),
                new pc.MeshInstance(pc.createCone(app.graphicsDevice), material)
            ]
        });
        app.root.addChild(entity);
        entity.setLocalPosition(0, 1.5, -1.5);

        // mesh with a basic material
        const basicMaterial = new pc.BasicMaterial();
        basicMaterial.color.set(0.5, 1.0, 0.7);
        basicMaterial.colorMap = assets.color.resource;

        const capsule = new pc.Entity('capsule');
        capsule.addComponent('render', {
            material: basicMaterial,
            type: 'capsule'
        });
        capsule.setLocalPosition(0.5, 2.0, -0.5);
        app.root.addChild(capsule);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.2, 0.1, 0.1),
            farClip: 100
        });
        camera.translate(-3, 1, 2);
        camera.lookAt(0, 0.5, 0);
        app.root.addChild(camera);

        // set skybox
        app.scene.envAtlas = assets.helipad.resource;
        app.scene.toneMapping = pc.TONEMAP_ACES;
        app.scene.skyboxMip = 1;
        app.scene.exposure = 1.5;

        // a link element, created in the html part of the examples.
        const link = document.getElementById('ar-link');

        // export the whole scene into a glb format
        const options = {
            maxTextureSize: 1024
        };

        new pcx.GltfExporter().build(app.root, options).then((arrayBuffer) => {

            const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });

            // @ts-ignore
            link.download = "scene.glb";

            // @ts-ignore
            link.href = URL.createObjectURL(blob);
        }).catch(console.error);

        // when clicking on the download UI button, trigger the download
        data.on('download', function () {
            link.click();
        });
    });
    return app;
}

export class GltfExportExample {
    static CATEGORY = 'Loaders';
    static WEBGPU_ENABLED = true;
    static INCLUDE_AR_LINK = true;
    static controls = controls;
    static example = example;
}
