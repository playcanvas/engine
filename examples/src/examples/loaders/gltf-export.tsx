import React from 'react';
import * as pc from '../../../../';
import { Button } from '@playcanvas/pcui/react';
import { Observer } from '@playcanvas/observer';

class GltfExportExample {
    static CATEGORY = 'Loaders';
    static NAME = 'GLTF Export';
    static WEBGPU_ENABLED = true;

    controls(data: Observer) {
        return <>
            <Button text='Download GLTF' onClick={() => data.emit('download')}/>
        </>;
    }

    example(canvas: HTMLCanvasElement, deviceType: string, pcx: any, data: any): void {

        // set up and load draco module, as the glb we load is draco compressed
        pc.WasmModule.setConfig('DracoDecoderModule', {
            glueUrl: '/static/lib/draco/draco.wasm.js',
            wasmUrl: '/static/lib/draco/draco.wasm.wasm',
            fallbackUrl: '/static/lib/draco/draco.js'
        });

        pc.WasmModule.getInstance('DracoDecoderModule', demo);

        function demo() {

            const assets = {
                'helipad': new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP }),
                'bench': new pc.Asset('bench', 'container', { url: '/static/assets/models/bench_wooden_01.glb' }),
                'model': new pc.Asset('model', 'container', { url: '/static/assets/models/bitmoji.glb' }),
                'board': new pc.Asset('statue', 'container', { url: '/static/assets/models/chess-board.glb' })
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
                    pc.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc.TextureHandler,
                    // @ts-ignore
                    pc.ContainerHandler
                ];

                const app = new pc.AppBase(canvas);
                app.init(createOptions);

                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc.RESOLUTION_AUTO);

                const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(() => {

                    app.start();

                    // get the instance of the bench and set up with render component
                    const entity1 = assets.bench.resource.instantiateRenderEntity();
                    entity1.setLocalPosition(0, 0, -1.5);
                    app.root.addChild(entity1);

                    // the character
                    const entity2 = assets.model.resource.instantiateRenderEntity();
                    app.root.addChild(entity2);

                    // chess board
                    const entity3 = assets.board.resource.instantiateRenderEntity();
                    entity3.setLocalScale(0.01, 0.01, 0.01);
                    app.root.addChild(entity3);

                    // a render component with a sphere and cone primitives
                    const material = new pc.StandardMaterial();
                    material.diffuse = pc.Color.RED;
                    material.update();

                    const entity = new pc.Entity("TwoMeshInstances");
                    entity.addComponent('render', {
                        type: 'asset',
                        meshInstances: [
                            new pc.MeshInstance(pc.createSphere(app.graphicsDevice), material),
                            new pc.MeshInstance(pc.createCone(app.graphicsDevice), material)
                        ]
                    });
                    app.root.addChild(entity);
                    entity.setLocalPosition(0, 1.5, -1.5);

                    // Create an Entity with a camera component
                    const camera = new pc.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc.Color(0.2, 0.1, 0.1),
                        farClip: 100
                    });
                    camera.translate(-3, 1, 2);
                    camera.lookAt(0, 0.5, 0);
                    app.root.addChild(camera);

                    // set skybox
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.toneMapping = pc.TONEMAP_ACES;
                    app.scene.skyboxMip = 1;
                    app.scene.exposure = 1.5;

                    // a link element, created in the html part of the examples.
                    const link = document.getElementById('ar-link');

                    // export the whole scene into a glb format
                    const options = {
                        maxTextureSize: 1024
                    };

                    new pcx.GltfExporter().build(app.root, options).then((arrayBuffer: any) => {

                        const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });

                        // @ts-ignore
                        link.download = "scene.glb";

                        // @ts-ignore
                        link.href = URL.createObjectURL(blob);
                    }).catch(console.error);

                    // when clicking on the download UI button, trigger the download
                    data.on('download', function () {
                        link.click();
                    });
                });
            });
        }
    }
}

export default GltfExportExample;
