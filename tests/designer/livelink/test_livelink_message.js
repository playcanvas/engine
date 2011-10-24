module('pc.designer.LiveLinkMessage');

test("new", function () {
    var msg = new pc.designer.LiveLinkMessage();
    
    ok(msg);
});

test("register", function () {
    pc.designer.LiveLinkMessage.register("VALUE")
    
    equal(pc.designer.LiveLinkMessageType.VALUE, "VALUE");
})

test("serialize", function () {
    var msg = new pc.designer.LiveLinkMessage();
    msg.id = null;
    msg.type = "MESSAGE_TYPE";
    msg.content = {
        "key": "value",
        "number": 1
    };
    
    var str = pc.designer.LiveLinkMessage.serialize(msg);
    equal(str, '{"type":"MESSAGE_TYPE","content":{"key":"value","number":1},"id":null,"senderid":null}');
});

test("deserialize", function () {
    var msg = new pc.designer.LiveLinkMessage();
    msg.id = null;
    msg.type = "MESSAGE_TYPE";
    msg.content = {
       "key": "value",
       "number": 1
    };
    var str = pc.designer.LiveLinkMessage.serialize(msg);
    
    var o = pc.designer.LiveLinkMessage.deserialize(str);
    
    ok(o);
    equal(o.content.key, "value");
    equal(o.content.number, 1);
});
