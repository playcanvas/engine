import React from 'react';
import * as pc from '../../../../';

import { BindingTwoWay, LabelGroup, Panel, SliderInput, BooleanInput } from '@playcanvas/pcui/react';
import { Observer } from '@playcanvas/observer';
class MeshDisplacementExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Mesh Displacement';
    static WEBGPU_ENABLED = false;

    controls(data: Observer) {
        return <>
            <Panel headerText='Displacement'>
                <LabelGroup text='Enabled'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'script.useDisplacement.enabled' }}/>
                </LabelGroup>
                <LabelGroup text='Factor'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.useDisplacement.displacementFactor' }} min={-1.0} max={1.0}/>
                </LabelGroup>
                <LabelGroup text='Offset'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.useDisplacement.displacementOffset' }} min={-1.0} max={1.0}/>
                </LabelGroup>
            </Panel>
        </>;
    }

    example(canvas: HTMLCanvasElement, deviceType: string, data: any): void {

        const assets = {
            orbitCamera: new pc.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
            helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP, mipmaps: false }),
            normal: new pc.Asset("normal", "texture", { url: "/static/assets/textures/seaside-rocks01-normal.jpg" }),
            diffuse: new pc.Asset("diffuse", "texture", { url: "/static/assets/textures/seaside-rocks01-color.jpg" }),
            other: new pc.Asset("other", "texture", { url: "/static/assets/textures/seaside-rocks01-gloss.jpg" })
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
                pc.ScriptHandler
            ];

            const app = new pc.AppBase(canvas);
            app.init(createOptions);

            // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
            app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc.RESOLUTION_AUTO);

            const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(() => {

                app.start();

                app.scene.toneMapping = pc.TONEMAP_ACES;
                app.scene.ambientLight.set(0, 0, 0);
                app.scene.ambientLuminance = 0;
                app.scene.envAtlas = assets.helipad.resource;
                app.scene.skyboxMip = 1;
                app.scene.skyboxIntensity = 0.1;
                app.scene.setSkybox(assets.helipad.resources);

                // Set default parameters
                data.set('script', {
                    useDisplacement: {
                        enabled: true,
                        displacementFactor: -0.1,
                        displacementOffset: 0.2
                    }
                });

                // Create a Material for ground plane
                const planeMaterial = new pc.StandardMaterial();
                planeMaterial.gloss = 0.0;
                planeMaterial.metalness = 0.7;
                planeMaterial.useMetalness = true;
                planeMaterial.update();

                // Create an Entity with a Render component for ground plane
                const plane = new pc.Entity();
                plane.addComponent('render', {
                    type: 'plane',
                    material: planeMaterial
                });
                plane.setLocalScale(new pc.Vec3(100, 0, 100));
                plane.setLocalPosition(0, 0, 0);
                app.root.addChild(plane);

                // Helper function to create a Sphere
                const createSphere = function (x: number, y: number, z: number, material: pc.Material, hiDef: boolean) {
                    // Create an Entity with Render component
                    const sphere = new pc.Entity();
                    sphere.addComponent("render", {
                        material: material,
                        type: "sphere"
                    });

                    // Create a highly defined sphere mesh
                    if (hiDef) {
                        const sphereHidef = pc.createSphere(device, {
                            radius: 0.5,
                            latitudeBands: 512,
                            longitudeBands: 512,
                            calculateTangents: true
                        });
                        sphere.render.meshInstances[0].mesh = sphereHidef;
                    }

                    // Set sphere position & scale and add to scene
                    sphere.setLocalPosition(x, y, z);
                    sphere.setLocalScale(3.0, 3.0, 3.0);
                    app.root.addChild(sphere);
                };

                // Create a material
                const material = new pc.StandardMaterial();
                material.diffuseMap = assets.diffuse.resource;
                material.metalnessMap = assets.other.resource;
                material.metalnessMapChannel = "r";
                material.glossMap = assets.other.resource;
                material.glossMapChannel = "g";
                material.normalMap = assets.normal.resource;
                material.diffuse = new pc.Color(0.6, 0.6, 0.9);
                material.diffuseTint = true;
                material.metalness = 0.6;
                material.gloss = 0.8;
                material.bumpiness = 0.7;
                material.useMetalness = true;

                // Set materials height map for displacement to use
                material.heightMap = assets.other.resource;

                // Set materials displacement parameters
                material.useDisplacement = data.get('script.useDisplacement.enabled');
                material.displacementFactor = data.get('script.useDisplacement.displacementFactor');
                material.displacementOffset = data.get('script.useDisplacement.displacementOffset');
                material.update();

                // Add sphere with specified material with helper function
                const sphere = createSphere(0, 2.5, 0, material, true);

                // Create an Entity with a light component
                const lightOmni = new pc.Entity("Omni");
                lightOmni.addComponent("light", {
                    type: "omni",
                    color: new pc.Color(1, 1, 1),
                    range: 25,
                    penumbraSize: 32,
                    shadowType: pc.SHADOW_PCSS,
                    intensity: 4.0,
                    castShadows: true,
                    shadowBias: 0.01,
                    normalOffsetBias: 0.01,
                    shadowResolution: 2048
                });
                lightOmni.setLocalPosition(-4, 7, 0);

                app.root.addChild(lightOmni);

                // Create an Entity with a camera component
                const camera = new pc.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc.Color(0.4, 0.45, 0.5)
                });
                camera.setLocalPosition(0, 5, 11);

                // Add orbit script to camera component
                camera.addComponent("script");
                camera.script.create("orbitCamera", {
                    attributes: {
                        inertiaFactor: 0.2,
                        focusEntity: sphere,
                        distanceMax: 500,
                        frameOnStart: false
                    }
                });
                camera.script.create("orbitCameraInputMouse");
                camera.script.create("orbitCameraInputTouch");
                app.root.addChild(camera);

                data.on('*:set', (path: string, value: any) => {
                    switch (path) {
                        case 'script.useDisplacement.enabled':
                            material.useDisplacement = value;
                            material.update();
                            break;
                        case 'script.useDisplacement.displacementFactor':
                            material.displacementFactor = value;
                            material.update();
                            break;
                        case 'script.useDisplacement.displacementOffset':
                            material.displacementOffset = value;
                            material.update();
                            break;
                    }
                });

                let resizeControlPanel = true;
                app.on("update", function () {
                    // resize control panel to fit the content better
                    if (resizeControlPanel) {
                        const panel = window.top.document.getElementById('controlPanel');
                        if (panel) {
                            panel.style.width = '360px';
                            resizeControlPanel = false;
                        }
                    }
                });
            });
        });
    }
}

export default MeshDisplacementExample;
