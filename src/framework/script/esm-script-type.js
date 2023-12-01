import { EventHandler } from "../../core/event-handler.js";

/**
 * A base class for esm scripts that provide a similar set features and functionality
 * to the traditional scripts interface. Events and 'enabled' prop.
 *
 * Note that implementing this base class is not required by the component system, it's
 * simply to provide a convenient and familiar api to migrate users to the new ESM script system
 */
export class EsmScriptType extends EventHandler {
    /**
     * The {@link AppBase} that the instance of this type belongs to.
     *
     * @type {import('../entity.js').Entity}
     */
    entity;

    /**
     * The {@link AppBase} that the instance of this type belongs to.
     *
     * @type {import('../app-base.js').AppBase}
     */
    app;

    set enabled(isEnabled) {

        if (isEnabled) {
            this.entity.esmscript.enableModule(this);
        } else {
            this.entity.esmscript.disableModule(this);
        }

        this.fire(isEnabled ? 'enable' : 'disable');
        this.fire('state', isEnabled);
    }

    get enabled() {
        return this.entity.esmscript.isModuleEnabled(this);
    }
}

/**
 * The EsmScriptInterface below illustrates the set of features available for an esm script.
 *
 * ** Note you do not have to implement or extend this class directly, it's purely for illustrative purposes**
 *
 * All of the life-cycle methods below are optional, you only use what you need, but the'll be
 * invoked where available. So if you just want to rotate an entity you'd likely only need the `update()` hook.
 * @example update(){ this.entity.rotateLocal(0, 1, 0); }
 *
 * By design, this is a very minimal api with no dependencies on internal state or events,
 * however we recognize this might not provide all the features you need which is why we've
 * provided the {@link EsmScriptType} base class which you can extend and provides a familiar
 * set of features to the older `ScriptType` class. The aim of this class isn't to provide
 * an identical feature set, but to give a familiar set of functionality to begin using ESM Scripts.
 * Of course, you can also use your own base class, on a per Script basis which gives you the freedom
 * to build much more powerful Script types.
 *
 * The game loop for an ESM Script can be seen as...
 *
 * +--------------+    +--------------+    +-------------+    +--------------+    +--------------+     +--------------+
 * | initialize() | -> | active()     | -> | update()    | -> | postUpdate() | -> | inactive()   |  -> | destroy()    |
 * +--------------+    +--------------+    +-------------+    +--------------+    +--------------+     +--------------+
 *                     |                                   Game Loop                             |
 *                     +-------------------------------------------------------------------------+
 */
export class EsmScriptInterface {
    // Do not assume when the constructor will be called at a particular point in the application lifecycle
    // eslint-disable-next-line no-useless-constructor
    constructor() {}

    /**
     * This lifecycle method is invoked immediately when added to an esm component
     * with `esmscript.add(YourScript)`. It's only ever invoked once and should be
     * used to initialize any internal state required by the script
     */
    initialize() {}

    /**
     * This lifecycle method is called as part of the the game loop before any
     * other method. If a script, its component, entity or any parent entity
     * in it's hierarchy becomes enabled in the previous in the scene hierarchy
     */
    active() {}

    /**
     * This method is called once per frame. It's a general purpose hook for updating
     * and animating things every game tick.
     *
     * @param {number} dt - The delta time (time since the last frame) measured in milliseconds.
     * @example update(dt){ this.entity.rotateLocal(0, 10 * dt, 0);}
     */
    update(dt) {}

    /**
     * This is a kind of late update method called immediately after every ESM Scripts has finished their
     * `update()` step. It can be used as a way to guarantee the order of behaviors. For example,
     * if you're positioning an object in one script and want a camera to follow it, you might use
     * the `update` to position it in one script, and the `postUpdate` on the camera to follow it
     * in a separate script. It allows you to keep your logic separate but guarantee things happen
     * in a certain order.
     *
     * @param {number} dt - The delta time (time since the last frame) measured in milliseconds.
     */
    postUpdate(dt) {}

    /**
     * During the game loop entities, scripts and components often become disabled. If any of those
     * happen which would result in this script becoming inactive, meaning that it won't participate
     * in the next game loop, then this `inactive()` method will be called at the end of the current frame.
     * This allows you to react to this as late as possible
     */
    inactive() {}

    /**
     * This method ia called immediately when an ESM Script, it's component or entity is either
     * destroyed or removed from the scene hierarchy. It doesn't occur as part of the game loop,
     * it's called immediately as a response to the Script being removed.
     */
    destroy() {}
}
