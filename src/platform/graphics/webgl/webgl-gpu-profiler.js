import { GpuProfiler } from "../gpu-profiler.js";

/**
 * Class holding information about the queries for a single frame.
 *
 * @ignore
 */
class FrameQueriesInfo {
    /**
     * The render version of the frame.
     *
     * @type {number[]}
     */
    renderVersion;

    /**
     * The queries for the frame.
     *
     * @type {WebGLQuery[]}
     */
    queries = [];

    destroy(gl) {
        this.queries.forEach(query => gl.deleteQuery(query));
        this.queries = null;
    }
}

/**
 * @ignore
 */
class WebglGpuProfiler extends GpuProfiler {
    device;

    /**
     * The pool of unused queries.
     *
     * @type {WebGLQuery[]}
     */
    freeQueries = [];

    /**
     * The pool of queries for the current frame.
     *
     * @type {WebGLQuery[]}
     */
    frameQueries = [];

    /**
     * A list of queries from the previous frames which are waiting for results.
     *
     * @type {FrameQueriesInfo[]}
     */
    previousFrameQueries = [];

    /**
     * Temporary array to storing the timings.
     *
     * @type {number[]}
     */
    timings = [];

    constructor(device) {
        super();
        this.device = device;
        this.ext = device.extDisjointTimerQuery;
    }

    destroy() {
        this.freeQueries.forEach(query => this.device.gl.deleteQuery(query));
        this.frameQueries.forEach(query => this.device.gl.deleteQuery(query));
        this.previousFrameQueries.forEach(frameQueriesInfo => frameQueriesInfo.destroy(this.device.gl));

        this.freeQueries = null;
        this.frameQueries = null;
        this.previousFrameQueries = null;
    }

    /**
     * Called when the WebGL context was lost. It releases all context related resources.
     *
     * @ignore
     */
    loseContext() {
        super.loseContext();
        this.freeQueries = [];
        this.frameQueries = [];
        this.previousFrameQueries = [];
    }

    restoreContext() {
        this.ext = this.device.extDisjointTimerQuery;
    }

    getQuery() {
        return this.freeQueries.pop() ?? this.device.gl.createQuery();
    }

    start(name) {

        if (this.ext) {

            const slot = this.getSlot(name);
            const query = this.getQuery();
            this.frameQueries[slot] = query;
            this.device.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);

            return slot;
        }

        return undefined;
    }

    end(slot) {

        if (slot !== undefined) {
            this.device.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
        }
    }

    frameStart() {

        this.processEnableRequest();

        if (this._enabled) {
            this.frameGPUMarkerSlot = this.start('GpuFrame');
        }
    }

    frameEnd() {
        if (this._enabled) {
            this.end(this.frameGPUMarkerSlot);
        }
    }

    request() {

        if (this._enabled) {

            const ext = this.ext;
            const gl = this.device.gl;
            const renderVersion = this.device.renderVersion;

            // add current frame queries to the end of frames list
            const frameQueries = this.frameQueries;
            if (frameQueries.length > 0) {
                this.frameQueries = [];

                const frameQueriesInfo = new FrameQueriesInfo();
                frameQueriesInfo.queries = frameQueries;
                frameQueriesInfo.renderVersion = renderVersion;
                this.previousFrameQueries.push(frameQueriesInfo);
            }

            // try to resolve the oldest frame
            if (this.previousFrameQueries.length > 0) {
                const previousQueriesInfo = this.previousFrameQueries[0];
                const previousQueries = previousQueriesInfo.queries;
                const lastQuery = previousQueries[previousQueries.length - 1];

                const available = gl.getQueryParameter(lastQuery, gl.QUERY_RESULT_AVAILABLE);
                const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);

                // valid results
                if (available && !disjoint) {

                    // remove the oldest frame from the list
                    this.previousFrameQueries.shift();

                    // get timings
                    const timings = this.timings;
                    timings.length = 0;
                    for (let i = 0; i < previousQueries.length; i++) {
                        const query = previousQueries[i];
                        const duration = gl.getQueryParameter(query, gl.QUERY_RESULT);
                        timings[i] = duration * 0.000001;

                        // return queries to the pool
                        this.freeQueries.push(query);
                    }

                    // report timings
                    this.report(previousQueriesInfo.renderVersion, timings);
                }

                // GPU was interrupted, discard all in-flight queries
                if (disjoint) {
                    this.previousFrameQueries.forEach((frameQueriesInfo) => {
                        this.report(frameQueriesInfo.renderVersion, null);
                        frameQueriesInfo.destroy(gl);
                    });
                    this.previousFrameQueries.length = 0;
                }
            }

            super.request(renderVersion);
        }
    }
}

export { WebglGpuProfiler };
