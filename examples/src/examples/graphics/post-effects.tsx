import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';
// @ts-ignore: library file import
import { Panel, SliderInput, LabelGroup, BooleanInput } from '@playcanvas/pcui/pcui-react';
// @ts-ignore: library file import
import { BindingTwoWay, Observer } from '@playcanvas/pcui/pcui-binding';

class PostEffectsExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Post Effects';

    load() {
        return <>
            <AssetLoader name='bloom' type='script' url='static/scripts/posteffects/posteffect-bloom.js' />
            <AssetLoader name='bokeh' type='script' url='static/scripts/posteffects/posteffect-bokeh.js' />
            <AssetLoader name='sepia' type='script' url='static/scripts/posteffects/posteffect-sepia.js' />
            <AssetLoader name='vignette' type='script' url='static/scripts/posteffects/posteffect-vignette.js' />
            <AssetLoader name='ssao' type='script' url='static/scripts/posteffects/posteffect-ssao.js' />
            <AssetLoader name='font' type='font' url='static/assets/fonts/arial.json' />
            <AssetLoader name='helipad.dds' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
        </>;
    }

    // @ts-ignore: override class function
    controls(data: Observer) {
        return <>
            <Panel headerText='BLOOM [KEY_1]'>
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
            <Panel headerText='SEPIA [KEY_2]'>
                <LabelGroup text='enabled'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'scripts.sepia.enabled' }}/>
                </LabelGroup>
                <LabelGroup text='amount'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'scripts.sepia.amount' }}/>
                </LabelGroup>
            </Panel>
            <Panel headerText='VIGNETTE [KEY_3]'>
                <LabelGroup text='enabled'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'scripts.vignette.enabled' }}/>
                </LabelGroup>
                <LabelGroup text='darkness'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'scripts.vignette.darkness' }}/>
                </LabelGroup>
                <LabelGroup text='offset'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'scripts.vignette.offset' }} max={2}/>
                </LabelGroup>
            </Panel>
            <Panel headerText='BOKEH [KEY_4]'>
                <LabelGroup text='enabled'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'scripts.bokeh.enabled' }}/>
                </LabelGroup>
                <LabelGroup text='aperture'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'scripts.bokeh.aperture' }} max={0.2}/>
                </LabelGroup>
                <LabelGroup text='max blur'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'scripts.bokeh.maxBlur' }} max={0.1}/>
                </LabelGroup>
            </Panel>
            <Panel headerText='SSAO [KEY_5]'>
                <LabelGroup text='enabled'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'scripts.ssao.enabled' }}/>
                </LabelGroup>
                <LabelGroup text='radius'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'scripts.ssao.radius' }} max={10}/>
                </LabelGroup>
                <LabelGroup text='samples'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'scripts.ssao.samples' }} max={32}/>
                </LabelGroup>
                <LabelGroup text='brightness'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'scripts.ssao.brightness' }}/>
                </LabelGroup>
            </Panel>
            <Panel headerText='POST-PROCESS UI [KEY_6]'>
                <LabelGroup text='enabled'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'data.postProcessUI.enabled' }}/>
                </LabelGroup>
            </Panel>
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: any, data: any): void {
        const app = new pc.Application(canvas, {
            keyboard: new pc.Keyboard(window)
        });
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // setup skydome
        app.scene.setSkybox(assets['helipad.dds'].resources);
        app.scene.skyboxMip = 3;
        app.scene.exposure = 1.6;

        // helper function to create a 3d primitive including its material
        function createPrimitive(primitiveType: string, position: pc.Vec3, scale: pc.Vec3, brightness: number, allowEmissive = true) {

            // create a material
            const material = new pc.StandardMaterial();
            material.shininess = 40;
            material.metalness = 0.6;
            material.useMetalness = true;

            // random diffuse and emissive color
            material.diffuse = new pc.Color(brightness, brightness, brightness);
            if (allowEmissive && Math.random() < 0.15) {
                material.emissive = new pc.Color(Math.random(), Math.random(), Math.random());
            }
            material.update();

            // create the primitive using the material
            const primitive = new pc.Entity();
            primitive.addComponent('render', {
                type: primitiveType,
                material: material
            });

            // set position and scale and add it to scene
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);
            app.root.addChild(primitive);

            return primitive;
        }

        // create the ground plane from the boxes
        for (let x = -2; x <= 2; x += 0.5) {
            for (let z = 0; z <= 10; z += 0.5) {
                createPrimitive("box", new pc.Vec3(x * 40, -5, z * 40), new pc.Vec3(18, 2, 18), Math.random());
            }
        }

        // create the towers from the boxes
        let scale = 16;
        for (let y = 0; y <= 7; y++) {
            for (let x = -1; x <= 1; x += 2) {
                for (let z = 0; z <= 10; z += 2) {
                    const prim = createPrimitive("box", new pc.Vec3(x * 40, 2 + y * 10, z * 40), new pc.Vec3(scale, scale, scale), Math.random());
                    prim.setLocalEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360);
                }
            }
            scale -= 1.5;
        }

        // create a sphere which represents the point of focus for the bokeh filter
        const focusPrimitive = createPrimitive("sphere", pc.Vec3.ZERO, new pc.Vec3(10, 10, 10), 2.8, false);

        // add an omni light as a child of this sphere
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "omni",
            color: pc.Color.WHITE,
            intensity: 4,
            range: 100,
            castShadows: false
        });
        focusPrimitive.addChild(light);

        // Create an Entity with a camera component, and attach postprocessing effects scripts on it
        const camera: any = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5),
            farClip: 500
        });
        camera.addComponent("script");
        data.set('scripts', {
            ssao: {
                enabled: true,
                radius: 5,
                samples: 16,
                brightness: 0
            },
            bloom: {
                enabled: true,
                bloomIntensity: 0.8,
                bloomThreshold: 0.8,
                blurAmount: 15
            },
            sepia: {
                enabled: true,
                amount: 0.4
            },
            vignette: {
                enabled: true,
                darkness: 1,
                offset: 1.2
            },
            bokeh: {
                enabled: true,
                aperture: 0.1,
                maxBlur: 0.01
            }
        });

        Object.keys(data.get('scripts')).forEach((key) => {
            camera.script.create(key, {
                attributes: data.get(`scripts.${key}`)
            });
        });

        // position the camera in the world
        camera.setLocalPosition(0, 30, -60);
        camera.lookAt(0, 0, 100);
        app.root.addChild(camera);

        // Allow user to toggle individual post effects
        app.keyboard.on("keydown", function (e) {
            // if the user is editing an input field, ignore key presses
            if (e.element.constructor.name === 'HTMLInputElement') return;
            switch (e.key) {
                case pc.KEY_1:
                    data.set('scripts.bloom.enabled', !data.get('scripts.bloom.enabled'));
                    break;
                case pc.KEY_2:
                    data.set('scripts.sepia.enabled', !data.get('scripts.sepia.enabled'));
                    break;
                case pc.KEY_3:
                    data.set('scripts.vignette.enabled', !data.get('scripts.vignette.enabled'));
                    break;
                case pc.KEY_4:
                    data.set('scripts.bokeh.enabled', !data.get('scripts.bokeh.enabled'));
                    break;
                case pc.KEY_5:
                    data.set('scripts.ssao.enabled', !data.get('scripts.ssao.enabled'));
                    break;
                case pc.KEY_6:
                    data.set('data.postProcessUI.enabled', !data.get('data.postProcessUI.enabled'));
                    break;
            }
        }, this);

        // Create a 2D screen to place UI on
        const screen = new pc.Entity();
        screen.addComponent("screen", {
            referenceResolution: new pc.Vec2(1280, 720),
            scaleBlend: 0.5,
            scaleMode: pc.SCALEMODE_BLEND,
            screenSpace: true
        });
        app.root.addChild(screen);

        // create a text element to show which effects are enabled
        const text = new pc.Entity();
        text.addComponent("element", {
            anchor: new pc.Vec4(0.1, 0.1, 0.5, 0.5),
            fontAsset: assets.font,
            fontSize: 28,
            pivot: new pc.Vec2(0.5, 0.1),
            type: pc.ELEMENTTYPE_TEXT,
            alignment: pc.Vec2.ZERO
        });
        screen.addChild(text);

        // Display some UI text which the post processing can be tested against
        text.element.text = 'Test UI Text';

        // update things every frame
        let angle = 0;
        app.on("update", function (dt) {
            angle += dt;

            // rotate the skydome
            app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, angle * 20, 0);

            // move the focus sphere in the world closer and further away
            const focusPosition = new pc.Vec3(0, 10, Math.abs(Math.sin(angle * 0.1)) * 400);
            focusPrimitive.setPosition(focusPosition);

            // set the focus distance to the bokeh effect
            // - it's a negative distance between the camera and the focus sphere
            camera.script.bokeh.focus = -focusPosition.sub(camera.getPosition()).length();

            // display the depth textur if bokeh is enabled
            if (camera.script.bokeh.enabled) {
                // @ts-ignore engine-tsd
                app.renderDepthTexture(0.7, -0.7, 0.5, 0.5);
            }
        });

        data.on('*:set', (path: string, value: any) => {
            const pathArray = path.split('.');
            if (pathArray[0] === 'scripts') {
                camera.script[pathArray[1]][pathArray[2]] = value;
            } else {
                camera.camera.disablePostEffectsLayer = camera.camera.disablePostEffectsLayer === pc.LAYERID_UI ? undefined : pc.LAYERID_UI
            }
        });
    }
}

export default PostEffectsExample;
