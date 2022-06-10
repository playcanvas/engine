import React from 'react';
import * as pc from '../../../../';

import { BindingTwoWay } from '@playcanvas/pcui';
import { BooleanInput, LabelGroup, Panel, SliderInput } from '@playcanvas/pcui/react';
import { Observer } from '@playcanvas/observer';

class HdrExample {
    static CATEGORY = 'Graphics';
    static NAME = 'HDR';


    controls(data: Observer) {
        return <>
            <Panel headerText='BLOOM'>
                <LabelGroup text='enabled'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'scripts.bloom.enabled' }}/>
                </LabelGroup>
                <LabelGroup text='intensity'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'scripts.bloom.bloomIntensity' }}/>
                </LabelGroup>
                <LabelGroup text='threshold'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'scripts.bloom.bloomThreshold' }}/>
                </LabelGroup>
                <LabelGroup text='blur amount'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'scripts.bloom.blurAmount' }} min={1} max={30}/>
                </LabelGroup>
            </Panel>
        </>;
    }

    example(canvas: HTMLCanvasElement, data: any): void {

        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body)
        });

        const assets = {
            'script': new pc.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
            'bloom': new pc.Asset('bloom', 'script', { url: '/static/scripts/posteffects/posteffect-bloom.js' }),
            'batmobile': new pc.Asset('batmobile', 'container', { url: '/static/assets/models/batmobile-armored.glb' }),
            'helipad.dds': new pc.Asset('helipad.dds', 'cubemap', { url: '/static/assets/cubemaps/helipad.dds' }, { type: pc.TEXTURETYPE_RGBM })
        };

        const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
        assetListLoader.load(() => {
            app.start();

            // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
            app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc.RESOLUTION_AUTO);

            // setup skydome
            app.scene.setSkybox(assets['helipad.dds'].resources);
            app.scene.skyboxMip = 2;
            app.scene.exposure = 5;

            app.scene.toneMapping = pc.TONEMAP_LINEAR;
            app.scene.gammaCorrection = pc.GAMMA_NONE;

            const skyboxLayer = app.scene.layers.getLayerByName("Skybox");
            skyboxLayer.enabled = false;


            // batmobile
            const batmobileEntity: pc.Entity = assets.batmobile.resource.instantiateRenderEntity();
            batmobileEntity.rotateLocal(0, 0, 90);
            app.root.addChild(batmobileEntity);


            // add an omni light as a child of this sphere
            const light = new pc.Entity();
            light.addComponent("light", {
                type: "omni",
                color: pc.Color.WHITE,
                intensity: 4,
                range: 100,
                castShadows: false
            });

            // Create an Entity with a camera component, and attach postprocessing effects scripts on it
            const camera: any = new pc.Entity();
            camera.addComponent("camera", {
                clearColor: new pc.Color(0.1, 0.1, 0.1),
                farClip: 500
            });
            camera.addComponent("script");

            camera.script.create("bloom", {
                attributes: {
                    bloomIntensity: 1.5,
                    bloomThreshold: 0.8,
                    blurAmount: 30
                }
            });


            camera.script.create("orbitCamera", {
                attributes: {
                    inertiaFactor: 0.2,
                    focusEntity: batmobileEntity,
                    distanceMax: 20
                }
            });
            camera.script.create("orbitCameraInputMouse");
            camera.script.create("orbitCameraInputTouch");

            // position the camera in the world
            camera.setLocalPosition(10, 5, 10);
            camera.lookAt(0, 0, 0);
            app.root.addChild(camera);


            // update things every frame
            let angle = 0;
            app.on("update", function (dt: any) {
                angle += dt;

                // rotate the skydome
//                app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, angle * 20, 0);
            });

            data.on('*:set', (path: string, value: any) => {
                const pathArray = path.split('.');
                if (pathArray[0] === 'scripts') {
                    camera.script[pathArray[1]][pathArray[2]] = value;
                }
            });
        });
    }
}

export default HdrExample;
