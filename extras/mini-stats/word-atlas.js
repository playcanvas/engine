// Word atlas
function WordAtlas(texture, words) {
    var canvas = document.createElement('canvas');
    canvas.width = texture.width;
    canvas.height = texture.height;

    // configure the context
    var context = canvas.getContext('2d', { alpha: true });
    context.font = '10px "Lucida Console", Monaco, monospace';
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = "rgb(255, 255, 255)";

    var padding = 5;
    var x = padding;
    var y = padding;
    var placements = [];
    var i;

    for (i = 0; i < words.length; ++i) {
        // measure the word
        var measurement = context.measureText(words[i]);

        var l = Math.ceil(-measurement.actualBoundingBoxLeft);
        var r = Math.ceil(measurement.actualBoundingBoxRight);
        var a = Math.ceil(measurement.actualBoundingBoxAscent);
        var d = Math.ceil(measurement.actualBoundingBoxDescent);

        var w = l + r;
        var h = a + d;

        // wrap text
        if (x + w >= canvas.width) {
            x = padding;
            y += 16;
        }

        // render the word
        context.fillText(words[i], x - l, y + a);

        placements.push({
            l: l, r: r, a: a, d: d,
            x: x, y: y, w: w, h: h
        });

        x += w + padding;
    }

    var wordMap = { };
    words.forEach(function (w, i) {
        wordMap[w] = i;
    });

    this.words = words;
    this.wordMap = wordMap;
    this.placements = placements;
    this.texture = texture;

    // copy pixel data to target
    var source = context.getImageData(0, 0, canvas.width, canvas.height);
    var dest = texture.lock();
    var red, alpha;
    for (y = 0; y < source.height; ++y) {
        for (x = 0; x < source.width; ++x) {
            var offset = (x + y * texture.width) * 4;

            // set .rgb white to allow shader to identify text
            dest[offset] = 255;
            dest[offset + 1] = 255;
            dest[offset + 2] = 255;

            // red red and alpha from image
            red = source.data[(x + (source.height - 1 - y) * source.width) * 4];
            alpha = source.data[(x + (source.height - 1 - y) * source.width) * 4 + 3];

            // alpha contains greyscale letters, use red to make non-digits darker
            dest[offset + 3] = alpha * (red > 150 ? 1 : 0.7);
        }
    }
}

Object.assign(WordAtlas.prototype, {
    render: function (render2d, word, x, y) {
        var p = this.placements[this.wordMap[word]];
        if (p) {
            var padding = 1;
            render2d.quad(this.texture,
                          x + p.l - padding,
                          y - p.d + padding,
                          p.w + padding * 2,
                          p.h + padding * 2,
                          p.x - padding,
                          64 - p.y - p.h - padding);
            return p.w;
        }
        return 0;
    }
});

export { WordAtlas };
