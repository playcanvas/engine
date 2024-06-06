import { platform } from '../core/platform.js';

import { WebglGraphicsDevice } from '../platform/graphics/webgl/webgl-graphics-device.js';

import { SoundManager } from '../platform/sound/manager.js';

import { Lightmapper } from './lightmapper/lightmapper.js';
import { BatchManager } from '../scene/batching/batch-manager.js';

import { AppBase } from './app-base.js';
import { AppOptions } from './app-options.js';
import { AnimationComponentSystem } from './components/animation/system.js';
import { AnimComponentSystem } from './components/anim/system.js';
import { AudioListenerComponentSystem } from './components/audio-listener/system.js';
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
import { ScrollViewComponentSystem } from './components/scroll-view/system.js';
import { ScrollbarComponentSystem } from './components/scrollbar/system.js';
import { SoundComponentSystem } from './components/sound/system.js';
import { SpriteComponentSystem } from './components/sprite/system.js';
import { ZoneComponentSystem } from './components/zone/system.js';
import { CameraComponentSystem } from './components/camera/system.js';
import { LightComponentSystem } from './components/light/system.js';
import { ScriptComponentSystem } from './components/script/system.js';
import { GSplatComponentSystem } from './components/gsplat/system.js';

import { RenderHandler } from './handlers/render.js';
import { AnimationHandler } from './handlers/animation.js';
import { AnimClipHandler } from './handlers/anim-clip.js';
import { AnimStateGraphHandler } from './handlers/anim-state-graph.js';
import { AudioHandler } from './handlers/audio.js';
import { BinaryHandler } from './handlers/binary.js';
import { ContainerHandler } from './handlers/container.js';
import { CssHandler } from './handlers/css.js';
import { CubemapHandler } from './handlers/cubemap.js';
import { FolderHandler } from './handlers/folder.js';
import { FontHandler } from './handlers/font.js';
import { GSplatHandler } from './handlers/gsplat.js';
import { HierarchyHandler } from './handlers/hierarchy.js';
import { HtmlHandler } from './handlers/html.js';
import { JsonHandler } from './handlers/json.js';
import { MaterialHandler } from './handlers/material.js';
import { ModelHandler } from './handlers/model.js';
import { SceneHandler } from './handlers/scene.js';
import { ScriptHandler } from './handlers/script.js';
import { ShaderHandler } from './handlers/shader.js';
import { SpriteHandler } from './handlers/sprite.js';
import { TemplateHandler } from './handlers/template.js';
import { TextHandler } from './handlers/text.js';
import { TextureAtlasHandler } from './handlers/texture-atlas.js';
import { TextureHandler } from './handlers/texture.js';

import { XrManager } from './xr/xr-manager.js';

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
 *     const app = this.app;
 * };
 *
 * MyScript.prototype.update = function(dt) {
 *     // ...and update functions.
 *     const app = this.app;
 * };
 * ```
 *
 * If you are using the Engine without the Editor, you have to create the application instance
 * manually.
 */
class Application extends AppBase {
    /**
     * Create a new Application instance.
     *
     * @param {HTMLCanvasElement} canvas - The canvas element.
     * @param {object} [options] - The options object to configure the Application.
     * @param {import('./input/element-input.js').ElementInput} [options.elementInput] - Input
     * handler for {@link ElementComponent}s.
     * @param {import('../platform/input/keyboard.js').Keyboard} [options.keyboard] - Keyboard
     * handler for input.
     * @param {import('../platform/input/mouse.js').Mouse} [options.mouse] - Mouse handler for
     * input.
     * @param {import('../platform/input/touch-device.js').TouchDevice} [options.touch] - TouchDevice
     * handler for input.
     * @param {import('../platform/input/game-pads.js').GamePads} [options.gamepads] - Gamepad
     * handler for input.
     * @param {string} [options.scriptPrefix] - Prefix to apply to script urls before loading.
     * @param {string} [options.assetPrefix] - Prefix to apply to asset urls before loading.
     * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} [options.graphicsDevice] - The
     * graphics device used by the application. If not provided, a WebGl graphics device will be
     * created.
     * @param {object} [options.graphicsDeviceOptions] - Options object that is passed into the
     * {@link GraphicsDevice} constructor.
     * @param {string[]} [options.scriptsOrder] - Scripts in order of loading first.
     * @example
     * // Engine-only example: create the application manually
     * const app = new pc.Application(canvas, options);
     *
     * // Start the application's main loop
     * app.start();
     */
    constructor(canvas, options = {}) {
        super(canvas);

        const appOptions = new AppOptions();

        appOptions.graphicsDevice = options.graphicsDevice ?? this.createDevice(canvas, options);
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

        appOptions.soundManager = new SoundManager();
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

        return new WebglGraphicsDevice(canvas, options.graphicsDeviceOptions);
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
            ScriptComponentSystem,
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
            ZoneComponentSystem,
            GSplatComponentSystem
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
            ContainerHandler,
            GSplatHandler
        ];
    }
}

export { Application };
