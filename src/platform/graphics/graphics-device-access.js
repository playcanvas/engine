/**
 * A static class providing access to current GraphicsDevice. Note that this should not be used
 * to access graphics device normally, and is provided only as a way of obtaining it to preserve
 * backwards API compatibility. In normal situations, a device needs to be passed in to classes
 * that need it.
 *
 * @ignore
 */
class GraphicsDeviceAccess {
    static _graphicsDevice = null;

    static set(graphicsDevice) {
        GraphicsDeviceAccess._graphicsDevice = graphicsDevice;
    }

    static get() {
        return GraphicsDeviceAccess._graphicsDevice;
    }
}

export { GraphicsDeviceAccess };
