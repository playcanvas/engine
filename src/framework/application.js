import { version, revision } from '../core/core.js';
import { now } from '../core/time.js';
import { path } from '../core/path.js';
import { Color } from '../core/color.js';
import { EventHandler } from '../core/event-handler.js';

import { math } from '../math/math.js';
import { Vec3 } from '../math/vec3.js';

import { http } from '../net/http.js';

import {
    ADDRESS_CLAMP_TO_EDGE,
    CLEARFLAG_COLOR, CLEARFLAG_DEPTH,
    FILTER_NEAREST,
    PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_R8_G8_B8_A8,
    PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP,
    SEMANTIC_POSITION,
    TYPE_FLOAT32
} from '../graphics/constants.js';
import { destroyPostEffectQuad } from '../graphics/simple-post-effect.js';
import { GraphicsDevice } from '../graphics/graphics-device.js';
import { RenderTarget } from '../graphics/render-target.js';
import { Texture } from '../graphics/texture.js';
import { VertexBuffer } from '../graphics/vertex-buffer.js';
import { VertexFormat } from '../graphics/vertex-format.js';
import { VertexIterator } from '../graphics/vertex-iterator.js';

import {
    LAYERID_DEPTH, LAYERID_IMMEDIATE, LAYERID_SKYBOX, LAYERID_UI, LAYERID_WORLD,
    LINEBATCH_OVERLAY,
    SHADER_DEPTH,
    SORTMODE_NONE, SORTMODE_MANUAL
} from '../scene/constants.js';
import { BatchManager } from '../scene/batching/batch-manager.js';
import { ForwardRenderer } from '../scene/forward-renderer.js';
import { GraphNode } from '../scene/graph-node.js';
import { ImmediateData, LineBatch } from '../scene/immediate.js';
import { Layer } from '../scene/layer.js';
import { LayerComposition } from '../scene/layer-composition.js';
import { Lightmapper } from '../scene/lightmapper.js';
import { Mesh } from '../scene/mesh.js';
import { MeshInstance } from '../scene/mesh-instance.js';
import { ParticleEmitter } from '../scene/particle-system/particle-emitter.js';
import { Scene } from '../scene/scene.js';

import { SoundManager } from '../sound/manager.js';

import { AnimationHandler } from '../resources/animation.js';
import { AnimClipHandler } from '../resources/anim-clip.js';
import { AnimStateGraphHandler } from '../resources/anim-state-graph.js';
import { AudioHandler } from '../resources/audio.js';
import { BinaryHandler } from '../resources/binary.js';
import { BundleHandler } from '../resources/bundle.js';
import { ContainerHandler } from '../resources/container.js';
import { CssHandler } from '../resources/css.js';
import { CubemapHandler } from '../resources/cubemap.js';
import { FolderHandler } from '../resources/folder.js';
import { FontHandler } from '../resources/font.js';
import { HierarchyHandler } from '../resources/hierarchy.js';
import { HtmlHandler } from '../resources/html.js';
import { JsonHandler } from '../resources/json.js';
import { MaterialHandler } from '../resources/material.js';
import { ModelHandler } from '../resources/model.js';
import { RenderHandler } from '../resources/render.js';
import { ResourceLoader } from '../resources/loader.js';
import { SceneHandler } from '../resources/scene.js';
import { SceneSettingsHandler } from '../resources/scene-settings.js';
import { ScriptHandler } from '../resources/script.js';
import { ShaderHandler } from '../resources/shader.js';
import { SpriteHandler } from '../resources/sprite.js';
import { TemplateHandler } from '../resources/template.js';
import { TextHandler } from '../resources/text.js';
import { TextureAtlasHandler } from '../resources/texture-atlas.js';
import { TextureHandler } from '../resources/texture.js';

import { Asset } from '../asset/asset.js';
import { AssetRegistry } from '../asset/asset-registry.js';

import { BundleRegistry } from '../bundles/bundle-registry.js';

import { ScriptRegistry } from '../script/script-registry.js';

import { I18n } from '../i18n/i18n.js';

import { VrManager } from '../vr/vr-manager.js';
import { XrManager } from '../xr/xr-manager.js';

import { AnimationComponentSystem } from './components/animation/system.js';
import { AnimComponentSystem } from './components/anim/system.js';
import { AudioListenerComponentSystem } from './components/audio-listener/system.js';
import { AudioSourceComponentSystem } from './components/audio-source/system.js';
import { ButtonComponentSystem } from './components/button/system.js';
import { CameraComponentSystem } from './components/camera/system.js';
import { CollisionComponentSystem } from './components/collision/system.js';
import { ComponentSystemRegistry } from './components/registry.js';
import { ComponentSystem } from './components/system.js';
import { ElementComponentSystem } from './components/element/system.js';
import { LayoutChildComponentSystem } from './components/layout-child/system.js';
import { LayoutGroupComponentSystem } from './components/layout-group/system.js';
import { LightComponentSystem } from './components/light/system.js';
import { ModelComponentSystem } from './components/model/system.js';
import { RenderComponentSystem } from './components/render/system.js';
import { ParticleSystemComponentSystem } from './components/particle-system/system.js';
import { RigidBodyComponentSystem } from './components/rigid-body/system.js';
import { ScreenComponentSystem } from './components/screen/system.js';
import { ScriptComponentSystem } from './components/script/system.js';
import { ScriptLegacyComponentSystem } from './components/script-legacy/system.js';
import { ScrollViewComponentSystem } from './components/scroll-view/system.js';
import { ScrollbarComponentSystem } from './components/scrollbar/system.js';
import { SoundComponentSystem } from './components/sound/system.js';
import { SpriteComponentSystem } from './components/sprite/system.js';
import { ZoneComponentSystem } from './components/zone/system.js';
import { script } from './script.js';
import { ApplicationStats } from './stats.js';
import { Entity } from './entity.js';
import { SceneRegistry } from './scene-registry.js';

import {
    FILLMODE_FILL_WINDOW, FILLMODE_KEEP_ASPECT,
    RESOLUTION_AUTO, RESOLUTION_FIXED
} from './constants.js';

import {
    getApplication,
    setApplication
} from './globals.js';

// Mini-object used to measure progress of loading sets
class Progress {
    constructor(length) {
        this.length = length;
        this.count = 0;
    }

    inc() {
        this.count++;
    }

    done() {
        return (this.count === this.length);
    }
}

var _deprecationWarning = false;
var tempGraphNode = new GraphNode();

/**
 * @class
 * @name pc.Application
 * @augments pc.EventHandler
 * @classdesc A pc.Application represents and manages your PlayCanvas application.
 * If you are developing using the PlayCanvas Editor, the pc.Application is created
 * for you. You can access your pc.Application instance in your scripts. Below is a
 * skeleton script which shows how you can access the application 'app' property inside
 * the initialize and update functions:
 *
 * ```javascript
 * // Editor example: accessing the pc.Application from a script
 * var MyScript = pc.createScript('myScript');
 *
 * MyScript.prototype.initialize = function() {
 *     // Every script instance has a property 'this.app' accessible in the initialize...
 *     var app = this.app;
 * };
 *
 * MyScript.prototype.update = function(dt) {
 *     // ...and update functions.
 *     var app = this.app;
 * };
 * ```
 *
 * If you are using the Engine without the Editor, you have to create the application
 * instance manually.
 * @description Create a new Application.
 * @param {Element} canvas - The canvas element.
 * @param {object} options
 * @param {pc.ElementInput} [options.elementInput] - Input handler for {@link pc.ElementComponent}s.
 * @param {pc.Keyboard} [options.keyboard] - Keyboard handler for input.
 * @param {pc.Mouse} [options.mouse] - Mouse handler for input.
 * @param {pc.TouchDevice} [options.touch] - TouchDevice handler for input.
 * @param {pc.GamePads} [options.gamepads] - Gamepad handler for input.
 * @param {string} [options.scriptPrefix] - Prefix to apply to script urls before loading.
 * @param {string} [options.assetPrefix] - Prefix to apply to asset urls before loading.
 * @param {object} [options.graphicsDeviceOptions] - Options object that is passed into the {@link pc.GraphicsDevice} constructor.
 * @param {string[]} [options.scriptsOrder] - Scripts in order of loading first.
 * @example
 * // Engine-only example: create the application manually
 * var app = new pc.Application(canvas, options);
 *
 * // Start the application's main loop
 * app.start();
 */

// PROPERTIES

/**
 * @name pc.Application#scene
 * @type {pc.Scene}
 * @description The scene managed by the application.
 * @example
 * // Set the tone mapping property of the application's scene
 * this.app.scene.toneMapping = pc.TONEMAP_FILMIC;
 */

/**
 * @name pc.Application#timeScale
 * @type {number}
 * @description Scales the global time delta. Defaults to 1.
 * @example
 * // Set the app to run at half speed
 * this.app.timeScale = 0.5;
 */

/**
 * @name pc.Application#maxDeltaTime
 * @type {number}
 * @description Clamps per-frame delta time to an upper bound. Useful since returning from a tab
 * deactivation can generate huge values for dt, which can adversely affect game state. Defaults
 * to 0.1 (seconds).
 * @example
 * // Don't clamp inter-frame times of 200ms or less
 * this.app.maxDeltaTime = 0.2;
 */

/**
 * @name pc.Application#scenes
 * @type {pc.SceneRegistry}
 * @description The scene registry managed by the application.
 * @example
 * // Search the scene registry for a item with the name 'racetrack1'
 * var sceneItem = this.app.scenes.find('racetrack1');
 *
 * // Load the scene using the item's url
 * this.app.scenes.loadScene(sceneItem.url);
 */

/**
 * @name pc.Application#assets
 * @type {pc.AssetRegistry}
 * @description The asset registry managed by the application.
 * @example
 * // Search the asset registry for all assets with the tag 'vehicle'
 * var vehicleAssets = this.app.assets.findByTag('vehicle');
 */

/**
 * @name pc.Application#graphicsDevice
 * @type {pc.GraphicsDevice}
 * @description The graphics device used by the application.
 */

