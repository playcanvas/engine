import { BindingTwoWay, LabelGroup, Panel, SliderInput } from '@playcanvas/pcui/react';

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
        <Panel headerText='Texture'>
            <LabelGroup text='Speed'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.speed' }}
                    min={0}
                    max={3}
                    precision={2}
                />
            </LabelGroup>
            <LabelGroup text='Hue'>
                <SliderInput
                    binding={new BindingTwoWay()}
                    link={{ observer, path: 'settings.hue' }}
                    min={0}
                    max={1}
                    precision={2}
                />
            </LabelGroup>
        </Panel>
    );
}
