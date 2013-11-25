pc.script.create("a", function(context) {
    var A = function Script(entity) {
        this.entity = entity;
    };
    
    A.prototype = {
        initialize: function () {
            console.log("initialize a");
            window.script.order.push("a");
        },
        
        update: function (dt) {
            console.log("update a");
            window.script.a = true;
            window.script.order.push("a");
            //equal(window.script.b, false);
        }
    };

    return A;
    
});