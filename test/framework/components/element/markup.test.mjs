import { expect } from 'chai';

import { Markup } from '../../../../src/framework/components/element/markup.js';

describe('Markup', function () {

    const evaluate = text => Markup.evaluate(Array.from(text));

    it('strips tags and returns the visible symbols', function () {
        const result = evaluate('[color="#ff0000"]hi[/color]');

        expect(result.symbols).to.deep.equal(['h', 'i']);
        expect(result.tags).to.have.lengthOf(2);
        expect(result.tags[0].color.value).to.equal('#ff0000');
    });

    it('does not throw when a tag name shadows an Object.prototype method', function () {
        const result = evaluate('[hasOwnProperty]hi[/hasOwnProperty]');

        expect(result.symbols).to.deep.equal(['h', 'i']);
        expect(result.tags[0].hasOwnProperty.value).to.equal(null);
    });

    it('merges a shadowing tag with a surrounding tag', function () {
        const result = evaluate('[color="#ff0000"][hasOwnProperty="x"]hi[/hasOwnProperty][/color]');

        expect(result.tags[0].color.value).to.equal('#ff0000');
        expect(result.tags[0].hasOwnProperty.value).to.equal('x');
    });

    it('merges nested tags that both shadow an Object.prototype method', function () {
        const text = '[hasOwnProperty="a"]h[hasOwnProperty="b"]i[/hasOwnProperty][/hasOwnProperty]';
        const result = evaluate(text);

        expect(result.symbols).to.deep.equal(['h', 'i']);
        expect(result.tags[0].hasOwnProperty.value).to.equal('a');
        expect(result.tags[1].hasOwnProperty.value).to.equal('b');
    });

    it('does not pollute Object.prototype through a __proto__ tag', function () {
        const result = evaluate('[__proto__="x"]hi[/__proto__]');

        expect(result.symbols).to.deep.equal(['h', 'i']);
        expect({}.value).to.equal(undefined);
    });

});
