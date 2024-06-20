import { Script } from 'playcanvas';

class Rotator extends Script {
    /**
     * @attribute
     */
    angle = 0;

    update(dt) {
        this.angle += dt;
        this.entity.setLocalEulerAngles(this.angle * 10, this.angle * 20, this.angle * 30);
    }
}

export { Rotator };
