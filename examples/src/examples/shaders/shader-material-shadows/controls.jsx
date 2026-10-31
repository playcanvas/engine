import { BindingTwoWay, LabelGroup, Panel, SelectInput } from '@playcanvas/pcui/react';

import {
    SHADOW_PCF1_16F,
    SHADOW_PCF1_32F,
    SHADOW_PCF3_16F,
    SHADOW_PCF3_32F,
    SHADOW_PCF5_16F,
    SHADOW_PCF5_32F,
    SHADOW_PCSS_32F,
    SHADOW_VSM_16F,
    SHADOW_VSM_32F
} from 'playcanvas';

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
            <Panel headerText='Shadow Settings'>
                <LabelGroup text='Shadow Type'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.shadowType' }}
                        type='number'
                        options={[
                            { v: SHADOW_PCF1_32F, t: 'PCF1_32F' },
                            { v: SHADOW_PCF3_32F, t: 'PCF3_32F' },
                            { v: SHADOW_PCF5_32F, t: 'PCF5_32F' },
                            { v: SHADOW_PCF1_16F, t: 'PCF1_16F' },
                            { v: SHADOW_PCF3_16F, t: 'PCF3_16F' },
                            { v: SHADOW_PCF5_16F, t: 'PCF5_16F' },
                            { v: SHADOW_VSM_16F, t: 'VSM_16F' },
                            { v: SHADOW_VSM_32F, t: 'VSM_32F' },
                            { v: SHADOW_PCSS_32F, t: 'PCSS_32F' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
