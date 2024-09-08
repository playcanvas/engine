import { IndexedList } from '../../src/core/indexed-list.js';

import { expect } from 'chai';

describe('IndexedList', function () {

    describe('#constructor', function () {

        it('creates an empty list', function () {
            const list = new IndexedList();

            expect(list.list().length).to.equal(0);
        });

    });

    describe('#clear', function () {

        it('removes all values', function () {
            const list = new IndexedList();

            const key1 = 'key1';
            const key2 = 'key2';
            const key3 = 'key3';
            const key4 = 'key4';
            const key5 = 'key5';

            const value1 = 'value1';
            const value2 = 'value2';
            const value3 = 'value3';
            const value4 = 'value4';
            const value5 = 'value5';

            list.push(key1, value1);
            list.push(key2, value2);
            list.push(key3, value3);
            list.push(key4, value4);
            list.push(key5, value5);

            list.clear();

            expect(list.has(key1)).to.equal(false);
            expect(list.has(key2)).to.equal(false);
            expect(list.has(key3)).to.equal(false);
            expect(list.has(key4)).to.equal(false);
            expect(list.has(key5)).to.equal(false);

            expect(list.get(key1)).to.equal(null);
            expect(list.get(key2)).to.equal(null);
            expect(list.get(key3)).to.equal(null);
            expect(list.get(key4)).to.equal(null);
            expect(list.get(key5)).to.equal(null);

            const all = list.list();

            expect(all.length).to.equal(0);
        });

    });

    describe('#has', function () {

        it('returns true if the key exists', function () {
            const list = new IndexedList();

            const key1 = 'key1';
            const key2 = 'key2';
            const key3 = 'key3';
            const key4 = 'key4';
            const key5 = 'key5';

            const value1 = 'value1';
            const value2 = 'value2';
            const value3 = 'value3';
            const value4 = 'value4';
            const value5 = 'value5';

            list.push(key1, value1);
            list.push(key2, value2);
            list.push(key3, value3);
            list.push(key4, value4);
            list.push(key5, value5);

            expect(list.has(key1)).to.equal(true);
            expect(list.has(key2)).to.equal(true);
            expect(list.has(key3)).to.equal(true);
            expect(list.has(key4)).to.equal(true);
            expect(list.has(key5)).to.equal(true);
        });

        it('returns false if the key does not exist', function () {
            const list = new IndexedList();

            const key1 = 'key1';
            const key2 = 'key2';
            const key3 = 'key3';
            const key4 = 'key4';
            const key5 = 'key5';

            const value1 = 'value1';
            const value2 = 'value2';
            const value3 = 'value3';
            const value4 = 'value4';
            const value5 = 'value5';

            list.push(key1, value1);
            list.push(key2, value2);
            list.push(key3, value3);
            list.push(key4, value4);
            list.push(key5, value5);

            expect(list.has('key6')).to.equal(false);
            expect(list.has('key7')).to.equal(false);
            expect(list.has('key8')).to.equal(false);
            expect(list.has('key9')).to.equal(false);
            expect(list.has('key10')).to.equal(false);
        });

    });

    describe('#push', function () {

        it('adds an key-value pair to the list', function () {
            const list = new IndexedList();

            const key = 'key';
            const notkey = 'notkey';
            const value = 'value';

            list.push(key, value);

            expect(list.has(key)).to.equal(true);
            expect(list.has(notkey)).to.equal(false);
            expect(list.get(key)).to.equal(value);
        });

    });

    describe('#get', function () {

        it('returns the value for the key', function () {
            const list = new IndexedList();

            const key = 'key';
            const value = 'value';

            list.push(key, value);

            expect(list.get(key)).to.equal(value);
        });

        it('returns null if the key does not exist', function () {
            const list = new IndexedList();

            const key = 'key';
            const notkey = 'notkey';
            const value = 'value';

            list.push(key, value);

            expect(list.get(notkey)).to.equal(null);
        });

    });

    describe('#list', function () {

        it('returns list in order', function () {
            const list = new IndexedList();

            const key1 = 'key1';
            const key2 = 'key2';
            const key3 = 'key3';
            const key4 = 'key4';
            const key5 = 'key5';

            const value1 = 'value1';
            const value2 = 'value2';
            const value3 = 'value3';
            const value4 = 'value4';
            const value5 = 'value5';

            list.push(key1, value1);
            list.push(key2, value2);
            list.push(key3, value3);
            list.push(key4, value4);
            list.push(key5, value5);

            const all = list.list();

            expect(all[0]).to.equal(value1);
            expect(all[1]).to.equal(value2);
            expect(all[2]).to.equal(value3);
            expect(all[3]).to.equal(value4);
            expect(all[4]).to.equal(value5);
        });

    });

    describe('#remove', function () {

        it('removes the key', function () {
            const list = new IndexedList();

            const key = 'key';
            const value = 'value';

            list.push(key, value);

            list.remove(key);

            expect(list.has(key)).to.equal(false);
        });


        it('does not affect surrounding keys', function () {
            const list = new IndexedList();

            const key1 = 'key1';
            const key2 = 'key2';
            const key3 = 'key3';
            const key4 = 'key4';
            const key5 = 'key5';

            const value1 = 'value1';
            const value2 = 'value2';
            const value3 = 'value3';
            const value4 = 'value4';
            const value5 = 'value5';

            list.push(key1, value1);
            list.push(key2, value2);
            list.push(key3, value3);
            list.push(key4, value4);
            list.push(key5, value5);

            list.remove(key3);

            expect(list.has(key1)).to.equal(true);
            expect(list.has(key2)).to.equal(true);
            expect(list.has(key3)).to.equal(false);
            expect(list.has(key4)).to.equal(true);
            expect(list.has(key5)).to.equal(true);

            expect(list.get(key1)).to.equal(value1);
            expect(list.get(key2)).to.equal(value2);
            expect(list.get(key3)).to.equal(null);
            expect(list.get(key4)).to.equal(value4);
            expect(list.get(key5)).to.equal(value5);

            const all = list.list();

            expect(all[0]).to.equal(value1);
            expect(all[1]).to.equal(value2);
            expect(all[2]).to.equal(value4);
            expect(all[3]).to.equal(value5);
        });

    });

});
