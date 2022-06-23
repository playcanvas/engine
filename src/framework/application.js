import { platform } from '../core/platform.js';

import { WebglGraphicsDevice } from '../graphics/webgl/webgl-graphics-device.js';

import { basic } from '../graphics/program-lib/programs/basic.js';
import { particle } from '../graphics/program-lib/programs/particle.js';
import { skybox } from '../graphics/program-lib/programs/skybox.js';
import { standard } from '../graphics/program-lib/programs/standard.js';

import { SoundManager } from '../sound/manager.js';

import { Lightmapper } from '../scene/lightmapper/lightmapper.js';
import { BatchManager } from '../scene/batching/batch-manager.js';

import { AppBase } from './app-base.js';
import { AppOptions } from './app-options.js';
import { script } from './script.js';
import { AnimationComponentSystem } from './components/animation/system.js';
import { AnimComponentSystem } from './components/anim/system.js';
import { AudioListenerComponentSystem } from './components/audio-listener/system.js';
import { AudioSourceComponentSystem } from './components/audio-source/system.js';
import { ButtonComponentSystem } from './components/button/system.js';
import { CollisionComponentSystem } from './components/collision/system.js';
import { ElementComponentSystem } from './components/element/system.js';
import { JointComponentSystem } from './components/joint/system.js';
import { LayoutChildComponentSystem } from './components/layout-child/system.js';
import { LayoutGroupComponentSystem } from './components/layout-group/system.js';
import { ModelComponentSystem } from './components/model/system.js';
import { ParticleSystemComponentSystem } from './components/particle-system/system.js';
import { RenderComponentSystem } from './components/render/system.js';
import { RigidBodyComponentSystem } from './components/rigid-body/system.js';
import { ScreenComponentSystem } from './components/screen/system.js';
import { ScriptLegacyComponentSystem } from './components/script-legacy/system.js';
import { ScrollViewComponentSystem } from './components/scroll-view/system.js';
import { ScrollbarComponentSystem } from './components/scrollbar/system.js';
import { SoundComponentSystem } from './components/sound/system.js';
import { SpriteComponentSystem } from './components/sprite/system.js';
import { ZoneComponentSystem } from './components/zone/system.js';
import { CameraComponentSystem } from './components/camera/system.js';
import { LightComponentSystem } from './components/light/system.js';
import { ScriptComponentSystem } from './components/script/system.js';

import { RenderHandler } from '../resources/render.js';
import { AnimationHandler } from '../resources/animation.js';
import { AnimClipHandler } from '../resources/anim-clip.js';
import { AnimStateGraphHandler } from '../resources/anim-state-graph.js';
import { AudioHandler } from '../resources/audio.js';
import { BinaryHandler } from '../resources/binary.js';
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
import { SceneHandler } from '../resources/scene.js';
import { ScriptHandler } from '../resources/script.js';
import { ShaderHandler } from '../resources/shader.js';
import { SpriteHandler } from '../resources/sprite.js';
import { TemplateHandler } from '../resources/template.js';
import { TextHandler } from '../resources/text.js';
import { TextureAtlasHandler } from '../resources/texture-atlas.js';
import { TextureHandler } from '../resources/texture.js';

import { XrManager } from '../xr/xr-manager.js';

/** @typedef {import('../input/element-input.js').ElementInput} ElementInput */
/** @typedef {import('../input/game-pads.js').GamePads} GamePads */
/** @typedef {import('../input/keyboard.js').Keyboard} Keyboard */
/** @typedef {import('../input/mouse.js').Mouse} Mouse */
/** @typedef {import('../input/touch-device.js').TouchDevice} TouchDevice */

/**
 * An Application represents and manages your PlayCanvas application. If you are developing using
 * the PlayCanvas Editor, the Application is created for you. You can access your Application
 * instance in your scripts. Below is a skeleton script which shows how you can access the
 * application 'app' property inside the initialize and update functions:
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
 * If you are using the Engine without the Editor, you have to create the application instance
 * manually.
 *
 * @augments AppBase
 */
