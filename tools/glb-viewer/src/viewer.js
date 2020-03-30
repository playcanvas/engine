var assetsFolder = "../../examples/assets";

var Viewer = function (canvas) {

    var self = this;

    // create the application
    var app = new pc.Application(canvas, {
        mouse: new pc.Mouse(canvas),
        touch: new pc.TouchDevice(canvas)
    });

    var getCanvasSize = function () {
        return {
            width: document.body.clientWidth - 200,
            height: document.body.clientHeight
        };
    };

    app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;

    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    var canvasSize = getCanvasSize();
    app.setCanvasFillMode(pc.FILLMODE_NONE, canvasSize.width, canvasSize.height);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    window.addEventListener("resize", function () {
        var canvasSize = getCanvasSize();
        app.resizeCanvas(canvasSize.width, canvasSize.height);
    });

    // load cubemap background
    var cubemapAsset = new pc.Asset('helipad.dds', 'cubemap', {
        url: assetsFolder + "/cubemaps/helipad.dds"
    }, {
        rgbm: true
    });
    cubemapAsset.ready(function () {
        app.scene.gammaCorrection = pc.GAMMA_SRGB;
        app.scene.toneMapping = pc.TONEMAP_ACES;
        app.scene.skyboxMip = 1;                        // Set the skybox to the 128x128 cubemap mipmap level
        app.scene.setSkybox(cubemapAsset.resources);
    });
    app.assets.add(cubemapAsset);
    app.assets.load(cubemapAsset);

    // create the orbit camera
    var camera = new pc.Entity("Camera");
    camera.addComponent("camera", {
        fov: 60,
        clearColor: new pc.Color(0.4, 0.45, 0.5)
    });

    // load orbit script
    app.assets.loadFromUrl(
        assetsFolder + "/scripts/camera/orbit-camera.js",
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

    // disable autorender
    app.autoRender = false;
    self.prevCameraMat = new pc.Mat4();
    app.on('update', self.update.bind(self));

    // configure drag and drop
    var preventDefault = function (ev) {
        ev.preventDefault();
    };

    var dropHandler = function (ev) {
        ev.preventDefault();

        if (ev.dataTransfer) {
            var items = ev.dataTransfer.items;
            if (items && items.length === 1 && items[0].kind === 'file') {
                var file = items[0].getAsFile();
                self.load(URL.createObjectURL(file), file.name);
            }
        }
    };
    window.addEventListener('dragenter', preventDefault, false);
    window.addEventListener('dragover', preventDefault, false);
    window.addEventListener('drop', dropHandler, false);

    var graph = new Graph(app, 128);
    app.on('prerender', function () {
        if (self.showGraphs) {
            graph.update();
            graph.render();
        }
    });

    // store things
    this.app = app;
    this.camera = camera;
    this.light = light;
    this.entity = null;
    this.graph = graph;
    this.showGraphs = false;

    function getUrlVars() {
        var vars = {};
        var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
            vars[key] = value;
        });
        return vars;
    }

    // specify ?load= in URL to load a file
    var vars = getUrlVars();
    if (vars.hasOwnProperty('load')) {
        this.load(vars.load, vars.load]);
    }

    // start the application
    app.start();
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

        this.graph.clear();

        this.animationMap = { };
        onAnimationsLoaded([]);
    },

    // move the camera to view the loaded object
    focusCamera: function () {
        var entity = this.entity;
        if (entity) {
            var camera = this.camera;

            var orbitCamera = camera.script.orbitCamera;
            orbitCamera.focus(entity);

            var distance = orbitCamera.distance;
            camera.camera.nearClip = distance / 10;
            camera.camera.farClip = distance * 10;

            var light = this.light;
            light.light.shadowDistance = distance * 2;
        }
    },

    // load model at the url
    load: function (url, filename) {
        this.app.assets.loadFromUrlAndFilename(url, filename, "container", this._onLoaded.bind(this));
    },

    // play the animation
    play: function (animationName) {
        if (this.entity && this.entity.animation) {
            if (animationName) {
                this.entity.animation.play(this.animationMap[animationName], 1);
            } else {
                this.entity.animation.playing = true;
            }
        }
    },

    // stop playing animations
    stop: function () {
        if (this.entity && this.entity.animation) {
            this.entity.animation.playing = false;
        }
    },

    setSpeed: function (speed) {
        if (this.entity && this.entity.animation) {
            var entity = this.entity;
            if (entity) {
                entity.animation.speed = speed;
            }
        }
    },

    setGraphs: function (show) {
        this.showGraphs = show;
    },

    update: function () {
        // if the camera has moved since the last render
        var cameraWorldTransform = this.camera.getWorldTransform();
        if (!this.prevCameraMat.equals(cameraWorldTransform)) {
            this.prevCameraMat.copy(cameraWorldTransform);
            this.app.renderNextFrame = true;
        }
        // or an animation is loaded and we're animating
        if (this.entity && this.entity.animation && this.entity.animation.playing) {
            this.app.renderNextFrame = true;
        }
    },

    _onLoaded: function (err, asset) {
        if (!err) {

            this.resetScene();

            var resource = asset.resource;

            // create entity and add model
            var entity = new pc.Entity();
            entity.addComponent("model", {
                type: "asset",
                asset: resource.model,
                castShadows: true
            });

            // create animations
            if (resource.animations && resource.animations.length > 0) {
                entity.addComponent('animation', {
                    assets: resource.animations.map(function (asset) {
                        return asset.id;
                    }),
                    speed: 1
                });

                var animationMap = {};
                for (var i = 0; i < resource.animations.length; ++i) {
                    var animAsset = resource.animations[i];
                    animationMap[animAsset.resource.name] = animAsset.name;
                }

                this.animationMap = animationMap;
                onAnimationsLoaded(Object.keys(this.animationMap));

                var createAnimGraphs = function () {
                    var extract = function (value, component) {
                        return function () {
                            return value[component];
                        };
                    };

                    var graph = this.graph;

                    var recurse = function (node) {
                        graph.addGraph(node, new pc.Color(1, 1, 0, 1), extract(node.localPosition, 'x'));
                        graph.addGraph(node, new pc.Color(0, 1, 1, 1), extract(node.localPosition, 'y'));
                        graph.addGraph(node, new pc.Color(1, 0, 1, 1), extract(node.localPosition, 'z'));

                        graph.addGraph(node, new pc.Color(1, 0, 0, 1), extract(node.localRotation, 'x'));
                        graph.addGraph(node, new pc.Color(0, 1, 0, 1), extract(node.localRotation, 'y'));
                        graph.addGraph(node, new pc.Color(0, 0, 1, 1), extract(node.localRotation, 'z'));
                        graph.addGraph(node, new pc.Color(1, 1, 1, 1), extract(node.localRotation, 'w'));

                        graph.addGraph(node, new pc.Color(1.0, 0.5, 0.5, 1), extract(node.localScale, 'x'));
                        graph.addGraph(node, new pc.Color(0.5, 1.0, 0.5, 1), extract(node.localScale, 'y'));
                        graph.addGraph(node, new pc.Color(0.5, 0.5, 1.0, 1), extract(node.localScale, 'z'));

                        for (var i = 0; i < node.children.length; ++i) {
                            recurse(node.children[i]);
                        }
                    };
                    recurse(entity);
                };

                // create animation graphs
                setTimeout(createAnimGraphs.bind(this), 1000);
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
