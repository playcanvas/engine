module("pc.resources.TextResourceHandler", {});


test("load", function () {
    var handler = new pc.resources.TextResourceHandler();

    var request = new pc.resources.TextRequest("file.txt");

    handler.load(request).then(function (resources) {
        console.log(resources);
        equal(resources, 'this is some text');
        start();

    });

    stop();
})
