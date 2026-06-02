import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput,
    SliderInput
} from '@playcanvas/pcui/react';

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
            <Panel headerText='Shadow Cascade Settings'>
                <LabelGroup text='Filtering'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.light.shadowType' }}
                        type='number'
                        options={[
                            { v: pc.SHADOW_PCF1_32F, t: 'PCF1_32F' },
                            { v: pc.SHADOW_PCF3_32F, t: 'PCF3_32F' },
                            { v: pc.SHADOW_PCF5_32F, t: 'PCF5_32F' },
                            { v: pc.SHADOW_PCF1_16F, t: 'PCF1_16F' },
                            { v: pc.SHADOW_PCF3_16F, t: 'PCF3_16F' },
                            { v: pc.SHADOW_PCF5_16F, t: 'PCF5_16F' },
                            { v: pc.SHADOW_VSM_16F, t: 'VSM_16F' },
                            { v: pc.SHADOW_VSM_32F, t: 'VSM_32F' },
                            { v: pc.SHADOW_PCSS_32F, t: 'PCSS_32F' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Count'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.light.numCascades' }}
                        min={1}
                        max={4}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Every Frame'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.light.everyFrame' }}
                        value={observer.get('settings.light.everyFrame')}
                    />
                </LabelGroup>
                <LabelGroup text='Resolution'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.light.shadowResolution' }}
                        min={128}
                        max={2048}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Distribution'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.light.cascadeDistribution' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Blend'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.light.cascadeBlend' }}
                        min={0}
                        max={0.2}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='VSM Blur'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.light.vsmBlurSize' }}
                        min={1}
                        max={25}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='PCSS Penumbra'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.light.penumbraSize' }}
                        min={0}
                        max={0.2}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='PCSS Falloff'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.light.penumbraFalloff' }}
                        min={1}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
