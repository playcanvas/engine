import { expect } from 'chai';

import { Color } from '../../../src/core/math/color.js';
import {
    LINEWIDTH_SCREEN,
    LINEWIDTH_WORLD,
    WideLineRenderer
} from '../../../src/extras/renderers/wide-line-renderer.js';
import {
    LINECAP_BUTT,
    LINECAP_ROUND,
    LINEJOIN_MITER,
    LINEJOIN_ROUND,
    WideLine
} from '../../../src/extras/renderers/wide-line.js';

describe('WideLine', function () {
    it('has default state', function () {
        const line = new WideLine();

        expect(line.pointCount).to.equal(0);
        expect(line.renderer).to.equal(null);
        expect(line.cap).to.equal(LINECAP_BUTT);
        expect(line.join).to.equal(LINEJOIN_MITER);
        expect(line.closed).to.equal(false);
        expect(line.dashLength).to.equal(0);
        expect(line.gapLength).to.equal(0);
        expect(line.dashOffset).to.equal(0);
    });

    it('sets packed positions, colors and widths', function () {
        const line = new WideLine();
        const positions = new Float32Array([0, 0, 0, 1, 2, 3, 4, 5, 6]);
        const colors = new Float32Array([
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        ]);
        const widths = new Float32Array([1, 2, 3]);

        expect(line.set(positions, colors, widths)).to.equal(line);
        expect(line.pointCount).to.equal(3);
        expect(line._positions).to.deep.equal(positions);
        expect(line._colors).to.deep.equal(colors);
        expect(line._widths).to.deep.equal(widths);
    });

    it('copies input data', function () {
        const line = new WideLine();
        const positions = new Float32Array([0, 0, 0, 1, 0, 0]);

        line.set(positions, Color.RED, 4);
        positions[0] = 10;

        expect(line._positions[0]).to.equal(0);
        expect(line._colors).to.deep.equal(new Float32Array([1, 0, 0]));
        expect(line._widths).to.deep.equal(new Float32Array([4]));
    });

    it('reuses storage for fixed-size updates', function () {
        const line = new WideLine();
        line.set([0, 0, 0, 1, 0, 0]);
        const storage = line._positions;

        line.setPositions([0, 1, 0, 1, 1, 0]);

        expect(line._positions).to.equal(storage);
    });

    it('rejects mismatched fixed-size updates', function () {
        const line = new WideLine();
        line.set([0, 0, 0, 1, 0, 0]);

        expect(() => line.setPositions([0, 0, 0, 1, 0, 0, 2, 0, 0])).to.throw(RangeError);
        expect(() => line.setColors([1, 1, 1])).to.throw(RangeError);
        expect(() => line.setWidths([1])).to.throw(RangeError);
    });

    it('allows set to change the point count atomically', function () {
        const line = new WideLine();
        line.set([0, 0, 0, 1, 0, 0]);
        line.set([0, 0, 0, 1, 0, 0, 2, 0, 0], Color.WHITE, [1, 2, 3]);

        expect(line.pointCount).to.equal(3);
    });

    it('does not modify data when set validation fails', function () {
        const line = new WideLine();
        line.set([0, 0, 0, 1, 0, 0]);

        expect(() => line.set([2, 0, 0, 3, 0, 0], Color.WHITE, [-1, 1])).to.throw(RangeError);
        expect(line._positions).to.deep.equal(new Float32Array([0, 0, 0, 1, 0, 0]));
        expect(line._widths).to.deep.equal(new Float32Array([1]));
    });

    it('updates style properties', function () {
        const line = new WideLine();

        line.cap = LINECAP_ROUND;
        line.join = LINEJOIN_ROUND;
        line.closed = true;
        line.dashLength = 2;
        line.gapLength = 1;
        line.dashOffset = -0.5;

        expect(line.cap).to.equal(LINECAP_ROUND);
        expect(line.join).to.equal(LINEJOIN_ROUND);
        expect(line.closed).to.equal(true);
        expect(line.dashLength).to.equal(2);
        expect(line.gapLength).to.equal(1);
        expect(line.dashOffset).to.equal(-0.5);
    });
});

describe('WideLineRenderer', function () {
    it('switches width shader variants', function () {
        const defines = [];
        let updates = 0;
        const renderer = Object.create(WideLineRenderer.prototype);
        renderer._widthUnits = LINEWIDTH_SCREEN;
        renderer.material = {
            setDefine: (name, value) => defines.push([name, value]),
            update: () => updates++
        };

        expect(renderer.widthUnits).to.equal(LINEWIDTH_SCREEN);

        renderer.widthUnits = LINEWIDTH_WORLD;
        expect(renderer.widthUnits).to.equal(LINEWIDTH_WORLD);
        expect(defines).to.deep.equal([['WIDE_LINE_WORLD_SPACE_WIDTH', true]]);
        expect(updates).to.equal(1);

        renderer.widthUnits = LINEWIDTH_SCREEN;
        expect(defines[1]).to.deep.equal(['WIDE_LINE_WORLD_SPACE_WIDTH', false]);
        expect(updates).to.equal(2);
    });

    it('rejects invalid width units', function () {
        const renderer = Object.create(WideLineRenderer.prototype);
        renderer._widthUnits = LINEWIDTH_SCREEN;

        expect(() => {
            renderer.widthUnits = -1;
        }).to.throw(RangeError);
    });
});
