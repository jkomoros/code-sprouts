import { css, html, TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { connect } from 'pwa-helpers/connect-mixin.js';

// This element is connected to the Redux store.
import { store } from '../store.js';

import {
	DialogElement
} from './dialog-element.js';

import {
	RootState
} from '../types_store.js';

import {
	CHECK_CIRCLE_OUTLINE_ICON,
	OPEN_IN_NEW
} from './my-icons.js';

import {
	SharedStyles
} from './shared-styles.js';

import {
	ButtonSharedStyles
} from './button-shared-styles.js';

import {
	forceClosedAPIKeysDialog,
	setAPIKeys,
} from '../actions/data.js';

import {
	selectAPIKeys,
	selectAPIKeysDialogAutoOpen,
	selectAPIKeysDialogOpen,
	selectMobile
} from '../selectors.js';

import {
	APIKeys,
	modelProvider,
	ModelProvider
} from '../../src/types.js';

import {
	TypedObject
} from '../../src/typed-object.js';

const KEY_NAMES : Record<ModelProvider, {keyName: string, include: boolean}> = {
	'openai.com': {
		keyName: 'OPENAI_API_KEY',
		include: true
	},
	'anthropic.com': {
		keyName: 'ANTHROPIC_API_KEY',
		include: false,
	}
};

@customElement('api-key-dialog')
export class APIKeyDialog extends connect(store)(DialogElement) {
	
	@state()
		_apiKeys : APIKeys = {};

	@state()
		_firstRun : boolean = false;

	static override get styles() {
		return [
			...DialogElement.styles,
			SharedStyles,
			ButtonSharedStyles,
			css`
				.buttons {
					display: flex;
					justify-content: flex-end;
				}

				p {
					margin-block-start: 0.5em;
					margin-block-end: 0.5em;
				}

				a svg {
					height: 1em;
					width: 1em;
					/* inherit the color of the a.color */
					fill: currentcolor;
				}

			`
		];
	}

	override stateChanged(state : RootState) {
		this.open = selectAPIKeysDialogOpen(state);
		this._apiKeys = selectAPIKeys(state);
		this._firstRun = selectAPIKeysDialogAutoOpen(state);
		this.mobile = selectMobile(state);
	}


	override innerRender() : TemplateResult {

		const defaultProviders = TypedObject.keys(KEY_NAMES).filter(key => KEY_NAMES[key].include).slice(0, 1);
		const otherProviders = TypedObject.keys(KEY_NAMES).filter(key => KEY_NAMES[key].include).slice(1);
		return html`
			<h3>Welcome</h3>
			<p>Code Sprouts allows you to run simple GPT-based bots created by yourself or others. You can learn more about what it can do at the <a href='https://github.com/jkomoros/code-sprouts?tab=readme-ov-file#code-sprouts' target='_blank'>README ${OPEN_IN_NEW}</a></p>
			<p>This application requires at least one API key to a supported LLM provider to run.</p>
			<p>This will be stored in your browser's local storage and never transmitted anywhere but directly to openai.com.</p>
			<p>No sprouts you load, from this domain or any other, will be able to see this key or any information from this domain.</p>
			<p>If you would rather not trust some random webapp with your API key, you can run your own viewer by following the instructions at <a href='https://github.com/jkomoros/code-sprouts' target="_blank">https://github.com/jkomoros/code-sprouts ${OPEN_IN_NEW}</a></p>
			<h4>Provide at least one of the following:</h4>
			${defaultProviders.map(provider => html`
					<label for=${provider}>${KEY_NAMES[provider].keyName}</label>
					<input
						type='text'
						id=${provider}
						data-provider=${provider}
						.value=${this._apiKeys[provider] || ''}
					/>
			`)}
			${otherProviders.length ? html`
				<details .open=${!this._firstRun}>
					<summary>Other providers</summary>
					${otherProviders.map(provider => html`
						<label for=${provider}>${KEY_NAMES[provider].keyName}</label>
						<input
							type='text'
							id=${provider}
							data-provider=${provider}
							.value=${this._apiKeys[provider] || ''}
						/>
				`)}
				</details>
			`: html``}
		`;
	}

	override _shouldClose() {
		store.dispatch(forceClosedAPIKeysDialog());
		//TODO: allow the dialog to be required and not show any affordances to close.

	}

	private _handleSubmitClicked() {
		const eles = this.shadowRoot?.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
		if (![...eles].some(ele => ele.value)) {
			alert('You must provide at least one API key');
			return;
		}
		const keys : APIKeys = {};
		for (const ele of eles) {
			const provider = modelProvider.parse(ele.dataset.provider);
			const key = ele.value;
			keys[provider] = key;
		}
		store.dispatch(setAPIKeys(keys));
		this._shouldClose();
	}

	override buttonsRender() : TemplateResult {
		return html`<button
			class='round default'
			@click=${this._handleSubmitClicked}
			title=${'Submit API key'}
		>${CHECK_CIRCLE_OUTLINE_ICON}</button>`;
	}

}

declare global {
	interface HTMLElementTagNameMap {
		'api-key-dialog': APIKeyDialog;
	}
}
