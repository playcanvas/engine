/**
 * @param {import('../../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ jsx, ReactPCUI }) {
    const { Label } = ReactPCUI;
    return jsx(Label, { value: 'N/A' });
}
