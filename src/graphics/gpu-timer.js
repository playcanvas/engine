Object.assign(pc, function () {
    'use strict';

    var GpuTimer = function (device) {
        this._gl = device.gl;
        this._ext = device.extDisjointTimerQuery;

        this._freeQueries = [];             // pool of free queries
        this._frameQueries = [];            // current frame's queries
        this._frames = [];                  // list of previous frame queries

        this._prevFrameEndTimestamp = 0;
        this._timings = { };
        this._prevTimings = { };

        console.log("bits=" + gl.getQuery(ext.TIMESTAMP_EXT, ext.QUERY_COUNTER_BITS_EXT));
    };

    Object.assign(GpuTimer.prototype, {
        // mark the beginning of the frame
        begin: function (name) {
            if (!this._ext) {
                return;
            }

            // check if all in-flight queries have been invalidated
            this._checkDisjoint();

            // store previous frame's queries
            if (this._frameQueries.length > 0) {
                this._frames.push(this._frameQueries);
                this._frameQueries = [];
            }

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

        // mark middle of a frame
        mark: function (name) {
            if (!this._ext) {
                return;
            }

            var query = this._allocateQuery();
            query[0] = name;
            this._ext.queryCounterEXT(query[1], this._ext.TIMESTAMP_EXT);
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
            var last = frame[frame.length - 1];
            console.log('isquery=' + this._gl.isQuery(last[1]));
            // wait for the last query in the frame to be available
            if (!this._gl.getQueryParameter(last[1], this._gl.QUERY_RESULT_AVAILABLE)) {
                return false;
            }

            for (var i = 0; i < frame.length; ++i) {
                var query = frame[i];
                var timestamp = this._gl.getQueryParameter(query[1], this._gl.QUERY_RESULT);
                timings[query[0]] = timestamp - this._prevFrameEndTimestamp;
                this._prevFrameEndTimestamp = timestamp;
            }

            return true;
        }
    });

    return {
        GpuTimer: GpuTimer
    };
}());
