import { BindingTwoWay, LabelGroup, Panel, SelectInput } from '@playcanvas/pcui/react';

import * as pc from 'playcanvas';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    return (
        <>
            <Panel headerText='Debug Shader Rendering'>
                <LabelGroup text='Mode'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.shaderPassName' }}
                        type='string'
                        options={[
                            { v: pc.SHADERPASS_FORWARD, t: 'None' },
                            { v: pc.SHADERPASS_ALBEDO, t: 'Albedo' },
                            { v: pc.SHADERPASS_OPACITY, t: 'Opacity' },
                            { v: pc.SHADERPASS_WORLDNORMAL, t: 'World Normal' },
                            { v: pc.SHADERPASS_SPECULARITY, t: 'Specularity' },
                            { v: pc.SHADERPASS_GLOSS, t: 'Gloss' },
                            { v: pc.SHADERPASS_METALNESS, t: 'Metalness' },
                            { v: pc.SHADERPASS_AO, t: 'AO' },
                            { v: pc.SHADERPASS_EMISSION, t: 'Emission' },
                            { v: pc.SHADERPASS_LIGHTING, t: 'Lighting' },
                            { v: pc.SHADERPASS_UV0, t: 'UV0' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
