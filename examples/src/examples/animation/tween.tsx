import React from 'react';
import * as pc from '../../../../';
import { ScriptLoader } from '../../app/helpers/loader';

class TweenExample {
    static CATEGORY = 'Animation';
    static NAME = 'Tween';
    static WEBGPU_ENABLED = true;

    load() {
        return <>
            <ScriptLoader name='TWEEN' url='https://cdnjs.cloudflare.com/ajax/libs/tween.js/18.6.4/tween.umd.js' />
        </>;
    }

    example(canvas: HTMLCanvasElement, deviceType: string): void {

        const assets = {
            'font': new pc.Asset('font', 'font', { url: '/static/assets/fonts/arial.json' }),
            'script': new pc.Asset('script', 'script', { url: '/static/scripts/animation/tween.js' })
        };

        const gfxOptions = {
            deviceTypes: [deviceType],
            glslangUrl: '/static/lib/glslang/glslang.js',
            twgslUrl: '/static/lib/twgsl/twgsl.js'
        };

        pc.createGraphicsDevice(canvas, gfxOptions).then((device: pc.GraphicsDevice) => {

            const createOptions = new pc.AppOptions();
            createOptions.graphicsDevice = device;

            createOptions.componentSystems = [
                // @ts-ignore
                pc.RenderComponentSystem,
                // @ts-ignore
                pc.CameraComponentSystem,
                // @ts-ignore
                pc.LightComponentSystem,
                // @ts-ignore
                pc.ScriptComponentSystem,
                // @ts-ignore
                pc.ElementComponentSystem
            ];
            createOptions.resourceHandlers = [
                // @ts-ignore
                pc.TextureHandler,
                // @ts-ignore
                pc.FontHandler,
                // @ts-ignore
                pc.JsonHandler,
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

                // Utility function to create a text element-based entity
                const createText = function (fontAsset: pc.Asset, message: string, x: number, y: number, z: number, rot: number) {
                    const text = new pc.Entity();
                    text.addComponent("element", {
                        anchor: [0.5, 0.5, 0.5, 0.5],
                        fontAsset: fontAsset,
                        fontSize: 0.5,
                        pivot: [1, 0.5],
                        text: message,
                        type: pc.ELEMENTTYPE_TEXT
                    });
                    text.setLocalPosition(x, y, z);
                    text.setLocalEulerAngles(0, 0, rot);
                    app.root.addChild(text);
                };

                const easingFunctions = [
                    'Linear',
                    'Quadratic',
                    'Cubic',
                    'Quartic',
                    'Quintic',
                    'Sinusoidal',
                    'Exponential',
                    'Circular',
                    'Elastic',
                    'Back',
                    'Bounce'
                ];
                const points: Array<pc.Vec3> = [];
                const colors: Array<pc.Color> = [];

                for (let i = 0; i < easingFunctions.length; i++) {
                    // Create an entity with a sphere render component
                    const sphere = new pc.Entity();

                    sphere.addComponent("render", {
                        type: "sphere"
                    });
                    const material = sphere.render.material as pc.StandardMaterial;
                    material.diffuse.set(1, 0, 0);
                    material.specular.set(0.6, 0.6, 0.6);
                    material.gloss = 0.2;

                    sphere.addComponent("script");
                    sphere.script.create("tween", {
                        attributes: {
                            tweens: [{
                                autoPlay: true, // Start this tween immediately
                                delay: 0, // No delay on start
                                duration: 1500, // 2 seconds
                                easingFunction: i,
                                easingType: 2, // InOut type
                                end: new pc.Vec4(4, -i, 0, 0),
                                path: 'localPosition', // Update the entity's local position
                                repeat: -1, // Repeat infinitely
                                repeatDelay: 0, // No delay between repeats
                                start: new pc.Vec4(0, -i, 0, 0),
                                yoyo: true // Ping pong between start and end values
                            }]
                        }
                    });

                    sphere.setLocalScale(0.8, 0.8, 0.8);
                    app.root.addChild(sphere);

                    // Add a line for the path of the sphere
                    points.push(new pc.Vec3(0, -i, 0), new pc.Vec3(4, -i, 0));
                    colors.push(pc.Color.WHITE, pc.Color.WHITE);

                    // Create a text label for the sphere
                    createText(assets.font, easingFunctions[i], -0.5, -i, 0, 0);
                }

                // Create an entity with a directional light component
                const light = new pc.Entity();
                light.addComponent("light", {
                    type: "directional"
                });
                light.setLocalEulerAngles(70, 30, 0);
                app.root.addChild(light);

                // Create an entity with a camera component
                const camera = new pc.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc.Color(0.4, 0.45, 0.5)
                });
                camera.translate(0.65, -5.5, 20);
                app.root.addChild(camera);

                app.on('update', function () {
                    app.drawLines(points, colors);
                });
            });
        });
    }
}

export default TweenExample;
