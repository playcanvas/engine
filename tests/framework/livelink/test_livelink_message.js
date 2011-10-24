module('pc.fw.LiveLinkMessage');

test("new", function () {
    var msg = new pc.fw.LiveLinkMessage();
    
    ok(msg);
});

test("register", function () {
    pc.fw.LiveLinkMessage.register("VALUE")
    
    equal(pc.fw.LiveLinkMessageType.VALUE, "VALUE");
})

test("serialize", function () {
    var msg = new pc.fw.LiveLinkMessage();
    msg.id = null;
    msg.type = "MESSAGE_TYPE";
    msg.content = {
        "key": "value",
        "number": 1
    };
    
    var str = pc.fw.LiveLinkMessage.serialize(msg);
    equal(str, '{"type":"MESSAGE_TYPE","content":{"key":"value","number":1},"id":null,"senderid":null}');
});

test("deserialize", function () {
    var msg = new pc.fw.LiveLinkMessage();
    msg.id = null;
    msg.type = "MESSAGE_TYPE";
    msg.content = {
       "key": "value",
       "number": 1
    };
    var str = pc.fw.LiveLinkMessage.serialize(msg);
    
    var o = pc.fw.LiveLinkMessage.deserialize(str);
    
    ok(o);
    equal(o.content.key, "value");
    equal(o.content.number, 1);
});
