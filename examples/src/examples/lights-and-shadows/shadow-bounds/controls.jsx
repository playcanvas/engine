import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';

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
            <Panel headerText='Shadow'>
                <LabelGroup text='Mode'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.shadow.mode' }}
                        type='string'
                        options={[
                            { v: 'bounds', t: 'Shadow Bounds' },
                            { v: 'frustum', t: 'Camera Frustum' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Filter'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.shadow.type' }}
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
                <LabelGroup text='Resolution'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.shadow.resolution' }}
                        type='number'
                        options={[
                            { v: 256, t: '256' },
                            { v: 512, t: '512' },
                            { v: 1024, t: '1024' },
                            { v: 2048, t: '2048' },
                            { v: 4096, t: '4096' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Show Bounds'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.shadow.showBounds' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Scene'>
                <LabelGroup text='Sun Elevation'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.sun.elevation' }}
                        min={10}
                        max={90}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Rotate Sun'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.sun.rotate' }}
                    />
                </LabelGroup>
                <LabelGroup text='Bounce'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.bounce' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
