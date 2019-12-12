Object.assign(pc, function () {
    'use strict';

    var GpuTimer = function (gl, extDisjointTimer) {
        this._gl = gl;
        this._ext = extDisjointTimer;

        this._freeQueries = [];                     // pool of free queries
        this._frameQueries = [];                    // current frame's queries
        this._frames = [];                          // list of previous frame queries

        this._timings = [];
        this._prevTimings = [];
    };

    Object.assign(GpuTimer.prototype, {
        // mark the beginning of the frame
        begin: function (name) {
            if (!this._ext) {
                return;
            }

            // store previous frame's queries
            if (this._frameQueries.length > 0) {
                this._gl.endQuery(this._ext.TIME_ELAPSED_EXT);
                this._frames.push(this._frameQueries);
                this._frameQueries = [];
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
        },

        // mark
        mark: function (name) {
            if (!this._ext) {
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
        },

        // check if the gpu has been interrupted thereby invalidating all
        // in-flight queries
        _checkDisjoint: function () {
            var disjoint = this._gl.getParameter(this._ext.GPU_DISJOINT_EXT);
            if (disjoint) {
                // return all queries to the free list
                this._freeQueries = [this._frames, [this._frameQueries], [this._freeQueries]].flat(2);
                this._frameQueries = [];
                this._frames = [];
            }
        },

        // either returns a previously free'd query or if there aren't any allocates a new one
        _allocateQuery: function () {
            return (this._freeQueries.length > 0) ?
                this._freeQueries.splice(-1, 1)[0] : ["", this._gl.createQuery()];
        },

        // attempt to resolve one frame's worth of timings
        _resolveFrameTimings: function (frame, timings) {
            // wait for the last query in the frame to be available
            if (!this._gl.getQueryParameter(frame[frame.length - 1][1], this._gl.QUERY_RESULT_AVAILABLE)) {
                return false;
            }

            for (var i = 0; i < frame.length; ++i) {
                timings[i] = [frame[i][0], this._gl.getQueryParameter(frame[i][1], this._gl.QUERY_RESULT) * 0.000001];
            }

            return true;
        }
    });

    Object.defineProperty(GpuTimer.prototype, 'timings', {
        get: function () {
            return this._timings;
        }
    });

    return {
        GpuTimer: GpuTimer
    };
}());
