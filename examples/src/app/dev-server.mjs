import { iframe } from './iframe.mjs';

const UPDATE_EVENT = 'playcanvas:examples-update';

let dirty = false;

window.addEventListener('editorDirty', (event) => {
    const { detail } = /** @type {CustomEvent} */ (event);
    dirty = detail?.dirty === true;
});

const isDirty = () => {
    return dirty;
};

/**
 * @param {string} kind - The reload kind.
 * @returns {boolean} True if reload should be skipped.
 */
const skipDirty = (kind) => {
    if (!isDirty()) {
        return false;
    }
    console.info(`Skipping ${kind} reload because the editor has unsaved changes.`);
    return true;
};

if (import.meta.hot) {
    import.meta.hot.on(UPDATE_EVENT, (data) => {
        if (data.kind === 'example') {
            if (data.example !== iframe.path || skipDirty('example')) {
                return;
            }
            iframe.fire('reloadFiles', {
                stamp: data.stamp,
                config: data.config,
                files: data.files
            });
            return;
        }

        if (data.kind === 'engine' || data.kind === 'iframe') {
            if (skipDirty(data.kind)) {
                return;
            }
            iframe.reload(data.stamp);
        }
    });
}
