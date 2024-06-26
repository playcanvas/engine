/**
 * A NULL implementation of the Texture.
 *
 * @ignore
 */
class NullTexture {
    destroy(device) {
    }

    propertyChanged(flag) {
    }

    loseContext() {
    }

    uploadImmediate(device, texture, immediate) {
    }
}

export { NullTexture };