/**
 * @name pc.Application#systems
 * @type {pc.ComponentSystemRegistry}
 * @description The application's component system registry. The pc.Application
 * constructor adds the following component systems to its component system registry:
 *
 * * animation ({@link pc.AnimationComponentSystem})
 * * audiolistener ({@link pc.AudioListenerComponentSystem})
 * * button ({@link pc.ButtonComponentSystem})
 * * camera ({@link pc.CameraComponentSystem})
 * * collision ({@link pc.CollisionComponentSystem})
 * * element ({@link pc.ElementComponentSystem})
 * * layoutchild ({@link pc.LayoutChildComponentSystem})
 * * layoutgroup ({@link pc.LayoutGroupComponentSystem})
 * * light ({@link pc.LightComponentSystem})
 * * model ({@link pc.ModelComponentSystem})
 * * particlesystem ({@link pc.ParticleSystemComponentSystem})
 * * rigidbody ({@link pc.RigidBodyComponentSystem})
 * * screen ({@link pc.ScreenComponentSystem})
 * * script ({@link pc.ScriptComponentSystem})
 * * scrollbar ({@link pc.ScrollbarComponentSystem})
 * * scrollview ({@link pc.ScrollViewComponentSystem})
 * * sound ({@link pc.SoundComponentSystem})
 * * sprite ({@link pc.SpriteComponentSystem})
 * @example
 * // Set global gravity to zero
 * this.app.systems.rigidbody.gravity.set(0, 0, 0);
 * @example
 * // Set the global sound volume to 50%
 * this.app.systems.sound.volume = 0.5;
 */

/**
 * @name pc.Application#xr
 * @type {pc.XrManager}
 * @description The XR Manager that provides ability to start VR/AR sessions.
 * @example
 * // check if VR is available
 * if (app.xr.isAvailable(pc.XRTYPE_VR)) {
 *     // VR is available
 * }
 */


/**
 * @name pc.Application#lightmapper
 * @type {pc.Lightmapper}
 * @description The run-time lightmapper.
 */

/**
 * @name pc.Application#loader
 * @type {pc.ResourceLoader}
 * @description The resource loader.
 */

/**
 * @name pc.Application#root
 * @type {pc.Entity}
 * @description The root entity of the application.
 * @example
 * // Return the first entity called 'Camera' in a depth-first search of the scene hierarchy
 * var camera = this.app.root.findByName('Camera');
 */

/**
 * @name pc.Application#keyboard
 * @type {pc.Keyboard}
 * @description The keyboard device.
 */

/**
 * @name pc.Application#mouse
 * @type {pc.Mouse}
 * @description The mouse device.
 */

/**
 * @name pc.Application#touch
 * @type {pc.TouchDevice}
 * @description Used to get touch events input.
 */

/**
 * @name pc.Application#gamepads
 * @type {pc.GamePads}
 * @description Used to access GamePad input.
 */

/**
 * @name pc.Application#elementInput
 * @type {pc.ElementInput}
 * @description Used to handle input for {@link pc.ElementComponent}s.
 */

/**
 * @name pc.Application#scripts
 * @type {pc.ScriptRegistry}
 * @description The application's script registry.
 */

/**
 * @name pc.Application#batcher
 * @type {pc.BatchManager}
 * @description The application's batch manager. The batch manager is used to
 * merge mesh instances in the scene, which reduces the overall number of draw
 * calls, thereby boosting performance.
 */

/**
 * @name pc.Application#autoRender
 * @type {boolean}
 * @description When true, the application's render function is called every frame.
 * Setting autoRender to false is useful to applications where the rendered image
 * may often be unchanged over time. This can heavily reduce the application's
 * load on the CPU and GPU. Defaults to true.
 * @example
 * // Disable rendering every frame and only render on a keydown event
 * this.app.autoRender = false;
 * this.app.keyboard.on('keydown', function (event) {
 *     this.app.renderNextFrame = true;
 * }, this);
 */

/**
 * @name pc.Application#renderNextFrame
 * @type {boolean}
 * @description Set to true to render the scene on the next iteration of the main loop.
 * This only has an effect if {@link pc.Application#autoRender} is set to false. The
 * value of renderNextFrame is set back to false again as soon as the scene has been
 * rendered.
 * @example
 * // Render the scene only while space key is pressed
 * if (this.app.keyboard.isPressed(pc.KEY_SPACE)) {
 *     this.app.renderNextFrame = true;
 * }
 */

 /**
  * @name pc.Application#i18n
  * @type {pc.I18n}
  * @description Handles localization.
  */

/**
 * @private
 * @static
 * @name pc.app
 * @type {pc.Application|undefined}
 * @description Gets the current application, if any.
 */
var app = null;

