import { css, html, TemplateResult } from 'lit';
import { HELP_ICON } from './my-icons.js';

//if you use help, also make sure to include ButtonSharedStyles
export const help = (message : string, disabled = false) : TemplateResult => {
	return html`<button class='small help' title="${message}" .disabled=${disabled}>${HELP_ICON}</button>`;
};

export const ButtonSharedStyles = css`
		button, .button {
			font-size: inherit;
			vertical-align: middle;
			color: var(--app-light-text-color);
			background: var(--dark-gray-color);
			padding: 0.5em;
			box-shadow: 0 2px 2px var(--shadow-color);
			border: none;
			cursor: pointer;
			margin: 0.5em;
			position: relative;
			overflow: hidden;
			transition: background-color var(--transition-fade), color var(--transition-fade), box-shadow var(--transition-fade);
		}

		button:disabled, .button:disabled {
			cursor:default;
            filter: var(--disabled-filter);
		}

		button:disabled:hover, .button:disabled:hover {
			filter: var(--disabled-filter);
		}

		button.default, .button.default {
			background: var(--app-primary-color);
		}

        button.highlight, .button.highlight {
            background: var(--app-secondary-color);
        }

		button.help, .button.help {
			cursor:default;
		}

		button.round, .button.round {
			border-radius:50%;
			height: 2.75em;
			width: 2.75em;
		}

		button svg, .button svg {
			fill: var(--app-light-text-color);
		}

		button:hover, .button:hover {
			filter: brightness(0.9);
		}

		button.small:disabled:hover, .button.small:disabled:hover {
			filter: none;
		}

		button.emoji, .button.emoji {
			background:transparent;
			padding: 0;
			margin:0;
			box-shadow: none;
			font-size: 1.75em;
			color: var(--dark-gray-color);
		}

		button.small, .button.small {
			background:transparent;
			padding: 0;
			margin:0;
			box-shadow: none;
			font-size: 1.0em;
			color: var(--dark-gray-color);
		}

		button.small:disabled svg, .button.small:disabled svg {
			fill: var(--disabled-color);
		}

		button.emoji:disabled, .button.emoji:disabled {
			filter: grayscale(100%) opacity(30%);
		}

		button.small svg, .button.small svg {
			fill: var(--dark-gray-color);
			height:1.0em;
			width:1.0em;
		}

		button.small:disabled:hover svg, .button.small:disabled:hover svg {
			fill: var(--disabled-color);
		}

		button.emoji:disabled:hover {
			filter: grayscale(100%) opacity(30%);
		}

		button.small:hover svg, .button.small:hover svg {
			fill: var(--disabled-color);
		}

		button.emoji:hover, .button.emoji:hover {
			filter: grayscale(50%) drop-shadow(0.1em 0.1em 0.1em black);
		}

`;
