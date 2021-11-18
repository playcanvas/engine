import * as pc from 'playcanvas/build/playcanvas.js';
import Example from '../../app/example';

class GLBExample extends Example {
    static CATEGORY = 'Loaders';
    static NAME = 'GLB';

    example(canvas: HTMLCanvasElement): void {

        // The example demonstrates loading of glb file, which contains meshes,
        // lights and cameras, and switches between the cameras every 2 seconds.

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {});

        // the array will store loaded cameras
        let camerasComponents: Array<pc.CameraComponent> = null;

        // Load a glb file as a container
        const url = "static/assets/models/geometry-camera-light.glb";
        app.assets.loadFromUrl(url, "container", function (err, asset) {
            app.start();

            // create an instance using render component
            const entity = asset.resource.instantiateRenderEntity();
            app.root.addChild(entity);

            // find all cameras - by default they are disabled
            // set their aspect ratio to automatic to work with any window size
            camerasComponents = entity.findComponents("camera");
            camerasComponents.forEach((component) => {
                component.aspectRatioMode = pc.ASPECT_AUTO;
            });

            // enable all lights from the glb
            const lightComponents: Array<pc.LightComponent> = entity.findComponents("light");
            lightComponents.forEach((component) => {
                component.enabled = true;
            });

            let time = 0;
            let activeCamera = 0;
            app.on("update", function (dt) {
                time -= dt;

                // change the camera every few seconds 
                if (time <= 0) {
                    time = 2;

                    // disable current camera
                    camerasComponents[activeCamera].enabled = false;

                    // activate next camera
                    activeCamera = (activeCamera + 1) % camerasComponents.length;
                    camerasComponents[activeCamera].enabled = true;
                }
            });
        });
    }
}

export default GLBExample;
