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
    const link = (path) => ({ observer, path: `data.${path}` });
    const binding = () => new BindingTwoWay();

    return (
        <Panel headerText='Rendering'>
            <LabelGroup text='Reload'>
                <SliderInput
                    binding={binding()}
                    link={link('reloadTime')}
                    min={0.1}
                    max={3}
                    precision={2}
                />
            </LabelGroup>
            <LabelGroup text='Shadows'>
                <BooleanInput type='toggle' binding={binding()} link={link('shadows')} />
            </LabelGroup>
            <LabelGroup text='Volumetric Fog'>
                <BooleanInput type='toggle' binding={binding()} link={link('volumetricFog')} />
            </LabelGroup>
            <LabelGroup text='Fog Samples'>
                <SliderInput
                    binding={binding()}
                    link={link('fogSteps')}
                    min={4}
                    max={128}
                    precision={0}
                />
            </LabelGroup>
            <LabelGroup text='Boulder Lights'>
                <BooleanInput type='toggle' binding={binding()} link={link('boulderLights')} />
            </LabelGroup>
        </Panel>
    );
}