class Application extends EventHandler {
    constructor(canvas, options = {}) {
        super();

        console.log("Powered by PlayCanvas " + version + " " + revision);

        // Store application instance
        Application._applications[canvas.id] = this;
        setApplication(this);

        app = this;

        this._time = 0;
        this.timeScale = 1;
        this.maxDeltaTime = 0.1; // Maximum delta is 0.1s or 10 fps.

        this.frame = 0; // the total number of frames the application has updated since start() was called

        this.autoRender = true;
        this.renderNextFrame = false;

        // enable if you want entity type script attributes
        // to not be re-mapped when an entity is cloned
        this.useLegacyScriptAttributeCloning = script.legacy;

        this._librariesLoaded = false;
        this._fillMode = FILLMODE_KEEP_ASPECT;
        this._resolutionMode = RESOLUTION_FIXED;
        this._allowResize = true;

        // for compatibility
        this.context = this;

        if (! options.graphicsDeviceOptions)
            options.graphicsDeviceOptions = { };

        options.graphicsDeviceOptions.xrCompatible = true;

        options.graphicsDeviceOptions.alpha = options.graphicsDeviceOptions.alpha || false;

        this.graphicsDevice = new GraphicsDevice(canvas, options.graphicsDeviceOptions);
        this.stats = new ApplicationStats(this.graphicsDevice);
        this._soundManager = new SoundManager(options);
        this.loader = new ResourceLoader(this);

        // stores all entities that have been created
        // for this app by guid
        this._entityIndex = {};

        this.scene = new Scene();
        this.root = new Entity(this);
        this.root._enabledInHierarchy = true;
        this._enableList = [];
        this._enableList.size = 0;
        this.assets = new AssetRegistry(this.loader);
        if (options.assetPrefix) this.assets.prefix = options.assetPrefix;
        this.bundles = new BundleRegistry(this.assets);
        // set this to false if you want to run without using bundles
        // We set it to true only if TextDecoder is available because we currently
        // rely on it for untarring.
        this.enableBundles = (typeof TextDecoder !== 'undefined');
        this.scriptsOrder = options.scriptsOrder || [];
        this.scripts = new ScriptRegistry(this);

        this.i18n = new I18n(this);

        this.scenes = new SceneRegistry(this);

        var self = this;
        this.defaultLayerWorld = new Layer({
            name: "World",
            id: LAYERID_WORLD
        });

        if (this.graphicsDevice.webgl2) {
            // WebGL 2 depth layer just copies existing depth
            this.defaultLayerDepth = new Layer({
                enabled: false,
                name: "Depth",
                id: LAYERID_DEPTH,

                onEnable: function () {
                    if (this.renderTarget) return;
                    var depthBuffer = new Texture(self.graphicsDevice, {
                        format: PIXELFORMAT_DEPTHSTENCIL,
                        width: self.graphicsDevice.width,
                        height: self.graphicsDevice.height
                    });
                    depthBuffer.name = 'rt-depth2';
                    depthBuffer.minFilter = FILTER_NEAREST;
                    depthBuffer.magFilter = FILTER_NEAREST;
                    depthBuffer.addressU = ADDRESS_CLAMP_TO_EDGE;
                    depthBuffer.addressV = ADDRESS_CLAMP_TO_EDGE;
                    this.renderTarget = new RenderTarget({
                        colorBuffer: null,
                        depthBuffer: depthBuffer,
                        autoResolve: false
                    });
                    self.graphicsDevice.scope.resolve("uDepthMap").setValue(depthBuffer);
                },

                onDisable: function () {
                    if (!this.renderTarget) return;
                    this.renderTarget._depthBuffer.destroy();
                    this.renderTarget.destroy();
                    this.renderTarget = null;
                },

                onPreRenderOpaque: function (cameraPass) { // resize depth map if needed
                    var gl = self.graphicsDevice.gl;
                    this.srcFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING);

                    if (!this.renderTarget || (this.renderTarget.width !== self.graphicsDevice.width || this.renderTarget.height !== self.graphicsDevice.height)) {
                        this.onDisable();
                        this.onEnable();
                    }

                    // disable clearing
                    this.oldClear = this.cameras[cameraPass].camera._clearOptions;
                    this.cameras[cameraPass].camera._clearOptions = this.depthClearOptions;
                },

                onPostRenderOpaque: function (cameraPass) { // copy depth
                    if (!this.renderTarget) return;

                    this.cameras[cameraPass].camera._clearOptions = this.oldClear;

                    var gl = self.graphicsDevice.gl;

                    self.graphicsDevice.setRenderTarget(this.renderTarget);
                    self.graphicsDevice.updateBegin();

                    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.srcFbo);
                    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.renderTarget._glFrameBuffer);
                    gl.blitFramebuffer( 0, 0, this.renderTarget.width, this.renderTarget.height,
                                        0, 0, this.renderTarget.width, this.renderTarget.height,
                                        gl.DEPTH_BUFFER_BIT,
                                        gl.NEAREST);
                }

            });
            this.defaultLayerDepth.depthClearOptions = {
                flags: 0
            };
        } else {
            // WebGL 1 depth layer just renders same objects as in World, but with RGBA-encoded depth shader
            this.defaultLayerDepth = new Layer({
                enabled: false,
                name: "Depth",
                id: LAYERID_DEPTH,
                shaderPass: SHADER_DEPTH,

                onEnable: function () {
                    if (this.renderTarget) return;
                    var colorBuffer = new Texture(self.graphicsDevice, {
                        format: PIXELFORMAT_R8_G8_B8_A8,
                        width: self.graphicsDevice.width,
                        height: self.graphicsDevice.height
                    });
                    colorBuffer.name = 'rt-depth1';
                    colorBuffer.minFilter = FILTER_NEAREST;
                    colorBuffer.magFilter = FILTER_NEAREST;
                    colorBuffer.addressU = ADDRESS_CLAMP_TO_EDGE;
                    colorBuffer.addressV = ADDRESS_CLAMP_TO_EDGE;
                    this.renderTarget = new RenderTarget(self.graphicsDevice, colorBuffer, {
                        depth: true,
                        stencil: self.graphicsDevice.supportsStencil
                    });
                    self.graphicsDevice.scope.resolve("uDepthMap").setValue(colorBuffer);
                },

                onDisable: function () {
                    if (!this.renderTarget) return;
                    this.renderTarget._colorBuffer.destroy();
                    this.renderTarget.destroy();
                    this.renderTarget = null;
                },

                onPostCull: function (cameraPass) {
                    // Collect all rendered mesh instances with the same render target as World has, depthWrite == true and prior to this layer to replicate blitFramebuffer on WebGL2
                    var visibleObjects = this.instances.visibleOpaque[cameraPass];
                    var visibleList = visibleObjects.list;
                    var visibleLength = 0;
                    var layers = self.scene.layers.layerList;
                    var subLayerEnabled = self.scene.layers.subLayerEnabled;
                    var isTransparent = self.scene.layers.subLayerList;
                    // can't use self.defaultLayerWorld.renderTarget because projects that use the editor override default layers
                    var rt = self.scene.layers.getLayerById(LAYERID_WORLD).renderTarget;
                    var cam = this.cameras[cameraPass];
                    var layer;
                    var j;
                    var layerVisibleList, layerCamId, layerVisibleListLength, drawCall, transparent;
                    for (var i = 0; i < layers.length; i++) {
                        layer = layers[i];
                        if (layer === this) break;
                        if (layer.renderTarget !== rt || !layer.enabled || !subLayerEnabled[i]) continue;
                        layerCamId = layer.cameras.indexOf(cam);
                        if (layerCamId < 0) continue;
                        transparent = isTransparent[i];
                        layerVisibleList = transparent ? layer.instances.visibleTransparent[layerCamId] : layer.instances.visibleOpaque[layerCamId];
                        layerVisibleListLength = layerVisibleList.length;
                        layerVisibleList = layerVisibleList.list;
                        for (j = 0; j < layerVisibleListLength; j++) {
                            drawCall = layerVisibleList[j];
                            if (drawCall.material && drawCall.material.depthWrite && !drawCall._noDepthDrawGl1) {
                                visibleList[visibleLength] = drawCall;
                                visibleLength++;
                            }
                        }
                    }
                    visibleObjects.length = visibleLength;
                },

                onPreRenderOpaque: function (cameraPass) { // resize depth map if needed
                    if (!this.renderTarget || (this.renderTarget.width !== self.graphicsDevice.width || this.renderTarget.height !== self.graphicsDevice.height)) {
                        this.onDisable();
                        this.onEnable();
                    }
                    this.oldClear = this.cameras[cameraPass].camera._clearOptions;
                    this.cameras[cameraPass].camera._clearOptions = this.rgbaDepthClearOptions;
                },

                onDrawCall: function () {
                    self.graphicsDevice.setColorWrite(true, true, true, true);
                },

                onPostRenderOpaque: function (cameraPass) {
                    if (!this.renderTarget) return;
                    this.cameras[cameraPass].camera._clearOptions = this.oldClear;
                }

            });
            this.defaultLayerDepth.rgbaDepthClearOptions = {
                color: [254.0 / 255, 254.0 / 255, 254.0 / 255, 254.0 / 255],
                depth: 1.0,
                flags: CLEARFLAG_COLOR | CLEARFLAG_DEPTH
            };
        }

        this.defaultLayerSkybox = new Layer({
            enabled: false,
            name: "Skybox",
            id: LAYERID_SKYBOX,
            opaqueSortMode: SORTMODE_NONE
        });
        this.defaultLayerUi = new Layer({
            enabled: true,
            name: "UI",
            id: LAYERID_UI,
            transparentSortMode: SORTMODE_MANUAL,
            passThrough: false
        });
        this.defaultLayerImmediate = new Layer({
            enabled: true,
            name: "Immediate",
            id: LAYERID_IMMEDIATE,
            opaqueSortMode: SORTMODE_NONE,
            passThrough: true
        });
        this.defaultLayerComposition = new LayerComposition("default");

        this.defaultLayerComposition.pushOpaque(this.defaultLayerWorld);
        this.defaultLayerComposition.pushOpaque(this.defaultLayerDepth);
        this.defaultLayerComposition.pushOpaque(this.defaultLayerSkybox);
        this.defaultLayerComposition.pushTransparent(this.defaultLayerWorld);
        this.defaultLayerComposition.pushOpaque(this.defaultLayerImmediate);
        this.defaultLayerComposition.pushTransparent(this.defaultLayerImmediate);
        this.defaultLayerComposition.pushTransparent(this.defaultLayerUi);

        this.scene.layers = this.defaultLayerComposition;

        this._immediateLayer = this.defaultLayerImmediate;

        // Default layers patch
        this.scene.on('set:layers', function (oldComp, newComp) {
            var list = newComp.layerList;
            var layer;
            for (var i = 0; i < list.length; i++) {
                layer = list[i];
                switch (layer.id) {
                    case LAYERID_DEPTH:
                        layer.onEnable = self.defaultLayerDepth.onEnable;
                        layer.onDisable = self.defaultLayerDepth.onDisable;
                        layer.onPreRenderOpaque = self.defaultLayerDepth.onPreRenderOpaque;
                        layer.onPostRenderOpaque = self.defaultLayerDepth.onPostRenderOpaque;
                        layer.depthClearOptions = self.defaultLayerDepth.depthClearOptions;
                        layer.rgbaDepthClearOptions = self.defaultLayerDepth.rgbaDepthClearOptions;
                        layer.shaderPass = self.defaultLayerDepth.shaderPass;
                        layer.onPostCull = self.defaultLayerDepth.onPostCull;
                        layer.onDrawCall = self.defaultLayerDepth.onDrawCall;
                        break;
                    case LAYERID_UI:
                        layer.passThrough = self.defaultLayerUi.passThrough;
                        break;
                    case LAYERID_IMMEDIATE:
                        layer.passThrough = self.defaultLayerImmediate.passThrough;
                        break;
                }
            }
        });

        this.renderer = new ForwardRenderer(this.graphicsDevice);
        this.renderer.scene = this.scene;
        this.lightmapper = new Lightmapper(this.graphicsDevice, this.root, this.scene, this.renderer, this.assets);
        this.once('prerender', this._firstBake, this);
        this.batcher = new BatchManager(this.graphicsDevice, this.root, this.scene);
        this.once('prerender', this._firstBatch, this);

        this.keyboard = options.keyboard || null;
        this.mouse = options.mouse || null;
        this.touch = options.touch || null;
        this.gamepads = options.gamepads || null;
        this.elementInput = options.elementInput || null;
        if (this.elementInput)
            this.elementInput.app = this;

        this.vr = null;
        this.xr = new XrManager(this);

        if (this.elementInput)
            this.elementInput.attachSelectEvents();

        this._inTools = false;

        this._skyboxLast = 0;

        this._scriptPrefix = options.scriptPrefix || '';

        if (this.enableBundles) {
            this.loader.addHandler("bundle", new BundleHandler(this.assets));
        }

        this.loader.addHandler("animation", new AnimationHandler());
        this.loader.addHandler("animclip", new AnimClipHandler());
        this.loader.addHandler("animstategraph", new AnimStateGraphHandler());
        this.loader.addHandler("model", new ModelHandler(this.graphicsDevice, this.scene.defaultMaterial));
        this.loader.addHandler("render", new RenderHandler(this.assets));
        this.loader.addHandler("material", new MaterialHandler(this));
        this.loader.addHandler("texture", new TextureHandler(this.graphicsDevice, this.assets, this.loader));
        this.loader.addHandler("text", new TextHandler());
        this.loader.addHandler("json", new JsonHandler());
        this.loader.addHandler("audio", new AudioHandler(this._soundManager));
        this.loader.addHandler("script", new ScriptHandler(this));
        this.loader.addHandler("scene", new SceneHandler(this));
        this.loader.addHandler("cubemap", new CubemapHandler(this.graphicsDevice, this.assets, this.loader));
        this.loader.addHandler("html", new HtmlHandler());
        this.loader.addHandler("css", new CssHandler());
        this.loader.addHandler("shader", new ShaderHandler());
        this.loader.addHandler("hierarchy", new HierarchyHandler(this));
        this.loader.addHandler("scenesettings", new SceneSettingsHandler(this));
        this.loader.addHandler("folder", new FolderHandler());
        this.loader.addHandler("font", new FontHandler(this.loader));
        this.loader.addHandler("binary", new BinaryHandler());
        this.loader.addHandler("textureatlas", new TextureAtlasHandler(this.loader));
        this.loader.addHandler("sprite", new SpriteHandler(this.assets, this.graphicsDevice));
        this.loader.addHandler("template", new TemplateHandler(this));
        this.loader.addHandler("container", new ContainerHandler(this.graphicsDevice, this.scene.defaultMaterial));

        this.systems = new ComponentSystemRegistry();
        this.systems.add(new RigidBodyComponentSystem(this));
        this.systems.add(new CollisionComponentSystem(this));
        this.systems.add(new AnimationComponentSystem(this));
        this.systems.add(new AnimComponentSystem(this));
        this.systems.add(new ModelComponentSystem(this));
        this.systems.add(new RenderComponentSystem(this));
        this.systems.add(new CameraComponentSystem(this));
        this.systems.add(new LightComponentSystem(this));
        if (script.legacy) {
            this.systems.add(new ScriptLegacyComponentSystem(this));
        } else {
            this.systems.add(new ScriptComponentSystem(this));
        }
        this.systems.add(new AudioSourceComponentSystem(this, this._soundManager));
        this.systems.add(new SoundComponentSystem(this, this._soundManager));
        this.systems.add(new AudioListenerComponentSystem(this, this._soundManager));
        this.systems.add(new ParticleSystemComponentSystem(this));
        this.systems.add(new ScreenComponentSystem(this));
        this.systems.add(new ElementComponentSystem(this));
        this.systems.add(new ButtonComponentSystem(this));
        this.systems.add(new ScrollViewComponentSystem(this));
        this.systems.add(new ScrollbarComponentSystem(this));
        this.systems.add(new SpriteComponentSystem(this));
        this.systems.add(new LayoutGroupComponentSystem(this));
        this.systems.add(new LayoutChildComponentSystem(this));
        this.systems.add(new ZoneComponentSystem(this));

        this._visibilityChangeHandler = this.onVisibilityChange.bind(this);

        // Depending on browser add the correct visibiltychange event and store the name of the hidden attribute
        // in this._hiddenAttr.
        if (typeof document !== 'undefined') {
            if (document.hidden !== undefined) {
                this._hiddenAttr = 'hidden';
                document.addEventListener('visibilitychange', this._visibilityChangeHandler, false);
            } else if (document.mozHidden !== undefined) {
                this._hiddenAttr = 'mozHidden';
                document.addEventListener('mozvisibilitychange', this._visibilityChangeHandler, false);
            } else if (document.msHidden !== undefined) {
                this._hiddenAttr = 'msHidden';
                document.addEventListener('msvisibilitychange', this._visibilityChangeHandler, false);
            } else if (document.webkitHidden !== undefined) {
                this._hiddenAttr = 'webkitHidden';
                document.addEventListener('webkitvisibilitychange', this._visibilityChangeHandler, false);
            }
        }

        this.meshInstanceArray = [];

        // bind tick function to current scope

        /* eslint-disable-next-line no-use-before-define */
        this.tick = makeTick(this); // Circular linting issue as makeTick and Application reference each other
    }

    static _applications = {};

    /**
     * @static
     * @function
     * @name pc.Application.getApplication
     * @description Get the current application. In the case where there are multiple running
     * applications, the function can get an application based on a supplied canvas id. This
     * function is particularly useful when the current pc.Application is not readily available.
     * For example, in the JavaScript console of the browser's developer tools.
     * @param {string} [id] - If defined, the returned application should use the canvas which has this id. Otherwise current application will be returned.
     * @returns {pc.Application|undefined} The running application, if any.
     * @example
     * var app = pc.Application.getApplication();
     */
    static getApplication(id) {
        return id ? Application._applications[id] : getApplication();
    }

    /**
     * @readonly
     * @name pc.Application#fillMode
     * @type {string}
     * @description The current fill mode of the canvas. Can be:
     *
     * * {@link pc.FILLMODE_NONE}: the canvas will always match the size provided.
     * * {@link pc.FILLMODE_FILL_WINDOW}: the canvas will simply fill the window, changing aspect ratio.
     * * {@link pc.FILLMODE_KEEP_ASPECT}: the canvas will grow to fill the window as best it can while maintaining the aspect ratio.
     */
    get fillMode() {
        return this._fillMode;
    }

    /**
     * @readonly
     * @name pc.Application#resolutionMode
     * @type {string}
     * @description The current resolution mode of the canvas, Can be:
     *
     * * {@link pc.RESOLUTION_AUTO}: if width and height are not provided, canvas will be resized to match canvas client size.
     * * {@link pc.RESOLUTION_FIXED}: resolution of canvas will be fixed.
     */
    get resolutionMode() {
        return this._resolutionMode;
    }

    /**
     * @function
     * @name pc.Application#configure
     * @description Load the application configuration file and apply application properties and fill the asset registry.
     * @param {string} url - The URL of the configuration file to load.
     * @param {pc.callbacks.ConfigureApp} callback - The Function called when the configuration file is loaded and parsed (or an error occurs).
     */
    configure(url, callback) {
        var self = this;
        http.get(url, function (err, response) {
            if (err) {
                callback(err);
                return;
            }

            var props = response.application_properties;
            var scenes = response.scenes;
            var assets = response.assets;

            self._parseApplicationProperties(props, function (err) {
                self._parseScenes(scenes);
                self._parseAssets(assets);
                if (!err) {
                    callback(null);
                } else {
                    callback(err);
                }
            });
        });
    }

    /**
     * @function
     * @name pc.Application#preload
     * @description Load all assets in the asset registry that are marked as 'preload'.
     * @param {pc.callbacks.PreloadApp} callback - Function called when all assets are loaded.
     */
    preload(callback) {
        var self = this;
        var i, total;

        self.fire("preload:start");

        // get list of assets to preload
        var assets = this.assets.list({
            preload: true
        });

        var _assets = new Progress(assets.length);

        var _done = false;

        // check if all loading is done
        var done = function () {
            // do not proceed if application destroyed
            if (!self.graphicsDevice) {
                return;
            }

            if (!_done && _assets.done()) {
                _done = true;
                self.fire("preload:end");
                callback();
            }
        };

        // totals loading progress of assets
        total = assets.length;
        var count = function () {
            return _assets.count;
        };

        if (_assets.length) {
            var onAssetLoad = function (asset) {
                _assets.inc();
                self.fire('preload:progress', count() / total);

                if (_assets.done())
                    done();
            };

            var onAssetError = function (err, asset) {
                _assets.inc();
                self.fire('preload:progress', count() / total);

                if (_assets.done())
                    done();
            };

            // for each asset
            for (i = 0; i < assets.length; i++) {
                if (!assets[i].loaded) {
                    assets[i].once('load', onAssetLoad);
                    assets[i].once('error', onAssetError);

                    this.assets.load(assets[i]);
                } else {
                    _assets.inc();
                    self.fire("preload:progress", count() / total);

                    if (_assets.done())
                        done();
                }
            }
        } else {
            done();
        }
    }

    _preloadScripts(sceneData, callback) {
        if (!script.legacy) {
            callback();
            return;
        }

        var self = this;

        self.systems.script.preloading = true;

        var scripts = this._getScriptReferences(sceneData);

        var i = 0, l = scripts.length;
        var progress = new Progress(l);
        var scriptUrl;
        var regex = /^http(s)?:\/\//;

        if (l) {
            var onLoad = function (err, ScriptType) {
                if (err)
                    console.error(err);

                progress.inc();
                if (progress.done()) {
                    self.systems.script.preloading = false;
                    callback();
                }
            };

            for (i = 0; i < l; i++) {
                scriptUrl = scripts[i];
                // support absolute URLs (for now)
                if (!regex.test(scriptUrl.toLowerCase()) && self._scriptPrefix)
                    scriptUrl = path.join(self._scriptPrefix, scripts[i]);

                this.loader.load(scriptUrl, 'script', onLoad);
            }
        } else {
            self.systems.script.preloading = false;
            callback();
        }
    }

    // handle area light property
    _handleAreaLightDataProperty(prop) {
        var asset = this.assets.get(prop);
        if (asset) {
            this.setAreaLightData(asset);
        } else {
            this.assets.once('add:' + prop, this.setAreaLightData, this);
        }
    }

    // set application properties from data file
    _parseApplicationProperties(props, callback) {
        var i;
        var len;

        // configure retrying assets
        if (typeof props.maxAssetRetries === 'number' && props.maxAssetRetries > 0) {
            this.loader.enableRetry(props.maxAssetRetries);
        }

        // TODO: remove this temporary block after migrating properties
        if (!props.useDevicePixelRatio)
            props.useDevicePixelRatio = props.use_device_pixel_ratio;
        if (!props.resolutionMode)
            props.resolutionMode = props.resolution_mode;
        if (!props.fillMode)
            props.fillMode = props.fill_mode;

        this._width = props.width;
        this._height = props.height;
        if (props.useDevicePixelRatio) {
            this.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
        }

        this.setCanvasResolution(props.resolutionMode, this._width, this._height);
        this.setCanvasFillMode(props.fillMode, this._width, this._height);

        // set up layers
        if (props.layers && props.layerOrder) {
            var composition = new LayerComposition("application");

            var layers = {};
            for (var key in props.layers) {
                var data = props.layers[key];
                data.id = parseInt(key, 10);
                // depth layer should only be enabled when needed
                // by incrementing its ref counter
                data.enabled = data.id !== LAYERID_DEPTH;
                layers[key] = new Layer(data);
            }

            for (i = 0, len = props.layerOrder.length; i < len; i++) {
                var sublayer = props.layerOrder[i];
                var layer = layers[sublayer.layer];
                if (!layer) continue;

                if (sublayer.transparent) {
                    composition.pushTransparent(layer);
                } else {
                    composition.pushOpaque(layer);
                }

                composition.subLayerEnabled[i] = sublayer.enabled;
            }

            this.scene.layers = composition;
        }

        // add batch groups
        if (props.batchGroups) {
            for (i = 0, len = props.batchGroups.length; i < len; i++) {
                var grp = props.batchGroups[i];
                this.batcher.addGroup(grp.name, grp.dynamic, grp.maxAabbSize, grp.id, grp.layers);
            }

        }

        // set localization assets
        if (props.i18nAssets) {
            this.i18n.assets = props.i18nAssets;
        }

        if (props.areaLightData) {
            this._handleAreaLightDataProperty(props.areaLightData);
        }

        this._loadLibraries(props.libraries, callback);
    }

    _loadLibraries(urls, callback) {
        var len = urls.length;
        var count = len;
        var self = this;

        var regex = /^http(s)?:\/\//;

        if (len) {
            var onLoad = function (err, script) {
                count--;
                if (err) {
                    callback(err);
                } else if (count === 0) {
                    self.onLibrariesLoaded();
                    callback(null);
                }
            };

            for (var i = 0; i < len; ++i) {
                var url = urls[i];

                if (!regex.test(url.toLowerCase()) && self._scriptPrefix)
                    url = path.join(self._scriptPrefix, url);

                this.loader.load(url, 'script', onLoad);
            }
        } else {
            self.onLibrariesLoaded();
            callback(null);
        }
    }

    // insert scene name/urls into the registry
    _parseScenes(scenes) {
        if (!scenes) return;

        for (var i = 0; i < scenes.length; i++) {
            this.scenes.add(scenes[i].name, scenes[i].url);
        }
    }

    // insert assets into registry
    _parseAssets(assets) {
        var i, id;
        var list = [];

        var scriptsIndex = {};
        var bundlesIndex = {};

        if (!script.legacy) {
            // add scripts in order of loading first
            for (i = 0; i < this.scriptsOrder.length; i++) {
                id = this.scriptsOrder[i];
                if (!assets[id])
                    continue;

                scriptsIndex[id] = true;
                list.push(assets[id]);
            }

            // then add bundles
            if (this.enableBundles) {
                for (id in assets) {
                    if (assets[id].type === 'bundle') {
                        bundlesIndex[id] = true;
                        list.push(assets[id]);
                    }
                }
            }

            // then add rest of assets
            for (id in assets) {
                if (scriptsIndex[id] || bundlesIndex[id])
                    continue;

                list.push(assets[id]);
            }
        } else {
            if (this.enableBundles) {
                // add bundles
                for (id in assets) {
                    if (assets[id].type === 'bundle') {
                        bundlesIndex[id] = true;
                        list.push(assets[id]);
                    }
                }
            }


            // then add rest of assets
            for (id in assets) {
                if (bundlesIndex[id])
                    continue;

                list.push(assets[id]);
            }
        }

        for (i = 0; i < list.length; i++) {
            var data = list[i];
            var asset = new Asset(data.name, data.type, data.file, data.data);
            asset.id = parseInt(data.id, 10);
            asset.preload = data.preload ? data.preload : false;
            // if this is a script asset and has already been embedded in the page then
            // mark it as loaded
            asset.loaded = data.type === 'script' && data.data && data.data.loadingType > 0;
            // tags
            asset.tags.add(data.tags);
            // i18n
            if (data.i18n) {
                for (var locale in data.i18n) {
                    asset.addLocalizedAssetId(locale, data.i18n[locale]);
                }
            }
            // registry
            this.assets.add(asset);
        }
    }

    _getScriptReferences(scene) {
        var i, key;

        var priorityScripts = [];
        if (scene.settings.priority_scripts) {
            priorityScripts = scene.settings.priority_scripts;
        }

        var _scripts = [];
        var _index = {};

        // first add priority scripts
        for (i = 0; i < priorityScripts.length; i++) {
            _scripts.push(priorityScripts[i]);
            _index[priorityScripts[i]] = true;
        }

        // then iterate hierarchy to get referenced scripts
        var entities = scene.entities;
        for (key in entities) {
            if (!entities[key].components.script) {
                continue;
            }

            var scripts = entities[key].components.script.scripts;
            for (i = 0; i < scripts.length; i++) {
                if (_index[scripts[i].url])
                    continue;
                _scripts.push(scripts[i].url);
                _index[scripts[i].url] = true;
            }
        }

        return _scripts;
    }

    /**
     * @function
     * @name pc.Application#start
     * @description Start the application. This function does the following:
     * 1. Fires an event on the application named 'start'
     * 2. Calls initialize for all components on entities in the hierarchy
     * 3. Fires an event on the application named 'initialize'
     * 4. Calls postInitialize for all components on entities in the hierarchy
     * 5. Fires an event on the application named 'postinitialize'
     * 6. Starts executing the main loop of the application
     * This function is called internally by PlayCanvas applications made in the Editor
     * but you will need to call start yourself if you are using the engine stand-alone.
     * @example
     * app.start();
     */
    start() {
        this.frame = 0;

        this.fire("start", {
            timestamp: now(),
            target: this
        });

        if (!this._librariesLoaded) {
            this.onLibrariesLoaded();
        }

        ComponentSystem.initialize(this.root);
        this.fire("initialize");

        ComponentSystem.postInitialize(this.root);
        this.fire("postinitialize");

        this.tick();
    }

    /**
     * @function
     * @name pc.Application#update
     * @description Update the application. This function will call the update
     * functions and then the postUpdate functions of all enabled components. It
     * will then update the current state of all connected input devices.
     * This function is called internally in the application's main loop and
     * does not need to be called explicitly.
     * @param {number} dt - The time delta since the last frame.
     */
    update(dt) {
        this.frame++;

        this.graphicsDevice.updateClientRect();

        if (this.vr) this.vr.poll();

        // #ifdef PROFILER
        this.stats.frame.updateStart = now();
        // #endif

        // Perform ComponentSystem update
        if (script.legacy)
            ComponentSystem.fixedUpdate(1.0 / 60.0, this._inTools);

        ComponentSystem.update(dt, this._inTools);
        ComponentSystem.animationUpdate(dt, this._inTools);
        ComponentSystem.postUpdate(dt, this._inTools);

        // fire update event
        this.fire("update", dt);

        if (this.controller) {
            this.controller.update(dt);
        }
        if (this.mouse) {
            this.mouse.update(dt);
        }
        if (this.keyboard) {
            this.keyboard.update(dt);
        }
        if (this.gamepads) {
            this.gamepads.update(dt);
        }

        // #ifdef PROFILER
        this.stats.frame.updateTime = now() - this.stats.frame.updateStart;
        // #endif
    }

    /**
     * @function
     * @name pc.Application#render
     * @description Render the application's scene. More specifically, the scene's
     * {@link pc.LayerComposition} is rendered by the application's {@link pc.ForwardRenderer}.
     * This function is called internally in the application's main loop and
     * does not need to be called explicitly.
     */
    render() {
        // #ifdef PROFILER
        this.stats.frame.renderStart = now();
        // #endif

        this.fire("prerender");
        this.root.syncHierarchy();
        this.batcher.updateAll();
        this.renderer.renderComposition(this.scene.layers);
        this.fire("postrender");

        // #ifdef PROFILER
        this.stats.frame.renderTime = now() - this.stats.frame.renderStart;
        // #endif
    }

    _fillFrameStatsBasic(now, dt, ms) {
        // Timing stats
        var stats = this.stats.frame;
        stats.dt = dt;
        stats.ms = ms;
        if (now > stats._timeToCountFrames) {
            stats.fps = stats._fpsAccum;
            stats._fpsAccum = 0;
            stats._timeToCountFrames = now + 1000;
        } else {
            stats._fpsAccum++;
        }

        // total draw call
        this.stats.drawCalls.total = this.graphicsDevice._drawCallsPerFrame;
        this.graphicsDevice._drawCallsPerFrame = 0;
    }

    _fillFrameStats() {
        var stats = this.stats.frame;

        // Render stats
        stats.cameras = this.renderer._camerasRendered;
        stats.materials = this.renderer._materialSwitches;
        stats.shaders = this.graphicsDevice._shaderSwitchesPerFrame;
        stats.shadowMapUpdates = this.renderer._shadowMapUpdates;
        stats.shadowMapTime = this.renderer._shadowMapTime;
        stats.depthMapTime = this.renderer._depthMapTime;
        stats.forwardTime = this.renderer._forwardTime;
        var prims = this.graphicsDevice._primsPerFrame;
        stats.triangles = prims[PRIMITIVE_TRIANGLES] / 3 +
            Math.max(prims[PRIMITIVE_TRISTRIP] - 2, 0) +
            Math.max(prims[PRIMITIVE_TRIFAN] - 2, 0);
        stats.cullTime = this.renderer._cullTime;
        stats.sortTime = this.renderer._sortTime;
        stats.skinTime = this.renderer._skinTime;
        stats.morphTime = this.renderer._morphTime;
        stats.instancingTime = this.renderer._instancingTime;
        stats.otherPrimitives = 0;
        for (var i = 0; i < prims.length; i++) {
            if (i < PRIMITIVE_TRIANGLES) {
                stats.otherPrimitives += prims[i];
            }
            prims[i] = 0;
        }
        this.renderer._camerasRendered = 0;
        this.renderer._materialSwitches = 0;
        this.renderer._shadowMapUpdates = 0;
        this.graphicsDevice._shaderSwitchesPerFrame = 0;
        this.renderer._cullTime = 0;
        this.renderer._layerCompositionUpdateTime = 0;
        this.renderer._sortTime = 0;
        this.renderer._skinTime = 0;
        this.renderer._morphTime = 0;
        this.renderer._instancingTime = 0;
        this.renderer._shadowMapTime = 0;
        this.renderer._depthMapTime = 0;
        this.renderer._forwardTime = 0;

        // Draw call stats
        stats = this.stats.drawCalls;
        stats.forward = this.renderer._forwardDrawCalls;
        stats.culled = this.renderer._numDrawCallsCulled;
        stats.depth = 0;
        stats.shadow = this.renderer._shadowDrawCalls;
        stats.skinned = this.renderer._skinDrawCalls;
        stats.immediate = 0;
        stats.instanced = 0;
        stats.removedByInstancing = 0;
        stats.misc = stats.total - (stats.forward + stats.shadow);
        this.renderer._depthDrawCalls = 0;
        this.renderer._shadowDrawCalls = 0;
        this.renderer._forwardDrawCalls = 0;
        this.renderer._numDrawCallsCulled = 0;
        this.renderer._skinDrawCalls = 0;
        this.renderer._immediateRendered = 0;
        this.renderer._instancedDrawCalls = 0;
        this.renderer._removedByInstancing = 0;

        this.stats.misc.renderTargetCreationTime = this.graphicsDevice.renderTargetCreationTime;

        stats = this.stats.particles;
        stats.updatesPerFrame = stats._updatesPerFrame;
        stats.frameTime = stats._frameTime;
        stats._updatesPerFrame = 0;
        stats._frameTime = 0;
    }

    /**
     * @function
     * @name pc.Application#setCanvasFillMode
     * @description Controls how the canvas fills the window and resizes when the window changes.
     * @param {string} mode - The mode to use when setting the size of the canvas. Can be:
     *
     * * {@link pc.FILLMODE_NONE}: the canvas will always match the size provided.
     * * {@link pc.FILLMODE_FILL_WINDOW}: the canvas will simply fill the window, changing aspect ratio.
     * * {@link pc.FILLMODE_KEEP_ASPECT}: the canvas will grow to fill the window as best it can while maintaining the aspect ratio.
     * @param {number} [width] - The width of the canvas (only used when mode is pc.FILLMODE_NONE).
     * @param {number} [height] - The height of the canvas (only used when mode is pc.FILLMODE_NONE).
     */
    setCanvasFillMode(mode, width, height) {
        this._fillMode = mode;
        this.resizeCanvas(width, height);
    }

    /**
     * @function
     * @name pc.Application#setCanvasResolution
     * @description Change the resolution of the canvas, and set the way it behaves when the window is resized.
     * @param {string} mode - The mode to use when setting the resolution. Can be:
     *
     * * {@link pc.RESOLUTION_AUTO}: if width and height are not provided, canvas will be resized to match canvas client size.
     * * {@link pc.RESOLUTION_FIXED}: resolution of canvas will be fixed.
     * @param {number} [width] - The horizontal resolution, optional in AUTO mode, if not provided canvas clientWidth is used.
     * @param {number} [height] - The vertical resolution, optional in AUTO mode, if not provided canvas clientHeight is used.
     */
    setCanvasResolution(mode, width, height) {
        this._resolutionMode = mode;

        // In AUTO mode the resolution is the same as the canvas size, unless specified
        if (mode === RESOLUTION_AUTO && (width === undefined)) {
            width = this.graphicsDevice.canvas.clientWidth;
            height = this.graphicsDevice.canvas.clientHeight;
        }

        this.graphicsDevice.resizeCanvas(width, height);
    }

    /**
     * @function
     * @name pc.Application#isHidden
     * @description Queries the visibility of the window or tab in which the application is running.
     * @returns {boolean} True if the application is not visible and false otherwise.
     */
    isHidden() {
        return document[this._hiddenAttr];
    }

    /**
     * @private
     * @function
     * @name pc.Application#onVisibilityChange
     * @description Called when the visibility state of the current tab/window changes.
     */
    onVisibilityChange() {
        if (this.isHidden()) {
            this._soundManager.suspend();
        } else {
            this._soundManager.resume();
        }
    }

    /**
     * @function
     * @name pc.Application#resizeCanvas
     * @description Resize the application's canvas element in line with the current fill mode.
     * In {@link pc.FILLMODE_KEEP_ASPECT} mode, the canvas will grow to fill the window as best it can while maintaining the aspect ratio.
     * In {@link pc.FILLMODE_FILL_WINDOW} mode, the canvas will simply fill the window, changing aspect ratio.
     * In {@link pc.FILLMODE_NONE} mode, the canvas will always match the size provided.
     * @param {number} [width] - The width of the canvas. Only used if current fill mode is {@link pc.FILLMODE_NONE}.
     * @param {number} [height] - The height of the canvas. Only used if current fill mode is {@link pc.FILLMODE_NONE}.
     * @returns {object} A object containing the values calculated to use as width and height.
     */
    resizeCanvas(width, height) {
        if (!this._allowResize) return; // prevent resizing (e.g. if presenting in VR HMD)

        // prevent resizing when in XR session
        if (this.xr && this.xr.session)
            return;

        var windowWidth = window.innerWidth;
        var windowHeight = window.innerHeight;

        if (this._fillMode === FILLMODE_KEEP_ASPECT) {
            var r = this.graphicsDevice.canvas.width / this.graphicsDevice.canvas.height;
            var winR = windowWidth / windowHeight;

            if (r > winR) {
                width = windowWidth;
                height = width / r;
            } else {
                height = windowHeight;
                width = height * r;
            }
        } else if (this._fillMode === FILLMODE_FILL_WINDOW) {
            width = windowWidth;
            height = windowHeight;
        }
        // OTHERWISE: FILLMODE_NONE use width and height that are provided

        this.graphicsDevice.canvas.style.width = width + 'px';
        this.graphicsDevice.canvas.style.height = height + 'px';

        // In AUTO mode the resolution is changed to match the canvas size
        if (this._resolutionMode === RESOLUTION_AUTO) {
            this.setCanvasResolution(RESOLUTION_AUTO);
        }

        // return the final values calculated for width and height
        return {
            width: width,
            height: height
        };
    }

    /**
     * @private
     * @name pc.Application#onLibrariesLoaded
     * @description Event handler called when all code libraries have been loaded.
     * Code libraries are passed into the constructor of the Application and the application won't start running or load packs until all libraries have
     * been loaded.
     */
    onLibrariesLoaded() {
        this._librariesLoaded = true;
        this.systems.rigidbody.onLibraryLoaded();
    }

    /**
     * @function
     * @name pc.Application#applySceneSettings
     * @description Apply scene settings to the current scene. Useful when your scene settings are parsed or generated from a non-URL source.
     * @param {object} settings - The scene settings to be applied.
     * @param {object} settings.physics - The physics settings to be applied.
     * @param {number[]} settings.physics.gravity - The world space vector representing global gravity in the physics simulation. Must be a fixed size array with three number elements, corresponding to each axis [ X, Y, Z ].
     * @param {object} settings.render - The rendering settings to be applied.
     * @param {number[]} settings.render.global_ambient - The color of the scene's ambient light. Must be a fixed size array with three number elements, corresponding to each color channel [ R, G, B ].
     * @param {string} settings.render.fog - The type of fog used by the scene. Can be:
     *
     * * {@link pc.FOG_NONE}
     * * {@link pc.FOG_LINEAR}
     * * {@link pc.FOG_EXP}
     * * {@link pc.FOG_EXP2}
     * @param {number[]} settings.render.fog_color - The color of the fog (if enabled). Must be a fixed size array with three number elements, corresponding to each color channel [ R, G, B ].
     * @param {number} settings.render.fog_density - The density of the fog (if enabled). This property is only valid if the fog property is set to pc.FOG_EXP or pc.FOG_EXP2.
     * @param {number} settings.render.fog_start - The distance from the viewpoint where linear fog begins. This property is only valid if the fog property is set to pc.FOG_LINEAR.
     * @param {number} settings.render.fog_end - The distance from the viewpoint where linear fog reaches its maximum. This property is only valid if the fog property is set to pc.FOG_LINEAR.
     * @param {number} settings.render.gamma_correction - The gamma correction to apply when rendering the scene. Can be:
     *
     * * {@link pc.GAMMA_NONE}
     * * {@link pc.GAMMA_SRGB}
     * @param {number} settings.render.tonemapping - The tonemapping transform to apply when writing fragments to the
     * frame buffer. Can be:
     *
     * * {@link pc.TONEMAP_LINEAR}
     * * {@link pc.TONEMAP_FILMIC}
     * * {@link pc.TONEMAP_HEJL}
     * * {@link pc.TONEMAP_ACES}
     * @param {number} settings.render.exposure - The exposure value tweaks the overall brightness of the scene.
     * @param {number|null} [settings.render.skybox] - The asset ID of the cube map texture to be used as the scene's skybox. Defaults to null.
     * @param {number} settings.render.skyboxIntensity - Multiplier for skybox intensity.
     * @param {number} settings.render.skyboxMip - The mip level of the skybox to be displayed. Only valid for prefiltered cubemap skyboxes.
     * @param {number[]} settings.render.skyboxRotation - Rotation of skybox.
     * @param {number} settings.render.lightmapSizeMultiplier - The lightmap resolution multiplier.
     * @param {number} settings.render.lightmapMaxResolution - The maximum lightmap resolution.
     * @param {number} settings.render.lightmapMode - The lightmap baking mode. Can be:
     *
     * * {@link pc.BAKE_COLOR}: single color lightmap
     * * {@link pc.BAKE_COLORDIR}: single color lightmap + dominant light direction (used for bump/specular)
     *
     * Only lights with bakeDir=true will be used for generating the dominant light direction. Defaults to.
     * @example
     *
     * var settings = {
     *     physics: {
     *         gravity: [0, -9.8, 0]
     *     },
     *     render: {
     *         fog_end: 1000,
     *         tonemapping: 0,
     *         skybox: null,
     *         fog_density: 0.01,
     *         gamma_correction: 1,
     *         exposure: 1,
     *         fog_start: 1,
     *         global_ambient: [0, 0, 0],
     *         skyboxIntensity: 1,
     *         skyboxRotation: [0, 0, 0],
     *         fog_color: [0, 0, 0],
     *         lightmapMode: 1,
     *         fog: 'none',
     *         lightmapMaxResolution: 2048,
     *         skyboxMip: 2,
     *         lightmapSizeMultiplier: 16
     *     }
     * };
     * app.applySceneSettings(settings);
     */
    applySceneSettings(settings) {
        var asset;

        if (this.systems.rigidbody && typeof Ammo !== 'undefined') {
            var gravity = settings.physics.gravity;
            this.systems.rigidbody.gravity.set(gravity[0], gravity[1], gravity[2]);
        }

        this.scene.applySettings(settings);

        if (settings.render.hasOwnProperty('skybox')) {
            if (settings.render.skybox) {
                asset = this.assets.get(settings.render.skybox);

                if (asset) {
                    this.setSkybox(asset);
                } else {
                    this.assets.once('add:' + settings.render.skybox, this.setSkybox, this);
                }
            } else {
                this.setSkybox(null);
            }
        }
    }

    /**
     * @function
     * @private
     * @name pc.Application#setAreaLightData
     * @description Sets the area light LUT asset for this app.
     * @param {pc.Asset} asset - Asset of type `binary` to be set.
     */
    setAreaLightData(asset) {
        if (asset) {
            var renderer = this.renderer;
            asset.ready(function (asset) {
                renderer._uploadAreaLightLuts(asset.resource);
            });
            this.assets.load(asset);
        } else {
            // #ifdef DEBUG
            console.warn("setAreaLightData: asset is not valid");
            // #endif
        }
    }

    /**
     * @function
     * @name pc.Application#setSkybox
     * @description Sets the skybox asset to current scene, and subscribes to asset load/change events.
     * @param {pc.Asset} asset - Asset of type `skybox` to be set to, or null to remove skybox.
     */
    setSkybox(asset) {
        if (asset) {
            if (this._skyboxLast === asset.id) {
                if (this.scene.skyboxMip === 0 && !asset.loadFaces) {
                    this._skyboxLoad(asset);
                } else {
                    this._onSkyboxChange(asset);
                }
                return;
            }

            if (this._skyboxLast) {
                this.assets.off('add:' + this._skyboxLast, this.setSkybox, this);
                this.assets.off('load:' + this._skyboxLast, this._onSkyboxChange, this);
                this.assets.off('remove:' + this._skyboxLast, this._skyboxRemove, this);
            }

            this._skyboxLast = asset.id;

            this.assets.on('load:' + asset.id, this._onSkyboxChange, this);
            this.assets.once('remove:' + asset.id, this._skyboxRemove, this);

            if (asset.resource)
                this.scene.setSkybox(asset.resources);

            this._skyboxLoad(asset);
        } else {
            if (!this._skyboxLast)
                return;

            this._skyboxRemove({
                id: this._skyboxLast
            });
        }
    }

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.Application#enableVr
     * @description Create and assign a {@link pc.VrManager} object to allow this application render in VR.
     */
    enableVr() {
        if (!this.vr) {
            this.vr = new VrManager(this);
        }
    }

    /**
     * @private
     * @deprecated
     * @function
     * @name pc.Application#disableVr
     * @description Destroy the {@link pc.VrManager}.
     */
    disableVr() {
        if (this.vr) {
            this.vr.destroy();
            this.vr = null;
        }
    }

    _onSkyboxChange(asset) {
        this.scene.setSkybox(asset.resources);
    }

    _skyboxLoad(asset) {
        if (this.scene.skyboxMip === 0)
            asset.loadFaces = true;

        this.assets.load(asset);

        this._onSkyboxChange(asset);
    }

    _skyboxRemove(asset) {
        if (!this._skyboxLast)
            return;

        this.assets.off('add:' + asset.id, this.setSkybox, this);
        this.assets.off('load:' + asset.id, this._onSkyboxChange, this);
        this.assets.off('remove:' + asset.id, this._skyboxRemove, this);
        this.scene.setSkybox(null);
        this._skyboxLast = null;
    }

    _firstBake() {
        this.lightmapper.bake(null, this.scene.lightmapMode);
    }

    _firstBatch() {
        if (this.scene._needsStaticPrepare) {
            this.renderer.prepareStaticMeshes(this.graphicsDevice, this.scene);
            this.scene._needsStaticPrepare = false;
        }
        this.batcher.generate();
    }

    _processTimestamp(timestamp) {
        return timestamp;
    }

    // IMMEDIATE MODE API
    _preRenderImmediate() {
        for (var i = 0; i < this._immediateData.lineBatches.length; i++) {
            if (this._immediateData.lineBatches[i]) {
                this._immediateData.lineBatches[i].finalize(this.meshInstanceArray);
            }
        }
    }

    _postRenderImmediate() {
        for (var i = 0; i < this._immediateData.layers.length; i++) {
            this._immediateData.layers[i].clearMeshInstances(true);
        }

        this._immediateData.layers.length = 0;
    }

    _initImmediate() {
        // Init global line drawing data once
        if (!this._immediateData) {
            this._immediateData = new ImmediateData(this.graphicsDevice);

            this.on('prerender', this._preRenderImmediate, this);
            this.on('postrender', this._postRenderImmediate, this);
        }
    }

    _addLines(position, color, options) {
        var layer = (options && options.layer) ? options.layer : this.scene.layers.getLayerById(LAYERID_IMMEDIATE);
        var depthTest = (options && options.depthTest !== undefined) ? options.depthTest : true;
        var mask = (options && options.mask) ? options.mask : undefined;

        this._initImmediate();

        this._immediateData.addLayer(layer);

        var idx = this._immediateData.getLayerIdx(layer);
        if (idx === undefined) {
            // Init used batch once
            var batch = new LineBatch();
            batch.init(this.graphicsDevice, this._immediateData.lineVertexFormat, layer, position.length / 2);
            batch.material.depthTest = depthTest;
            if (mask) batch.meshInstance.mask = mask;

            idx = this._immediateData.lineBatches.push(batch) - 1; // push into list and get index
            this._immediateData.addLayerIdx(idx, layer);
        } else {
            // Possibly reallocate buffer if it's small
            this._immediateData.lineBatches[idx].init(this.graphicsDevice, this._immediateData.lineVertexFormat, layer, position.length / 2);
            this._immediateData.lineBatches[idx].material.depthTest = depthTest;
            if (mask) this._immediateData.lineBatches[idx].meshInstance.mask = mask;
        }
        // Append
        this._immediateData.lineBatches[idx].addLines(position, color);
    }

    /**
     * @function
     * @name pc.Application#renderLine
     * @description Renders a line. Line start and end coordinates are specified in
     * world-space. If a single color is supplied, the line will be flat-shaded with
     * that color. If two colors are supplied, the line will be smooth shaded between
     * those colors. It is also possible to control which scene layer the line is
     * rendered into. By default, lines are rendered into the immediate layer
     * {@link pc.LAYERID_IMMEDIATE}.
     * @param {pc.Vec3} start - The start world-space coordinate of the line.
     * @param {pc.Vec3} end - The end world-space coordinate of the line.
     * @param {pc.Color} color - The start color of the line.
     * @param {pc.Color} [endColor] - The end color of the line.
     * @param {object} [options] - Options to set rendering properties.
     * @param {pc.Layer} [options.layer] - The layer to render the line into. Defaults
     * to {@link pc.LAYERID_IMMEDIATE}.
     * @example
     * // Render a 1-unit long white line
     * var start = new pc.Vec3(0, 0, 0);
     * var end = new pc.Vec3(1, 0, 0);
     * var color = new pc.Color(1, 1, 1);
     * app.renderLine(start, end, color);
     * @example
     * // Render a 1-unit long line that is smooth-shaded from white to red
     * var start = new pc.Vec3(0, 0, 0);
     * var end = new pc.Vec3(1, 0, 0);
     * var startColor = new pc.Color(1, 1, 1);
     * var endColor = new pc.Color(1, 0, 0);
     * app.renderLine(start, end, startColor, endColor);
     * @example
     * // Render a 1-unit long white line into the world layer
     * var start = new pc.Vec3(0, 0, 0);
     * var end = new pc.Vec3(1, 0, 0);
     * var color = new pc.Color(1, 1, 1);
     * var worldLayer = app.scene.layers.getLayerById(pc.LAYERID_WORLD);
     * app.renderLine(start, end, color, {
     *     layer: worldLayer
     * });
     * @example
     * // Render a 1-unit long line that is smooth-shaded from white to red into the world layer
     * var start = new pc.Vec3(0, 0, 0);
     * var end = new pc.Vec3(1, 0, 0);
     * var startColor = new pc.Color(1, 1, 1);
     * var endColor = new pc.Color(1, 0, 0);
     * var worldLayer = app.scene.layers.getLayerById(pc.LAYERID_WORLD);
     * app.renderLine(start, end, color, {
     *     layer: worldLayer
     * });
     */
    renderLine(start, end, color) {
        var endColor = color;
        var options;

        var arg3 = arguments[3];
        var arg4 = arguments[4];

        if (arg3 instanceof Color) {
            // passed in end color
            endColor = arg3;

            if (typeof arg4 === 'number') {
                if (!_deprecationWarning) {
                    console.warn("lineBatch argument is deprecated for renderLine. Use options.layer instead");
                    _deprecationWarning = true;
                }
                // compatibility: convert linebatch id into options
                if (arg4 === LINEBATCH_OVERLAY) {
                    options = {
                        layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
                        depthTest: false
                    };
                } else {
                    options = {
                        layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
                        depthTest: true
                    };
                }
            } else {
                // use passed in options
                options = arg4;
            }
        } else if (typeof arg3 === 'number') {
            if (!_deprecationWarning) {
                console.warn("lineBatch argument is deprecated for renderLine. Use options.layer instead");
                _deprecationWarning = true;
            }

            endColor = color;

            // compatibility: convert linebatch id into options
            if (arg3 === LINEBATCH_OVERLAY) {
                options = {
                    layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
                    depthTest: false
                };
            } else {
                options = {
                    layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
                    depthTest: true
                };
            }
        } else if (arg3) {
            // options passed in
            options = arg3;
        }

        this._addLines([start, end], [color, endColor], options);
    }

    /**
     * @function
     * @name pc.Application#renderLines
     * @description Renders an arbitrary number of discrete line segments. The lines
     * are not connected by each subsequent point in the array. Instead, they are
     * individual segments specified by two points. Therefore, the lengths of the
     * supplied position and color arrays must be the same and also must be a multiple
     * of 2. The colors of the ends of each line segment will be interpolated along
     * the length of each line.
     * @param {pc.Vec3[]} position - An array of points to draw lines between. The
     * length of the array must be a multiple of 2.
     * @param {pc.Color[]} color - An array of colors to color the lines. This
     * must be the same length as the position array. The length of the array must
     * also be a multiple of 2.
     * @param {object} [options] - Options to set rendering properties.
     * @param {pc.Layer} [options.layer] - The layer to render the lines into.
     * @example
     * // Render 2 discrete line segments
     * var points = [
     *     // Line 1
     *     new pc.Vec3(0, 0, 0),
     *     new pc.Vec3(1, 0, 0),
     *     // Line 2
     *     new pc.Vec3(1, 1, 0),
     *     new pc.Vec3(1, 1, 1)
     * ];
     * var colors = [
     *     // Line 1
     *     pc.Color.RED,
     *     pc.Color.YELLOW,
     *     // Line 2
     *     pc.Color.CYAN,
     *     pc.Color.BLUE
     * ];
     * app.renderLines(points, colors);
     */
    renderLines(position, color, options) {
        if (!options) {
            // default option
            options = {
                layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
                depthTest: true
            };
        } else if (typeof options === 'number') {
            if (!_deprecationWarning) {
                console.warn("lineBatch argument is deprecated for renderLine. Use options.layer instead");
                _deprecationWarning = true;
            }

            // backwards compatibility, LINEBATCH_OVERLAY lines have depthtest disabled
            if (options === LINEBATCH_OVERLAY) {
                options = {
                    layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
                    depthTest: false
                };
            } else {
                options = {
                    layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
                    depthTest: true
                };
            }
        }

        var multiColor = !!color.length;
        if (multiColor) {
            if (position.length !== color.length) {
                console.error("renderLines: position/color arrays have different lengths");
                return;
            }
        }
        if (position.length % 2 !== 0) {
            console.error("renderLines: array length is not divisible by 2");
            return;
        }
        this._addLines(position, color, options);
    }

    // Draw lines forming a transformed unit-sized cube at this frame
    // lineType is optional
    renderWireCube(matrix, color, options) {
        var i;

        this._initImmediate();

        // Init cube data once
        if (!this._immediateData.cubeLocalPos) {
            var x = 0.5;
            this._immediateData.cubeLocalPos = [new Vec3(-x, -x, -x), new Vec3(-x, x, -x), new Vec3(x, x, -x), new Vec3(x, -x, -x),
                new Vec3(-x, -x, x), new Vec3(-x, x, x), new Vec3(x, x, x), new Vec3(x, -x, x)];
            this._immediateData.cubeWorldPos = [new Vec3(), new Vec3(), new Vec3(), new Vec3(),
                new Vec3(), new Vec3(), new Vec3(), new Vec3()];
        }

        var cubeLocalPos = this._immediateData.cubeLocalPos;
        var cubeWorldPos = this._immediateData.cubeWorldPos;

        // Transform and append lines
        for (i = 0; i < 8; i++) {
            matrix.transformPoint(cubeLocalPos[i], cubeWorldPos[i]);
        }
        this.renderLines([
            cubeWorldPos[0], cubeWorldPos[1],
            cubeWorldPos[1], cubeWorldPos[2],
            cubeWorldPos[2], cubeWorldPos[3],
            cubeWorldPos[3], cubeWorldPos[0],

            cubeWorldPos[4], cubeWorldPos[5],
            cubeWorldPos[5], cubeWorldPos[6],
            cubeWorldPos[6], cubeWorldPos[7],
            cubeWorldPos[7], cubeWorldPos[4],

            cubeWorldPos[0], cubeWorldPos[4],
            cubeWorldPos[1], cubeWorldPos[5],
            cubeWorldPos[2], cubeWorldPos[6],
            cubeWorldPos[3], cubeWorldPos[7]
        ], color, options);
    }

    // Draw meshInstance at this frame
    renderMeshInstance(meshInstance, options) {
        if (!options) {
            options = {
                layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE)
            };
        }

        this._initImmediate();

        this._immediateData.addLayer(options.layer);

        this.meshInstanceArray[0] = meshInstance;
        options.layer.addMeshInstances(this.meshInstanceArray, true);
    }

    // Draw mesh at this frame
    renderMesh(mesh, material, matrix, options) {
        if (!options) {
            options = {
                layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE)
            };
        }

        this._initImmediate();
        tempGraphNode.worldTransform = matrix;
        tempGraphNode._dirtyWorld = tempGraphNode._dirtyNormal = false;

        var instance = new MeshInstance(tempGraphNode, mesh, material);
        instance.cull = false;

        if (options.mask) instance.mask = options.mask;
        this._immediateData.addLayer(options.layer);

        this.meshInstanceArray[0] = instance;
        options.layer.addMeshInstances(this.meshInstanceArray, true);
    }

    // Draw quad of size [-0.5, 0.5] at this frame
    renderQuad(matrix, material, options) {
        if (!options) {
            options = {
                layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE)
            };
        }

        this._initImmediate();

        // Init quad data once
        if (!this._immediateData.quadMesh) {
            var format = new VertexFormat(this.graphicsDevice, [
                { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 }
            ]);
            var quadVb = new VertexBuffer(this.graphicsDevice, format, 4);
            var iterator = new VertexIterator(quadVb);
            iterator.element[SEMANTIC_POSITION].set(-0.5, -0.5, 0);
            iterator.next();
            iterator.element[SEMANTIC_POSITION].set(0.5, -0.5, 0);
            iterator.next();
            iterator.element[SEMANTIC_POSITION].set(-0.5, 0.5, 0);
            iterator.next();
            iterator.element[SEMANTIC_POSITION].set(0.5, 0.5, 0);
            iterator.end();
            this._immediateData.quadMesh = new Mesh(this.graphicsDevice);
            this._immediateData.quadMesh.vertexBuffer = quadVb;
            this._immediateData.quadMesh.primitive[0].type = PRIMITIVE_TRISTRIP;
            this._immediateData.quadMesh.primitive[0].base = 0;
            this._immediateData.quadMesh.primitive[0].count = 4;
            this._immediateData.quadMesh.primitive[0].indexed = false;
        }

        // Issue quad drawcall
        tempGraphNode.worldTransform = matrix;
        tempGraphNode._dirtyWorld = tempGraphNode._dirtyNormal = false;

        var quad = new MeshInstance(tempGraphNode, this._immediateData.quadMesh, material);
        quad.cull = false;
        this.meshInstanceArray[0] = quad;

        this._immediateData.addLayer(options.layer);

        options.layer.addMeshInstances(this.meshInstanceArray, true);
    }

    /**
     * @function
     * @name pc.Application#destroy
     * @description Destroys application and removes all event listeners.
     * @example
     * this.app.destroy();
     */
    destroy() {
        var i, l;
        var canvasId = this.graphicsDevice.canvas.id;

        this.off('librariesloaded');
        document.removeEventListener('visibilitychange', this._visibilityChangeHandler, false);
        document.removeEventListener('mozvisibilitychange', this._visibilityChangeHandler, false);
        document.removeEventListener('msvisibilitychange', this._visibilityChangeHandler, false);
        document.removeEventListener('webkitvisibilitychange', this._visibilityChangeHandler, false);
        this._visibilityChangeHandler = null;
        this.onVisibilityChange = null;

        this.root.destroy();
        this.root = null;

        if (this.mouse) {
            this.mouse.off();
            this.mouse.detach();
            this.mouse = null;
        }

        if (this.keyboard) {
            this.keyboard.off();
            this.keyboard.detach();
            this.keyboard = null;
        }

        if (this.touch) {
            this.touch.off();
            this.touch.detach();
            this.touch = null;
        }

        if (this.elementInput) {
            this.elementInput.detach();
            this.elementInput = null;
        }

        if (this.controller) {
            this.controller = null;
        }

        var systems = this.systems.list;
        for (i = 0, l = systems.length; i < l; i++) {
            systems[i].destroy();
        }

        ComponentSystem.destroy();

        // destroy all texture resources
        var assets = this.assets.list();
        for (i = 0; i < assets.length; i++) {
            assets[i].unload();
            assets[i].off();
        }
        this.assets.off();


        // destroy bundle registry
        this.bundles.destroy();
        this.bundles = null;

        this.i18n.destroy();
        this.i18n = null;

        for (var key in this.loader.getHandler('script')._cache) {
            var element = this.loader.getHandler('script')._cache[key];
            var parent = element.parentNode;
            if (parent) parent.removeChild(element);
        }
        this.loader.getHandler('script')._cache = {};

        this.loader.destroy();
        this.loader = null;

        this.scene.destroy();
        this.scene = null;

        this.systems = [];
        this.context = null;

        // script registry
        this.scripts.destroy();
        this.scripts = null;

        this.scenes.destroy();
        this.scenes = null;

        this.lightmapper.destroy();
        this.lightmapper = null;

        this.batcher.destroyManager();
        this.batcher = null;

        this._entityIndex = {};

        this.defaultLayerDepth.onPreRenderOpaque = null;
        this.defaultLayerDepth.onPostRenderOpaque = null;
        this.defaultLayerDepth.onDisable = null;
        this.defaultLayerDepth.onEnable = null;
        this.defaultLayerDepth = null;
        this.defaultLayerWorld = null;

        destroyPostEffectQuad();

        if (this.vr) {
            this.vr.destroy();
            this.vr = null;
        }
        this.xr.end();

        this.graphicsDevice.destroy();
        this.graphicsDevice = null;

        this.renderer = null;
        this.tick = null;

        this.off(); // remove all events

        if (this._soundManager) {
            this._soundManager.destroy();
            this._soundManager = null;
        }

        script.app = null;

        // remove default particle texture
        ParticleEmitter.DEFAULT_PARAM_TEXTURE = null;

        Application._applications[canvasId] = null;

        if (getApplication() === this) {
            setApplication(null);
        }
    }

    /**
     * @private
     * @function
     * @name pc.Application#getEntityFromIndex
     * @description Get entity from the index by guid.
     * @param {string} guid - The GUID to search for.
     * @returns {pc.Entity} The Entity with the GUID or null.
     */
    getEntityFromIndex(guid) {
        return this._entityIndex[guid];
    }
}

