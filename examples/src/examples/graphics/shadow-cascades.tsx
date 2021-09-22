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
        </>;
    }

    // @ts-ignore: override class function
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

    // @ts-ignore: override class function
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

        app.scene.ambientLight = new pc.Color(0.5, 0.5, 0.5);

        function createPrimitive(primitiveType: string, position: pc.Vec3, scale: pc.Vec3) {

            // create a material
            const material = new pc.StandardMaterial();

            if (primitiveType === "capsule") {
                material.diffuse = new pc.Color(Math.random(), Math.random(), Math.random());
                material.shininess = 70;
                material.metalness = 0.4;
                material.useMetalness = true;
            }
            material.update();

            // create the primitive using the material
            const primitive = new pc.Entity();
            primitive.addComponent('model', {
                type: primitiveType,
                material: material
            });

            // set position and scale and add it to scene
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);
            app.root.addChild(primitive);

            return primitive;
        }

        // create ground plane
        const limit = 200;
        const groundEntity = createPrimitive("plane", new pc.Vec3(0, 0, 0), new pc.Vec3(3 * limit, 3 * limit, 3 * limit));

        // populate it with capsules
        for (let x = -limit; x <= limit; x += 50) {
            for (let z = -limit; z <= limit; z += 50) {
                createPrimitive("capsule", new pc.Vec3(x, 15, z), new pc.Vec3(12, 22, 12));
            }
        }

        // create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.9, 0.9, 0.9),
            farClip: 1000
        });

        // and position it in the world
        camera.setLocalPosition(20, 30, 150);

        // add orbit camera script with a mouse and a touch support
        camera.addComponent("script");
        camera.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2,
                focusEntity: groundEntity,
                distanceMax: 330
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
        dirLight.setLocalEulerAngles(45, -20, 20);

        // handle HUD changes - update properties on the light
        data.on('*:set', (path: string, value: any) => {
            const pathArray = path.split('.');
            // @ts-ignore
            dirLight.light[pathArray[2]] = value;
        });
    }
}

export default ShadowCascadesExample;
