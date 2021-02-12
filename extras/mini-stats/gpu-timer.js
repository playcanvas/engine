class GpuTimer {
    constructor(app) {
        this._gl = app.graphicsDevice.gl;
        this._ext = app.graphicsDevice.extDisjointTimerQuery;

        this._freeQueries = [];                     // pool of free queries
        this._frameQueries = [];                    // current frame's queries
        this._frames = [];                          // list of previous frame queries

        this._timings = [];
        this._prevTimings = [];

        this.enabled = true;
        this.unitsName = "ms";
        this.decimalPlaces = 1;

        app.on('frameupdate', this.begin.bind(this, 'update'));
        app.on('framerender', this.mark.bind(this, 'render'));
        app.on('frameend', this.end.bind(this));
    }

    // called when context was lost, function releases all context related resources
    loseContext() {
        this._freeQueries = [];                     // pool of free queries
        this._frameQueries = [];                    // current frame's queries
        this._frames = [];                          // list of previous frame queries
    }

    // mark the beginning of the frame
    begin(name) {
        if (!this.enabled) {
            return;
        }

        // store previous frame's queries
        if (this._frameQueries.length > 0) {
            this.end();
        }

        // check if all in-flight queries have been invalidated
        this._checkDisjoint();

        // resolve previous frame timings
        if (this._frames.length > 0) {
            if (this._resolveFrameTimings(this._frames[0], this._prevTimings)) {
                // swap
                var tmp = this._prevTimings;
                this._prevTimings = this._timings;
                this._timings = tmp;

                // free
                this._freeQueries = this._freeQueries.concat(this._frames.splice(0, 1)[0]);
            }
        }

        this.mark(name);
    }

    // mark
    mark(name) {
        if (!this.enabled) {
            return;
        }

        // end previous query
        if (this._frameQueries.length > 0) {
            this._gl.endQuery(this._ext.TIME_ELAPSED_EXT);
        }

        // allocate new query and begin
        var query = this._allocateQuery();
        query[0] = name;
        this._gl.beginQuery(this._ext.TIME_ELAPSED_EXT, query[1]);
        this._frameQueries.push(query);
    }

    // end of frame
    end() {
        if (!this.enabled) {
            return;
        }

        this._gl.endQuery(this._ext.TIME_ELAPSED_EXT);
        this._frames.push(this._frameQueries);
        this._frameQueries = [];
    }

    // check if the gpu has been interrupted thereby invalidating all
    // in-flight queries
    _checkDisjoint() {
        var disjoint = this._gl.getParameter(this._ext.GPU_DISJOINT_EXT);
        if (disjoint) {
            // return all queries to the free list
            this._freeQueries = [this._frames, [this._frameQueries], [this._freeQueries]].flat(2);
            this._frameQueries = [];
            this._frames = [];
        }
    }

    // either returns a previously free'd query or if there aren't any allocates a new one
    _allocateQuery() {
        return (this._freeQueries.length > 0) ?
            this._freeQueries.splice(-1, 1)[0] : ["", this._gl.createQuery()];
    }

    // attempt to resolve one frame's worth of timings
    _resolveFrameTimings(frame, timings) {
        // wait for the last query in the frame to be available
        if (!this._gl.getQueryParameter(frame[frame.length - 1][1], this._gl.QUERY_RESULT_AVAILABLE)) {
            return false;
        }

        for (var i = 0; i < frame.length; ++i) {
            timings[i] = [frame[i][0], this._gl.getQueryParameter(frame[i][1], this._gl.QUERY_RESULT) * 0.000001];
        }

        return true;
    }

    get timings() {
        return this._timings.map(function (v) {
            return v[1];
        });
    }
}

export { GpuTimer };
