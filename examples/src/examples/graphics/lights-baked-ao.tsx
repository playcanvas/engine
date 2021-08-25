import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';
// @ts-ignore: library file import
import { Panel, SliderInput, LabelGroup, BooleanInput, Label } from '@playcanvas/pcui/pcui-react';
// @ts-ignore: library file import
import { BindingTwoWay, Observer } from '@playcanvas/pcui/pcui-binding';

class LightsBakedAOExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Lights Baked AO';
    static HIDDEN = false;

    load() {
        return <>
            <AssetLoader name='cubemap' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
        </>;
    }

    // @ts-ignore: override class function
    controls(data: Observer) {
        return <>
            <Panel headerText='Lightmap Filter Settings'>
                <LabelGroup text='enable'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'data.settings.lightmapFilterEnabled' }} value={data.get('data.settings.lightmapFilterEnabled')}/>
                </LabelGroup>
                <LabelGroup text='range'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'data.settings.lightmapFilterRange' }}  value={data.get('data.settings.lightmapFilterRange')} min = {1} max = {20} precision = {0}/>
                </LabelGroup>
                <LabelGroup text='smoothness'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'data.settings.lightmapFilterSmoothness' }}  value={data.get('data.settings.lightmapFilterSmoothness')} min = {0.1} max = {2} precision = {1}/>
                </LabelGroup>
            </Panel>
            <Panel headerText='Ambient light'>
                <LabelGroup text='bake'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'data.ambient.ambientBake' }} value={data.get('data.ambient.ambientBake')}/>
                </LabelGroup>
                <LabelGroup text='cubemap'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'data.ambient.cubemap' }} value={data.get('data.ambient.cubemap')}/>
                </LabelGroup>
                <LabelGroup text='hemisphere'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'data.ambient.hemisphere' }} value={data.get('data.ambient.hemisphere')}/>
                </LabelGroup>
                <LabelGroup text='samples'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'data.ambient.ambientBakeNumSamples' }}  value={data.get('data.ambient.ambientBakeNumSamples')} max={64} precision={0}/>
                </LabelGroup>
                <LabelGroup text='contrast'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'data.ambient.ambientBakeOcclusionContrast' }}  value={data.get('data.ambient.ambientBakeOcclusionContrast')} min = {-1} max={1} precision={1}/>
                </LabelGroup>
                <LabelGroup text='brightness'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'data.ambient.ambientBakeOcclusionBrightness' }}  value={data.get('data.ambient.ambientBakeOcclusionBrightness')} min = {-1} max={1} precision={1}/>
                </LabelGroup>
            </Panel>
            <Panel headerText='Directional light'>
                <LabelGroup text='enable'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'data.directional.enabled' }} value={data.get('data.directional.enabled')}/>
                </LabelGroup>
                <LabelGroup text='bake'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'data.directional.bake' }} value={data.get('data.directional.bake')}/>
                </LabelGroup>
                <LabelGroup text='samples'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'data.directional.bakeNumSamples' }}  value={data.get('data.directional.bakeNumSamples')} max={64} precision={0}/>
                </LabelGroup>
                <LabelGroup text='area'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'data.directional.bakeArea' }}  value={data.get('data.directional.bakeArea')} max={40} precision={0}/>
                </LabelGroup>
            </Panel>
            <Panel headerText='Other lights'>
                <LabelGroup text='enable'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'data.other.enabled' }} value={data.get('data.other.enabled')}/>
                </LabelGroup>
            </Panel>
            <Panel headerText='Bake stats'>
                <LabelGroup text='duration'>
                    <Label binding={new BindingTwoWay()} link={{ observer: data, path: 'data.stats.duration' }} value={data.get('data.stats.duration')}/>
                </LabelGroup>
            </Panel>
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: any, data: any): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // bake properties connected to the HUD
        data.set('data', {
            settings: {
                lightmapFilterEnabled: true,
                lightmapFilterRange: 10,
                lightmapFilterSmoothness: 0.2
            },
            ambient: {
                ambientBake: true,
                cubemap: true,
                hemisphere: true,
                ambientBakeNumSamples: 20,
                ambientBakeOcclusionContrast: -0.2,
                ambientBakeOcclusionBrightness: 0.2
            },
            directional: {
                enabled: true,
                bake: true,
                bakeNumSamples: 15,
                bakeArea: 10
            },
            other: {
                enabled: true,
            },
            stats: {
                duration: ''
            }
        });

        // setup skydome - this is the main source of ambient light
        app.scene.skyboxMip = 3;
        app.scene.skyboxIntensity = 1;
        app.scene.setSkybox(assets.cubemap.resources);

        // if skydome cubemap is disabled using HUD, a constant ambient color is used instead
        app.scene.ambientLight = new pc.Color(0.1, 0.3, 0.4);

        // bake properties
        app.scene.ambientBake = data.get('data.ambient.ambientBake');
        app.scene.ambientBakeNumSamples = data.get('data.ambient.ambientBakeNumSamples');

        app.scene.lightmapFilterEnabled = data.get('data.settings.lightmapFilterEnabled');
        app.scene.lightmapFilterRange = data.get('data.settings.lightmapFilterRange');
        app.scene.lightmapFilterSmoothness = data.get('data.settings.lightmapFilterSmoothness');

        // create material used to render lightmapped objects
        const material = new pc.StandardMaterial();
        material.update();

        // create ground plane
        const ground = new pc.Entity("Ground");
        ground.addComponent('render', {
            castShadows: true,
            castShadowsLightmap: true,
            lightmapped: true,
            type: "box",
            material: material
        });
        app.root.addChild(ground);
        ground.setLocalScale(40, 1, 40);

        // create roof box
        const roof = new pc.Entity("Roof");
        roof.addComponent('render', {
            castShadows: true,
            castShadowsLightmap: true,
            lightmapped: true,
            type: "box",
            material: material
        });
        app.root.addChild(roof);
        roof.setLocalPosition(0, 6, -10);
        roof.setLocalScale(15, 1, 45);
        roof.setLocalEulerAngles(-30, 0, 0);

        // create large sphere
        const sphere = new pc.Entity("Ground");
        sphere.addComponent('render', {
            castShadows: true,
            castShadowsLightmap: true,
            lightmapped: true,
            type: "sphere",
            material: material
        });
        app.root.addChild(sphere);
        sphere.setLocalScale(12, 12, 12);
        sphere.setLocalPosition(3, 6.6, 5);

        // create random objects on the plane
        const shapes = ["box", "cone", "cylinder", "sphere"];
        for (let i = 0; i < 40; i++) {
            const shape = shapes[Math.floor(Math.random() * shapes.length)];

            // Create an entity with a render component that is set up to be lightmapped
            const entity = new pc.Entity("Primitive" + i);
            entity.addComponent('render', {
                castShadows: true,
                castShadowsLightmap: true,
                lightmapped: true,
                type: shape,
                material: material
            });
            app.root.addChild(entity);

            // random orientation
            const scale = 1 + Math.random() * 2;
            entity.setLocalScale(scale, scale, scale);
            entity.setLocalPosition(Math.random() * 30 - 15, scale + Math.random() * 2, Math.random() * 30 - 15);
            entity.setLocalEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360);
        }

        // directional light
        const lightDirectional = new pc.Entity("Directional");
        lightDirectional.addComponent("light", {
            type: "directional",
            affectDynamic: true,
            affectLightmapped: true,
            bake: data.get('data.directional.bake'),
            bakeArea: data.get('data.directional.bakeArea'),
            bakeNumSamples: data.get('data.directional.bakeNumSamples'),
            castShadows: true,
            normalOffsetBias: 0.05,
            shadowBias: 0.2,
            shadowDistance: 70,
            shadowResolution: 2048,
            shadowType: pc.SHADOW_PCF3,
            color: new pc.Color(0.7, 0.7, 0.5),
            intensity: 0.6
        });
        app.root.addChild(lightDirectional);
        lightDirectional.setLocalEulerAngles(0, 10, 0);

        // Create an entity with a omni light component that is configured as a baked light
        const lightOmni = new pc.Entity("Omni");
        lightOmni.addComponent("light", {
            type: "omni",
            affectDynamic: false,
            affectLightmapped: true,
            bake: true,
            castShadows: true,
            normalOffsetBias: 0.05,
            shadowBias: 0.2,
            shadowDistance: 50,
            shadowResolution: 512,
            shadowType: pc.SHADOW_PCF3,
            color: pc.Color.RED,
            range: 10,
            intensity: 0.7
        });
        lightOmni.setLocalPosition(-6, 5, 0);
        app.root.addChild(lightOmni);

        // Create an entity with a spot light component that is configured as a baked light
        const lightSpot = new pc.Entity("Spot");
        lightSpot.addComponent("light", {
            type: "spot",
            affectDynamic: false,
            affectLightmapped: true,
            bake: true,
            castShadows: true,
            normalOffsetBias: 0.05,
            shadowBias: 0.2,
            shadowDistance: 50,
            shadowResolution: 512,
            shadowType: pc.SHADOW_PCF3,
            color: pc.Color.BLUE,
            range: 10
        });
        lightSpot.setLocalPosition(5, 8, -3);
        app.root.addChild(lightSpot);

        // Create an entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5),
            farClip: 100,
            nearClip: 0.05
        });
        app.root.addChild(camera);

        // lightmap baking properties
        const bakeType = pc.BAKE_COLOR;
        app.scene.lightmapMode = bakeType;
        app.scene.lightmapMaxResolution = 1024;

        // multiplier for lightmap resolution
        app.scene.lightmapSizeMultiplier = 10;

        // Set an update function on the app's update event
        let time = 0;
        let needBake = true;
        app.on("update", function (dt) {
            time += dt;

            // bake lightmaps when HUD properties change
            if (needBake) {
                needBake = false;
                app.lightmapper.bake(null, bakeType);

                // update stats
                data.set('data.stats.duration', app.lightmapper.stats.totalRenderTime.toFixed(1) + 'ms');
            }

            // orbit camera
            camera.setLocalPosition(30 * Math.sin(time * 0.4), 12, 30);
            camera.lookAt(pc.Vec3.ZERO);
        });

        // handle data changes from HUD
        data.on('*:set', (path: string, value: any) => {
            const pathArray = path.split('.');

            needBake = true;

            // ambient light
            if (pathArray[1] === 'ambient') {
                if (pathArray[2] === 'cubemap') {
                    // enable / disable cubemap
                    app.scene.setSkybox(value ? assets.cubemap.resources : null);
                } else if (pathArray[2] === 'hemisphere') {
                    // switch between smaller hemosphere and full sphere
                    app.scene.ambientBakeSpherePart = value ? 0.4 : 1;
                } else {
                    // all other values
                    app.scene[pathArray[2]] = value;
                }
            } else if (pathArray[1] === 'directional') {
                if (pathArray[2] === 'bake') {
                    lightDirectional.light.bake = value;

                    // temporary workaround for incorrect handling of dirty flags to rebuild shaders when multiple compositions are used
                    // @ts-ignore
                    app.scene.updateLitShaders = true;
                } else {
                    lightDirectional.light[pathArray[2]] = value;
                }
            } else if (pathArray[1] === 'settings') {
                app.scene[pathArray[2]] = value;
            } else if (pathArray[1] === 'other') {
                lightOmni.light[pathArray[2]] = value;
                lightSpot.light[pathArray[2]] = value;
            } else {
                // don't rebake if stats change
                needBake = false;
            }
        });
    }
}

export default LightsBakedAOExample;
