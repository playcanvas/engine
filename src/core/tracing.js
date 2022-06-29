/**
 * Log tracing functionality, allowing for tracing of the internal functionality of the engine.
 * Note that the trace logging only takes place in the debug build of the engine and is stripped
 * out in other builds.
 */
 class Tracing {
    /**
     * Set storing names of enabled trace channels
     *
     * @type {Set<string>}
     * @private
     */
    static _traceChannels = new Set();

    /**
     * Enable or disable trace channel
     *
     * @param {string} channel - Name of the trace channel. Can be:
     *
     * - {@link TRACEID_RENDER_FRAME}
     * - {@link TRACEID_RENDER_PASS}
     * - {@link TRACEID_RENDER_PASS_DETAIL}
     * - {@link TRACEID_RENDER_ACTION}
     * - {@link TRACEID_RENDER_TARGET_ALLOC}
     * - {@link TRACEID_TEXTURE_ALLOC}
     *
     * @param {boolean} enabled - new enabled state for it
     */
    static set(channel, enabled = true) {

        // #if _DEBUG
        if (enabled) {
            Tracing._traceChannels.add(channel);
        } else {
            Tracing._traceChannels.delete(channel);
        }
        // #endif
    }

    /**
     * Test if the trace channel is enabled.
     *
     * @param {string} channel - Name of the trace channnel.
     * @returns {boolean} - True if the trace channel is enabled.
     */
    static get(channel) {
        return Tracing._traceChannels.has(channel);
    }
}

export { Tracing };
