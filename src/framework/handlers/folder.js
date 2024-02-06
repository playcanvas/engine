import { ResourceHandler } from "./handler.js";

/**
 * @augments ResourceHandler
 */
class FolderHandler extends ResourceHandler {
    /**
     * Type of the resource the handler handles.
     *
     * @type {string}
     */
    handlerType = "folder";

    load(url, callback) {
        callback(null, null);
    }

    open(url, data) {
        return data;
    }
}

export { FolderHandler };
