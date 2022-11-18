import React from 'react';

import * as pc from '../../../../';
import { Panel, Button } from '@playcanvas/pcui/react';
import { Observer } from '@playcanvas/observer';

class AssetViewerExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Asset Viewer';

    controls(data: Observer) {
        return <>
            <Panel headerText='Asset'>
                <Button text='Previous' onClick={() => data.emit('previous')}/>
                <Button text='Next' onClick={() => data.emit('next')}/>
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
            dish: new pc.Asset('dish', 'container', { url: '/static/assets/models/IridescentDishWithOlives.glb' }),
            mosquito: new pc.Asset('mosquito', 'container', { url: '/static/assets/models/MosquitoInAmber.glb' }),
            sheen: new pc.Asset('sheen', 'container', { url: '/static/assets/models/SheenChair.glb' }),
            lamp: new pc.Asset('lamp', 'container', { url: '/static/assets/models/StainedGlassLamp.glb' }),
            font: new pc.Asset('font', 'font', { url: '/static/assets/fonts/arial.json' }),
            checkerboard: new pc.Asset('checkerboard', 'texture', { url: '/static/assets/textures/checkboard.png' })
        };

        const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
        assetListLoader.load(() => {

            // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
            app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc.RESOLUTION_AUTO);

            // Depth layer is where the framebuffer is copied to a texture to be used in the following layers.
            // Move the depth layer to take place after World and Skydome layers, to capture both of them.
            const depthLayer = app.scene.layers.getLayerById(pc.LAYERID_DEPTH);
            app.scene.layers.remove(depthLayer);
            app.scene.layers.insertOpaque(depthLayer, 2);

            const createText = function (fontAsset: pc.Asset, message: string, x: number, z: number) {
                // Create a text element-based entity
                const text = new pc.Entity();
                text.addComponent("element", {
                    anchor: [0.5, 0.5, 0.5, 0.5],
                    fontAsset: fontAsset,
                    fontSize: 0.2,
                    pivot: [0.5, 0.5],
                    text: message,
                    type: pc.ELEMENTTYPE_TEXT
                });
                text.setLocalPosition(x, -0.9, z);
                text.setLocalEulerAngles(-90, 0, 0);
                app.root.addChild(text);
            };

            app.start();
            let currentAssetIndex = 0;

            const mosquito = assets.mosquito.resource.instantiateRenderEntity({
                castShadows: true
            });
            mosquito.setLocalScale(new pc.Vec3(25, 25, 25));
            mosquito.setLocalPosition(0, 0.5, 0);
            app.root.addChild(mosquito);
            createText(assets.font, "KHR_materials_volume\nKHR_materials_ior\nKHR_materials_transmission", 0, 2);

            // create an entity with render assets
            const dish = assets.dish.resource.instantiateRenderEntity({
                castShadows: true
            });
            dish.setLocalScale(new pc.Vec3(9, 9, 9));
            dish.setLocalPosition(-4, -0.5, 0);
            app.root.addChild(dish);
            createText(assets.font, "KHR_materials_specular\nKHR_materials_volume\nKHR_materials_ior\nKHR_materials_transmission", -4, 2);

            const sheen1 = assets.sheen.resource.instantiateRenderEntity({
                castShadows: true
            });
            sheen1.setLocalScale(new pc.Vec3(4, 4, 4));
            sheen1.setLocalPosition(8, -1.0, 0);
            app.root.addChild(sheen1);
            createText(assets.font, "Mango Velvet", 8, 1);

            const sheen2 = assets.sheen.resource.instantiateRenderEntity({
                castShadows: true
            });
            sheen2.setLocalScale(new pc.Vec3(4, 4, 4));
            sheen2.setLocalPosition(4, -1.0, 0);
            assets.sheen.resource.applyMaterialVariant(sheen2, "Peacock Velvet");
            app.root.addChild(sheen2);
            createText(assets.font, "KHR_materials_sheen\nKHR_materials_variants", 5.5, 2);
            createText(assets.font, "Peacock Velvet", 4, 1);

            const lamp = assets.lamp.resource.instantiateRenderEntity({
                castShadows: true
            });
            lamp.setLocalScale(new pc.Vec3(5, 5, 5));
            lamp.setLocalPosition(-8, -1.0, 0);
            createText(assets.font, "Lamp on", -8, 1);
            app.root.addChild(lamp);

            const lamp2 = assets.lamp.resource.instantiateRenderEntity({
                castShadows: true
            });
            lamp2.setLocalScale(new pc.Vec3(5, 5, 5));
            lamp2.setLocalPosition(-11, -1.0, 0);
            assets.lamp.resource.applyMaterialVariant(lamp2, "Lamp off");
            app.root.addChild(lamp2);
            createText(assets.font, "Lamp off", -11, 1);
            createText(assets.font, "KHR_materials_transmission\nKHR_materials_ior\nKHR_materials_volume\nKHR_materials_variants\nKHR_materials_clearcoat", -9.5, 2);

            const assetList = [
                lamp2, lamp, dish, mosquito, sheen2, sheen1
            ];

            const material = new pc.StandardMaterial();
            material.diffuseMap = assets.checkerboard.resource;
            material.diffuseMapTiling = new pc.Vec2(16, 6);
            material.update();
            const plane = new pc.Entity();
            plane.addComponent('model', {
                type: 'plane',
                material: material
            });
            plane.setLocalScale(new pc.Vec3(25, 0, 10));
            plane.setLocalPosition(0, -1.0, 0);
            app.root.addChild(plane);

            // Create an Entity with a camera component
            const camera = new pc.Entity();
            camera.addComponent("camera", {
            });
            camera.setLocalPosition(0, 55, 160);

            camera.camera.requestSceneColorMap(true);
            camera.addComponent("script");
            camera.script.create("orbitCamera", {
                attributes: {
                    inertiaFactor: 0.2,
                    distanceMin: 8,
                    distanceMax: 50
                }
            });
            camera.script.create("orbitCameraInputMouse");
            camera.script.create("orbitCameraInputTouch");
            app.root.addChild(camera);

            const directionalLight = new pc.Entity();
            directionalLight.addComponent("light", {
                type: "directional",
                color: pc.Color.WHITE,
                castShadows: true,
                intensity: 1,
                shadowBias: 0.2,
                normalOffsetBias: 0.05,
                shadowResolution: 2048
            });
            directionalLight.setEulerAngles(45, 180, 0);
            app.root.addChild(directionalLight);

            app.scene.setSkybox(assets.helipad.resources);
            app.scene.toneMapping = pc.TONEMAP_ACES;
            app.scene.skyboxMip = 1;
            app.scene.skyboxRotation = new pc.Quat().setFromEulerAngles(0, 70, 0);
            app.scene.skyboxIntensity = 1.5;

            window.addEventListener("touchstart", (event) => {
                const touch = event.touches[0];
                const entity = data.get('selection.focusEntity');
                let newEntity = entity;
                if (touch.clientX <= canvas.width * 0.2) {
                    newEntity = Math.max(0, entity - 1);
                } else if (touch.clientX >= canvas.width * 0.8) {
                    newEntity = Math.min(entity + 1, assetList.length);
                }
                if (entity !== newEntity) {
                    data.set('selection.focusEntity', newEntity);
                }
            }, false);

            function jumpToAsset(offset: number) {

                // wrap around
                const count = assetList.length - 1;
                currentAssetIndex += offset;
                if (currentAssetIndex < 0) currentAssetIndex = count;
                if (currentAssetIndex > count) currentAssetIndex = 0;

                const pos = assetList[currentAssetIndex].getLocalPosition();
                const newPos = new pc.Vec3(0, 2.0, 6.0).add(pos);
                camera.setLocalPosition(newPos);

                // @ts-ignore engine-tsd
                camera.script.orbitCamera.focusEntity = assetList[currentAssetIndex];
            }

            // focus on mosquito
            jumpToAsset(3);

            data.on('previous', function () {
                jumpToAsset(-1);
            });

            // remove light button handler
            data.on('next', function () {
                jumpToAsset(1);
            });
        });
    }
}

export default AssetViewerExample;
