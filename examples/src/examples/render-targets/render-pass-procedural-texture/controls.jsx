import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput,
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
            <Panel headerText='Animation'>
                <LabelGroup text='Animate'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.animate' }}
                    />
                </LabelGroup>
                <LabelGroup text='Speed'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.speed' }}
                        min={0.1}
                        max={4}
                        precision={1}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Pattern'>
                <LabelGroup text='Palette'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.palette' }}
                        type='string'
                        options={[
                            { v: 'agate', t: 'Agate' },
                            { v: 'malachite', t: 'Malachite' },
                            { v: 'marble', t: 'Marble' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Scale'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.scale' }}
                        min={1}
                        max={10}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Bumpiness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.bumpiness' }}
                        min={0}
                        max={3}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Textures'>
                <LabelGroup text='Resolution'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.resolution' }}
                        type='number'
                        options={[
                            { v: 128, t: '128 x 128' },
                            { v: 256, t: '256 x 256' },
                            { v: 512, t: '512 x 512' },
                            { v: 1024, t: '1024 x 1024' },
                            { v: 2048, t: '2048 x 2048' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Show'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.preview' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
