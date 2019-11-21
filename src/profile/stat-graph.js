Object.assign(pc, function () {
    'use strict';

    var graphDiv = null;

    var StatGraph = function (width, height) {
        this.width = width || 256;
        this.height = height || 144;

        this.styles = ['rgb(255,255,255)', 'rgb(255,64,64)', 'rgb(64,255,64)', 'rgb(64,64,255)'];

        // create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.width = this.width / window.devicePixelRatio + 'px';
        this.canvas.style.height = this.height / window.devicePixelRatio + 'px';
        this.canvas.style.display = 'block';
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // get context and clear
        this.ctx = this.canvas.getContext('2d');
        this.ctx.fillStyle = 'rgb(0,0,0)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.lineWidth = 1;

        // create parent and add to the document
        if (graphDiv === null) {
            graphDiv = document.createElement('div');
            graphDiv.style.cssText = 'position:fixed;top:0;left:0;border:2px solid #606060';
            document.body.appendChild(graphDiv);
        }
        graphDiv.appendChild(this.canvas);
    };

    StatGraph.prototype = {
        update: function (values, prevValues) {
            var w = this.width;
            var h = this.height;

            // shift contents left one pixel
            this.ctx.drawImage(this.canvas, 1, 0, w - 1, h, 0, 0, w - 1, h);

            // clear background
            var yMid = this._mapY(1000.0 / 60.0);
            this.ctx.fillStyle = 'rgb(0,0,0)';
            this.ctx.fillRect(w - 1, 0, 1, yMid);
            this.ctx.fillStyle = 'rgb(48,48,48)';
            this.ctx.fillRect(w - 1, yMid, 1, h - yMid);

            // render values
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

        _mapY: function (value) {
            return (this.height - 1) * (1.0 - value / 48.0);
        }
    };

    return {
        StatGraph: StatGraph
    };
}());
