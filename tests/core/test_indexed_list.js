QUnit.module('pc.IndexedList');

test('new pc.IndexedList is empty', function () {
    var list = new pc.IndexedList();

    strictEqual(list.list().length, 0);
});

// push
// has
// get
// remove
// list
// clear

test('push, has, get behave as expected', function () {
    var list = new pc.IndexedList();

    var key = 'key';
    var notkey = 'notkey';
    var value = 'value';

    list.push(key, value);

    strictEqual(list.has(key), true);
    strictEqual(list.has(notkey), false);
    strictEqual(list.get(key), value);
});

test('get() returns null if no key', function () {
    var list = new pc.IndexedList();

    var nokey = 'nokey';

    strictEqual(list.get(nokey), null);

});

test('remove() removes the key', function () {
    var list = new pc.IndexedList();

    var key = 'key';
    var notkey = 'notkey';
    var value = 'value';

    list.push(key, value);

    list.remove(key);

    strictEqual(list.has(key), false);
});


test('remove() does not affect surrounding keys', function () {
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

    strictEqual(list.has(key1), true);
    strictEqual(list.has(key2), true);
    strictEqual(list.has(key3), false);
    strictEqual(list.has(key4), true);
    strictEqual(list.has(key5), true);

    strictEqual(list.get(key1), value1);
    strictEqual(list.get(key2), value2);
    strictEqual(list.get(key3), null);
    strictEqual(list.get(key4), value4);
    strictEqual(list.get(key5), value5);

    var all = list.list();

    strictEqual(all[0], value1);
    strictEqual(all[1], value2);
    strictEqual(all[2], value4);
    strictEqual(all[3], value5);
});

test('list() returns list in order', function () {
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

    strictEqual(all[0], value1);
    strictEqual(all[1], value2);
    strictEqual(all[2], value3);
    strictEqual(all[3], value4);
    strictEqual(all[4], value5);
});

test('clear() removes all values', function () {
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

    strictEqual(list.has(key1), false);
    strictEqual(list.has(key2), false);
    strictEqual(list.has(key3), false);
    strictEqual(list.has(key4), false);
    strictEqual(list.has(key5), false);

    strictEqual(list.get(key1), null);
    strictEqual(list.get(key2), null);
    strictEqual(list.get(key3), null);
    strictEqual(list.get(key4), null);
    strictEqual(list.get(key5), null);

    var all = list.list()

    strictEqual(all.length, 0);
})
