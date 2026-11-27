import { Debug } from '../../../core/debug.js';
import { SYSTEMORDER_AUDIOLISTENER } from '../constants.js';
import { ComponentSystem } from '../system.js';
import { AudioListenerComponent } from './component.js';

/**
 * @import { AppBase } from '../../app-base.js'
 */

/**
 * Manages the {@link AudioListenerComponent}s of an application. Reach it through
 * `app.systems.audiolistener`; components are created with {@link Entity#addComponent}, never by
 * calling the system directly.
 *
 * @category Sound
 */
class AudioListenerComponentSystem extends ComponentSystem {
    /** @ignore */
    static order = SYSTEMORDER_AUDIOLISTENER;

    /**
     * Create a new AudioListenerComponentSystem instance.
     *
     * @param {AppBase} app - The application managing this system.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'audiolistener';

        this.ComponentType = AudioListenerComponent;

        this.manager = app.soundManager;
        Debug.assert(this.manager, 'AudioListenerComponentSystem cannot be created without sound manager');

        this.current = null;

        // the listener follows its entity in the postUpdate phase, after the scripts, so that it
        // uses the transform of the frame, including animations and changes scripts make in
        // postUpdate
        this.app.systems.on('postUpdate', this.onUpdate, this);
    }

    cloneComponent(entity, clone) {
        return this.addComponent(clone, {
            enabled: entity.audiolistener.enabled
        });
    }

    onUpdate(dt) {
        if (this.current) {
            const position = this.current.getPosition();
            this.manager.listener.setPosition(position);

            const wtm = this.current.getWorldTransform();
            this.manager.listener.setOrientation(wtm);
        }
    }

    destroy() {
        super.destroy();

        this.app.systems.off('postUpdate', this.onUpdate, this);
    }
}

export { AudioListenerComponentSystem };
