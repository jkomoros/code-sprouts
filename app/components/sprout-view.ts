import { html, css, TemplateResult} from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { PageViewElement } from './page-view-element.js';
import { connect } from 'pwa-helpers/connect-mixin.js';

// This element is connected to the Redux store.
import { store } from '../store.js';

import {
	selectConversation,
	selectCurrentSprout,
	selectCurrentSproutName,
	selectHashForCurrentState,
	selectOpenAIAPIKey,
	selectPageExtra,
	selectSproutData,
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
	addDefaultSprouts,
	selectSprout,
	setOpenAIAPIKey,
	sproutStoppedStreaming,
	startStreamingSprout,
	streamIncrementalMessage,
	updateWithMainPageExtra
} from '../actions/data.js';

import {
	fetchOpenAIAPIKeyFromStorage,
	storeOpenAIAPIKeyToStorage
} from '../util.js';

import {
	Conversation,
	SproutDataMap,
	SproutLocation
} from '../types.js';

import {
	Sprout
} from '../../src/sprout.js';

import {
	Signaller,
	runSproutInBrowser
} from '../runner.js';

@customElement('sprout-view')
class SproutView extends connect(store)(PageViewElement) {

	@state()
		_pageExtra = '';

	@state()
		_hashForCurrentState = '';

	@state()
		_openAIAPIKey = '';

	@state()
		_sprouts : SproutDataMap = {};

	@state()
		_currentSproutName : SproutLocation | null = null;

	@state()
		_currentSprout : Sprout | null = null;

	@state()
		_conversation : Conversation = [];

	_lastSignaller : Signaller | null = null;

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
				<div class='toolbar'>
					<label for='sprout-select'>Sprout:</label>
					<select
						id='sprout-select'
						.value=${this._currentSproutName || ''}
						@change=${this._handleSproutChanged}
					>
						${Object.keys(this._sprouts).map((key) => html`
							<option .value=${key} .selected=${key == this._currentSproutName}>${key}</option>
						`)}
					</select>
				</div>
				${this._conversation.map((message) => html`${JSON.stringify(message, null, '\t')}`)}
			</div>
		`;
	}

	// This is called every time something is updated in the store.
	override stateChanged(state : RootState) {
		this._pageExtra = selectPageExtra(state);
		this._hashForCurrentState = selectHashForCurrentState(state);
		this._openAIAPIKey = selectOpenAIAPIKey(state);
		this._sprouts = selectSproutData(state);
		this._currentSproutName = selectCurrentSproutName(state);
		this._currentSprout = selectCurrentSprout(state);
		this._conversation = selectConversation(state);
	}

	override firstUpdated() {
		store.dispatch(addDefaultSprouts());
		store.dispatch(canonicalizePath());
		store.dispatch(setOpenAIAPIKey(fetchOpenAIAPIKeyFromStorage()));
		window.addEventListener('hashchange', () => this._handleHashChange());
		//We do this after packets have already been loaded from storage
		this._handleHashChange();
	}

	override updated(changedProps : Map<keyof SproutView, SproutView[keyof SproutView]>) {
		if (changedProps.has('_hashForCurrentState')) {
			store.dispatch(canonicalizeHash());
		}
		if ((changedProps.has('_pageExtra')) && this._pageExtra) {
			store.dispatch(updateWithMainPageExtra(this._pageExtra));
		}
		if (changedProps.has('_currentSprout') && this._currentSprout) {
			if (this._lastSignaller) this._lastSignaller.finish();
			this._lastSignaller = new Signaller({
				streamStarted: () => store.dispatch(startStreamingSprout()),
				streamStopped: () => store.dispatch(sproutStoppedStreaming()),
				streamIncrementalMessage: (message) => store.dispatch(streamIncrementalMessage(message)),
				getUserMessage: async (previousSproutMessage : string) : Promise<string> => {
					const response = prompt(`The AI said:\n${previousSproutMessage}\n\nWhat do you want to say?`);
					return response || '';
				}
			});
			runSproutInBrowser(this._currentSprout, this._lastSignaller);
		}
		if (changedProps.has('_openAIAPIKey')) {
			if (this._openAIAPIKey) {
				storeOpenAIAPIKeyToStorage(this._openAIAPIKey);
			} else {
				const key = prompt('What is your OPENAI_API_KEY?\nThis will be stored in your browser\'s local storage and never transmitted elsewhere.');
				if (key) {
					store.dispatch(setOpenAIAPIKey(key));
				}
			}
		}
	}

	_handleHashChange() {
		store.dispatch(updateHash(window.location.hash, true));
	}

	_handleSproutChanged(e : Event) {
		const sproutName = (e.target as HTMLSelectElement).value;
		if (sproutName) {
			store.dispatch(selectSprout(sproutName));
		}
	}

}

declare global {
	interface HTMLElementTagNameMap {
		'sprout-view': SproutView;
	}
}