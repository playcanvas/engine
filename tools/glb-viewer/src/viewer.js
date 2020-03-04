
var assetsFolder = "../../examples/assets";

var Viewer = function (canvas) {

    var self = this;

    // create the application
    var app = new pc.Application(canvas, {
        mouse: new pc.Mouse(document.body),
        touch: new pc.TouchDevice(document.body)
    });

    app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;

    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    window.addEventListener("resize", function () {
        app.resizeCanvas(canvas.width, canvas.height);
    });

    // load cubemap background
    var cubemapAsset = new pc.Asset('helipad.dds', 'cubemap', {
        url: assetsFolder + "/cubemaps/helipad.dds"
    });
    app.assets.add(cubemapAsset);
    app.assets.load(cubemapAsset);
    cubemapAsset.ready(function () {
        cubemapAsset.resources.forEach(function (cubemap) {
            cubemap.rgbm = true;
        });
        app.scene.setSkybox(cubemapAsset.resources);
        app.scene.gammaCorrection = pc.GAMMA_SRGB;
        app.scene.toneMapping = pc.TONEMAP_ACES;
        app.scene.skyboxMip = 1;                        // Set the skybox to the 128x128 cubemap mipmap level
    });

    // create the orbit camera
    var camera = new pc.Entity();
    camera.addComponent("camera", {
        fov: 60,
        clearColor: new pc.Color(0.4, 0.45, 0.5)
    });

    // load orbit script
    app.assets.loadFromUrl(assetsFolder + "/scripts/camera/orbit-camera.js",
                            "script",
                            function (err, asset) {
                                // setup orbit script component
                                camera.addComponent("script");
                                camera.script.create("orbitCamera", {
                                    attributes: {
                                        inertiaFactor: 0.1
                                    }
                                });
                                camera.script.create("orbitCameraInputMouse");
                                camera.script.create("orbitCameraInputTouch");
                                app.root.addChild(camera);
                            });

    // create the light
    var light = new pc.Entity();
    light.addComponent("light", {
        type: "directional",
        color: new pc.Color(1, 1, 1),
        castShadows: true,
        intensity: 2,
        shadowBias: 0.2,
        shadowDistance: 5,
        normalOffsetBias: 0.05,
        shadowResolution: 2048
    });
    light.setLocalEulerAngles(45, 30, 0);
    app.root.addChild(light);

    app.start();

    // configure drag and drop
    var preventDefault = function (ev) {
        ev.preventDefault();
    }

    var dropHandler = function (ev) {
        ev.preventDefault();

        if (ev.dataTransfer) {
            const items = ev.dataTransfer.items;
            if (items && items.length === 1 && items[0].kind === 'file') {
                const file = items[0].getAsFile();
                self.load(URL.createObjectURL(file));
            }
        }
    }
    window.addEventListener('dragenter', preventDefault, false);
    window.addEventListener('dragover', preventDefault, false);
    window.addEventListener('drop', dropHandler, false);

    // store things
    this.app = app;
    this.camera = camera;
    this.light = light;
    this.entity = null;
};

Object.assign(Viewer.prototype, {
    // reset the viewer, unloading resources
    resetScene: function () {
        var app = this.app;

        var entity = this.entity;
        if (entity) {
            app.root.removeChild(entity);
            entity.destroy();
            this.entity = null;
        }

        if (this.asset) {
            app.assets.remove(this.asset);
            this.asset.unload();
            this.asset = null;
        }
    },

    focusCamera: function () {
        var entity = this.entity;
        if (entity) {
            var camera = this.camera;
            camera.script.orbitCamera.focus(entity);

            var distance = camera.script.orbitCamera.distance;
            camera.camera.nearClip = distance / 10;
            camera.camera.farClip = distance * 10;

            var light = this.light;
            light.light.shadowDistance = distance * 2;
        }
    },

    // load model from the url
    load: function (url) {
        this.app.assets.loadFromUrl(url, "container", this._onLoaded.bind(this));
    },

    _onLoaded: function (err, asset) {
        if (!err) {
            this.resetScene();

            var resource = asset.resource;

            // construct model entity
            var entity = new pc.Entity();
            entity.addComponent("model", {
                type: "asset",
                asset: resource.model,
                castShadows: true
            });

            if (resource.animations && resource.animations.length > 0) {
                entity.addComponent('animation', {
                    assets: resource.animations.map(function (asset) {
                        return asset.id
                    }),
                    speed: 1
                });
            }

            this.app.root.addChild(entity);
            this.entity = entity;
            this.asset = asset;

            this.focusCamera();
        }
    }
});

var viewer;

var main = function () {
    viewer = new Viewer(document.getElementById("application-canvas"));
};
