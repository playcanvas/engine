import React from 'react';
import * as pc from '../../../../';

import { BindingTwoWay } from '@playcanvas/pcui';
import { BooleanInput, LabelGroup, Panel, SliderInput } from '@playcanvas/pcui/react';
import { Observer } from '@playcanvas/observer';
class PhysicalLightUnitsExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Physical Light Units';

    controls(data: Observer) {
        return <>
            <Panel headerText='Lights'>
                <LabelGroup text='Sun (lm/m2)'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.sun.luminance' }} min={0.0} max={100000.0}/>
                </LabelGroup>
                <LabelGroup text='Sky (lm/m2)'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.sky.luminance' }} min={0.0} max={100000.0}/>
                </LabelGroup>
                <LabelGroup text='Spot (lm)'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.spot.luminance' }} min={0.0} max={200000.0}/>
                </LabelGroup>
                <LabelGroup text='Spot aperture'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.spot.aperture' }} min={1.0} max={90.0}/>
                </LabelGroup>
                <LabelGroup text='Point (lm)'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.point.luminance' }} min={0.0} max={800000.0}/>
                </LabelGroup>
                <LabelGroup text='Rect (lm)'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.rect.luminance' }} min={0.0} max={800000.0}/>
                </LabelGroup>
            </Panel>
            <Panel headerText='Camera'>
                <LabelGroup text='Aperture (f-stop)'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.camera.aperture' }} min={1.0} max={16.0}/>
                </LabelGroup>
                <LabelGroup text='Shutter Speed (1/x)'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.camera.shutter' }} min={1.0} max={1000.0}/>
                </LabelGroup>
                <LabelGroup text='Sensitivity (ISO)'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.camera.sensitivity' }} min={100.0} max={1000.0}/>
                </LabelGroup>
                <LabelGroup text='Animate'>
                    <BooleanInput binding={new BindingTwoWay()} link={{ observer: data, path: 'script.camera.animate' }}/>
                </LabelGroup>

            </Panel>
        </>;
    }

    example(canvas: HTMLCanvasElement, data: any): void {

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {
            graphicsDeviceOptions: {
                alpha: true
            },
            mouse: new pc.Mouse(document.body),
            keyboard: new pc.Keyboard(document.body),
            touch: new pc.TouchDevice(document.body)
        });

        const assets = {
            orbitCamera: new pc.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
            helipad: new pc.Asset('helipad.dds', 'cubemap', { url: '/static/assets/cubemaps/helipad.dds' }, { type: pc.TEXTURETYPE_RGBM }),
            lights: new pc.Asset('lights', 'container', { url: '/static/assets/models/Lights.glb' }),
            sheen: new pc.Asset('sheen', 'container', { url: '/static/assets/models/SheenChair.glb' }),
            color: new pc.Asset('color', 'texture', { url: '/static/assets/textures/seaside-rocks01-color.jpg' }),
            normal: new pc.Asset('normal', 'texture', { url: '/static/assets/textures/seaside-rocks01-normal.jpg' }),
            gloss: new pc.Asset('gloss', 'texture', { url: '/static/assets/textures/seaside-rocks01-gloss.jpg' }),
            luts: new pc.Asset('luts', 'binary', { url: '/static/assets/binary/area-light-luts.bin' })
        };

        const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
        assetListLoader.load(() => {
            // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
            app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc.RESOLUTION_AUTO);

            app.start();

            app.scene.setSkybox(assets.helipad.resources);
            app.scene.toneMapping = pc.TONEMAP_ACES;
            app.scene.skyboxMip = 1;
            app.scene.physicalUnits = true;

            // set the loaded area light LUT data
            app.setAreaLightLuts(assets.luts);

            const sheen1 = assets.sheen.resource.instantiateRenderEntity({
                castShadows: true
            });
            sheen1.setLocalScale(new pc.Vec3(3, 3, 3));
            sheen1.setLocalPosition(7, -1.0, 0);
            app.root.addChild(sheen1);

            const sheen2 = assets.sheen.resource.instantiateRenderEntity({
                castShadows: true
            });
            sheen2.setLocalScale(new pc.Vec3(3, 3, 3));
            sheen2.setLocalPosition(4, -1.0, 0);
            assets.sheen.resource.applyMaterialVariant(sheen2, "Peacock Velvet");
            app.root.addChild(sheen2);

            const lights = assets.lights.resource.instantiateRenderEntity({
                castShadows: true
            });
            // enable all lights from the glb
            const lightComponents: Array<pc.LightComponent> = lights.findComponents("light");
            lightComponents.forEach((component) => {
                component.enabled = true;
            });
            lights.setLocalPosition(10, 0, 0);
            app.root.addChild(lights);

            const material = new pc.StandardMaterial();
            material.diffuseMap = assets.color.resource;
            material.normalMap = assets.normal.resource;
            material.glossMap = assets.gloss.resource;
            material.metalness = 0.7;
            material.shininess = 80;
            material.useMetalness = true;

            material.diffuseMapTiling.set(17, 17);
            material.normalMapTiling.set(17, 17);
            material.glossMapTiling.set(17, 17);
            material.update();

            const plane = new pc.Entity();
            plane.addComponent('model', {
                type: 'plane',
                material: material
            });
            plane.setLocalScale(new pc.Vec3(100, 0, 100));
            plane.setLocalPosition(0, -1.0, 0);
            app.root.addChild(plane);


            data.set('script', {
                sun: {
                    luminance: 100000
                },
                sky: {
                    luminance: 20000
                },
                spot: {
                    luminance: 200000,
                    aperture: 45
                },
                point: {
                    luminance: 100000
                },
                rect: {
                    luminance: 100000
                },
                camera: {
                    aperture: 16.0,
                    shutter: 1000,
                    sensitivity: 1000,
                    animate: false
                }
            });

            // Create an Entity with a camera component
            const camera = new pc.Entity();
            camera.addComponent("camera", {
                clearColor: new pc.Color(0.4, 0.45, 0.5),
                aperture: data.get('script.camera.aperture'),
                shutter: 1 / data.get('script.camera.shutter'),
                sensitivity: data.get('script.camera.sensitivity')
            });
            camera.setLocalPosition(0, 5, 30);

            camera.camera.requestSceneColorMap(true);
            camera.addComponent("script");
            camera.script.create("orbitCamera", {
                attributes: {
                    inertiaFactor: 0.2,
                    focusEntity: sheen1,
                    distanceMin: 1,
                    distanceMax: 400,
                    frameOnStart: false
                }
            });
            camera.script.create("orbitCameraInputMouse");
            camera.script.create("orbitCameraInputTouch");
            app.root.addChild(camera);

            app.scene.skyboxIntensity = data.get('script.sky.luminance');


            const directionalLight = new pc.Entity();
            directionalLight.addComponent("light", {
                type: "directional",
                color: pc.Color.WHITE,
                castShadows: true,
                luminance: data.get('script.sun.luminance'),
                shadowBias: 0.2,
                normalOffsetBias: 0.05,
                shadowResolution: 2048
            });
            directionalLight.setEulerAngles(45, 35, 0);
            app.root.addChild(directionalLight);

            const pointLight = new pc.Entity();
            pointLight.addComponent("light", {
                type: "point",
                color: pc.Color.WHITE,
                castShadows: false,
                luminance: data.get('script.point.luminance'),
                shadowBias: 0.2,
                normalOffsetBias: 0.05,
                shadowResolution: 2048
            });
            pointLight.setLocalPosition(0, 5, 0);
            app.root.addChild(pointLight);

            const spotLight = new pc.Entity();
            spotLight.addComponent("light", {
                type: "spot",
                color: pc.Color.WHITE,
                castShadows: false,
                luminance: data.get('script.spot.luminance'),
                shadowBias: 0.2,
                normalOffsetBias: 0.05,
                shadowResolution: 2048,
                outerConeAngle: data.get('script.spot.aperture'),
                innerConeAngle: 0
            });
            spotLight.setEulerAngles(0, 0, 0);
            spotLight.setLocalPosition(10, 5, 5);
            app.root.addChild(spotLight);

            const areaLight = new pc.Entity();
            areaLight.addComponent("light", {
                type: "spot",
                shape: pc.LIGHTSHAPE_RECT,
                color: pc.Color.WHITE,
                range: 9999,
                luminance: data.get('script.rect.luminance'),
                falloffMode: pc.LIGHTFALLOFF_INVERSESQUARED,
                innerConeAngle: 80,
                outerConeAngle: 85,
                normalOffsetBias: 0.1
            });
            areaLight.setLocalScale(2, 2, 2);
            areaLight.setEulerAngles(90, 180, 0);
            areaLight.setLocalPosition(5, 0, -5);

            // emissive material that is the light source color
            const brightMaterial = new pc.StandardMaterial();
            brightMaterial.emissive = pc.Color.WHITE;
            brightMaterial.emissiveIntensity = areaLight.light.luminance;
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

            data.on('*:set', (path: string, value: any) => {
                if (path === 'script.sun.luminance') {
                    directionalLight.light.luminance = value;
                } else if (path === 'script.sky.luminance') {
                    app.scene.skyboxIntensity = value;
                } else if (path === 'script.spot.luminance') {
                    spotLight.light.luminance = value;
                } else if (path === 'script.spot.aperture') {
                    spotLight.light.outerConeAngle = value;
                } else if (path === 'script.point.luminance') {
                    pointLight.light.luminance = value;
                } else if (path === 'script.rect.luminance') {
                    areaLight.light.luminance = value;
                    brightMaterial.emissiveIntensity = value;
                    brightMaterial.update();
                } else if (path === 'script.camera.aperture') {
                    camera.camera.aperture = value;
                } else if (path === 'script.camera.shutter') {
                    camera.camera.shutter = 1 / value;
                } else if (path === 'script.camera.sensitivity') {
                    camera.camera.sensitivity = value;
                }
            });

            let time = 0;
            app.on("update", function (dt) {
                time += dt;
                if (data.get('script.camera.animate')) {
                    data.set('script.camera.aperture', 3 + (1 + Math.sin(time)) * 5.0);
                }
            });
        });
    }
}

export default PhysicalLightUnitsExample;