class Application extends AppBase {
    /**
     * Create a new Application instance.
     *
     * @param {Element} canvas - The canvas element.
     * @param {object} [options] - The options object to configure the Application.
     * @param {ElementInput} [options.elementInput] - Input handler for {@link ElementComponent}s.
     * @param {Keyboard} [options.keyboard] - Keyboard handler for input.
     * @param {Mouse} [options.mouse] - Mouse handler for input.
     * @param {TouchDevice} [options.touch] - TouchDevice handler for input.
     * @param {GamePads} [options.gamepads] - Gamepad handler for input.
     * @param {string} [options.scriptPrefix] - Prefix to apply to script urls before loading.
     * @param {string} [options.assetPrefix] - Prefix to apply to asset urls before loading.
     * @param {object} [options.graphicsDeviceOptions] - Options object that is passed into the
     * {@link GraphicsDevice} constructor.
     * @param {string[]} [options.scriptsOrder] - Scripts in order of loading first.
     * @example
     * // Engine-only example: create the application manually
     * var app = new pc.Application(canvas, options);
     *
     * // Start the application's main loop
     * app.start();
     */
    constructor(canvas, options = {}) {
        super(canvas);

        const appOptions = new AppOptions();

        appOptions.graphicsDevice = this.createDevice(canvas, options);
        this.addComponentSystems(appOptions);
        this.addResourceHandles(appOptions);

        appOptions.elementInput = options.elementInput;
        appOptions.keyboard = options.keyboard;
        appOptions.mouse = options.mouse;
        appOptions.touch = options.touch;
        appOptions.gamepads = options.gamepads;

        appOptions.scriptPrefix = options.scriptPrefix;
        appOptions.assetPrefix = options.assetPrefix;
        appOptions.scriptsOrder = options.scriptsOrder;

        appOptions.soundManager = new SoundManager(options);
        appOptions.lightmapper = Lightmapper;
        appOptions.batchManager = BatchManager;
        appOptions.xr = XrManager;

        this.init(appOptions);
    }

    createDevice(canvas, options) {

        if (!options.graphicsDeviceOptions) {
            options.graphicsDeviceOptions = { };
        }
        if (platform.browser && !!navigator.xr) {
            options.graphicsDeviceOptions.xrCompatible = true;
        }
        options.graphicsDeviceOptions.alpha = options.graphicsDeviceOptions.alpha || false;

        const device = new WebglGraphicsDevice(canvas, options.graphicsDeviceOptions);

        // register shader programs
        device.programLib.register('basic', basic);
        device.programLib.register('particle', particle);
        device.programLib.register('skybox', skybox);
        device.programLib.register('standard', standard);

        return device;
    }

    addComponentSystems(appOptions) {
        appOptions.componentSystems = [
            RigidBodyComponentSystem,
            CollisionComponentSystem,
            JointComponentSystem,
            AnimationComponentSystem,
            AnimComponentSystem,
            ModelComponentSystem,
            RenderComponentSystem,
            CameraComponentSystem,
            LightComponentSystem,
            script.legacy ? ScriptLegacyComponentSystem : ScriptComponentSystem,
            AudioSourceComponentSystem,
            SoundComponentSystem,
            AudioListenerComponentSystem,
            ParticleSystemComponentSystem,
            ScreenComponentSystem,
            ElementComponentSystem,
            ButtonComponentSystem,
            ScrollViewComponentSystem,
            ScrollbarComponentSystem,
            SpriteComponentSystem,
            LayoutGroupComponentSystem,
            LayoutChildComponentSystem,
            ZoneComponentSystem
        ];
    }

    addResourceHandles(appOptions) {
        appOptions.resourceHandlers = [
            RenderHandler,
            AnimationHandler,
            AnimClipHandler,
            AnimStateGraphHandler,
            ModelHandler,
            MaterialHandler,
            TextureHandler,
            TextHandler,
            JsonHandler,
            AudioHandler,
            ScriptHandler,
            SceneHandler,
            CubemapHandler,
            HtmlHandler,
            CssHandler,
            ShaderHandler,
            HierarchyHandler,
            FolderHandler,
            FontHandler,
            BinaryHandler,
            TextureAtlasHandler,
            SpriteHandler,
            TemplateHandler,
            ContainerHandler
        ];
    }
}

export { Application };
