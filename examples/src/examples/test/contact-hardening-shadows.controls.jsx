import {
    BindingTwoWay,
    LabelGroup,
    Panel,
    SliderInput,
    SelectInput,
    BooleanInput
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
            <Panel headerText='Area light'>
                <LabelGroup text='Enabled'>
                    <BooleanInput
                        id='area-light'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.area.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='Intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.area.intensity' }}
                        min={0.0}
                        max={32.0}
                    />
                </LabelGroup>
                <LabelGroup text='Softness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.area.size' }}
                        min={0.01}
                        max={32.0}
                    />
                </LabelGroup>
                <LabelGroup text='Shadows'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.area.shadowType' }}
                        options={[
                            { v: pc.SHADOW_PCSS_32F, t: 'PCSS_32F' },
                            { v: pc.SHADOW_PCF5_32F, t: 'PCF_32F' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Point light'>
                <LabelGroup text='Enabled'>
                    <BooleanInput
                        id='point-light'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.point.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='Intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.point.intensity' }}
                        min={0.0}
                        max={32.0}
                    />
                </LabelGroup>
                <LabelGroup text='Softness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.point.size' }}
                        min={0.01}
                        max={32.0}
                    />
                </LabelGroup>
                <LabelGroup text='Shadows'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.point.shadowType' }}
                        options={[
                            { v: pc.SHADOW_PCSS_32F, t: 'PCSS_32F' },
                            { v: pc.SHADOW_PCF5_32F, t: 'PCF_32F' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Directional light'>
                <LabelGroup text='Enabled'>
                    <BooleanInput
                        id='directional-light'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.directional.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='Intensity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.directional.intensity' }}
                        min={0.0}
                        max={32.0}
                    />
                </LabelGroup>
                <LabelGroup text='Softness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.directional.size' }}
                        min={0.01}
                        max={32.0}
                    />
                </LabelGroup>
                <LabelGroup text='Shadows'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.directional.shadowType' }}
                        options={[
                            { v: pc.SHADOW_PCSS_32F, t: 'PCSS_32F' },
                            { v: pc.SHADOW_PCF5_32F, t: 'PCF_32F' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Animate'>
                <LabelGroup text='Cycle Active Light'>
                    <BooleanInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.cycle' }}
                    />
                </LabelGroup>
                <LabelGroup text='Animate Lights'>
                    <BooleanInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'script.animate' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
