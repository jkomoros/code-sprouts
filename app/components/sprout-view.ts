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
	selectSproutStreaming,
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
	provideUserResponse,
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
	ConversationTurn,
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

import {
	ATTACH_FILE_ICON,
	IMAGE_ICON,
	SEND_ICON,
	SYNC_ICON
} from './my-icons.js';

import {
	assertUnreachable
} from '../../src/util.js';

import {
	promptImages,
	textForPrompt
} from '../../src/llm.js';

import {
	ImageURL,
	Prompt
} from '../../src/types.js';

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
		_currentSproutAllowsImages = false;

	@state()
		_sproutStreaming = false;

	@state()
		_conversation : Conversation = [];
	
	@state()
		_imageUpload : ImageURL = '';

	@state()
		_renderDropTarget : boolean = false;

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
					display: flex;
					flex-direction: column;
					align-items: center;
				}

				#conversation {
					width: 60em;
					height: 100%;
				}

				#conversation-messages {
					overflow-y: scroll;
					display: flex;
					flex-direction: column;
					justify-content: center;
					align-items: center;	
				}

				.conversation-turn {
					width: 100%;
				}

				#conversation-input {
					width: 100%;
					display: flex;
					position: relative;
				}

				#conversation-input textarea {
					flex-grow: 1;
				}

				#conversation-input .drop-target-message {
					z-index: 1;
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					flex-direction: column;
					justify-content: center;
					align-items: center;
					pointer-events: none;
					font-size: 2.0em;
					display: none;
					color: var(--lighter-gray-color);
					outline: 2px dashed var(--disabled-color); /* Dashed border to indicate drop area */
					background-color: rgba(255, 255, 255, 0.7); /* Slight background highlight */
				}

				#conversation-input.drop-target .drop-target-message {
					display: flex;
				}

				.conversation-turn-speaker {
					font-size: 0.8em;
					color: var(--dark-gray-color);
				}

				.conversation-turn-text em.loading {
					//Animate opacity to make it fade in and out
					opacity: 0;
					color: var(--dark-gray-color);
					animation-name: fade-in-out;
					animation-duration: var(--slow-animation);
					animation-iteration-count: infinite;
					animation-timing-function: ease-in-out;
				}

				@keyframes fade-in-out {
					0% { opacity: 0; }
					50% { opacity: 1; }
					100% { opacity: 0; }
				}

				img {
					max-width: 100%;
					max-height: 100%;
					object-fit: contain;
				}

				span.loading svg {
					fill: var(--dark-gray-color);
					height:1.0em;
					width:1.0em;
					animation-name: spin;
					animation-duration: var(--slow-animation);
					animation-iteration-count: infinite;
					animation-timing-function: linear;
				}

				span.loading.disabled {
					opacity:0;
					transition: opacity var(--fast-animation);
				}

				span.loading {
					opacity: 1;
				}

				@keyframes spin {
					from { transform:rotate(360deg); }
					to { transform:rotate(0deg); }
				}
			`
		];
	}

	override render() : TemplateResult {
		return html`
			<div class='container'>
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
				<div id='conversation'>
					<div id='conversation-messages'>
						${this._conversation.map((turn, index) => this._renderConversation(turn, index == this._conversation.length - 1))}
					</div>
					<div
						id='conversation-input'
						class='${this._renderDropTarget ? 'drop-target' : ''}'
						@dragover=${this._handleDragOver}
						@dragleave=${this._handleDragLeave}
						@drop=${this._handleDrop}
					>
						<div class='drop-target-message'>
							Drop images here
						</div>
						<textarea
							autofocus
							id='conversation-input-textarea'
							?disabled=${this._sproutStreaming}
						></textarea>
						<input
							type='file'
							id='image-upload'
							accept='image/*'
							?hidden=${true}
							@change=${this._handleConversationImageInputChanged}
						></input>
						${this._currentSproutAllowsImages ? html`
							<button
								class='button round'
								@click=${this._handleConversationImageInputClicked}
								title=${this._imageUpload ? 'Image uploaded' : 'Upload image'}
								?disabled=${this._sproutStreaming}
							>
								${this._imageUpload ? ATTACH_FILE_ICON : IMAGE_ICON}
							</button>
						`: ''}
						<button
							class='button round'
							@click=${this._handleConversationInputSubmit}
							title='Send'
							?disabled=${this._sproutStreaming}
						>
							<!-- TODO: Cmd-Enter to send -->
							${SEND_ICON}
						</button>
					</div>
				</div>
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
		this._sproutStreaming = selectSproutStreaming(state);
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
			this._currentSproutAllowsImages = false;
			this._currentSprout.allowImages().then(allowImages => {
				this._currentSproutAllowsImages = allowImages;
			});
			if (this._lastSignaller) this._lastSignaller.finish();
			this._lastSignaller = new Signaller({
				streamStarted: () => store.dispatch(startStreamingSprout()),
				streamStopped: () => store.dispatch(sproutStoppedStreaming()),
				streamIncrementalMessage: (message) => store.dispatch(streamIncrementalMessage(message))
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

	private _renderConversation(turn : ConversationTurn, lastTurn : boolean) : TemplateResult {
		let speaker = '';
		switch (turn.speaker) { 
		case 'sprout':
			speaker = 'Sprout';
			break;
		case 'user':
			speaker = 'User';
			break;
		default:
			assertUnreachable(turn.speaker);
		}
		const showLoading = turn.speaker === 'sprout' && this._sproutStreaming && lastTurn;
		const text = textForPrompt(turn.message);
		const images = promptImages(turn.message);
		//TODO: sometimes the text is empty and the stream is done, in that case show 'No response'
		return html`
			<div class='conversation-turn'>
				<div class='conversation-turn-speaker'>
					${speaker}
					<span class='loading ${showLoading ? '' : 'disabled'}'>${SYNC_ICON}</span>
				</div>
				<div class='conversation-turn-text'>${text.trim() ? html`${text}` : html`<em class='loading'>Thinking...</em>`}</div>
				${images.length > 0 ? html`<div class='conversation-turn-images'>
					${images.map((image) => html`<img src=${image.image} />`)}
				</div>` : ''}
			</div>
		`;
	}

	private _handleDragOver(e : DragEvent) {
		e.preventDefault();
		this._renderDropTarget = true;
	}

	private _handleDragLeave(e : DragEvent) {
		e.preventDefault();
		this._renderDropTarget = false;
	}

	private _handleDrop(e : DragEvent) {
		e.preventDefault();
		this._renderDropTarget = false;
		if (!e.dataTransfer) throw new Error('No data transfer');
		const files = e.dataTransfer.files;
		if (!files.length) return;
		const file = files[0];
		this._attachFile(file);
	}

	private _handleConversationInputSubmit() {
		if (this._sproutStreaming) throw new Error('Cannot submit while streaming');
		if (!this._lastSignaller) throw new Error('No signaller');
		const textarea = this.shadowRoot!.getElementById('conversation-input-textarea') as HTMLTextAreaElement;
		const text = textarea.value;
		textarea.value = '';
		const image = this._imageUpload;
		this._imageUpload = '';		
		const message : Prompt = image ? [
			text,
			{
				image
			}
		] : text;
		store.dispatch(provideUserResponse(message, this._lastSignaller));
	}

	private _handleConversationImageInputClicked() {
		const input = this.shadowRoot!.getElementById('image-upload') as HTMLInputElement;
		input.click();
	}

	private _attachFile(file : File) {
		if (!file.type.startsWith('image/')) throw new Error('Not an image');
		const reader = new FileReader();
		//TODO: don't allow submitting the text if an image is uploading
		reader.onload = () => {
			//We told it to be a dataURL so it's a file
			this._imageUpload = reader.result as string;
		};
		//TODO: resize the image
		reader.readAsDataURL(file);	
	}

	private _handleConversationImageInputChanged() {
		const input = this.shadowRoot!.getElementById('image-upload') as HTMLInputElement;
		if (!input.files) throw new Error('No files');
		const file = input.files[0];
		if (!file) throw new Error('No file');
		this._attachFile(file);
	}

	private _handleHashChange() {
		store.dispatch(updateHash(window.location.hash, true));
	}

	private _handleSproutChanged(e : Event) {
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