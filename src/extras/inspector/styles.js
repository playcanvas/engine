/**
 * Stylesheet for the entity inspector panel. Injected into the panel's shadow root, so nothing
 * here leaks into the page and nothing in the page leaks in.
 *
 * @type {string}
 */
const styles = /* css */ `
    :host {
        all: initial;
        display: block;
    }

    * {
        box-sizing: border-box;
    }

    .pci-panel {
        position: fixed;
        top: 0;
        bottom: 0;
        right: 0;
        width: 420px;
        z-index: 100000;
        display: flex;
        flex-direction: column;
        background: #1b1d21;
        color: #d8dbe0;
        font: 12px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        border-left: 1px solid #33363d;
        box-shadow: -6px 0 18px rgba(0, 0, 0, 0.35);
        user-select: none;
        -webkit-user-select: none;
    }

    .pci-panel.pci-dock-left {
        right: auto;
        left: 0;
        border-left: none;
        border-right: 1px solid #33363d;
        box-shadow: 6px 0 18px rgba(0, 0, 0, 0.35);
    }

    .pci-panel.pci-popout {
        left: 0;
        right: 0;
        width: auto !important;
        border: none;
        box-shadow: none;
    }

    .pci-edge {
        position: absolute;
        top: 0;
        bottom: 0;
        left: -3px;
        width: 6px;
        cursor: ew-resize;
    }

    .pci-dock-left .pci-edge {
        left: auto;
        right: -3px;
    }

    .pci-popout .pci-edge {
        display: none;
    }

    .pci-toolbar {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 8px;
        background: #24272d;
        border-bottom: 1px solid #33363d;
        flex: 0 0 auto;
    }

    .pci-toolbar .pci-title {
        font-weight: 600;
        color: #f0f2f5;
        margin-right: 4px;
        white-space: nowrap;
    }

    .pci-toolbar .pci-spacer {
        flex: 1 1 auto;
    }

    .pci-btn {
        font: inherit;
        color: #d8dbe0;
        background: #33363d;
        border: 1px solid #44484f;
        border-radius: 4px;
        padding: 2px 8px;
        cursor: pointer;
        white-space: nowrap;
    }

    .pci-btn:hover {
        background: #3d4149;
    }

    .pci-btn:disabled {
        opacity: 0.4;
        cursor: default;
    }

    .pci-btn.pci-active {
        background: #ff8a20;
        border-color: #ff8a20;
        color: #1b1d21;
    }

    .pci-body {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    .pci-hierarchy {
        flex: 0 0 45%;
        display: flex;
        flex-direction: column;
        min-height: 60px;
    }

    .pci-filter {
        flex: 0 0 auto;
        padding: 6px 8px;
        border-bottom: 1px solid #2c2f36;
    }

    .pci-filter input {
        width: 100%;
        font: inherit;
        color: #e8eaee;
        background: #14161a;
        border: 1px solid #33363d;
        border-radius: 4px;
        padding: 3px 6px;
        outline: none;
        user-select: text;
        -webkit-user-select: text;
    }

    .pci-filter input:focus {
        border-color: #ff8a20;
    }

    .pci-tabs {
        flex: 0 0 auto;
        display: flex;
        gap: 2px;
        padding: 4px 8px 0;
        background: #24272d;
        border-bottom: 1px solid #33363d;
    }

    .pci-tab {
        font: inherit;
        color: #a3a8b1;
        background: transparent;
        border: 1px solid transparent;
        border-bottom: none;
        border-radius: 4px 4px 0 0;
        padding: 3px 10px;
        margin-bottom: -1px;
        cursor: pointer;
    }

    .pci-tab:hover {
        color: #e8eaee;
    }

    .pci-tab.pci-active {
        color: #f0f2f5;
        background: #1b1d21;
        border-color: #33363d;
    }

    .pci-listpanel {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    .pci-subbar {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 4px 8px;
        border-bottom: 1px solid #2c2f36;
        color: #a3a8b1;
        font-size: 11px;
    }

    .pci-subbar.pci-wrap {
        flex-wrap: wrap;
        row-gap: 4px;
    }

    .pci-check {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        cursor: pointer;
        white-space: nowrap;
    }

    .pci-check input.pci-number {
        width: 54px;
        height: auto;
        font: inherit;
        color: #e8eaee;
        background: #14161a;
        border: 1px solid #33363d;
        border-radius: 3px;
        padding: 1px 4px;
        outline: none;
        user-select: text;
        -webkit-user-select: text;
    }

    .pci-number:focus {
        border-color: #ff8a20;
    }

    .pci-note {
        flex: 0 0 auto;
        padding: 6px 8px;
        border-bottom: 1px solid #2c2f36;
        color: #ffb4b4;
        font-size: 11px;
    }

    .pci-check input {
        width: 12px;
        height: 12px;
        margin: 0;
        accent-color: #ff8a20;
    }

    .pci-list {
        flex: 1 1 auto;
        overflow: auto;
        padding: 4px 0;
    }

    .pci-lrow {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 20px;
        padding-right: 8px;
        white-space: nowrap;
        cursor: pointer;
    }

    .pci-lrow:hover {
        background: #262a31;
    }

    .pci-lrow.pci-selected {
        background: #3a4a6b;
        color: #ffffff;
    }

    .pci-lrow.pci-dim .pci-cell-name,
    .pci-lrow.pci-dim .pci-cell-info {
        opacity: 0.45;
    }

    .pci-cell {
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .pci-cell-index {
        flex: 0 0 22px;
        text-align: right;
        color: #6b7079;
        font-family: ui-monospace, Menlo, Consolas, "Liberation Mono", monospace;
        font-size: 10.5px;
    }

    .pci-cell-name {
        flex-shrink: 0;
    }

    .pci-cell-info {
        color: #9aa0aa;
        font-family: ui-monospace, Menlo, Consolas, "Liberation Mono", monospace;
        font-size: 10.5px;
    }

    .pci-lrow.pci-selected .pci-cell-info {
        color: #d0d6e0;
    }

    .pci-cell-right {
        margin-left: auto;
        flex-shrink: 0;
    }

    .pci-cell-time {
        flex-shrink: 0;
        margin-left: auto;
        color: #b5cea8;
        font-family: ui-monospace, Menlo, Consolas, "Liberation Mono", monospace;
        font-size: 10.5px;
    }

    .pci-cell-tag {
        flex-shrink: 0;
        font-size: 9.5px;
        line-height: 13px;
        padding: 0 4px;
        border-radius: 3px;
        background: #5a2a2a;
        color: #ffb4b4;
    }

    .pci-cell-tag-info {
        background: #2f333b;
        color: #a3a8b1;
    }

    .pci-cell.pci-link {
        text-decoration: underline dotted;
    }

    .pci-cell.pci-link:hover {
        color: #9ad7ff;
    }

    .pci-tree {
        flex: 1 1 auto;
        overflow: auto;
        padding: 4px 0;
    }

    .pci-row {
        display: flex;
        align-items: center;
        gap: 4px;
        height: 20px;
        padding-right: 8px;
        white-space: nowrap;
        cursor: pointer;
    }

    .pci-row:hover {
        background: #262a31;
    }

    .pci-row.pci-selected {
        background: #3a4a6b;
        color: #ffffff;
    }

    .pci-row.pci-disabled .pci-name {
        opacity: 0.45;
    }

    .pci-row.pci-graphnode .pci-name {
        font-style: italic;
        color: #a3a8b1;
    }

    .pci-row.pci-match .pci-name {
        color: #ffd28a;
    }

    .pci-arrow {
        flex: 0 0 12px;
        width: 12px;
        text-align: center;
        color: #8b909a;
        font-size: 11px;
    }

    .pci-toggle {
        flex: 0 0 auto;
        width: 12px;
        height: 12px;
        margin: 0 3px 0 0;
        accent-color: #ff8a20;
        cursor: pointer;
    }

    .pci-name {
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .pci-badges {
        display: inline-flex;
        gap: 3px;
        margin-left: 4px;
    }

    .pci-badge {
        font-size: 9.5px;
        line-height: 13px;
        padding: 0 4px;
        border-radius: 3px;
        background: #2f333b;
        color: #a3a8b1;
    }

    .pci-selected .pci-badge {
        background: #4d5f86;
        color: #e8eaee;
    }

    .pci-count {
        margin-left: auto;
        color: #6b7079;
        font-size: 10.5px;
    }

    .pci-splitter {
        flex: 0 0 5px;
        background: #24272d;
        border-top: 1px solid #33363d;
        border-bottom: 1px solid #33363d;
        cursor: ns-resize;
    }

    .pci-properties {
        flex: 1 1 auto;
        overflow: auto;
        padding-bottom: 8px;
        font-family: ui-monospace, Menlo, Consolas, "Liberation Mono", monospace;
        font-size: 11px;
    }

    .pci-empty {
        padding: 12px 10px;
        color: #6b7079;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
    }

    .pci-section-title {
        position: sticky;
        top: 0;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        margin-top: 4px;
        background: #24272d;
        color: #f0f2f5;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        z-index: 1;
    }

    .pci-section-title::before {
        content: "▾";
        color: #8b909a;
        font-size: 10px;
    }

    .pci-collapsed .pci-section-title::before {
        content: "▸";
    }

    .pci-collapsed .pci-rows {
        display: none;
    }

    .pci-prop {
        display: flex;
        gap: 8px;
        padding: 1px 8px;
        line-height: 17px;
    }

    .pci-prop:hover {
        background: #20232a;
    }

    .pci-prop.pci-indent {
        padding-left: 22px;
    }

    .pci-label {
        flex: 0 0 38%;
        color: #9aa0aa;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .pci-indent .pci-label {
        flex-basis: calc(38% - 14px);
    }

    .pci-value {
        flex: 1 1 auto;
        min-width: 0;
        color: #e0e3e8;
        white-space: pre-wrap;
        word-break: break-word;
        user-select: text;
        -webkit-user-select: text;
    }

    .pci-v-num  { color: #b5cea8; }
    .pci-v-bool { color: #569cd6; }
    .pci-v-str  { color: #ce9178; }
    .pci-v-null { color: #6b7079; }
    .pci-v-obj  { color: #dcdcaa; }
    .pci-v-ref  { color: #4fc1ff; }
    .pci-v-err  { color: #f14c4c; }

    .pci-link {
        cursor: pointer;
        text-decoration: underline dotted;
    }

    .pci-link:hover {
        color: #9ad7ff;
    }

    .pci-swatch {
        display: inline-block;
        width: 10px;
        height: 10px;
        margin-right: 5px;
        vertical-align: -1px;
        border: 1px solid #55595f;
        border-radius: 2px;
    }

    .pci-status {
        flex: 0 0 auto;
        display: flex;
        gap: 10px;
        padding: 4px 8px;
        background: #24272d;
        border-top: 1px solid #33363d;
        color: #8b909a;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
    }

    .pci-status .pci-paused {
        color: #ff8a20;
        font-weight: 600;
    }

    .pci-status .pci-path {
        flex: 1 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        text-align: right;
    }
`;

export { styles };
