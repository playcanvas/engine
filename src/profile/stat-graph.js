Object.assign(pc, function () {
    'use strict';

    var graphDiv = null;

    var StatGraph = function (width, height) {
        width = width || 16;//256;
        height = height || 144;

        this.styles = ['rgb(255,96,96)', 'rgb(96,255,96)', 'rgb(96,96,255)', 'rgb(196,196,196)'];

        // create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'display:block;margin:2px;background:black';
        this.canvas.style.width = Math.floor(width / window.devicePixelRatio) + 'px';
        this.canvas.style.height = Math.floor(height / window.devicePixelRatio) + 'px';
        this.canvas.width = width;
        this.canvas.height = height;

        // get context and clear
        this.ctx = this.canvas.getContext('2d');
        this.ctx.fillStyle = 'rgb(0,0,0)';
        this.ctx.fillRect(0, 0, width, height);
        this.ctx.lineWidth = 1;

        // create parent and add to the document
        if (graphDiv === null) {
            graphDiv = document.createElement('div');
            graphDiv.style.cssText = 'position:fixed;top:0;left:0;background:#606060;';
            document.body.appendChild(graphDiv);

            graphDiv.addEventListener('click', function (event) {
                event.preventDefault();
                for (var i = graphDiv.children.length - 1; i >= 0; --i) {
                    var child = graphDiv.children[i];
                    child.width = child.width === 16 ? 256 : 16;
                    child.style.width = Math.floor(child.width / window.devicePixelRatio) + 'px';
                }
            });
        }
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

                this.ctx.strokeStyle = this.styles[i % this.styles.length];
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
                this.ctx.fillStyle = this.styles[i % this.styles.length];
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
