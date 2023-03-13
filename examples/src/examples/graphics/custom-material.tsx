import React from 'react';

import * as pc from '../../../../';
import { Panel, Button } from '@playcanvas/pcui/react';
import { Observer } from '@playcanvas/observer';

class CustomMaterialExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Asset Viewer';

    example(canvas: HTMLCanvasElement, data: any): void {

        const assets = {
            orbitCamera: new pc.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
            helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP }),
            font: new pc.Asset('font', 'font', { url: '/static/assets/fonts/arial.json' }),
            checkerboard: new pc.Asset('checkerboard', 'texture', { url: '/static/assets/textures/checkboard.png' })
        };

        pc.createGraphicsDevice(canvas).then((device: pc.GraphicsDevice) => {

            const createOptions = new pc.AppOptions();
            createOptions.graphicsDevice = device;
            createOptions.mouse = new pc.Mouse(document.body);
            createOptions.touch = new pc.TouchDevice(document.body);
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
                pc.ElementComponentSystem
            ];
            createOptions.resourceHandlers = [
                // @ts-ignore
                pc.TextureHandler,
                // @ts-ignore
                pc.ContainerHandler,
                // @ts-ignore
                pc.ScriptHandler,
                // @ts-ignore
                pc.JsonHandler,
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

                app.scene.envAtlas = assets.helipad.resource;

                // Create an Entity with a camera component
                const camera = new pc.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc.Color(0.4, 0.45, 0.5)
                });
                camera.translate(0, 1, 4);
                camera.lookAt(0, 0, 0);
                app.root.addChild(camera);

                // Create an Entity with a omni light component and a sphere model component.
                const light = new pc.Entity();
                light.addComponent("light", {
                    type: "omni",
                    color: new pc.Color(1, 1, 1),
                    radius: 100
                });
                light.translate(0, 3, 0);
                app.root.addChild(light);

                const material = new pc.Material();
                material.setParameter("texture_envAtlas", assets.helipad.resource);
                material.setParameter("material_reflectivity", 1.0);
                const options = new pc.LitOptions();
                options.shadingModel = pc.SPECULAR_BLINN;
                options.useSpecular = true;
                options.useMetalness = true;
                options.reflectionSource = 'envAtlas';
                options.ambientSource = 'envAtlas';
                options.ambientEncoding = assets.helipad.resource.encoding;
                const litShader = new pc.LitShader(device, options);
                litShader.needsNormal = true;
                const customFrontend = new pc.ChunkBuilder();
                customFrontend.append(litShader.chunks.litShaderArgsPS);
                customFrontend.append(`
                uniform float textureBias;
                LitShaderArguments evaluateFrontend() {
                    LitShaderArguments args;
                    args.albedo = vec3(1, 0, 1);
                    args.metalness = 1.0;
                    args.specularity = vec3(1,1,1);
                    args.specularityFactor = 1.0;
                    args.gloss = 1.0;
                    args.worldNormal = dVertexNormalW;
                    args.ao = 1.0;
                    args.opacity = 1.0;
                    return args;
                }`);

                litShader.generateVertexShader([true], [true], []);
                litShader.generateFragmentShader("", customFrontend.code, "    LitShaderArguments litShaderArgs = evaluateFrontend();\n", "vUv0");
                material.shader = pc.createShaderFromCode(device, litShader.vshader, litShader.fshader, "CustomMaterialShader");
                material.update();

                // create primitive
                const primitive = new pc.Entity();
                primitive.addComponent('render', {
                    type: "box",
                    material: material
                });

                // set position and scale and add it to scene
                app.root.addChild(primitive);
            });
        });
    }
}

export default CustomMaterialExample;
