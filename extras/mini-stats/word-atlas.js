// Word atlas
class WordAtlas {
    constructor(texture, words) {
        const canvas = document.createElement('canvas');
        canvas.width = texture.width;
        canvas.height = texture.height;

        // configure the context
        const context = canvas.getContext('2d', { alpha: true });
        context.font = '10px "Lucida Console", Monaco, monospace';
        context.textAlign = "left";
        context.textBaseline = "alphabetic";
        context.fillStyle = "rgb(255, 255, 255)";

        const padding = 5;
        let x = padding;
        let y = padding;
        const placements = [];

        for (let i = 0; i < words.length; ++i) {
            // measure the word
            const measurement = context.measureText(words[i]);

            const l = Math.ceil(-measurement.actualBoundingBoxLeft);
            const r = Math.ceil(measurement.actualBoundingBoxRight);
            const a = Math.ceil(measurement.actualBoundingBoxAscent);
            const d = Math.ceil(measurement.actualBoundingBoxDescent);

            const w = l + r;
            const h = a + d;

            // wrap text
            if (x + w >= canvas.width) {
                x = padding;
                y += 16;
            }

            // digits and '.' are white, the rest grey
            context.fillStyle = words[i].length === 1 ? "rgb(255, 255, 255)" : "rgb(150, 150, 150)";

            // render the word
            context.fillText(words[i], x - l, y + a);

            placements.push({
                l: l,
                r: r,
                a: a,
                d: d,
                x: x,
                y: y,
                w: w,
                h: h
            });

            x += w + padding;
        }

        const wordMap = { };
        words.forEach((w, i) => {
            wordMap[w] = i;
        });

        this.words = words;
        this.wordMap = wordMap;
        this.placements = placements;
        this.texture = texture;

        // copy pixel data to target
        const source = context.getImageData(0, 0, canvas.width, canvas.height);
        const dest = texture.lock();
        for (let y = 0; y < source.height; ++y) {
            for (let x = 0; x < source.width; ++x) {
                const offset = (x + y * texture.width) * 4;

                // set .rgb white to allow shader to identify text
                dest[offset] = 255;
                dest[offset + 1] = 255;
                dest[offset + 2] = 255;

                // red and alpha from image
                const red = source.data[(x + (source.height - 1 - y) * source.width) * 4];
                const alpha = source.data[(x + (source.height - 1 - y) * source.width) * 4 + 3];

                // alpha contains grayscale letters, use red to make non-digits darker
                dest[offset + 3] = alpha * (red > 150 ? 1 : 0.7);
            }
        }
    }

    render(render2d, word, x, y) {
        const p = this.placements[this.wordMap[word]];
        if (p) {
            const padding = 1;
            render2d.quad(this.texture,
                          x + p.l - padding,
                          y - p.d + padding,
                          p.w + padding * 2,
                          p.h + padding * 2,
                          p.x - padding,
                          64 - p.y - p.h - padding,
                          undefined, undefined,
                          true);
            return p.w;
        }
        return 0;
    }
}

export { WordAtlas };
