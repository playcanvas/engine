/**
 * A Null implementation of the Texture.
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

    copy(source, options) {
        return true;
    }
}

export { NullTexture };
