export const attributes = {
    speed: { type: 'number' }
};

export default class Rotate {
    speed = 10;

    /**
     * @type {Entity}
     */
    entity;

    /**
     * @param {Number} dt - time in milliseconds
     */
    update(dt) {
        this.entity.rotate(10 * dt * this.speed, 20 * dt, 30 * dt);
    }
}
