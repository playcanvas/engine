import { EventHandler } from '../../core/event-handler.js';
import { Vec3 } from '../../core/math/vec3.js';

class Input extends EventHandler {
    static EVENT_ROTATESTART = 'rotate:start';

    static EVENT_ROTATEMOVE = 'rotate:move';

    static EVENT_ROTATEEND = 'rotate:end';

    translation = new Vec3();
}

export { Input };
