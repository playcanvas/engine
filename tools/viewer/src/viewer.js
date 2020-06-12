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
            width: document.body.clientWidth - 250,
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
    var cubemapAsset = new pc.Asset('helipad.dds', 'texture', {
        url: assetsFolder + "/cubemaps/helipad.dds"
    }, {
        type: "rgbm"
    });
    cubemapAsset.ready(function () {
        app.scene.gammaCorrection = pc.GAMMA_SRGB;
        app.scene.toneMapping = pc.TONEMAP_ACES;
        app.scene.skyboxMip = 0;                        // Set the skybox to the 128x128 cubemap mipmap level
        app.scene.setSkybox(cubemapAsset.resources);
        app.renderNextFrame = true;                     // ensure we render again when the cubemap arrives
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
    app.on('prerender', this._onPrerender, this);
    app.on('frameend', this._onFrameend, this);

    // store app things
    this.app = app;
    this.camera = camera;
    this.light = light;
    this.entity = null;
    this.asset = null;
    this.graph = graph;
    this.meshInstances = [];
    this.firstFrame = false;

    this.showGraphs = false;

    this.wireframe = false;
    this.showBounds = false;
    this.showSkeleton = false;
    this.normalLength = 0;
    this.directLightingFactor = 1;
    this.envLightingFactor = 1;

    this.dirtyWireframe = false;
    this.dirtyBounds = false;
    this.dirtySkeleton = false;
    this.dirtyNormals = false;
    this.debugBounds = new DebugLines(app, camera);
    this.debugSkeleton = new DebugLines(app, camera);
    this.debugNormals = new DebugLines(app, camera);

    this.miniStats = new pc.MiniStats(app);

    function getUrlVars() {
        var vars = {};
        window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
            vars[key] = value;
        });
        return vars;
    }

    // specify ?load= in URL to load a file
    var vars = getUrlVars();
    if (vars.hasOwnProperty('load')) {
        this.load(vars.load, vars.load);
    }

    // start the application
    app.start();
};

// flatten a hierarchy of nodes
Viewer._flatten = function (node) {
    var result = [];
    node.forEach(function (n) {
        result.push(n);
    });
    return result;
};

// get the set of unique values from the array
Viewer._distinct = function (array) {
    var result = [];
    for (var i = 0; i < array.length; ++i) {
        if (result.indexOf(array[i]) === -1) {
            result.push(array[i]);
        }
    }
    return result;
};

