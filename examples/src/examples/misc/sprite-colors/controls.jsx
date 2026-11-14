import {
    BindingTwoWay,
    BooleanInput,
    Label,
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
        <Panel headerText='Chromatic currents'>
            <LabelGroup text='Jellyfish'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.count' }}
                    min={25}
                    max={250}
                    precision={0}
                />
            </LabelGroup>
            <LabelGroup text='Speed'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.speed' }}
                    min={0}
                    max={2}
                    precision={2}
                />
            </LabelGroup>
            {['motion', 'colors', 'opacity', 'animation'].map((name) => (
                <LabelGroup key={name} text={name.charAt(0).toUpperCase() + name.slice(1)}>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: `settings.${name}` }}
                    />
                </LabelGroup>
            ))}
            <Label text='One atlas. Independent sprite colors.' />
        </Panel>
    );
}
