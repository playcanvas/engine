import {
    BindingTwoWay,
    LabelGroup,
    Panel,
    SliderInput,
    BooleanInput
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
            <Panel headerText='Settings'>
                <LabelGroup text='Lifetime'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.lifetime' }}
                        min={0}
                        max={5}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='Num Particles'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.numParticles' }}
                        min={1}
                        max={1000}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='Enabled'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.enabled' }}
                    />
                </LabelGroup>
                <LabelGroup text='Lighting'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.lighting' }}
                    />
                </LabelGroup>
                <LabelGroup text='Align To Motion'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.alignToMotion' }}
                    />
                </LabelGroup>
                <LabelGroup text='Textured'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.textured' }}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
