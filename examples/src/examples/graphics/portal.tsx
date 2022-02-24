import * as pc from '../../../../';

class PortalExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Portal';

    example(canvas: HTMLCanvasElement): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {
            keyboard: new pc.Keyboard(window)
        });

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        app.start();

        ////////////////////////////////
        // Script to rotate the scene //
        ////////////////////////////////
        const Rotator = pc.createScript('rotator');

        let t = 0;

        Rotator.prototype.update = function (dt: number) {
            t += dt;
            this.entity.setEulerAngles(0, Math.sin(t) * 20, 0);
        };

        //////////////////////////////////////////////////////////////////
        // Script to set stencil options for entities inside the portal //
        //////////////////////////////////////////////////////////////////
        const InsidePortal = pc.createScript('insidePortal');

        InsidePortal.prototype.initialize = function () {
            const stencil = new pc.StencilParameters({
                func: pc.FUNC_NOTEQUAL,
                ref: 0
            });

            for (const meshInstance of this.entity.render.meshInstances) {
                meshInstance.material.stencilBack = meshInstance.material.stencilFront = stencil;
            }

            const prt = this.entity.particlesystem;
            if (prt) {
                const mat = prt.emitter.material;
                mat.stencilBack = mat.stencilFront = stencil;
            }
        };

        ///////////////////////////////////////////////////////////////////
        // Script to set stencil options for entities outside the portal //
        ///////////////////////////////////////////////////////////////////
        const OutsidePortal = pc.createScript('outsidePortal');

        OutsidePortal.prototype.initialize = function () {
            const stencil = new pc.StencilParameters({
                func: pc.FUNC_EQUAL,
                ref: 0
            });

            for (const meshInstance of this.entity.render.meshInstances) {
                meshInstance.material.stencilBack = meshInstance.material.stencilFront = stencil;
            }

            const prt = this.entity.particlesystem;
            if (prt) {
                const mat = prt.emitter.material;
                mat.stencilBack = mat.stencilFront = stencil;
            }
        };

        ///////////////////////////////////////////////
        // Set stencil options for the portal itself //
        ///////////////////////////////////////////////
        const Portal = pc.createScript('portal');

        // initialize code called once per entity
        Portal.prototype.initialize = function () {
            // We only want to write to the stencil buffer
            const mat = this.entity.render.meshInstances[0].material;
            mat.depthWrite = false;
            mat.redWrite = mat.greenWrite = mat.blueWrite = mat.alphaWrite = false;
            mat.stencilBack = mat.stencilFront = new pc.StencilParameters({
                zpass: pc.STENCILOP_INCREMENT
            });
            mat.update();
        };

        ///////////////////////////////////////////////

        app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

        const insideMat = new pc.StandardMaterial();
        const outsideMat = new pc.StandardMaterial();
        const portalMat = new pc.StandardMaterial();
        const borderMat = new pc.StandardMaterial();
        borderMat.emissive.set(1, 0.4, 0);
        borderMat.update();

        // find world layer - majority of objects render to this layer
        const worldLayer = app.scene.layers.getLayerByName("World");

        // portal layer - this is where the portal itself is written to
        // the stencil buffer, and this needs to render first, so insert
        // it before the world layer (at index 0)
        const portalLayer = new pc.Layer({ name: "Portal" });
        app.scene.layers.insert(portalLayer, 0);

        // Create an Entity with a camera component
        // this camera renders both world and portal layers
        const camera = new pc.Entity();
        camera.addComponent('camera', {
            clearColor: new pc.Color(0.12, 0.12, 0.12),
            layers: [worldLayer.id, portalLayer.id]
        });
        camera.setLocalPosition(7.5, 5.5, 6.1);
        camera.setLocalEulerAngles(-30, 45, 0);

        // Create an Entity with a directional light component
        const light = new pc.Entity();
        light.addComponent('light', {
            type: 'directional',
            color: new pc.Color(1, 1, 1)
        });
        light.setEulerAngles(45, 135, 0);

        // Create a root for the graphical scene
        const group = new pc.Entity();
        group.addComponent('script');
        group.script.create('rotator');

        // Create the portal entity - this plane is written to stencil buffer,
        // which is then used to test for inside / outside. This needs to render
        // before all elements requring stencil buffer, so add ot to a portalLayer
        const portal = new pc.Entity("Portal");
        portal.addComponent('render', {
            type: 'plane',
            material: portalMat,
            layers: [portalLayer.id]
        });
        portal.addComponent('script');
        portal.script.create('portal');
        portal.setLocalPosition(0, 0, 0);
        portal.setLocalEulerAngles(90, 0, 0);
        portal.setLocalScale(4, 1, 6);

        // Create the portal border entity
        // this is set up for rendering outside the portal
        const border = new pc.Entity("Border");
        border.addComponent('render', {
            type: 'plane',
            material: borderMat
        });
        border.addComponent('script');
        border.script.create('outsidePortal');
        border.setLocalPosition(0, 0, 0);
        border.setLocalEulerAngles(90, 0, 0);
        border.setLocalScale(4.68, 1.17, 7.019);

        // Create an Entity with a Box render component and a particle system
        // This uses insidePortal script to set up its stencil testing
        // for inside the portal
        const box = new pc.Entity("Box");
        box.addComponent('render', {
            type: 'box',
            material: insideMat
        });
        box.addComponent('particlesystem', {
            numParticles: 256,
            lifetime: 5,
            rate: 0.02,
            rate2: 0.03,
            emitterShape: pc.EMITTERSHAPE_BOX,
            emitterExtents: new pc.Vec3(0, 0, 0),
            scaleGraph: new pc.Curve([0, 0.1]),
            velocityGraph: new pc.CurveSet([[0, 3], [0, 3], [0, 3]]),
            velocityGraph2: new pc.CurveSet([[0, -3], [0, -3], [0, -3]]),
        });
        box.addComponent('script');
        box.script.create('insidePortal');
        box.setLocalPosition(0, 0.5, -1.936);

        // Create an entity with a sphere render component
        // This uses outsidePortal script to set up its stencil testing
        // for outside the portal
        const sphere = new pc.Entity("Sphere");
        sphere.addComponent('render', {
            type: 'sphere',
            material: outsideMat
        });
        sphere.addComponent('script');
        sphere.script.create('outsidePortal');
        sphere.setLocalPosition(0, 0, -2.414);
        sphere.setLocalEulerAngles(0, 0, 0);
        sphere.setLocalScale(1, 1, 1);

        // Add the new entities to the hierarchy
        app.root.addChild(camera);
        app.root.addChild(light);
        app.root.addChild(group);
        group.addChild(box);
        group.addChild(portal);
        group.addChild(border);
        group.addChild(sphere);
    }
}

export default PortalExample;
