pc.script.create("b", function(context) {
    var B = function Script(entity) {
        this.entity = entity;
    };
    
    B.prototype = {
        initialize: function () {
            console.log("initialize b");
            window.script.order.push("b");
        },
        
        update: function (dt) {
            console.log("update b");
            window.script.b = true;
            window.script.order.push("b");
            //equal(window.script.a, true);
        }
    };

    return B;
    
});