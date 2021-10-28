import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';

class DracoGLBExample extends Example {
    static CATEGORY = 'Loaders';
    static NAME = 'Draco GLB';

    example(canvas: HTMLCanvasElement, assets: any, wasmSupported: any, loadWasmModuleAsync: any): void {

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {});

        // load the draco decoder
        if (wasmSupported()) {
            loadWasmModuleAsync('DracoDecoderModule', 'static/lib/draco/draco.wasm.js', 'static/lib/draco/draco.wasm.wasm', demo);
        } else {
            loadWasmModuleAsync('DracoDecoderModule', 'static/lib/draco/draco.js', '', demo);
        }

        function demo() {
            app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

            // Load a glb file as a container
            const url = "static/assets/models/heart_draco.glb";
            app.assets.loadFromUrl(url, "container", function (err, asset) {
                app.start();

                // create an instance using render component
                const entity = asset.resource.instantiateRenderEntity({
                    castShadows: true
                });
                app.root.addChild(entity);
                entity.setLocalScale(20, 20, 20);

                // Create an Entity with a camera component
                const camera = new pc.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc.Color(0.2, 0.2, 0.2)
                });
                camera.translate(0, 0.5, 4);
                app.root.addChild(camera);

                // Create an entity with a omni light component
                const light = new pc.Entity();
                light.addComponent("light", {
                    type: "omni",
                    intensity: 3
                });
                light.setLocalPosition(1, 1, 5);
                app.root.addChild(light);

                app.on("update", function (dt) {
                    if (entity) {
                        entity.rotate(4 * dt, -20 * dt, 0);
                    }
                });
            });
        }
    }
}

export default DracoGLBExample;
