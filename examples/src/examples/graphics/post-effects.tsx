import React from 'react';
import * as pc from 'playcanvas';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class PostEffectsExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Post Effects';

    load() {
        return <>
            <AssetLoader name='bloom' type='script' url='static/scripts/posteffects/posteffect-bloom.js' />
            <AssetLoader name='bokeh' type='script' url='static/scripts/posteffects/posteffect-bokeh.js' />
            <AssetLoader name='sepia' type='script' url='static/scripts/posteffects/posteffect-sepia.js' />
            <AssetLoader name='vignette' type='script' url='static/scripts/posteffects/posteffect-vignette.js' />
            <AssetLoader name='statue' type='container' url='static/assets/models/statue.glb' />
            <AssetLoader name='font' type='font' url='static/assets/fonts/arial.json' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: any): void {
        const app = new pc.Application(canvas, {
            keyboard: new pc.Keyboard(window)
        });
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        function createMaterial(colors: pc.Color[]) {
            const material = new pc.StandardMaterial();
            for (const param in colors) {
                // @ts-ignore engine-tsd
                material[param] = colors[param];
            }
            material.update();
            return material;
        }

        app.scene.ambientLight = new pc.Color(0.4, 0.4, 0.4);

        // Generate some materials to assign to scene objects
        const gray = createMaterial({
            // @ts-ignore engine-tsd
            ambient: new pc.Color(0.1, 0.1, 0.1),
            diffuse: new pc.Color(0.5, 0.5, 0.5)
        });
        const white = createMaterial({
            // @ts-ignore engine-tsd
            emissive: new pc.Color(1, 1, 1)
        });
        const blue = createMaterial({
            // @ts-ignore engine-tsd
            diffuse: new pc.Color(0, 0, 0),
            emissive: new pc.Color(0, 0, 1)
        });

        const entity = assets.statue.resource.instantiateRenderEntity({
            castShadows: true
        });
        app.root.addChild(entity);

        // Create an Entity with a camera component
        const camera: any = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5),
            farClip: 50
        });
        camera.addComponent("script");
        camera.script.create("bloom", {
            attributes: {
                bloomIntensity: 1,
                bloomThreshold: 0.1,
                blurAmount: 4
            }
        });
        camera.script.create("sepia", {
            attributes: {
                amount: 0.7
            }
        });
        camera.script.create("vignette", {
            attributes: {
                darkness: 2,
                offset: 1
            }
        });
        camera.script.create("bokeh", {
            attributes: {
                aperture: 1,
                maxBlur: 0.02
            }
        });

        camera.addComponent("script");
        camera.script.create("bloom", {
            attributes: {
                bloomIntensity: 1,
                bloomThreshold: 0.1,
                blurAmount: 4
            }
        });
        camera.script.create("sepia", {
            attributes: {
                amount: 0.7
            }
        });
        camera.script.create("vignette", {
            attributes: {
                darkness: 2,
                offset: 1
            }
        });
        camera.script.create("bokeh", {
            attributes: {
                aperture: 1,
                maxBlur: 0.02
            }
        });

        camera.translate(0, 7, 24);
        camera.rotate(0, 0, 0);

        // Create an Entity for the ground
        const ground = new pc.Entity();
        ground.addComponent("model", {
            type: "box"
        });
        ground.setLocalScale(50, 1, 50);
        ground.setLocalPosition(0, -0.5, 0);
        ground.model.material = gray;


        // Create an spot light
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "spot",
            color: new pc.Color(1, 1, 1),
            outerConeAngle: 60,
            innerConeAngle: 40,
            range: 100,
            intensity: 1,
            castShadows: true,
            shadowBias: 0.005,
            normalOffsetBias: 0.01,
            shadowResolution: 2048
        });

        const cone = new pc.Entity();
        cone.addComponent("model", {
            type: "cone"
        });
        cone.model.material = white;
        light.addChild(cone);

        // Create a point light
        const pointlight = new pc.Entity();
        pointlight.addComponent("light", {
            type: "point",
            color: new pc.Color(0, 0, 1),
            range: 100,
            intensity: 1
        });
        pointlight.addComponent("model", {
            type: "sphere"
        });
        pointlight.model.material = blue;

        // Add Entities into the scene hierarchy
        app.root.addChild(camera);
        app.root.addChild(light);
        app.root.addChild(pointlight);
        app.root.addChild(ground);

        // Allow user to toggle individual post effects
        app.keyboard.on("keydown", function (e) {
            switch (e.key) {
                case pc.KEY_1:
                    // @ts-ignore engine-tsd
                    camera.script.bloom.enabled = !camera.script.bloom.enabled;
                    break;
                case pc.KEY_2:
                    // @ts-ignore engine-tsd
                    camera.script.sepia.enabled = !camera.script.sepia.enabled;
                    break;
                case pc.KEY_3:
                    // @ts-ignore engine-tsd
                    camera.script.vignette.enabled = !camera.script.vignette.enabled;
                    break;
                case pc.KEY_4:
                    // @ts-ignore engine-tsd
                    camera.script.bokeh.enabled = !camera.script.bokeh.enabled;
                    break;
                case pc.KEY_5:
                    camera.camera.disablePostEffectsLayer = camera.camera.disablePostEffectsLayer === pc.LAYERID_UI ? undefined : pc.LAYERID_UI;
                    break;
            }
        }, this);

        // Simple update loop to rotate the light
        const radius = 20;
        const height = 5;
        let angle = 0;

        const pointRadius = 5;
        const pointHeight = 10;

        // Create a 2D screen
        const screen = new pc.Entity();
        screen.addComponent("screen", {
            referenceResolution: new pc.Vec2(1280, 720),
            scaleBlend: 0.5,
            scaleMode: pc.SCALEMODE_BLEND,
            screenSpace: true
        });

        app.root.addChild(screen);

        // create text to show which effects are enabled
        // Create a basic text element
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

        app.on("update", function (dt) {
            angle += 20 * dt;
            if (angle > 360) {
                angle -= 360;
            }
            if (entity) {
                light.lookAt(entity.getPosition());
                light.rotateLocal(90, 0, 0);
                light.setLocalPosition(radius * Math.sin(angle * pc.math.DEG_TO_RAD), height, radius * Math.cos(angle * pc.math.DEG_TO_RAD));

                pointlight.setLocalPosition(pointRadius * Math.sin(-2 * angle * pc.math.DEG_TO_RAD), pointHeight, pointRadius * Math.cos(-2 * angle * pc.math.DEG_TO_RAD));

                // @ts-ignore engine-tsd
                if (camera.script.bokeh) {
            // @ts-ignore engine-tsd
                    camera.script.bokeh.focus = light.getLocalPosition().z - camera.getLocalPosition().z;
                }
            }

            // update text showing which post effects are enabled
            if (text) {
                text.element.text = `[Key 1] Bloom: ${camera.script.bloom.enabled}
[Key 2] Sepia: ${camera.script.sepia.enabled}
[Key 3] Vignette: ${camera.script.vignette.enabled}
[Key 4] Bokeh: ${camera.script.bokeh.enabled}
[Key 5] Post-process UI: ${camera.camera.disablePostEffectsLayer !== pc.LAYERID_UI}`;
            }

            // display the depth texture
            if (camera.script.bokeh.enabled) {
                // @ts-ignore engine-tsd
                app.renderDepthTexture(0.6, 0.7, 0.6, 0.3);
            }
        });
    }
}

export default PostEffectsExample;
