module('pc.fw.LiveLink');

test("new", function () {
    var ll = new pc.fw.LiveLink();
    ok(ll);
    ll.detach();
});

test("addDestinationWindow", function () {
    var ll = new pc.fw.LiveLink();
    
    ll.addDestinationWindow(window);
    
    equal(ll._destinations.length, 1);
    
    ll.detach();
});

test("removeDestinationWindow", function () {
   var ll = new pc.fw.LiveLink();
   
   ll.addDestinationWindow(window);
   
   ll.removeDestinationWindow(window);
   
   equal(ll._destinations.length, 0); 
   
   
    ll.detach();
});

test("send", function () {
    
    jack(function () {
        var window = jack.create("window", ["postMessage"]);
        window.location = {protocol: "http:", host: "origin"};
        
        jack.expect("window.postMessage")
            .exactly("1 time")
            .whereArgument(1).is("http://origin")
            //('{"type":"NO_TYPE","content":{}}', "http://origin");
            
        var ll = new pc.fw.LiveLink();
        ll.addDestinationWindow(window);
        
        var msg = new pc.fw.LiveLinkMessage();
        msg.content = {};
        
        ll.send(msg);                
        ll.detach();
    });
    
});

test("listen", function () {
    expect(1);
    /*
    w = jack.create("window", ["postMessage", "addEventListener"])
    jack.expect("window.addEventListener")
        .exactly("1 time")
        .mock(function (type, callback) {
            callback({"source": w, "data": '{"type": "type","content": "content"}'});
        });
    jack.expect("window.postMessage")
        .exactly("1 time");
    */
    var ll = new pc.fw.LiveLink();
    var fn = function(msg) {
        ok(msg.type);
        ok(msg.content);
    };
    
    ll.listen(fn);
    
    equal(ll._listener, fn);
    
    ll.detach();
});

asyncTest("send, 2 links, listener", 1, function () {
    var l1 = new pc.fw.LiveLink();
    var l2 = new pc.fw.LiveLink();
    l2.addDestinationWindow(window);
    
    l1.listen(function (msg) {
        equal(msg.content, "test");
    });
    
    var msg = new pc.fw.LiveLinkMessage();
    msg.content = "test";
    l2.send(msg);
    
    setTimeout(function () {
        start();
        l1.detach();
        l2.detach(); 
    }, 250);
    
});

asyncTest("send, 2 links, with callback", 2, function () {
    var l1 = new pc.fw.LiveLink();
    var l2 = new pc.fw.LiveLink();
    l2.addDestinationWindow(window);
    
    l1.listen(function (msg) {
        equal(msg.content, "test");
    });
    
    var msg = new pc.fw.LiveLinkMessage();
    msg.content = "test";
    l2.send(msg, function () {
        ok(true);        
    });
    
    setTimeout(function () {
        start();
        l1.detach();
        l2.detach();
    }, 250);
});

asyncTest("send, 2 windows, with callback", 5, function () {
    var l1 = new pc.fw.LiveLink();
    var l2 = new pc.fw.LiveLink();
    l2.addDestinationWindow(window);
    l2.addDestinationWindow(window);
    
    var count = 0;
    l1.listen(function (msg) {
        equal(msg.content, "test");
        count++;
    });
    
    var msg = new pc.fw.LiveLinkMessage();
    msg.id = "test"
    msg.content = "test";
    var count = 0;
    l2.send(msg, function () {
        ok(true);
        // This is failing at the moment because sending messages to the current window is synchronous which means the code hasn't group the message sends
        // into one callback, so we get one callback per window.
        equal(false, sent);
        sent = true;
    });
    
    setTimeout(function () {
        start();
        equal(count, 2);
        l1.detach();
    }, 250);
});