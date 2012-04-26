module('pc.audio');

test('pc.audio.isSupported MP3', function () {
    var url = '/test/file.mp3';
    var a = new Audio();

    equal(pc.audio.isSupported(url), true);
    equal(pc.audio.isSupported(url, a), true);
});

test('pc.audio.isSupported ogg', function () {
    var url = '/test/file.ogg';
    var a = new Audio();

    equal(pc.audio.isSupported(url), true);
    equal(pc.audio.isSupported(url, a), true);
});

test('pc.audio.isSupported wav', function () {
    var url = '/test/file.wav';
    var a = new Audio();

    equal(pc.audio.isSupported(url), true);
    equal(pc.audio.isSupported(url, a), true);
});

test('pc.audio.isSupported other', function () {
    var url = '/test/file.other';
    var a = new Audio();

    equal(pc.audio.isSupported(url), false);
    equal(pc.audio.isSupported(url, a), false);
});