Viewer._calcBoundingBox = function (meshInstances) {
    var bbox = new pc.BoundingBox();
    for (var i = 0; i < meshInstances.length; ++i) {
        if (i === 0) {
            bbox.copy(meshInstances[i].aabb);
        } else {
            bbox.add(meshInstances[i].aabb);
        }
    }
    return bbox;
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
        this.meshInstances = [];

        this.animationMap = { };
        onAnimationsLoaded([]);

        this.morphMap = { };
        onMorphTargetsLoaded([]);

        this.dirtyWireframe = this.dirtyBounds = this.dirtySkeleton = this.dirtyNormals = true;
    },

    // move the camera to view the loaded object
    focusCamera: function () {
        var entity = this.entity;
        if (entity) {
            var camera = this.camera.camera;
            var orbitCamera = this.camera.script.orbitCamera;

            // calculate scene bounding box
            var bbox = Viewer._calcBoundingBox(this.meshInstances);
            var radius = bbox.halfExtents.length();
            var distance = (radius * 1.5) / Math.cos(0.5 * camera.fov * camera.aspectRatio * pc.math.DEG_TO_RAD);

            orbitCamera.pivotPoint = bbox.center;
            orbitCamera.distance = distance;
            camera.nearClip = distance / 10;
            camera.farClip = distance * 10;

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
            this.entity.animation.enabled = true;
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
            this.entity.animation.enabled = false;
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

    setShowGraphs: function (show) {
        this.showGraphs = show;
        this.renderNextFrame();
    },

    setWireframe: function (wireframe) {
        this.wireframe = wireframe;
        this.dirtyWireframe = true;
        this.renderNextFrame();
    },

    setShowBounds: function (show) {
        this.showBounds = show;
        this.dirtyBounds = true;
        this.renderNextFrame();
    },

    setShowSkeleton: function (show) {
        this.showSkeleton = show;
        this.dirtySkeleton = true;
        this.renderNextFrame();
    },

    setNormalLength: function (length) {
        this.normalLength = length;
        this.dirtyNormals = true;
        this.renderNextFrame();
    },

    setDirectLighting: function (factor) {
        this.light.light.intensity = factor;
        this.renderNextFrame();
    },

    setEnvLighting: function (factor) {
        this.app.scene.skyboxIntensity = factor;
        this.renderNextFrame();
    },

    // set the morphing value
    setMorphWeight: function (name, weight) {
        if (this.morphMap.hasOwnProperty(name)) {
            var morphs = this.morphMap[name];
            morphs.forEach(function (morph) {
                morph.instance.setWeight(morph.targetIndex, weight);
            });
            this.dirtyNormals = true;
            this.renderNextFrame();
        }
    },

    update: function () {
        // if the camera has moved since the last render
        var cameraWorldTransform = this.camera.getWorldTransform();
        if (!this.prevCameraMat.equals(cameraWorldTransform)) {
            this.prevCameraMat.copy(cameraWorldTransform);
            this.renderNextFrame();
        }
        // or an animation is loaded and we're animating
        if (this.entity && this.entity.animation && this.entity.animation.playing) {
            this.dirtyBounds = true;
            this.dirtySkeleton = true;
            this.dirtyNormals = true;
            this.renderNextFrame();
        }
    },

    renderNextFrame: function () {
        this.app.renderNextFrame = true;
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

            // setup morph targets
            if (entity.model && entity.model.model && entity.model.model.morphInstances.length > 0) {
                var morphInstances = entity.model.model.morphInstances;
                // make a list of all the morph instance target names
                var morphMap = { };
                var morphs = [];
                var targetName;
                morphInstances.forEach(function (morphInstance, morphIndex) {

                    // mesh name line
                    morphs.push({ name: "Mesh " + morphIndex });

                    morphInstance.morph._targets.forEach(function (target, targetIndex) {
                        targetName = morphIndex + "-" + target.name;
                        if (!morphMap.hasOwnProperty(targetName)) {
                            morphMap[targetName] = [{ instance: morphInstance, targetIndex: targetIndex }];
                            morphs.push({ name: targetName, weight: target.defaultWeight });
                        } else {
                            morphMap[targetName].push({ instance: morphInstance, targetIndex: targetIndex });
                        }
                    });
                });

                this.morphMap = morphMap;
                onMorphTargetsLoaded(morphs);
            }

            this.app.root.addChild(entity);
            this.entity = entity;
            this.asset = asset;
            this.meshInstances =
                Viewer._distinct(
                    Viewer._flatten(entity)
                        .map( function (node) {
                            return node.model ? node.model.meshInstances : [];
                        })
                        .flat());

            // we can't refocus the camera here because the scene hierarchy only gets updated
            // during render. we must instead set a flag, wait for a render to take place and
            // then focus the camera.
            this.firstFrame = true;
            this.renderNextFrame();
        }
    },

    // generate and render debug elements on prerender
    _onPrerender: function () {
        if (this.showGraphs) {
            this.graph.update();
            this.graph.render();
        }

        if (this.entity &&
            this.entity.model &&
            this.entity.model.model &&
            !this.firstFrame) {             // don't update on the first frame

            var i;
            var meshInstance;
            var model = this.entity.model.model;

            // wireframe
            if (this.dirtyWireframe) {
                this.dirtyWireframe = false;

                for (i = 0; i < this.meshInstances.length; ++i) {
                    meshInstance = this.meshInstances[i];
                    if (this.wireframe) {
                        if (!meshInstance.mesh.primitive[pc.RENDERSTYLE_WIREFRAME]) {
                            meshInstance.mesh.generateWireframe();
                        }
                        meshInstance.renderStyle = pc.RENDERSTYLE_WIREFRAME;
                    } else {
                        meshInstance.renderStyle = pc.RENDERSTYLE_SOLID;
                    }
                }
            }

            // debug bounds
            if (this.dirtyBounds) {
                this.dirtyBounds = false;
                this.debugBounds.clear();

                if (this.showBounds) {
                    var bbox = Viewer._calcBoundingBox(this.meshInstances);
                    this.debugBounds.box(bbox.getMin(), bbox.getMax());
                }
                this.debugBounds.update();
            }

            // debug skeleton
            if (this.dirtySkeleton) {
                this.dirtySkeleton = false;
                this.debugSkeleton.clear();

                if (this.showSkeleton) {
                    this.debugSkeleton.generateSkeleton(model.graph);
                }
                this.debugSkeleton.update();
            }

            // debug normals
            if (this.dirtyNormals) {
                this.dirtyNormals = false;
                this.debugNormals.clear();

                if (this.normalLength > 0) {
                    for (i = 0; i < this.meshInstances.length; ++i) {
                        meshInstance = this.meshInstances[i];
                        var vertexBuffer = meshInstance.morphInstance ?
                            meshInstance.morphInstance._vertexBuffer : meshInstance.mesh.vertexBuffer;

                        if (vertexBuffer) {
                            var skinMatrices = meshInstance.skinInstance ?
                                meshInstance.skinInstance.matrices : null;

                            // if there is skinning we need to manually update matrices here otherwise
                            // our normals are always a frame behind
                            if (skinMatrices) {
                                meshInstance.skinInstance.updateMatrices(meshInstance.node);
                            }

                            this.debugNormals.generateNormals(vertexBuffer,
                                                              meshInstance.node.getWorldTransform(),
                                                              this.normalLength,
                                                              skinMatrices);
                        }
                    }
                }
                this.debugNormals.update();
            }
        }
    },

    _onFrameend: function () {
        if (this.firstFrame) {
            this.firstFrame = false;

            // focus camera after first frame otherwise skinned model bounding
            // boxes are incorrect
            this.focusCamera();
            this.renderNextFrame();
        }
    }
});

/* eslint-disable no-unused-vars */

var viewer;
function startViewer() {
    viewer = new Viewer(document.getElementById("application-canvas"));
}

var main = function () {
    pc.basisDownload(
        '../../examples/lib/basis/basis.wasm.js',
        '../../examples/lib/basis/basis.wasm.wasm',
        '../../examples/lib/basis/basis.js',
        function () {
            if (wasmSupported()) {
                loadWasmModuleAsync('DracoDecoderModule',
                                    '../../examples/lib/draco/draco.wasm.js',
                                    '../../examples/lib/draco/draco.wasm.wasm',
                                    startViewer);
            } else {
                loadWasmModuleAsync('DracoDecoderModule',
                                    '../../examples/lib/draco/draco.js',
                                    '',
                                    startViewer);
            }
        });
};

/* eslint-enable no-unused-vars */
