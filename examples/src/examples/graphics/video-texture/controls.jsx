import { BindingTwoWay, BooleanInput, LabelGroup, Panel } from '@playcanvas/pcui/react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    /**
     * @param {string} text - The label of the toggle.
     * @param {string} path - The path of the setting.
     * @returns {ReactElement} The toggle.
     */
    const toggle = (text, path) => (
        <LabelGroup text={text}>
            <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer, path }} />
        </LabelGroup>
    );

    return (
        <Panel headerText='Video'>
            {toggle('Playing', 'settings.playing')}
            {toggle('Sound', 'settings.sound')}
            {toggle('Tile Wave', 'settings.wave')}
            {toggle('Wall Light', 'settings.wallLight')}
        </Panel>
    );
}
