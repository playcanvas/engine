export default class Rotate {
    // rotate the entity according to the delta time since the last frame
    update(dt, { entity }) {
        entity.rotate(10 * dt, 20 * dt, 30 * dt);
    }
}
