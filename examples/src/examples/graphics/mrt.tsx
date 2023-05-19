import * as pc from '../../../../';

class MrtExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Multi Render Targets';
    static WEBGPU_ENABLED = true;

    static FILES = {

        // shader chunk which outputs to multiple render targets
        // Note: gl_FragColor is not modified, and so the forward pass output is used for target 0
        'output.frag': /* glsl */`
            #ifdef MYMRT_PASS
                // output world normal to target 1
                pcFragColor1 = vec4(litShaderArgs.worldNormal * 0.5 + 0.5, 1.0);

                // output gloss to target 2
                pcFragColor2 = vec4(vec3(litShaderArgs.gloss) , 1.0);
            #endif
        `
    };

    example(canvas: HTMLCanvasElement, deviceType: string, files: { 'output.frag': string, }): void {

        // set up and load draco module, as the glb we load is draco compressed
        pc.WasmModule.setConfig('DracoDecoderModule', {
            glueUrl: '/static/lib/draco/draco.wasm.js',
            wasmUrl: '/static/lib/draco/draco.wasm.wasm',
            fallbackUrl: '/static/lib/draco/draco.js'
        });

        const assets = {
            'board': new pc.Asset('statue', 'container', { url: '/static/assets/models/chess-board.glb' }),
            helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false })
        };

        const gfxOptions = {
            deviceTypes: [deviceType],
            glslangUrl: '/static/lib/glslang/glslang.js',
            twgslUrl: '/static/lib/twgsl/twgsl.js'
        };

        pc.createGraphicsDevice(canvas, gfxOptions).then((device: pc.GraphicsDevice) => {

            const createOptions = new pc.AppOptions();
            createOptions.graphicsDevice = device;
            createOptions.keyboard = new pc.Keyboard(document.body);

            createOptions.componentSystems = [
                // @ts-ignore
                pc.RenderComponentSystem,
                // @ts-ignore
                pc.CameraComponentSystem,
                // @ts-ignore
                pc.LightComponentSystem,
                // @ts-ignore
                pc.ScriptComponentSystem,
                // @ts-ignore
                pc.ScreenComponentSystem,
                // @ts-ignore
                pc.ElementComponentSystem
            ];
            createOptions.resourceHandlers = [
                // @ts-ignore
                pc.ScriptHandler,
                // @ts-ignore
                pc.TextureHandler,
                // @ts-ignore
                pc.ContainerHandler,
                // @ts-ignore
                pc.FontHandler
            ];

            const app = new pc.AppBase(canvas);
            app.init(createOptions);

            // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
            app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc.RESOLUTION_AUTO);

            const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(() => {

                app.start();

                // setup skydome
                app.scene.envAtlas = assets.helipad.resource;
                app.scene.skyboxMip = 1;
                app.scene.toneMapping = pc.TONEMAP_ACES;


                // get world and skybox layers
                const worldLayer = app.scene.layers.getLayerByName("World");
                const skyboxLayer = app.scene.layers.getLayerByName("Skybox");

                // create a layer for object that render into texture, add it right after the world layer
                const rtLayer = new pc.Layer({ name: "RTLayer" });
                app.scene.layers.insert(rtLayer, 1);

                // helper function to create a texture to render to
                const createTexture = (name: string, width: number, height: number) => {
                    return new pc.Texture(app.graphicsDevice, {
                        name: name,
                        width: width,
                        height: height,
                        format: pc.PIXELFORMAT_R8_G8_B8_A8,
                        mipmaps: false,
                        minFilter: pc.FILTER_LINEAR,
                        magFilter: pc.FILTER_LINEAR,
                        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
                        addressV: pc.ADDRESS_CLAMP_TO_EDGE
                    });
                };

                // create textures and render target for rendering into, including depth buffer
                const texture0 = createTexture('RT-texture-0', 512, 512);
                const texture1 = createTexture('RT-texture-1', 512, 512);
                const texture2 = createTexture('RT-texture-2', 512, 512);

                // render to multiple targets if supported
                const colorBuffers = app.graphicsDevice.supportsMrt ? [texture0, texture1, texture2] : [texture0];
                const renderTarget = new pc.RenderTarget({
                    name: `MRT`,
                    colorBuffers: colorBuffers,
                    depth: true,
                    flipY: true,
                    samples: 2
                });

                // Create texture camera, which renders entities in RTLayer into the texture
                const textureCamera = new pc.Entity("TextureCamera");
                textureCamera.addComponent("camera", {
                    layers: [rtLayer.id],
                    farClip: 500,

                    // set the priority of textureCamera to lower number than the priority of the main camera (which is at default 0)
                    // to make it rendered first each frame
                    priority: -1,

                    // this camera renders into texture target
                    renderTarget: renderTarget
                });
                app.root.addChild(textureCamera);

                // if MRT is supported, set the shader pass to use MRT output
                if (app.graphicsDevice.supportsMrt) {
                    textureCamera.camera.setShaderPass('MyMRT');
                }

                // get the instance of the chess board. Render it into RTLayer only.
                const boardEntity = assets.board.resource.instantiateRenderEntity({
                    layers: [rtLayer.id]
                });
                app.root.addChild(boardEntity);

                // override output shader chunk for the material of the chess board, to inject our
                // custom shader chunk which outputs to multiple render targets during our custom
                // shader pass
                const outputChunk = files['output.frag'];
                const renders: Array<pc.RenderComponent> = boardEntity.findComponents("render");
                renders.forEach((render) => {

                    const meshInstances = render.meshInstances;
                    for (let i = 0; i < meshInstances.length; i++) {
                        // @ts-ignore engine-tsd
                        meshInstances[i].material.chunks.outputPS = outputChunk;
                    }
                });

                // Create an Entity with a camera component
                const camera: any = new pc.Entity();
                camera.addComponent("camera", {
                    layers: [worldLayer.id, skyboxLayer.id]
                });
                app.root.addChild(camera);

                // update things every frame
                let angle = 1;
                app.on("update", function (dt: any) {
                    angle += dt;

                    // orbit the camera around
                    textureCamera.setLocalPosition(110 * Math.sin(angle * 0.2), 45, 110 * Math.cos(angle * 0.2));
                    textureCamera.lookAt(pc.Vec3.ZERO);

                    // debug draw the texture on the screen in the world layer of the main camera
                    // @ts-ignore engine-tsd
                    app.drawTexture(0, 0.4, 1, 1, texture0, null, worldLayer);

                    // @ts-ignore engine-tsd
                    app.drawTexture(-0.5, -0.5, 0.7, 0.7, texture1, null, worldLayer);

                    // @ts-ignore engine-tsd
                    app.drawTexture(0.5, -0.5, 0.7, 0.7, texture2, null, worldLayer);
                });
            });
        });
    }
}

export default MrtExample;
