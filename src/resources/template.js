import { http } from '../net/http.js';

import { Template } from '../templates/template.js';
import { TemplateUtils } from '../templates/template-utils.js';

class TemplateHandler {
    constructor(app) {
        this._app = app;
    }

    load(url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        var assets = this._app.assets;

        http.get(url.load, {}, function (err, response) {
            if (err) {
                callback("Error requesting template: " + url.original);
            } else {
                TemplateUtils.waitForTemplateAssets(
                    response.entities,
                    assets,
                    callback,
                    response);
            }
        });
    }

    open(url, data) {
        return new Template(this._app, data);
    }
}

export { TemplateHandler };
