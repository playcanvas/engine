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
 * @param {{ observer: Observer }} props - Control panel properties.
 * @returns {ReactElement} The controls.
 */
export function Controls({ observer }) {
    return (
        <Panel headerText='Element colors'>
            {[
                ['animate', 'Animate'],
                ['colors', 'Cycle colors'],
                ['opacity', 'Pulse opacity'],
                ['world', 'World space'],
                ['masks', 'Masks'],
                ['custom', 'Custom material']
            ].map(([name, title]) => (
                <LabelGroup key={name} text={title}>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: `settings.${name}` }}
                    />
                </LabelGroup>
            ))}
            <LabelGroup text='Hue offset'>
                <SliderInput
                    min={0}
                    max={1}
                    precision={2}
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.hue' }}
                />
            </LabelGroup>
            <LabelGroup text='Opacity'>
                <SliderInput
                    min={0}
                    max={1}
                    precision={2}
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.alpha' }}
                />
            </LabelGroup>
        </Panel>
    );
}
