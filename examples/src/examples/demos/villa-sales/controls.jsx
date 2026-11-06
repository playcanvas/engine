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
            <Panel headerText='Wind' collapsible collapsed>
                <LabelGroup text='Strength'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.wind' }}
                        min={0}
                        max={0.5}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Overlay' collapsible collapsed>
                <LabelGroup text='Show'>
                    <BooleanInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.show' }}
                    />
                </LabelGroup>
                <LabelGroup text='Surface offset'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.offset' }}
                        min={0}
                        max={8}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Fill opacity'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.fill' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
                <LabelGroup text='Outline'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.outline' }}
                        min={0}
                        max={1}
                        precision={2}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
