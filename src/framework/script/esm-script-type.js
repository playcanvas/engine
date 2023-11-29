import { EventHandler } from "../../core/event-handler.js";

/**
 * A base class for esm scripts that provide a similar set features and functionality
 * to the traditional scripts interface. Events, `initialize()` and 'enabled' prop.
 *
 * Note that implementing this base class is not required by the component system, it's
 * simply to provide a convenient and familiar api to migrate users to the new ESM script system
 */
export class EsmScriptType extends EventHandler {
    hasInitialized = false;

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

    initialize() {}

    set enabled(isEnabled) {

        // if (!this.hasInitialized) {
        //     Debug.error(`The EsmScript 'enabled' prop cannot be set until it has been initialized.`);
        //     return;
        // }

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

    active({ entity, app }) {

        this.entity = entity;
        this.app = app;

        if (!this.hasInitialized) {
            this.hasInitialized = true;
            this.initialize();
        }
    }
}

/**
 * The EsmScriptInterface below illustrates the set of features available for an esm script.
 * All of the methods are optional, but the component will call them if available,
 * so if you want to rotate an entity you can simply create a script with just an
 * 'update' method.
 *
 * It also has no internal state, which makes things much simpler for the component system
 * as there is no need to check.
 *
 * Of course, this is a very minimal set of features, which is why we've provided the EsmScriptType class
 * which does have state and is functionally very similar to the regular ScriptType class.
 * It provides events and and a once-only `initialize()` method. You can simply extend this base class to
 * get most of the functionality you might be familiar with from original scripting system. However, more importantly,
 * this is entirely optional, and there are many use-cases that we haven't considered, so you can create your own Script Base
 * class with your own functionality. What's important is that you have the flexibility, whilst we can keep the core scripting system
 * fast and simple.
 */
export class EsmScriptInterface {
    // The constructor will Do not assume when the constructor will be called at a particular point in the application lifecycle
    // constructor() {}

    // called when the script first becomes initialized
    initialize() {}

    // called whenever the script becomes active, ie. it is part of the component tree and can receive updates
    active({ entity, app }) {}

    // called whenever the script becomes inactive, and will no longer receive lifecycle events
    inactive() {}

    // called every frame whilst the script is active
    update(dt, { entity, app }) {}

    // called after every frame whilst the script is active
    postUpdate(dt, { entity, app }) {}

    // called when the script, component or parent entity is destroyed.
    destroy() {}
}
