pc.extend(pc.resources, function () {
    var JsonResourceHandler = function () {
    };
    JsonResourceHandler = pc.inherits(JsonResourceHandler, pc.resources.ResourceHandler);

    JsonResourceHandler.prototype.load = function (request, options) {
        var self = this;

        var promise = new pc.promise.Promise(function (resolve, reject) {
            pc.net.http.get(request.canonical, function(response) {
                resolve(response);
            }, {
                error: function () {
                    reject();
                }
            });
        });

        return promise;
    };

    JsonResourceHandler.prototype.open = function (data, request, options) {
        return data;
    };

    var JsonRequest = function JsonRequest(identifier) {
    };
    JsonRequest = pc.inherits(JsonRequest, pc.resources.ResourceRequest);
    JsonRequest.prototype.type = "json";
    JsonRequest.prototype.Type = Object;

    return {
        JsonResourceHandler: JsonResourceHandler,
        JsonRequest: JsonRequest
    };
}());
