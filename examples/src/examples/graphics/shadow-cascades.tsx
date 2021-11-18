import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';
// @ts-ignore: library file import
import Panel from '@playcanvas/pcui/Panel/component';
// @ts-ignore: library file import
import SliderInput from '@playcanvas/pcui/SliderInput/component';
// @ts-ignore: library file import
import LabelGroup from '@playcanvas/pcui/LabelGroup/component';
// @ts-ignore: library file import
import BindingTwoWay from '@playcanvas/pcui/BindingTwoWay';
// @ts-ignore: library file import
import SelectInput from '@playcanvas/pcui/SelectInput/component';
// @ts-ignore: library file import
import { Observer } from '@playcanvas/observer';

class ShadowCascadesExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Shadow Cascades';

    load() {
        return <>
            <AssetLoader name='script' type='script' url='static/scripts/camera/orbit-camera.js' />
            <AssetLoader name='terrain' type='container' url='static/assets/models/terrain.glb' />
            <AssetLoader name='helipad' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
        </>;
    }

    controls(data: Observer) {
        return <>
            <Panel headerText='Shadow Cascade Settings'>
                {<LabelGroup text='Filtering'>
                    <SelectInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.light.shadowType' }} type="number" options={[
                        { v: 0, t: 'PCF3' },
                        { v: 1, t: 'VSM8' },
                        { v: 2, t: 'VSM16' },
                        { v: 3, t: 'VSM32' },
                        { v: 4, t: 'PCF5' }
                    ]} />
                </LabelGroup>}
                <LabelGroup text='Count'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.light.numCascades' }} min={1} max={4} precision={0}/>
                </LabelGroup>
                <LabelGroup text='Resolution'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.light.shadowResolution' }} min={128} max={2048} precision={0}/>
                </LabelGroup>
                <LabelGroup text='Distribution'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.light.cascadeDistribution' }} min={0} max={1} precision={2}/>
                </LabelGroup>
                <LabelGroup text='VSM Blur'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.light.vsmBlurSize' }} min={1} max={25} precision={0}/>
                </LabelGroup>
            </Panel>
        </>;
    }

    example(canvas: HTMLCanvasElement, assets: any, data:any): void {

        const app = new pc.Application(canvas, {});
        app.start();

        data.set('settings', {
            light: {
                numCascades: 4,             // number of cascades
                shadowResolution: 2048,     // shadow map resolution storing 4 cascades
                cascadeDistribution: 0.5,   // distribution of cascade distances to prefer sharpness closer to the camera
                shadowType: pc.SHADOW_PCF3, // shadow filter type
                vsmBlurSize: 11             // shader filter blur size for VSM shadows
            }
        });

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        window.addEventListener("resize", function () {
            app.resizeCanvas(canvas.width, canvas.height);
        });

        // setup skydome
        app.scene.skyboxMip = 3;
        app.scene.setSkybox(assets.helipad.resources);
        app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, -70, 0);
        app.scene.gammaCorrection = pc.GAMMA_SRGB;
        app.scene.toneMapping = pc.TONEMAP_ACES;

        // instantiate the terrain
        const terrain = assets.terrain.resource.instantiateRenderEntity();
        terrain.setLocalScale(30, 30, 30);
        app.root.addChild(terrain);

        // find a tree in the middle to use as a focus point
        const tree = terrain.findOne("name", "Arbol 2.002");

        // create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.9, 0.9, 0.9),
            farClip: 1000
        });

        // and position it in the world
        camera.setLocalPosition(300, 60, 25);

        // add orbit camera script with a mouse and a touch support
        camera.addComponent("script");
        camera.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2,
                focusEntity: tree,
                distanceMax: 600
            }
        });
        camera.script.create("orbitCameraInputMouse");
        camera.script.create("orbitCameraInputTouch");
        app.root.addChild(camera);

        // Create a directional light casting cascaded shadows
        const dirLight = new pc.Entity();
        dirLight.addComponent("light", {
            ...{
                type: "directional",
                color: pc.Color.WHITE,
                shadowBias: 0.3,
                normalOffsetBias: 0.2,
                intensity: 1.0,

                // enable shadow casting
                castShadows: true,
                shadowDistance: 1000
            },
            ...data.get('settings.light')
        });
        app.root.addChild(dirLight);
        dirLight.setLocalEulerAngles(45, 350, 20);

        // handle HUD changes - update properties on the light
        data.on('*:set', (path: string, value: any) => {
            const pathArray = path.split('.');
            // @ts-ignore
            dirLight.light[pathArray[2]] = value;
        });

        // on the first frame, when camera is updated, move it further away from the focus tree
        let firstFrame = true;
        app.on("update", function (dt) {
            if (firstFrame) {
                firstFrame = false;
                // @ts-ignore engine-tsd
                camera.script.orbitCamera.distance = 320;
            }
        });
    }
}

export default ShadowCascadesExample;
