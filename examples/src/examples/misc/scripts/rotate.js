export default class Rotate {
    constructor(app, entity) {
        this.box = entity;
    }

    // rotate the box according to the delta time since the last frame
    update(dt) {
        this.box.rotate(10 * dt, 20 * dt, 30 * dt);
    }
}
