import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SliderInput
} from '@playcanvas/pcui/react';

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
            <Panel headerText='Soft Shadow Settings'>
                <LabelGroup text='Soft Shadows'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.light.soft' }}
                    />
                </LabelGroup>
                <LabelGroup text='Resolution'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.light.shadowResolution' }}
                        min={512}
                        max={4096}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Penumbra'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.light.penumbraSize' }}
                        min={0}
                        max={0.2}
                        precision={3}
                    />
                </LabelGroup>
                <LabelGroup text='Falloff'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.light.penumbraFalloff' }}
                        min={1}
                        max={10}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Samples'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.light.shadowSamples' }}
                        min={1}
                        max={128}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Blocker Samples'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.light.shadowBlockerSamples' }}
                        min={0}
                        max={128}
                        precision={0}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
