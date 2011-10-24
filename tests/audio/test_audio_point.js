module('pc.audio.PointAudio');

test("new", function () {
    var a = new pc.audio.PointAudio();
    
    ok(a);
});

test("setPosition", function () {
   var a = new pc.audio.PointAudio();
   
   a.setPosition([1,2,3]);
   var p = a.getPosition();
   
   equal(1, p[0]);
   equal(2, p[1]);
   equal(3, p[2]);
});

test("setPosition, updates VolumeAtPosition", function () {
    var a = new pc.audio.PointAudio();
    
    a.setPosition([0,0.5,0]);
    
    equal(0.5, a.getVolumeAtPosition([0,0,0]));    
});

test("setListenerPosition", function () {
    var a = new pc.audio.PointAudio();
    
    a.setListenerPosition([0.5,0,0]);
    
    equal(0.5, a._audio.volume);
    
});

test("setVolume", function () {
    var a = new pc.audio.PointAudio();
    
    a.setVolume(0.2);
    
    equal(0.2, a.getVolume());
    equal(0.2, a.getVolumeAtPosition([0,0,0]));    
});
