import * as pc from '../../../../';

class GlbExample {
    static CATEGORY = 'Loaders';
    static NAME = 'GLB';

    example(canvas: HTMLCanvasElement): void {

        // The example demonstrates loading of glb file, which contains meshes,
        // lights and cameras, and switches between the cameras every 2 seconds.

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {});

        // the array will store loaded cameras
        let camerasComponents: Array<pc.CameraComponent> = null;

        const assets = {
            'scene': new pc.Asset('scene', 'container', { url: '/static/assets/models/geometry-camera-light.glb' })
        };

        const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
        assetListLoader.load(() => {

            app.start();

            // glb lights use physical units
            app.scene.physicalUnits = true;

            // create an instance using render component
            const entity = assets.scene.resource.instantiateRenderEntity();
            app.root.addChild(entity);

            // find all cameras - by default they are disabled
            camerasComponents = entity.findComponents("camera");
            camerasComponents.forEach((component) => {

                // set the aspect ratio to automatic to work with any window size
                component.aspectRatioMode = pc.ASPECT_AUTO;

                // set up exposure for physical units
                component.aperture = 4;
                component.shutter = 1 / 100;
                component.sensitivity = 500;
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

export default GlbExample;
