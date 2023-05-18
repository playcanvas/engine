import React from 'react';
import * as pc from '../../../../';

import { BindingTwoWay, LabelGroup, Panel, SliderInput, SelectInput } from '@playcanvas/pcui/react';
import { Observer } from '@playcanvas/observer';
class ContactHardeningShadowsExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Contact Hardening Shadows';
    static WEBGPU_ENABLED = true;

    controls(data: Observer) {
        return <>
            <Panel headerText='Lights'>
                <LabelGroup text='Area (lm)'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.area.intensity' }} min={0.0} max={32.0}/>
                </LabelGroup>
                <LabelGroup text='Area Softness'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.area.size' }} min={0.1} max={35.0}/>
                </LabelGroup>
                <LabelGroup text='Area Shadows'>
                    <SelectInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.area.shadowType' }} options={[{ v: pc.SHADOW_PCSS, t: 'PCSS' }, { v: pc.SHADOW_PCF5, t: 'PCF' }]} />
                </LabelGroup>
                <LabelGroup text='Point (lm)'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.point.intensity' }} min={0.0} max={32.0}/>
                </LabelGroup>
                <LabelGroup text='Point Softness'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.point.size' }} min={0.1} max={35.0}/>
                </LabelGroup>
                <LabelGroup text='Point Shadows'>
                    <SelectInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.point.shadowType' }} options={[{ v: pc.SHADOW_PCSS, t: 'PCSS' }, { v: pc.SHADOW_PCF5, t: 'PCF' }]} />
                </LabelGroup>
                <LabelGroup text='Directional (lm)'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.directional.intensity' }} min={0.0} max={32.0}/>
                </LabelGroup>
                <LabelGroup text='Directional Softness'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.directional.size' }} min={0.1} max={35.0}/>
                </LabelGroup>
                <LabelGroup text='Directional Shadows'>
                    <SelectInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.directional.shadowType' }} options={[{ v: pc.SHADOW_PCSS, t: 'PCSS' }, { v: pc.SHADOW_PCF5, t: 'PCF' }]} />
                </LabelGroup>
            </Panel>
        </>;
    }

    example(canvas: HTMLCanvasElement, deviceType: string, data: any): void {

        const assets = {
            orbitCamera: new pc.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
            helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP }),
            cube: new pc.Asset('cube', 'container', { url: '/static/assets/models/playcanvas-cube.glb' }),
            color: new pc.Asset('color', 'texture', { url: '/static/assets/textures/seaside-rocks01-color.jpg' }),
            normal: new pc.Asset('normal', 'texture', { url: '/static/assets/textures/seaside-rocks01-normal.jpg' }),
            gloss: new pc.Asset('gloss', 'texture', { url: '/static/assets/textures/seaside-rocks01-gloss.jpg' }),
            luts: new pc.Asset('luts', 'json', { url: '/static/assets/json/area-light-luts.json' }),
            asset: new pc.Asset('sponza', 'container', { url: '/static/assets/models/old_tree.glb' })
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
                pc.ContainerHandler,
                // @ts-ignore
                pc.ScriptHandler,
                // @ts-ignore
                pc.JsonHandler
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
                app.scene.skyboxMip = 1;
                app.scene.ambientLight.set(0, 0, 0);
                app.scene.ambientLuminance = 0;
                app.scene.setSkybox(assets.helipad.resources);

                // enable area lights which are disabled by default for clustered lighting
                app.scene.lighting.areaLightsEnabled = true;
                app.scene.clusteredLightingEnabled = false;

                app.scene.lighting.shadowsEnabled = true;
                app.scene.lighting.shadowAtlasResolution = 2048;
                app.scene.skyboxIntensity = 0.1;

                // set the loaded area light LUT data
                const luts = assets.luts.resource;
                app.setAreaLightLuts(luts.LTC_MAT_1, luts.LTC_MAT_2);

                const planeMaterial = new pc.StandardMaterial();
                //planeMaterial.diffuseMap = assets.color.resource;
                //planeMaterial.normalMap = assets.normal.resource;
                planeMaterial.gloss = 0.0;
                planeMaterial.metalness = 0.7;
                planeMaterial.useMetalness = true;

                planeMaterial.diffuseMapTiling.set(17, 17);
                planeMaterial.normalMapTiling.set(17, 17);
                planeMaterial.glossMapTiling.set(17, 17);
                planeMaterial.update();

                const plane = new pc.Entity();
                plane.addComponent('render', {
                    type: 'plane',
                    material: planeMaterial
                });
                plane.setLocalScale(new pc.Vec3(100, 0, 100));
                plane.setLocalPosition(0, -1.0, 0);
                app.root.addChild(plane);

                const plane2 = new pc.Entity();
                plane2.addComponent('render', {
                    type: 'plane',
                    material: planeMaterial
                });
                plane2.setLocalScale(new pc.Vec3(100, 0, 100));
                plane2.setLocalPosition(-15, 0, 0);
                plane2.setEulerAngles(90, 90, 0);
                app.root.addChild(plane2);

                data.set('script', {
                    rect: {
                        intensity: 16.0,
                        size: 30,
                        shadowType: pc.SHADOW_PCSS
                    }
                });

                const occluder = assets.asset.resource.instantiateRenderEntity();
                /*
                const occluder = new pc.Entity();
                occluder.addComponent('render', {
                        type: 'box',
                        material: planeMaterial
                });
                
                occluder.setLocalPosition(-2, -0.2, 0);

                //occluder.setEulerAngles(0, 0, 0);
                occluder.setLocalScale(0.5, 10, 0.5);
                */
                app.root.addChild(occluder);

                app.scene.envAtlas = assets.helipad.resource;

                const areaLight = new pc.Entity();
                areaLight.addComponent("light", {
                    type: "spot",
                    shape: pc.LIGHTSHAPE_RECT,
                    color: pc.Color.WHITE,
                    castShadows: true,
                    range: 150,
                    shadowResolution: 2048,
                    shadowDistance: 100,
                    lightSize: data.get('script.rect.size'),
                    shadowType: data.get('script.rect.shadowType'),
                    intensity: data.get('script.rect.intensity'),
                    falloffMode: pc.LIGHTFALLOFF_INVERSESQUARED,
                    innerConeAngle: 45,
                    outerConeAngle: 50,
                    normalOffsetBias: 0.1
                });
                areaLight.setLocalScale(3, 1, 3);
                areaLight.setEulerAngles(45, 90, 0);
                areaLight.setLocalPosition(4, 7, 0);

                // emissive material that is the light source color
                const brightMaterial = new pc.StandardMaterial();
                brightMaterial.emissive = pc.Color.WHITE;
                brightMaterial.emissiveIntensity = areaLight.light.intensity;
                brightMaterial.useLighting = false;
                brightMaterial.cull = pc.CULLFACE_NONE;
                brightMaterial.update();

                const brightShape = new pc.Entity();
                // primitive shape that matches light source shape
                brightShape.addComponent("render", {
                    type: "plane",
                    material: brightMaterial,
                    castShadows: false
                });
                areaLight.addChild(brightShape);
                app.root.addChild(areaLight);

                const directionalLight = new pc.Entity();
                directionalLight.addComponent("light", {
                    type: "directional",
                    color: pc.Color.WHITE,
                    castShadows: true,
                    numCascades: 1,
                    lightSize: data.get('script.directional.size'),
                    shadowType: data.get('script.directional.shadowType'),
                    intensity: data.get('script.directional.intensity'),
                    shadowBias: 0.5,
                    shadowDistance: 50,
                    normalOffsetBias: 0.1,
                    shadowResolution: 2048
                });
                directionalLight.setEulerAngles(45, 35, 0);
                app.root.addChild(directionalLight);

                const lightOmni = new pc.Entity("Omni");
                lightOmni.addComponent("light", {
                    type: "omni",
                    color: pc.Color.WHITE,
                    range: 25,
                    lightSize: data.get('script.point.size'),
                    shadowType: data.get('script.point.shadowType'),
                    intensity: data.get('script.point.intensity'),
                    castShadows: true,
                    shadowBias: 0.2,
                    normalOffsetBias: 0.2,
                    shadowResolution: 2048
                });
                lightOmni.setLocalPosition(10, 10, 4);
                app.root.addChild(lightOmni);

                // Create an Entity with a camera component
                const camera = new pc.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc.Color(0.4, 0.45, 0.5)
                });
                camera.setLocalPosition(0, 5, 11);

                camera.camera.requestSceneColorMap(true);
                camera.addComponent("script");
                camera.script.create("orbitCamera", {
                    attributes: {
                        inertiaFactor: 0.2,
                        focusEntity: occluder,
                        distanceMin: 1,
                        distanceMax: 100,
                        frameOnStart: false
                    }
                });
                camera.script.create("orbitCameraInputMouse");
                camera.script.create("orbitCameraInputTouch");
                app.root.addChild(camera);

                data.on('*:set', (path: string, value: any) => {
                    if (path === 'script.rect.intensity') {
                        areaLight.light.intensity = value;
                        brightMaterial.emissiveIntensity = value;
                        brightMaterial.update();
                    } else if (path === 'script.rect.size') {
                        areaLight.light.lightSize = value;
                    } else if (path === 'script.rect.shadowType') {
                        areaLight.light.shadowType = parseInt(value);
                    } else if (path === 'occluder.height') {
                        //occluder.setLocalPosition(0, 2 + value, 0);
                    } else if (path === 'light.distance') {
                        areaLight.setLocalPosition(0, 4, -value);
                    }
                });

                let resizeControlPanel = true;
                let time = 0;
                app.on("update", function (dt) {
                    time += dt;

                    //data.set('occluder.height', Math.sin(time * 0.2) * 2);
                    //data.set('light.distance', Math.sin(time * 0.2) * 10 + 14);

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

export default ContactHardeningShadowsExample;