// static data
var _frameEndData = {};

// create tick function to be wrapped in closure
var makeTick = function (_app) {
    var application = _app;
    var frameRequest;

    return function (timestamp, frame) {
        if (!application.graphicsDevice)
            return;

        setApplication(application);

        if (frameRequest) {
            window.cancelAnimationFrame(frameRequest);
            frameRequest = null;
        }

        // have current application pointer in pc
        app = application;

        var currentTime = application._processTimestamp(timestamp) || now();
        var ms = currentTime - (application._time || currentTime);
        var dt = ms / 1000.0;
        dt = math.clamp(dt, 0, application.maxDeltaTime);
        dt *= application.timeScale;

        application._time = currentTime;

        // Submit a request to queue up a new animation frame immediately
        if (application.vr && application.vr.display) {
            frameRequest = application.vr.display.requestAnimationFrame(application.tick);
        } else if (application.xr.session) {
            frameRequest = application.xr.session.requestAnimationFrame(application.tick);
        } else {
            frameRequest = window.requestAnimationFrame(application.tick);
        }

        if (application.graphicsDevice.contextLost)
            return;

        application._fillFrameStatsBasic(currentTime, dt, ms);

        // #ifdef PROFILER
        application._fillFrameStats();
        // #endif

        application.fire("frameupdate", ms);

        if (frame) {
            application.xr.update(frame);
            application.graphicsDevice.defaultFramebuffer = frame.session.renderState.baseLayer.framebuffer;
        } else {
            application.graphicsDevice.defaultFramebuffer = null;
        }

        application.update(dt);

        application.fire("framerender");

        if (application.autoRender || application.renderNextFrame) {
            application.render();
            application.renderNextFrame = false;
        }

        // set event data
        _frameEndData.timestamp = now();
        _frameEndData.target = application;

        application.fire("frameend", _frameEndData);
        application.fire("frameEnd", _frameEndData);// deprecated old event, remove when editor updated

        if (application.vr && application.vr.display && application.vr.display.presenting) {
            application.vr.display.submitFrame();
        }
    };
};

export { app, Application };
