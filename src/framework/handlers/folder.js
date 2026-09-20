import { ResourceHandler } from './handler.js';

/**
 * Resource handler for the `folder` asset type. Folders only group other assets, so this handler
 * produces no resource.
 *
 * @ignore
 */
class FolderHandler extends ResourceHandler {
    constructor(app) {
        super(app, 'folder');
    }

    load(url, callback) {
        callback(null, null);
    }
}

export { FolderHandler };
