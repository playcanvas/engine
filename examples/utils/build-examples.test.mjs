import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getExampleTargets, loadExampleMetaData } from './build-examples.mjs';

test('copies example helper modules as source files', async () => {
    await loadExampleMetaData();

    const targets = getExampleTargets();

    assert.equal(Object.hasOwn(targets, 'local'), false);
    assert.equal(targets.sources.some(({ dest }) => dest === 'dist/iframe/misc_editor.gizmo-handler.mjs'), true);
});
