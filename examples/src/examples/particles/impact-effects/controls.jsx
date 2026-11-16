import {
    BindingTwoWay,
    BooleanInput,
    Label,
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
            <Panel headerText='Effects'>
                <LabelGroup text='Effect'>
                    <SelectInput
                        options={[
                            { v: 'mixed', t: 'Mixed' },
                            { v: 'bullet', t: 'Bullets' },
                            { v: 'explosion', t: 'Explosions' },
                            { v: 'magic', t: 'Magic' }
                        ]}
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.effect' }}
                    />
                </LabelGroup>
                <LabelGroup text='Auto Fire'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.autoFire' }}
                    />
                </LabelGroup>
                <LabelGroup text='Shots / Second'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.rate' }}
                        min={0.5}
                        max={30}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Soft Particles'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.softParticles' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Stats'>
                <LabelGroup text='Playing'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'stats.active' }}
                        value='0'
                    />
                </LabelGroup>
                <LabelGroup text='Instances'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'stats.instances' }}
                        value='0'
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
