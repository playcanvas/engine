describe('pc.IndexedList', function () {
    it('new pc.IndexedList is empty', function () {
        var list = new pc.IndexedList();

        expect(list.list().length).to.equal(0);
    });

    // push
    // has
    // get
    // remove
    // list
    // clear

    it('push, has, get behave as expected', function () {
        var list = new pc.IndexedList();

        var key = 'key';
        var notkey = 'notkey';
        var value = 'value';

        list.push(key, value);

        expect(list.has(key)).to.equal(true);
        expect(list.has(notkey)).to.equal(false);
        expect(list.get(key)).to.equal(value);
    });

    it('get() returns null if no key', function () {
        var list = new pc.IndexedList();

        var nokey = 'nokey';

        expect(list.get(nokey)).to.equal(null);

    });

    it('remove() removes the key', function () {
        var list = new pc.IndexedList();

        var key = 'key';
        var notkey = 'notkey';
        var value = 'value';

        list.push(key, value);

        list.remove(key);

        expect(list.has(key)).to.equal(false);
    });


    it('remove() does not affect surrounding keys', function () {
        var list = new pc.IndexedList();

        var key1 = 'key1';
        var key2 = 'key2';
        var key3 = 'key3';
        var key4 = 'key4';
        var key5 = 'key5';

        var value1 = 'value1';
        var value2 = 'value2';
        var value3 = 'value3';
        var value4 = 'value4';
        var value5 = 'value5';

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

        var all = list.list();

        expect(all[0]).to.equal(value1);
        expect(all[1]).to.equal(value2);
        expect(all[2]).to.equal(value4);
        expect(all[3]).to.equal(value5);
    });

    it('list() returns list in order', function () {
        var list = new pc.IndexedList();

        var key1 = 'key1';
        var key2 = 'key2';
        var key3 = 'key3';
        var key4 = 'key4';
        var key5 = 'key5';

        var value1 = 'value1';
        var value2 = 'value2';
        var value3 = 'value3';
        var value4 = 'value4';
        var value5 = 'value5';

        list.push(key1, value1);
        list.push(key2, value2);
        list.push(key3, value3);
        list.push(key4, value4);
        list.push(key5, value5);

        var all = list.list()

        expect(all[0]).to.equal(value1);
        expect(all[1]).to.equal(value2);
        expect(all[2]).to.equal(value3);
        expect(all[3]).to.equal(value4);
        expect(all[4]).to.equal(value5);
    });

    it('clear() removes all values', function () {
        var list = new pc.IndexedList();

        var key1 = 'key1';
        var key2 = 'key2';
        var key3 = 'key3';
        var key4 = 'key4';
        var key5 = 'key5';

        var value1 = 'value1';
        var value2 = 'value2';
        var value3 = 'value3';
        var value4 = 'value4';
        var value5 = 'value5';

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

        var all = list.list()

        expect(all.length).to.equal(0);
    });
});
