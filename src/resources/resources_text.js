pc.extend(pc.resources, function () {
    var TextResourceHandler = function () {
    };
    TextResourceHandler = pc.inherits(TextResourceHandler, pc.resources.ResourceHandler);

    TextResourceHandler.prototype.load = function (request, options) {
        var self = this;

        var promise = new RSVP.Promise(function (resolve, reject) {
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

    TextResourceHandler.prototype.open = function (data, request, options) {
        return data;
    };

    var TextRequest = function TextRequest(identifier) {
    };
    TextRequest = pc.inherits(TextRequest, pc.resources.ResourceRequest);
    TextRequest.prototype.type = "text";
    TextRequest.prototype.Type = Object;

    return {
        TextResourceHandler: TextResourceHandler,
        TextRequest: TextRequest
    };
}());
