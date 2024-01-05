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
} from './my-icons.js';

import {
	SharedStyles
} from './shared-styles.js';

import {
	ButtonSharedStyles
} from './button-shared-styles.js';

import {
	setOpenAIAPIKey,
} from '../actions/data.js';

import {
	selectMobile,
	selectOpenAIAPIKey,
} from '../selectors.js';

@customElement('api-key-dialog')
export class APIKeyDialog extends connect(store)(DialogElement) {
	
	@state()
		_apiKey : string = '';

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

			`
		];
	}

	override stateChanged(state : RootState) {
		this._apiKey = selectOpenAIAPIKey(state);
		this.open = this._apiKey == '';
		this.mobile = selectMobile(state);
	}


	override innerRender() : TemplateResult {
		if (this._apiKey) return html`You have provided your API key.`;
		return html`
			<h3>Please provide your API key</h3>
			<p>This application requires your <strong>OPENAI_API_KEY</strong> to run.</p>
			<p>This will be stored in your browser's local storage and never transmitted anywhere but directly to OpenAI.com.</p>
			<p>No sprouts you load, from this domain or any other, will be able to see this key or any information from this domain.</p>
			<p>If you would rather not trust some random webapp with your API key, you can run your own viewer by following the instructions at <a href='https://github.com/jkomoros/code-sprouts' target="_blank">https://github.com/jkomoros/code-sprouts</a></p>
			<label>OPENAI_API_KEY</label>
			<input
				type='text'
			/>
		`;
	}

	override _shouldClose() {
		//The only way to get out of this dialog is to click the cancel button.

	}

	private _handleSubmitClicked() {
		const ele = this.shadowRoot!.querySelector('input') as HTMLInputElement;
		if (!ele) return;
		const apiKey = ele.value;
		if (!apiKey) alert('You must provide an API key');
		store.dispatch(setOpenAIAPIKey(apiKey));
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
