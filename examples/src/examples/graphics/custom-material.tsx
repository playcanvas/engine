import React from 'react';

import * as pc from '../../../../';
import { Panel, Button } from '@playcanvas/pcui/react';
import { Observer } from '@playcanvas/observer';

class CustomMaterialExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Custom Material';

    controls(data: Observer) {
        return <></>;
    }

    example(canvas: HTMLCanvasElement, deviceType: string, data: any): void {

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
                app.scene.clusteredLightingEnabled = false;

                // Create an Entity with a camera component
                const camera = new pc.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc.Color(0.4, 0.45, 0.5)
                });
                camera.addComponent("script");
                camera.script.create("orbitCamera", {
                    attributes: {
                        inertiaFactor: 0.2,
                        distanceMin: 8,
                        distanceMax: 50
                    }
                });
                camera.script.create("orbitCameraInputMouse");
                camera.script.create("orbitCameraInputTouch");
                camera.translate(0, 1, 4);
                camera.lookAt(0, 0, 0);
                app.root.addChild(camera);

                // Create an Entity with a omni light component and a sphere model component.
                const light = new pc.Entity();
                light.addComponent("light", {
                    type: "omni",
                    color: new pc.Color(1, 1, 1),
                    intensity: 1,
                    range: 100
                });
                light.translate(0, 3, 0);
                app.root.addChild(light);

                const material = new pc.CustomMaterial();
                material.setParameter("texture_envAtlas", assets.helipad.resource);
                material.setParameter("material_reflectivity", 1.0);
                const options = new pc.LitOptions();
                options.shadingModel = pc.SPECULAR_BLINN;
                options.useSpecular = true;
                options.useMetalness = true;
                options.occludeSpecular = 1;
                options.reflectionSource = 'envAtlas';
                options.reflectionEncoding = assets.helipad.resource.encoding;
                options.ambientSource = 'envAtlas';
                options.ambientEncoding = assets.helipad.resource.encoding;
                options.clusteredLightingEnabled = app.scene.clusteredLightingEnabled;
                material.options = options;

                const customLitArguments = `
                LitShaderArguments evaluateFrontend() {
                    LitShaderArguments args;
                    args.emission = vec3(0, 0, 0);
                    args.albedo = dVertexNormalW;
                    args.metalness = 0.5;
                    args.specularity = vec3(1,1,1);
                    args.specularityFactor = 1.0;
                    args.gloss = 0.5;
                    args.worldNormal = dVertexNormalW;
                    args.ao = 0.0;
                    args.opacity = 1.0;
                    return args;
                }`;
                material.customLitArguments = customLitArguments;
                material.update();

                // create primitive
                const primitive = new pc.Entity();
                primitive.addComponent('render', {
                    type: "sphere",
                    material: material
                });

                // set position and scale and add it to scene
                app.root.addChild(primitive);
            });
        });
    }
}

export default CustomMaterialExample;
