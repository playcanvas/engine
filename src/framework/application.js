import { ApplicationLite } from "./application-lite.js";
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
 * @augments ApplicationLite
 */
class Application extends ApplicationLite {
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
        super(canvas, options);

        this.systems.add(new RigidBodyComponentSystem(this));
        this.systems.add(new CollisionComponentSystem(this));
        this.systems.add(new JointComponentSystem(this));
        this.systems.add(new AnimationComponentSystem(this));
        this.systems.add(new AnimComponentSystem(this));
        this.systems.add(new ModelComponentSystem(this));

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
        this.systems.add(new RenderComponentSystem(this));
        this.systems.add(new CameraComponentSystem(this));
        this.systems.add(new LightComponentSystem(this));
    }
}

export { Application };
