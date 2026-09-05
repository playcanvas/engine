import { math } from '../../core/math/math.js';
import { Texture } from '../../platform/graphics/texture.js';
import { FILTER_LINEAR } from '../../platform/graphics/constants.js';

class WordAtlas {
    constructor(device, words) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { alpha: true });
        const fonts = [
            '400 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            '600 28px "SFMono-Regular", Consolas, "Liberation Mono", monospace'
        ];
        const glyphs = new Set(words);
        for (const word of words) {
            for (const char of word) glyphs.add(char);
        }
        for (let i = 32; i < 127; i++) glyphs.add(String.fromCharCode(i));
        glyphs.add('…');
        glyphs.add('—');

        // Both fonts share one atlas at 2x CSS resolution. Painting happens only here;
        // changing values are assembled from cached, tabular digit quads.
        const padding = 2;
        const width = 1024;
        let x = padding;
        let y = padding;
        let rowHeight = 0;
        this.placements = [new Map(), new Map()];
        for (let style = 0; style < fonts.length; style++) {
            context.font = fonts[style];
            for (const word of glyphs) {
                const measurement = context.measureText(word);
                const left = Math.floor(-measurement.actualBoundingBoxLeft);
                const right = Math.ceil(measurement.actualBoundingBoxRight);
                const ascent = Math.ceil(measurement.actualBoundingBoxAscent);
                const descent = Math.ceil(measurement.actualBoundingBoxDescent);
                const w = right - left + padding * 2;
                const h = ascent + descent + padding * 2;
                if (w > width - padding * 2) continue;
                if (x + w + padding > width) {
                    x = padding;
                    y += rowHeight + padding;
                    rowHeight = 0;
                }
                this.placements[style].set(word, {
                    x,
                    y,
                    w,
                    h,
                    left,
                    ascent,
                    offsetX: (left - padding) / 2,
                    offsetY: (-descent - padding) / 2,
                    advance: measurement.width / 2
                });
                x += w + padding;
                rowHeight = Math.max(rowHeight, h);
            }
        }
        canvas.width = width;
        canvas.height = math.nextPowerOfTwo(y + rowHeight + padding);
        context.fillStyle = '#fff';
        context.textBaseline = 'alphabetic';
        for (let style = 0; style < fonts.length; style++) {
            context.font = fonts[style];
            for (const [word, p] of this.placements[style]) {
                context.fillText(word, p.x + padding - p.left, p.y + padding + p.ascent);
            }
        }
        this.texture = new Texture(device, {
            name: 'mini-stats-word-atlas',
            width: canvas.width,
            height: canvas.height,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            levels: [context.getImageData(0, 0, canvas.width, canvas.height).data]
        });
    }

    destroy() {
        this.texture.destroy();
    }

    measure(word, style = 0) {
        const placements = this.placements[style];
        const p = placements.get(word);
        if (p) return p.advance;
        let width = 0;
        for (let i = 0; i < word.length; i++) {
            width += (placements.get(word[i]) ?? placements.get('?')).advance;
        }
        return width;
    }

    render(render2d, word, x, y, style = 0, color = 0xffffffff, maxWidth = Infinity) {
        const width = this.measure(word, style);
        if (maxWidth <= 0) return 0;
        const ellipsis = this.placements[style].get('…');
        const truncate = width > maxWidth;
        const available = truncate ? Math.max(0, maxWidth - ellipsis.advance) : width;
        this.renderText(render2d, word, x, y, style, color, available);
        if (truncate) this.renderText(render2d, '…', x + available, y, style, color, ellipsis.advance);
        return Math.min(width, maxWidth);
    }

    renderText(render2d, word, x, y, style, color, maxWidth) {
        const placements = this.placements[style];
        const whole = placements.get(word);
        let advance = 0;
        const count = whole ? 1 : word.length;
        for (let i = 0; i < count && advance < maxWidth; i++) {
            const p = whole ?? placements.get(word[i]) ?? placements.get('?');
            const width = Math.min(p.w / 2, maxWidth - advance - p.offsetX);
            render2d.quad(x + advance + p.offsetX, y + p.offsetY, width, p.h / 2,
                p.x, this.texture.height - p.y - p.h, width * 2, p.h, this.texture, 1, color);
            advance += p.advance;
        }
    }
}

export { WordAtlas };
