Object.assign(pc, function () {
    'use strict';

    var statContainer = null;

    // StatContainer

    var STATES = {
        collapsed: { width: 32, height: 114, pixelRatio: 1, opacity: 0.6, showLabel: true, showGraph: false },
        small: { width: 256, height: 114, pixelRatio: 1, opacity: 0.6, showLabel: true, showGraph: true },
        large: { width: 256, height: 114, pixelRatio: 2, opacity: 0.6, showLabel: true, showGraph: true }
    };

    var STATE_ORDER = ['collapsed', 'small', 'large'];

    var StatContainer = function () {
        this.state = 0;
        this.children = [];
        this.parent = document.createElement('div');
        this.parent.style.cssText = 'position:fixed;top:0;left:0;background:transparent;border:1px solid black';

        this.parent.addEventListener('mouseenter', function (event) {
            this.activate();
        }.bind(this));

        this.parent.addEventListener('mouseleave', function (event) {
            this.deactivate();
        }.bind(this));

        this.parent.addEventListener('click', function (event) {
            event.preventDefault();
            this.toggle();
        }.bind(this));

        document.body.appendChild(this.parent);
    };

    Object.assign(StatContainer.prototype, {
        addChild: function (stat) {
            if (this.children.length > 0) {
                stat.parent.style.borderTop = '2px solid gray';
            }
            this.children.push(stat);
            this.parent.appendChild(stat.parent);

            var state = this._getState();
            stat.parent.style.opacity = state.opacity;
            stat._updateLayout(state);
        },

        toggle: function () {
            this.state = (this.state + 1) % STATE_ORDER.length;
            this._updateLayouts();
        },

        show: function () {
            this.parent.style.display = 'block';
        },

        hide: function () {
            this.parent.style.display = 'none';
        },

        activate: function () {
            for (var i = 0; i < this.children.length; ++i) {
                this.children[i].parent.style.opacity = 1.0;
            }
            this.parent.style.borderColor = 'darkorange';
        },

        deactivate: function () {
            var state = this._getState();
            for (var i = 0; i < this.children.length; ++i) {
                this.children[i].parent.style.opacity = state.opacity;
            }
            this.parent.style.borderColor = 'black';
        },

        _updateLayouts: function () {
            var state = this._getState();
            for (var i = 0; i < this.children.length; ++i) {
                this.children[i]._updateLayout(state);
            }
        },

        _getState: function () {
            return STATES[STATE_ORDER[this.state]];
        }
    });

    // StatGraph

    var STYLES = ['rgb(255,96,96)', 'rgb(96,255,96)', 'rgb(96,96,255)', 'rgb(196,196,196)'];

    var StatGraph = function (label) {
        if (!statContainer) {
            statContainer = new StatContainer();
        }

        this.label = label;
        this.avg = 0;
        this.avgTotal = 0;
        this.avgTimer = 0;
        this.avgCount = 0;

        // create parent div
        this.parent = document.createElement('div');

        // create text div
        this.text = document.createElement('div');
        // position:absolute;top:5px;left:5px;
        this.text.style.cssText = 'background:black;color:rgba(255,255,255,0.5);font:10px "Lucida Console", Monaco, monospace';
        this.text.innerHTML = label;
        this.parent.appendChild(this.text);

        // create graph canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'background:black;';
        this.parent.appendChild(this.canvas);

        // get the graph's 2d context and clear it
        this.ctx = this.canvas.getContext('2d');
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.lineWidth = 1;

        statContainer.addChild(this);
    };

    Object.assign(StatGraph.prototype, {
        update: function (ms, values) {
            // calculate stacked total
            var total = values.reduce(function (a, v) {
                return a + v;
            }, 0);

            // update averages
            this.avgTotal += total;
            this.avgTimer += ms;
            this.avgCount++;
            if (this.avgTimer > 1000) {
                this.avg = this.avgTotal / this.avgCount;
                this.avgTimer = 0;
                this.avgTotal = 0;
                this.avgCount = 0;

                // update display text
                if (this.text.style.display !== 'none') {
                    this.text.innerHTML = this.label + ' ' + this.avg.toFixed(1) + 'ms';
                }
            }

            // update graph canvas
            if (this.canvas.style.display !== 'none') {
                var w = this.canvas.width;
                var h = this.canvas.height;

                // shift graph contents left one pixel
                this.ctx.drawImage(this.canvas, 1, 0, w - 1, h, 0, 0, w - 1, h);

                // clear background
                this.ctx.fillStyle = 'black';
                this.ctx.fillRect(w - 1, 0, 1, h);

                // render values
                this._renderStacked(values);

                // overlay 60hz frame marker
                var yMid = this._mapY(1000.0 / 60.0);
                this.ctx.fillStyle = 'rgb(255,255,0, 0.6)';
                this.ctx.fillRect(w - 1, yMid, 1, 1);
            }
        },

        _renderStacked: function (values) {
            var w = this.canvas.width;
            var h = this.canvas.height;
            var curY = h;
            for (var i = 0; i < values.length; ++i) {
                var value = h * values[i] / 48.0;
                curY -= value;
                this.ctx.fillStyle = STYLES[i % STYLES.length];
                this.ctx.fillRect(w - 1, curY, 1, value);
            }
        },

        _mapY: function (value) {
            return this.canvas.height * (1.0 - value / 48.0);
        },

        _updateLayout: function (state) {
            this.text.style.display = state.showLabel ? 'block' : 'none';
            this.canvas.style.display = state.showGraph ? 'block' : 'none';
            this.canvas.style.width = Math.floor(state.width * state.pixelRatio / window.devicePixelRatio) + 'px';
            this.canvas.style.height = Math.floor(state.height * state.pixelRatio / window.devicePixelRatio) + 'px';
            this.canvas.width = state.width;
            this.canvas.height = state.height;
        }
    });

    return {
        StatGraph: StatGraph,
        toggleMiniStats: function () {
            if (statContainer) {
                statContainer.toggle();
            }
        },
        showMiniStats: function () {
            if (statContainer) {
                statContainer.show();
            }
        },
        hideMiniStats: function () {
            if (statContainer) {
                statContainer.hide();
            }
        }
    };
}());
