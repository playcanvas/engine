import * as pc from 'playcanvas';
import { loadES5 } from '../../loadES5.mjs';
// todo simply import "@loaders.gl/core";
// https://loaders.gl/docs/developer-guide/get-started
// TODO: https://cdn.jsdelivr.net/npm/@loaders.gl/core@2.3.6/dist/es6/

/**
 * @typedef {{ 'shader.vert': string, 'shader.frag': string }} Files
 * @typedef {import('../../options.mjs').ExampleOptions<Files>} Options
 * @param {Options} options - The example options.
 * @returns {Promise<pc.AppBase>} The example application.
 */
async function example({ canvas, deviceType, files, assetPath, glslangPath, twgslPath }) {
    const CORE  = await loadES5('https://cdn.jsdelivr.net/npm/@loaders.gl/core@2.3.6/dist/dist.min.js');
    const DRACO = await loadES5('https://cdn.jsdelivr.net/npm/@loaders.gl/draco@2.3.6/dist/dist.min.js');

    // This example uses draco point cloud loader library from https://loaders.gl/
    // Note that many additional formats are supported by the library and can be used.
    const gfxOptions = {
        deviceTypes: [deviceType],
        glslangUrl: glslangPath + 'glslang.js',
        twgslUrl: twgslPath + 'twgsl.js'
    };

    /** @type {pc.GraphicsDevice} */
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
    app.start();
    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    /**
     * @param {string} url - The url to load.
     */
    async function loadModel(url) {
        console.log("loader.gl example url", url);
        // load the url using the draco format loader
        // @ts-ignore: cannot find CORE and DRACO
        const modelData = await CORE.load(url, DRACO.DracoLoader);

        // loaded colors only contain RGB, convert it to an array of RGBA with alpha of 255
        const srcColors = modelData.attributes.COLOR_0.value;
        const numVertices = srcColors.length / modelData.attributes.COLOR_0.size;
        const colors32 = new Uint8Array(numVertices * 4);
        for (let i = 0; i < numVertices; i++) {
            colors32[i * 4 + 0] = srcColors[i * 3 + 0];
            colors32[i * 4 + 1] = srcColors[i * 3 + 1];
            colors32[i * 4 + 2] = srcColors[i * 3 + 2];
            colors32[i * 4 + 3] = 255;
        }

        // based on the loaded data, create the mesh with position and color vertex data
        const mesh = new pc.Mesh(app.graphicsDevice);
        mesh.clear(true, false);
        mesh.setPositions(modelData.attributes.POSITION.value, modelData.attributes.POSITION.size);
        mesh.setColors32(colors32);
        mesh.update(pc.PRIMITIVE_POINTS);

        const shader = pc.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], "MyShader", {
            aPosition: pc.SEMANTIC_POSITION,
            aColor: pc.SEMANTIC_COLOR
        });

        // create material using the shader
        const material = new pc.Material();
        material.shader = shader;
        material.blendType = pc.BLENDMODE_ONE_MINUS_DST_ALPHA;
        material.cull = pc.CULLFACE_NONE;

        // Add an entity with a render component to render the mesh
        const entity = new pc.Entity();
        entity.addComponent('render', {
            material: material,
            meshInstances: [new pc.MeshInstance(mesh, material)]
        });

        app.root.addChild(entity);
    }
    // Create an Entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent("camera", {
        clearColor: new pc.Color(0.1, 0.1, 0.1),
        farClip: 100
    });
    camera.translate(-20, 15, 20);
    camera.lookAt(0, 7, 0);
    app.root.addChild(camera);
    // Load the draco model, don't wait for it.
    loadModel(assetPath + "models/park_points.drc");
    // update things each frame
    let time = 0;
    app.on("update", function (dt) {
        time += dt;
        // orbit the camera
        if (camera) {
            camera.setLocalPosition(40 * Math.sin(time * 0.5), 10, 20 * Math.cos(time * 0.5));
            camera.lookAt(pc.Vec3.ZERO);
        }
    });
    return app;
}

class LoadersGlExample {
    static CATEGORY = 'Loaders';
    static FILES = {
        'shader.vert': `
            // Attributes per vertex: position
            attribute vec4 aPosition;
            attribute vec4 aColor;
            
            uniform mat4   matrix_viewProjection;
            uniform mat4   matrix_model;
            
            // Color to fragment program
            varying vec4 outColor;
            
            void main(void)
            {
                mat4 modelViewProj = matrix_viewProjection * matrix_model;
                gl_Position = modelViewProj * aPosition;
            
                // WebGPU doesn't support setting gl_PointSize to anything besides a constant 1.0
                #ifndef WEBGPU
                    gl_PointSize = 1.5;
                #endif
            
                outColor = aColor;
            }`,

        'shader.frag': `
            precision lowp float;
            varying vec4 outColor;
            
            void main(void)
            {
                // just output color supplied by vertex shader
                gl_FragColor = outColor;
            }`
    };
    static example = example;
    static imports = [ loadES5 ];
}

export { LoadersGlExample };
