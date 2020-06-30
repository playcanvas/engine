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

    // create the orbit camera
    var camera = new pc.Entity("Camera");
    camera.addComponent("camera", {
        fov: 75,
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
                    inertiaFactor: 0.02
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

    window.addEventListener('dragenter', preventDefault, false);
    window.addEventListener('dragover', preventDefault, false);
    window.addEventListener('drop', this._dropHandler.bind(this), false);

    var graph = new Graph(app, 128);
    app.on('prerender', this._onPrerender, this);
    app.on('frameend', this._onFrameend, this);

    // create the scene and debug root nodes
    var sceneRoot = new pc.Entity("sceneRoot", app);
    app.root.addChild(sceneRoot);

    var debugRoot = new pc.Entity("debugRoot", app);
    app.root.addChild(debugRoot);

    // store app things
    this.app = app;
    this.camera = camera;
    this.light = light;
    this.sceneRoot = sceneRoot;
    this.debugRoot = debugRoot;
    this.entities = [];
    this.assets = [];
    this.graph = graph;
    this.meshInstances = [];
    this.animationMap = { };
    this.morphMap = { };
    this.morphs = [];
    this.firstFrame = false;

    this.showGraphs = false;
    this.showWireframe = false;
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

    // construct ministats, default off
    this.miniStats = new pcx.MiniStats(app);
    this.miniStats.enabled = false;

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
        this.loadScene({ url: vars.load, filename: vars.load });
    }

    // initialize the envmap
    app.loader.getHandler(pc.ASSET_TEXTURE).parsers.hdr = new HdrParser(app.assets, false);
    this.loadHeliSkybox();
    // this.load(assetsFolder + '/textures/wooden_motel_2k.hdr');
    // this.load(assetsFolder + '/models/playcanvas-cube.glb');

    // construct debug shiny ball
    var shiny = new pc.StandardMaterial();
    shiny.metalness = 1;
    shiny.shininess = 100;
    shiny.useMetalness = true;
    shiny.update();

    var sphere = new pc.Entity();
    sphere.addComponent("model", {
        material: shiny,
        type: "sphere"
    });
    sphere.setLocalPosition(0, 0, 0);
    this.sphere = sphere;

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
    // initialize the faces and prefiltered lighting data from the given
    // skybox texture, which is either a cubemap or equirect texture.
    initSkyboxFromTexture: function (skybox) {
        var self = this;
        var app = self.app;
        var device = app.graphicsDevice;

        var cubemaps = [];

        if (skybox.cubemap) {
            // store cubemap for faces
            cubemaps.push(skybox);
        } else {
            // generate faces cubemap
            var faces = new pc.Texture(device, {
                name: 'skyboxFaces',
                cubemap: true,
                width: skybox.width / 4,
                height: skybox.width / 4,
                type: pc.TEXTURETYPE_RGBM
            });

            pc.reprojectTexture(device, skybox, faces);
            cubemaps.push(faces);
        }

        // generate prefiltered lighting data
        var sizes = [128, 64, 32, 16, 8, 4];
        var specPower = [undefined, 512, 128, 32, 8, 2];
        for (var i = 0; i < sizes.length; ++i) {
            var prefilter = new pc.Texture(device, {
                cubemap: true,
                name: 'skyboxPrefilter' + i,
                width: sizes[i],
                height: sizes[i],
                type: pc.TEXTURETYPE_RGBM
            });
            pc.reprojectTexture(device, cubemaps[1] || skybox, prefilter, specPower[i]);
            cubemaps.push(prefilter);
        }

        // assign the textures to the scene
        app.scene.gammaCorrection = pc.GAMMA_SRGB;
        app.scene.toneMapping = pc.TONEMAP_ACES;
        app.scene.skyboxMip = 0;                        // Set the skybox to the 128x128 cubemap mipmap level
        app.scene.setSkybox(cubemaps);
        app.renderNextFrame = true;                     // ensure we render again when the cubemap arrives
    },

    loadSkybox: function (files) {
        var self = this;
        var app = self.app;

        if (files.length !== 6) {
            // load equirectangular skybox
            var textureAsset = new pc.Asset('skybox_equi', 'texture', {
                url: files[0].url,
                filename: files[0].filename
            });
            textureAsset.ready(function () {
                var texture = textureAsset.resource;
                if (texture.type === pc.TEXTURETYPE_DEFAULT) {
                    // assume jps/pngs are RGBM
                    texture.type = pc.TEXTURETYPE_RGBM;
                }
                texture.minFilter = pc.FILTER_NEAREST;
                self.initSkyboxFromTexture(texture);
            });
            app.assets.add(textureAsset);
            app.assets.load(textureAsset);
        } else {
            // sort files into the correct order based on filename
            const names = [
                ['posx', 'negx', 'posy', 'negy', 'posz', 'negz'],
                ['px', 'nx', 'py', 'ny', 'pz', 'nz'],
                ['right', 'left', 'up', 'down', 'front', 'back'],
                ['right', 'left', 'top', 'bottom', 'forward', 'backward'],
                ['0', '1', '2', '3', '4', '5']
            ];

            var getOrder = function (filename) {
                var fn = filename.toLowerCase();
                for (var i = 0; i < names.length; ++i) {
                    var nameList = names[i];
                    for (var j = 0; j < nameList.length; ++j) {
                        if (fn.indexOf('_' + nameList[j] + '.') !== -1) {
                            return j;
                        }
                    }
                }
                return 0;
            };

            var sortPred = function (first, second) {
                var firstOrder = getOrder(first.filename);
                var secondOrder = getOrder(second.filename);
                return firstOrder < secondOrder ? -1 : (secondOrder < firstOrder ? 1 : 0);
            };

            files.sort(sortPred);

            // construct an asset for each cubemap face
            var faceAssets = files.map(function (file, index) {
                var faceAsset = new pc.Asset('skybox_face' + index, 'texture', file);
                app.assets.add(faceAsset);
                app.assets.load(faceAsset);
                return faceAsset;
            });

            // construct the cubemap asset
            var cubemapAsset = new pc.Asset('skybox_cubemap', 'cubemap', null, {
                textures: faceAssets.map(function (faceAsset) {
                    return faceAsset.id;
                }),
                magFilter: pc.FILTER_LINEAR,
                minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
                anisotropy: 1,
                type: pc.TEXTURETYPE_RGBM
            });
            cubemapAsset.loadFaces = true;
            cubemapAsset.on('load', function () {
                var cubemap = cubemapAsset.resource;
                if (cubemap) {
                    cubemap.type = pc.TEXTURETYPE_RGBM;
                    cubemap.minFilter = pc.FILTER_NEAREST;
                    self.initSkyboxFromTexture(cubemap);
                }
            });
            app.assets.add(cubemapAsset);
            app.assets.load(cubemapAsset);
        }
    },

    // load helipad cubemap
    loadHeliSkybox: function () {
        var self = this;
        var app = self.app;

        var cubemap = new pc.Asset('helipad', 'cubemap', {
            url: assetsFolder + "/cubemaps/Helipad.dds"
        }, {
            textures: [
                assetsFolder + "/cubemaps/Helipad_posx.png",
                assetsFolder + "/cubemaps/Helipad_negx.png",
                assetsFolder + "/cubemaps/Helipad_posy.png",
                assetsFolder + "/cubemaps/Helipad_negy.png",
                assetsFolder + "/cubemaps/Helipad_posz.png",
                assetsFolder + "/cubemaps/Helipad_negz.png"
            ],
            magFilter: pc.FILTER_LINEAR,
            minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
            anisotropy: 1,
            type: pc.TEXTURETYPE_RGBM
        });
        cubemap.loadFaces = true;
        cubemap.on('load', function () {
            if (cubemap.resource.width != 4) {
                cubemap.resource.type = pc.TEXTURETYPE_RGBM;
                app.scene.gammaCorrection = pc.GAMMA_SRGB;
                app.scene.toneMapping = pc.TONEMAP_ACES;
                app.scene.skyboxMip = 0;                        // Set the skybox to the 128x128 cubemap mipmap level
                app.scene.setSkybox(cubemap.resources);
                app.renderNextFrame = true;                     // ensure we render again when the cubemap arrives

                // generate Helipad_equi.png from cubemaps
                // reproject the heli to equirect
                // var equi = new pc.Texture(app.graphicsDevice, {
                //     name: 'heli_equirect',
                //     width: 2048,
                //     height: 1024,
                //     type: pc.TEXTURETYPE_RGBM
                // });
                // pc.reprojectTexture(app.graphicsDevice, cubemap.resource, equi);
                // pc.downloadTexture(equi, 'Helipad_equi.png', 0, true);

                // pc.downloadTexture(cubemap.resource, 'Helipad_cube.png');
            }
        });
        app.assets.add(cubemap);
        app.assets.load(cubemap);
    },

    // reset the viewer, unloading resources
    resetScene: function () {
        var app = this.app;
        var i;

        for (i = 0; i < this.entities.length; ++i) {
            var entity = this.entities[i];
            this.sceneRoot.removeChild(entity);
            entity.destroy();
        }
        this.entities = [];

        for (i = 0; i < this.assets.length; ++i) {
            var asset = this.assets[i];
            app.assets.remove(asset);
            asset.unload();
        }
        this.assets = [];

        this.graph.clear();
        this.meshInstances = [];

        this.animationMap = { };
        onAnimationsLoaded([]);

        this.morphMap = { };
        this.morphs = [];
        onMorphTargetsLoaded([]);

        this.dirtyWireframe = this.dirtyBounds = this.dirtySkeleton = this.dirtyNormals = true;

        this.app.renderNextFrame = true;
    },

    clearSkybox: function () {
        this.app.scene.setSkybox(null);
        this.app.renderNextFrame = true;
    },

    // move the camera to view the loaded object
    focusCamera: function () {
        var camera = this.camera.camera;
        var orbitCamera = this.camera.script.orbitCamera;

        // calculate scene bounding box
        var bbox = Viewer._calcBoundingBox(this.meshInstances);
        var radius = bbox.halfExtents.length();
        var distance = (radius * 1.4) / Math.sin(0.5 * camera.fov * camera.aspectRatio * pc.math.DEG_TO_RAD);

        orbitCamera.pivotPoint = bbox.center;
        orbitCamera.distance = distance;
        camera.nearClip = distance / 10;
        camera.farClip = distance * 10;

        var light = this.light;
        light.light.shadowDistance = distance * 2;
    },

    // load model
    loadScene: function (url) {
        this.app.assets.loadFromUrlAndFilename(url.url, url.filename, "container", this._onLoaded.bind(this));
    },

    // perform load given a list of url objects
    load: function (urls) {
        // convert single url to list
        if (!Array.isArray(urls)) {
            urls = [urls];
        }

        // convert url strings to url structs
        urls = urls.map(function (url) {
            return typeof url === "string" ? {
                url: url,
                filename: url
            } : url;
        });

        var ext = function (filename) {
            return pc.path.getExtension(filename).toLowerCase();
        };

        // check if a gltf file is being loaded
        var gltf = urls.find(function (url) {
            return ext(url.filename) === '.gltf';
        });

        var result = false;     // sceneLoaded
        var self = this;
        if (gltf) {
            var processTexture = function (gltfTexture, continuation) {
                var u = urls.find(function (url) {
                    return url.filename === gltfTexture.uri;
                });
                if (u) {
                    var textureAsset = new pc.Asset(u.filename, 'texture', { url: u.url, filename: u.filename }, { flipY: false } );
                    textureAsset.on('load', function () {
                        continuation(null, textureAsset);
                    });
                    self.app.assets.add(textureAsset);
                    self.app.assets.load(textureAsset);
                } else {
                    continuation("failed to load uri=" + gltfTexture.uri);
                }
            };

            var processBuffer = function (gltfBuffer, continuation) {
                var u = urls.find(function (url) {
                    return url.filename === gltfBuffer.uri;
                });
                if (u) {
                    var bufferAsset = new pc.Asset(u.filename, 'binary', { url: u.url, filename: u.filename }, null );
                    bufferAsset.on('load', function () {
                        continuation(null, new Uint8Array(bufferAsset.resource));
                    });
                    self.app.assets.add(bufferAsset);
                    self.app.assets.load(bufferAsset);
                } else {
                    continuation("failed to load uri=" + gltfBuffer.uri);
                }
            };

            var containerAsset = new pc.Asset(gltf.filename, 'container', gltf, null, {
                texture: {
                    processAsync: processTexture
                },
                buffer: {
                    processAsync: processBuffer
                }
            });
            containerAsset.on('load', function () {
                self._onLoaded(null, containerAsset);
            });
            self.app.assets.add(containerAsset);
            self.app.assets.load(containerAsset);
            result = true;
        } else {
            // load scene files
            var imageUrls = urls.filter(function (url) {
                switch (ext(url.filename)) {
                    case '.glb':
                    case '.gltf':
                        self.loadScene(url);
                        result = true;
                        return false;
                    default:
                        return true;
                }
            });

            // load skybox textures
            if (imageUrls.length > 0) {
                self.loadSkybox(imageUrls);
            }
        }

        return result;
    },

    // play the animation
    play: function (animationName) {
        for (var i = 0; i < this.entities.length; ++i) {
            var entity = this.entities[i];
            if (entity.animation) {
                entity.animation.enabled = true;
                if (animationName) {
                    entity.animation.play(this.animationMap[animationName], 1);
                } else {
                    entity.animation.playing = true;
                }
            }
        }
    },

    // stop playing animations
    stop: function () {
        for (var i = 0; i < this.entities.length; ++i) {
            var entity = this.entities[i];
            if (entity.animation) {
                entity.animation.enabled = false;
                entity.animation.playing = false;
            }
        }
    },

    setSpeed: function (speed) {
        for (var i = 0; i < this.entities.length; ++i) {
            var entity = this.entities[i];
            if (entity.animation) {
                entity.animation.speed = speed;
            }
        }
    },

    setShowGraphs: function (show) {
        this.showGraphs = show;
        this.renderNextFrame();
    },

    setStats: function (show) {
        this.miniStats.enabled = show;
        this.renderNextFrame();
    },

    setShowWireframe: function (show) {
        this.showWireframe = show;
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

    setFov: function (fov) {
        this.camera.camera.fov = fov;
        this.renderNextFrame();
    },

    setShowShinyBall: function (show) {
        if (show) {
            this.debugRoot.addChild(this.sphere);
        } else {
            this.debugRoot.removeChild(this.sphere);
        }
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
        for (var i = 0; i < this.entities.length; ++i) {
            var entity = this.entities[i];
            if (entity.animation && entity.animation.playing) {
                this.dirtyBounds = true;
                this.dirtySkeleton = true;
                this.dirtyNormals = true;
                this.renderNextFrame();
                break;
            }
        }
        // or the ministats is enabled
        if (this.miniStats.enabled) {
            this.renderNextFrame();
        }
    },

    renderNextFrame: function () {
        this.app.renderNextFrame = true;
    },

    _dropHandler: function (ev) {
        ev.preventDefault();

        if (ev.dataTransfer && ev.dataTransfer.items) {
            var self = this;
            var urls = [];
            var awaiting = 0;
            var shiftKey = !!ev.shiftKey;

            var checkDone = function () {
                if (awaiting === 0) {
                    // if a scene was loaded (and not just a skybox), clear the current scene
                    if (self.load(urls) && !shiftKey) {
                        self.resetScene();
                    }
                }
            };

            for (var i = 0; i < ev.dataTransfer.items.length; ++i) {
                var item = ev.dataTransfer.items[i];
                if (item.kind === 'file') {
                    var file = item.getAsFile();
                    urls.push({
                        url: URL.createObjectURL(file),
                        filename: file.name
                    });
                } else if (item.kind === 'string' && item.type === 'text/plain') {
                    item.getAsString(function (s) {         // eslint-disable-line no-loop-func
                        urls.push(s);
                        awaiting--;
                        checkDone();
                    });
                    awaiting++;
                }
            }

            checkDone();
        }
    },

    _onLoaded: function (err, asset) {
        if (err) {
            return;
        }

        var resource = asset.resource;

        var entity;
        if (resource.model || this.entities.length === 0) {
            // create entity and add model
            entity = new pc.Entity();
            entity.addComponent("model", {
                type: "asset",
                asset: resource.model,
                castShadows: true
            });
            this.entities.push(entity);
            this.sceneRoot.addChild(entity);
        } else {
            // use the last model that was added to the scene, presumably this is animation data
            // that we want to play on an already-existing model
            entity = this.entities[this.entities.length - 1];
        }

        // create animations
        if (resource.animations && resource.animations.length > 0) {
            if (!entity.animation) {
                entity.addComponent('animation', {
                    speed: 1
                });
            }

            entity.animation.assets = entity.animation.assets.concat(resource.animations.map(function (asset) {
                return asset.id;
            }));

            for (var i = 0; i < resource.animations.length; ++i) {
                var animAsset = resource.animations[i];
                this.animationMap[animAsset.resource.name] = animAsset.name;
            }

            onAnimationsLoaded(Object.keys(this.animationMap));

            var createAnimGraphs = function () {
                var extract = function (value, component) {
                    return function () {
                        return value[component];
                    };
                };

                var graph = this.graph;

                var recurse = function (node) {
                    if (!graph.hasNode(node)) {
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
                    }

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
            var morphMap = this.morphMap;
            var morphs = this.morphs;
            morphInstances.forEach(function (morphInstance, morphIndex) {
                // mesh name line
                morphs.push({ name: "Mesh " + morphIndex });

                morphInstance.morph._targets.forEach(function (target, targetIndex) {
                    var targetName = morphIndex + "-" + target.name;
                    if (!morphMap.hasOwnProperty(targetName)) {
                        morphMap[targetName] = [{ instance: morphInstance, targetIndex: targetIndex }];
                        morphs.push({ name: targetName, weight: target.defaultWeight });
                    } else {
                        morphMap[targetName].push({ instance: morphInstance, targetIndex: targetIndex });
                    }
                });
            });

            onMorphTargetsLoaded(morphs);
        }

        this.assets.push(asset);
        this.meshInstances = this.meshInstances.concat(
            Viewer._distinct(
                Viewer._flatten(entity)
                    .map( function (node) {
                        return node.model ? node.model.meshInstances || [] : [];
                    })
                    .flat()));

        this.dirtyWireframe = this.dirtyBounds = this.dirtySkeleton = this.dirtyNormals = true;

        // we can't refocus the camera here because the scene hierarchy only gets updated
        // during render. we must instead set a flag, wait for a render to take place and
        // then focus the camera.
        this.firstFrame = true;
        this.renderNextFrame();
    },

    // generate and render debug elements on prerender
    _onPrerender: function () {
        if (this.showGraphs) {
            this.graph.update();
            this.graph.render();
        }

        if (!this.firstFrame) {                          // don't update on the first frame
            var i;

            // wireframe
            if (this.dirtyWireframe) {
                this.dirtyWireframe = false;
                for (i = 0; i < this.meshInstances.length; ++i) {
                    meshInstance = this.meshInstances[i];
                    if (this.showWireframe) {
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

            // debug skeleton
            if (this.dirtySkeleton) {
                this.dirtySkeleton = false;
                this.debugSkeleton.clear();

                if (this.showSkeleton) {
                    for (i = 0; i < this.entities.length; ++i) {
                        var entity = this.entities[i];
                        if (entity.model && entity.model.model) {
                            this.debugSkeleton.generateSkeleton(entity.model.model.graph);
                        }
                    }
                }

                this.debugSkeleton.update();
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
