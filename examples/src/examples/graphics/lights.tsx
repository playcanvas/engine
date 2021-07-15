import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';
import { AssetLoader } from '../../app/helpers/loader';
// @ts-ignore: library file import
import { Panel, SliderInput, LabelGroup, BooleanInput } from '@playcanvas/pcui/pcui-react';
// @ts-ignore: library file import
import { BindingTwoWay, Observer } from '@playcanvas/pcui/pcui-binding';

class LightsExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Lights';

    load() {
        return <>
            <AssetLoader name='statue' type='container' url='static/assets/models/statue.glb' />
            <AssetLoader name="heart" type="texture" url="static/assets/textures/heart.png" />
        </>;
    }

    // @ts-ignore: override class function
    controls(data: Observer) {
        return <>
            <Panel headerText='OMNI LIGHT [KEY_1]'>
                <LabelGroup text='enabled'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'lights.omni.enabled' }}/>
                </LabelGroup>
                <LabelGroup text='intensity'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'lights.omni.intensity' }}/>
                </LabelGroup>
            </Panel>
            <Panel headerText='SPOT LIGHT [KEY_2]'>
                <LabelGroup text='enabled'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'lights.spot.enabled' }}/>
                </LabelGroup>
                <LabelGroup text='intensity'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'lights.spot.intensity' }}/>
                </LabelGroup>
            </Panel>
            <Panel headerText='DIRECTIONAL LIGHT [KEY_3]'>
                <LabelGroup text='enabled'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'lights.directional.enabled' }}/>
                </LabelGroup>
                <LabelGroup text='intensity'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'lights.directional.intensity' }}/>
                </LabelGroup>
            </Panel>
        </>;
    }

    // @ts-ignore: override class function$
    example(canvas: HTMLCanvasElement, assets: any, data:any): void {
        function createMaterial(colors: any) {
            const material: any = new pc.StandardMaterial();
            for (const param in colors) {
                material[param] = colors[param];
            }
            material.update();
            return material;
        }

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {
            keyboard: new pc.Keyboard(window)
        });
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        app.scene.ambientLight = new pc.Color(0.4, 0.4, 0.4);

        // create an entity with the statue
        const entity = assets.statue.resource.instantiateRenderEntity();

        app.root.addChild(entity);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });
        camera.translate(0, 15, 35);
        camera.rotate(-14, 0, 0);
        app.root.addChild(camera);

        // ground material
        const material = createMaterial({
            ambient: pc.Color.GRAY,
            diffuse: pc.Color.GRAY
        });

        // Create an Entity for the ground
        const ground = new pc.Entity();
        ground.addComponent("render", {
            type: "box",
            material: material
        });
        ground.setLocalScale(70, 1, 70);
        ground.setLocalPosition(0, -0.5, 0);
        app.root.addChild(ground);

        // setup light data

        data.set('lights', {
            spot: {
                enabled: true,
                intensity: 0.6
            },
            omni: {
                enabled: true,
                intensity: 0.6
            },
            directional: {
                enabled: true,
                intensity: 0.6
            }
        });

        const lights: {[key: string]: pc.Entity } = {};

        // Create an spot light
        lights.spot = new pc.Entity();
        lights.spot.addComponent("light", {
            ...{
                type: "spot",
                color: pc.Color.WHITE,
                innerConeAngle: 30,
                outerConeAngle: 31,
                range: 100,
                castShadows: true,
                shadowBias: 0.05,
                normalOffsetBias: 0.03,
                shadowResolution: 2048,
                // heart texture's alpha channel as a cookie texture
                cookie: assets.heart.resource,
                // cookie: assets.heart.asset.resource,
                cookieChannel: "a"
            },
            ...data.get('lights.spot')
        });

        const cone = new pc.Entity();
        cone.addComponent("render", {
            type: "cone",
            castShadows: false,
            material: createMaterial({ emissive: pc.Color.WHITE })
        });
        lights.spot.addChild(cone);
        app.root.addChild(lights.spot);

        // Create a omni light
        lights.omni = new pc.Entity();
        lights.omni.addComponent("light", {
            ...{
                type: "omni",
                color: pc.Color.YELLOW,
                castShadows: true,
                range: 100
            },
            ...data.get('lights.omni')
        });
        lights.omni.addComponent("render", {
            type: "sphere",
            castShadows: false,
            material: createMaterial({ diffuse: pc.Color.BLACK, emissive: pc.Color.YELLOW })
        });
        app.root.addChild(lights.omni);

        // Create a directional light
        lights.directional = new pc.Entity();
        lights.directional.addComponent("light", {
            ...{
                type: "directional",
                color: pc.Color.CYAN,
                range: 100,
                castShadows: true,
                shadowBias: 0.1,
                normalOffsetBias: 0.2
            },
            ...data.get('lights.directional')
        });
        app.root.addChild(lights.directional);

        // Allow user to toggle individual lights
        app.keyboard.on("keydown", function (e) {
            // if the user is editing an input field, ignore key presses
            if (e.element.constructor.name === 'HTMLInputElement') return;
            switch (e.key) {
                case pc.KEY_1:
                    data.set('lights.omni.enabled', !data.get('lights.omni.enabled'));
                    break;
                case pc.KEY_2:
                    data.set('lights.spot.enabled', !data.get('lights.spot.enabled'));
                    break;
                case pc.KEY_3:
                    data.set('lights.directional.enabled', !data.get('lights.directional.enabled'));
                    break;
            }
        }, this);

        // Simple update loop to rotate the light
        let angleRad = 1;
        app.on("update", function (dt) {
            angleRad += 0.3 * dt;
            if (entity) {

                lights.spot.lookAt(new pc.Vec3(0, -5, 0));
                lights.spot.rotateLocal(90, 0, 0);
                lights.spot.setLocalPosition(15 * Math.sin(angleRad), 25, 15 * Math.cos(angleRad));

                lights.omni.setLocalPosition(5 * Math.sin(-2 * angleRad), 10, 5 * Math.cos(-2 * angleRad));

                lights.directional.setLocalEulerAngles(45, -60 * angleRad, 0);
            }
        });

        data.on('*:set', (path: string, value: any) => {
            const pathArray = path.split('.');
            if (pathArray[2] === 'enabled') {
                lights[pathArray[1]].enabled = value;
            } else {
                // @ts-ignore
                lights[pathArray[1]][pathArray[2]] = value;
            }
        });
    }
}

export default LightsExample;
