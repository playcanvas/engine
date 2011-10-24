module('pc.audio.AudioBase');


test("new", function () {
    var a = new pc.audio.AudioBase();
    
    ok(a);
});

test("setSource, exists", function () {
   var a = new pc.audio.AudioBase();
   
   var uri = "/sdk/tests/audio/ACDC_-_Back_In_Black-sample.ogg";
   
   a.setSource(uri);
   
   equal(uri, a.getSource().slice(-uri.length));
});

test("setSource, doesn't exist", function () {
   var a = new pc.audio.AudioBase();
   var uri = "/missing.ogg";
   
   a.setSource(uri);
   
   equal(uri, a.getSource().slice(-uri.length));    
});

test("setVolume", function () {
   var a = new pc.audio.AudioBase();
   
   a.setVolume(0.8);
   
   equal(parseFloat(a.getVolume().toFixed(1)), 0.8); 
});

test("play, no source", function () {
   var a = new pc.audio.AudioBase();
   
   raises( a.play, "Audio has no source" );
});

test("play, source", function () {
   var a = new pc.audio.AudioBase();
   a.setSource("http://sample");
   a.play();
});

/*
test("event: loadeddata", function () {
    expect(1);
    stop();

    var a = new pc.audio.AudioBase();
    a.bind("loadeddata", function () {
        ok(true);
        start();
    });
    
    a.setSource("/sdk/tests/audio/ACDC_-_Back_In_Black-sample.ogg");
    
    setTimeout(function () {
        start();        
    }, 5000);
});
*/