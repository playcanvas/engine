import { Vec2 } from '../../../math/vec2.js';

class ScrollViewComponentData {
    constructor() {
        this.enabled = true;
        this.useMouseWheel = true;
        this.mouseWheelSensitivity = new Vec2(1, 1);
    }
}

export { ScrollViewComponentData };
