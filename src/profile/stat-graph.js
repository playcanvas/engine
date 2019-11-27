Object.assign(pc, function () {
    'use strict';

    var graphDiv = null;
    var styles = ['rgb(255,96,96)', 'rgb(96,255,96)', 'rgb(96,96,255)', 'rgb(196,196,196)'];
    var width = 256;//16;
    var height = 114;
    var pixelRatio = window.devicePixelRatio;

    var updateLayout = function (child) {
        child.style.width = Math.floor(width / pixelRatio) + 'px';
        if (child.tagName === 'CANVAS') {
            child.style.height = Math.floor(height / pixelRatio) + 'px';
        }
        child.width = width;
        if (child.tagName === 'CANVAS') {
            child.height = height;
        }
    };

    var updateLayouts = function () {
        for (var i = 0; i < graphDiv.children.length; ++i) {
            updateLayout(graphDiv.children[i]);
        }
    };

    var StatGraph = function (label) {
        // create parent and add to the document
        if (graphDiv === null) {
            graphDiv = document.createElement('div');
            graphDiv.style.cssText = 'position:fixed;top:0;left:0;background:gray';
            document.body.appendChild(graphDiv);

            graphDiv.addEventListener('click', function (event) {
                event.preventDefault();
                if (event.metaKey || event.ctrlKey) {
                    pixelRatio = pixelRatio === 1 ? window.devicePixelRatio : 1;
                } else {
                    width = width === 16 ? 256 : 16;
                }
                updateLayouts();
            });
        }

        // create info div
        this.div = document.createElement('div');
        this.div.style.cssText = 'display:block;margin:0px;background-color:gray;color:white;font:bold 10px Helvetica,Arial,sans-serif';
        this.div.width = width;
        this.div.height = 12;
        this.div.innerHTML = label;
        graphDiv.appendChild(this.div);

        // create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'display:block;margin:2px;background:black';
        updateLayout(this.canvas);

        // get the graph's 2d context and clear it
        this.ctx = this.canvas.getContext('2d');
        this.ctx.fillStyle = 'rgb(0,0,0)';
        this.ctx.fillRect(0, 0, width, height);
        this.ctx.lineWidth = 1;

        graphDiv.appendChild(this.canvas);
    };

    StatGraph.prototype = {
        update: function (values, prevValues) {
            var w = this.canvas.width;
            var h = this.canvas.height;

            // shift contents left one pixel
            this.ctx.drawImage(this.canvas, 1, 0, w - 1, h, 0, 0, w - 1, h);

            // clear background
            var yMid = this._mapY(1000.0 / 60.0);
            this.ctx.fillStyle = 'rgb(0,0,0)';
            this.ctx.fillRect(w - 1, 0, 1, yMid);
            this.ctx.fillStyle = 'rgb(48,48,48)';
            this.ctx.fillRect(w - 1, yMid, 1, h - yMid);

            // render values
            // this._renderLines(values, prevValues);
            this._renderStacked(values, prevValues);
        },

        _renderLines: function (values, prevValues) {
            var w = this.canvas.width;
            for (var i = values.length - 1; i >= 0; --i) {
                var y1 = this._mapY(prevValues[i]);
                var y2 = this._mapY(values[i]);

                this.ctx.strokeStyle = styles[i % styles.length];
                this.ctx.beginPath();
                this.ctx.moveTo(w - 2, y1);
                this.ctx.lineTo(w - 1, y2);
                this.ctx.stroke();
            }
        },

        _renderStacked: function (values, prevValues) {
            var w = this.canvas.width;
            var h = this.canvas.height;
            var curY = h;
            for (var i = 0; i < values.length; ++i) {
                var value = h * values[i] / 48.0;
                curY -= value;
                this.ctx.fillStyle = styles[i % styles.length];
                this.ctx.fillRect(w - 1, curY, 1, value);
            }
        },

        _mapY: function (value) {
            return this.canvas.height * (1.0 - value / 48.0);
        }
    };

    return {
        StatGraph: StatGraph
    };
}());
