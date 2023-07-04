import React from 'react';
import * as pc from '../../../../';

import { BindingTwoWay, LabelGroup, Panel, SliderInput, SelectInput, BooleanInput } from '@playcanvas/pcui/react';
import { Observer } from '@playcanvas/observer';
class ContactHardeningShadowsExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Contact Hardening Shadows';
    static WEBGPU_ENABLED = false;

    controls(data: Observer) {
        return <>
            <Panel headerText='Area light'>
                <LabelGroup text='Enabled'>
                    <BooleanInput id='area-light' binding={new BindingTwoWay()} link={{ observer: data, path: 'script.area.enabled' }} />
                </LabelGroup>
                <LabelGroup text='Intensity'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.area.intensity' }} min={0.0} max={32.0}/>
                </LabelGroup>
                <LabelGroup text='Softness'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.area.size' }} min={0.01} max={32.0}/>
                </LabelGroup>
                <LabelGroup text='Shadows'>
                    <SelectInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.area.shadowType' }} options={[{ v: pc.SHADOW_PCSS, t: 'PCSS' }, { v: pc.SHADOW_PCF5, t: 'PCF' }]} />
                </LabelGroup>
            </Panel>
            <Panel headerText='Point light'>
                <LabelGroup text='Enabled'>
                    <BooleanInput id='point-light' binding={new BindingTwoWay()} link={{ observer: data, path: 'script.point.enabled' }} />
                </LabelGroup>
                <LabelGroup text='Intensity'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.point.intensity' }} min={0.0} max={32.0}/>
                </LabelGroup>
                <LabelGroup text='Softness'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.point.size' }} min={0.01} max={32.0}/>
                </LabelGroup>
                <LabelGroup text='Shadows'>
                    <SelectInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.point.shadowType' }} options={[{ v: pc.SHADOW_PCSS, t: 'PCSS' }, { v: pc.SHADOW_PCF5, t: 'PCF' }]} />
                </LabelGroup>
            </Panel>
            <Panel headerText='Directional light'>
                <LabelGroup text='Enabled'>
                    <BooleanInput id='directional-light' binding={new BindingTwoWay()} link={{ observer: data, path: 'script.directional.enabled' }} />
                </LabelGroup>
                <LabelGroup text='Intensity'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.directional.intensity' }} min={0.0} max={32.0}/>
                </LabelGroup>
                <LabelGroup text='Softness'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.directional.size' }} min={0.01} max={32.0}/>
                </LabelGroup>
                <LabelGroup text='Shadows'>
                    <SelectInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.directional.shadowType' }} options={[{ v: pc.SHADOW_PCSS, t: 'PCSS' }, { v: pc.SHADOW_PCF5, t: 'PCF' }]} />
                </LabelGroup>
            </Panel>
            <Panel headerText='Animate'>
                <LabelGroup text='Cycle Active Light'>
                    <BooleanInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.cycle' }} />
                </LabelGroup>
                <LabelGroup text='Animate Lights'>
                    <BooleanInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.animate' }} />
                </LabelGroup>
            </Panel>
        </>;
    }

    example(canvas: HTMLCanvasElement, deviceType: string, data: any): void {

        pc.WasmModule.setConfig('DracoDecoderModule', {
            glueUrl: '/static/lib/draco/draco.wasm.js',
            wasmUrl: '/static/lib/draco/draco.wasm.wasm',
            fallbackUrl: '/static/lib/draco/draco.js'
        });

        pc.WasmModule.getInstance('DracoDecoderModule', demo);


        function demo() {

            const assets = {
                orbitCamera: new pc.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
                helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP }),
                cube: new pc.Asset('cube', 'container', { url: '/static/assets/models/playcanvas-cube.glb' }),
                luts: new pc.Asset('luts', 'json', { url: '/static/assets/json/area-light-luts.json' }),
                asset: new pc.Asset('asset', 'container', { url: '/static/assets/models/robot-arm.glb' })
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
                    app.scene.clusteredLightingEnabled = false;
                    app.scene.skyboxIntensity = 0.1;

                    // set the loaded area light LUT data
                    const luts = assets.luts.resource;
                    app.setAreaLightLuts(luts.LTC_MAT_1, luts.LTC_MAT_2);

                    const planeMaterial = new pc.StandardMaterial();
                    planeMaterial.gloss = 0.0;
                    planeMaterial.metalness = 0.7;
                    planeMaterial.useMetalness = true;
                    planeMaterial.update();

                    const plane = new pc.Entity();
                    plane.addComponent('render', {
                        type: 'plane',
                        material: planeMaterial
                    });
                    plane.setLocalScale(new pc.Vec3(100, 0, 100));
                    plane.setLocalPosition(0, -1.0, 0);
                    app.root.addChild(plane);

                    data.set('script', {
                        cycle: true,
                        animate: true,
                        area: {
                            enabled: true,
                            intensity: 16.0,
                            size: 2,
                            shadowType: pc.SHADOW_PCSS
                        },
                        point: {
                            enabled: true,
                            intensity: 4.0,
                            size: 2,
                            shadowType: pc.SHADOW_PCSS
                        },
                        directional: {
                            enabled: true,
                            intensity: 2.0,
                            size: 1,
                            shadowType: pc.SHADOW_PCSS
                        }
                    });

                    const occluder = assets.asset.resource.instantiateRenderEntity();
                    app.root.addChild(occluder);

                    app.scene.envAtlas = assets.helipad.resource;

                    const areaLight = new pc.Entity();
                    areaLight.addComponent("light", {
                        type: "spot",
                        shape: pc.LIGHTSHAPE_RECT,
                        color: new pc.Color(0.25, 1, 0.25),
                        castShadows: true,
                        range: 150,
                        shadowResolution: 2048,
                        shadowDistance: 100,
                        penumbraSize: data.get('script.area.size'),
                        shadowType: data.get('script.area.shadowType'),
                        intensity: data.get('script.area.intensity'),
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
                    brightMaterial.emissive = areaLight.light.color;
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
                        color: new pc.Color(1, 1, 1),
                        castShadows: true,
                        numCascades: 1,
                        penumbraSize: data.get('script.directional.size'),
                        shadowType: data.get('script.directional.shadowType'),
                        intensity: data.get('script.directional.intensity'),
                        shadowBias: 0.5,
                        shadowDistance: 50,
                        normalOffsetBias: 0.1,
                        shadowResolution: 2048
                    });
                    directionalLight.setEulerAngles(65, 35, 0);
                    app.root.addChild(directionalLight);

                    const lightOmni = new pc.Entity("Omni");
                    lightOmni.addComponent("light", {
                        type: "omni",
                        color: new pc.Color(1, 0.25, 0.25),
                        range: 25,
                        penumbraSize: data.get('script.point.size'),
                        shadowType: data.get('script.point.shadowType'),
                        intensity: data.get('script.point.intensity'),
                        castShadows: true,
                        shadowBias: 0.2,
                        normalOffsetBias: 0.2,
                        shadowResolution: 2048
                    });
                    lightOmni.setLocalPosition(-4, 7, 0);

                    const omniMaterial = new pc.StandardMaterial();
                    omniMaterial.emissive = lightOmni.light.color;
                    omniMaterial.emissiveIntensity = lightOmni.light.intensity;
                    omniMaterial.useLighting = false;
                    omniMaterial.cull = pc.CULLFACE_NONE;
                    omniMaterial.update();

                    const omniShape = new pc.Entity();
                    omniShape.addComponent("render", {
                        type: "sphere",
                        material: omniMaterial,
                        castShadows: false
                    });
                    omniShape.setLocalScale(0.2, 0.2, 0.2);
                    lightOmni.addChild(omniShape);
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
                            distanceMax: 500,
                            frameOnStart: false
                        }
                    });
                    camera.script.create("orbitCameraInputMouse");
                    camera.script.create("orbitCameraInputTouch");
                    app.root.addChild(camera);

                    data.on('*:set', (path: string, value: any) => {
                        switch (path) {
                            case 'script.area.enabled':
                                areaLight.enabled = value;
                                break;
                            case 'script.area.intensity':
                                areaLight.light.intensity = value;
                                brightMaterial.emissiveIntensity = value;
                                brightMaterial.update();
                                break;
                            case 'script.area.size':
                                areaLight.light.penumbraSize = value;
                                break;
                            case 'script.area.shadowType':
                                areaLight.light.shadowType = parseInt(value);
                                break;
                            case 'script.directional.enabled':
                                directionalLight.enabled = value;
                                break;
                            case 'script.directional.intensity':
                                directionalLight.light.intensity = value;
                                break;
                            case 'script.directional.size':
                                directionalLight.light.penumbraSize = value;
                                break;
                            case 'script.directional.shadowType':
                                directionalLight.light.shadowType = parseInt(value);
                                break;
                            case 'script.point.enabled':
                                lightOmni.enabled = value;
                                break;
                            case 'script.point.intensity':
                                lightOmni.light.intensity = value;
                                break;
                            case 'script.point.size':
                                lightOmni.light.penumbraSize = value;
                                break;
                            case 'script.point.shadowType':
                                lightOmni.light.shadowType = parseInt(value);
                                break;
                        }
                    });

                    const areaLightElement = window.top.document.getElementById('area-light');
                    const pointLightElement = window.top.document.getElementById('point-light');
                    const directionalLightElement = window.top.document.getElementById('directional-light');

                    let resizeControlPanel = true;
                    let time = 0;
                    let timeDiff = 0;
                    let index = 0;
                    app.on("update", function (dt) {

                        if (time === 0) {
                            // @ts-ignore engine-tsd
                            camera.script.orbitCamera.distance = 25;
                        }
                        timeDiff += dt;

                        if (data.get('script.cycle')) {
                            if ((timeDiff / 5) > 1) {
                                index = (index + 1) % 3;
                                timeDiff = 0;
                            }
                            areaLight.enabled = index === 0;
                            directionalLight.enabled = index === 1;
                            lightOmni.enabled = index === 2;

                            areaLightElement.ui.enabled = false;
                            pointLightElement.ui.enabled = false;
                            directionalLightElement.ui.enabled = false;
                        } else {
                            areaLightElement.ui.enabled = true;
                            pointLightElement.ui.enabled = true;
                            directionalLightElement.ui.enabled = true;

                            areaLight.enabled = data.get('script.area.enabled');
                            directionalLight.enabled = data.get('script.directional.enabled');
                            lightOmni.enabled = data.get('script.point.enabled');
                        }

                        if (data.get('script.animate')) {
                            time += dt;
                            const x = Math.sin(time * 0.2);
                            const z = Math.cos(time * 0.2);
                            lightOmni.setLocalPosition(x * 4, 5, z * 4);
                            directionalLight.setEulerAngles(65, 35 + (time * 2), 0);
                            areaLight.setEulerAngles(45, 180 + time * 0.2 * 180.0 / Math.PI, 0);
                            areaLight.setLocalPosition(-x * 4, 7, -z * 4);
                        }

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
}

export default ContactHardeningShadowsExample;
