import { html, css, TemplateResult} from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { PageViewElement } from './page-view-element.js';
import { connect } from 'pwa-helpers/connect-mixin.js';

// This element is connected to the Redux store.
import { store } from '../store.js';

import {
	selectHashForCurrentState,
	selectOpenAIAPIKey,
	selectPageExtra,
} from '../selectors.js';

// These are the shared styles needed by this element.
import { SharedStyles } from './shared-styles.js';

import {
	ButtonSharedStyles
} from './button-shared-styles.js';

import {
	RootState
} from '../types_store.js';

import {
	canonicalizeHash,
	canonicalizePath,
	updateHash,
} from '../actions/app.js';

import {
	setOpenAIApiKey
} from '../actions/data.js';

import {
	fetchOpenAIAPIKeyFromStorage,
	storeOpenAIAPIKeyToStorage
} from '../util.js';

@customElement('main-view')
class MainView extends connect(store)(PageViewElement) {

	@state()
		_pageExtra = '';

	@state()
		_hashForCurrentState = '';

	@state()
		_openAIAPIKey = '';

	static override get styles() {
		return [
			SharedStyles,
			ButtonSharedStyles,
			css`
				:host {
					position:relative;
					height:100vh;
					width: 100vw;
					background-color: var(--override-app-background-color, var(--app-background-color, #356F9E));
					overflow:scroll;
					--stroke-width: 0px;
				}

				.container {
					height: 100%;
					width: 100%;
				}
			`
		];
	}

	override render() : TemplateResult {
		return html`
			<div>
				Hello, world!
			</div>
		`;
	}

	// This is called every time something is updated in the store.
	override stateChanged(state : RootState) {
		this._pageExtra = selectPageExtra(state);
		this._hashForCurrentState = selectHashForCurrentState(state);
		this._openAIAPIKey = selectOpenAIAPIKey(state);
	}

	override firstUpdated() {
		store.dispatch(canonicalizePath());
		store.dispatch(setOpenAIApiKey(fetchOpenAIAPIKeyFromStorage()));
		window.addEventListener('hashchange', () => this._handleHashChange());
		//We do this after packets have already been loaded from storage
		this._handleHashChange();
	}

	override updated(changedProps : Map<keyof MainView, MainView[keyof MainView]>) {
		if (changedProps.has('_hashForCurrentState')) {
			store.dispatch(canonicalizeHash());
		}
		if (changedProps.has('_openAIAPIKey')) {
			if (this._openAIAPIKey) {
				storeOpenAIAPIKeyToStorage(this._openAIAPIKey);
			} else {
				const key = prompt('What is your OPENAI_API_KEY?\nThis will be stored in your browser\'s local storage and never transmitted elsewhere.');
				if (key) {
					store.dispatch(setOpenAIApiKey(key));
				}
			}
		}
	}

	_handleHashChange() {
		store.dispatch(updateHash(window.location.hash, true));
	}

}

declare global {
	interface HTMLElementTagNameMap {
		'main-view': MainView;
	}
}