import { html, css, TemplateResult, PropertyValues} from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { PageViewElement } from './page-view-element.js';
import { connect } from 'pwa-helpers/connect-mixin.js';

import {
	marked,

} from 'marked';

import DOMPurify from 'dompurify';

// This element is connected to the Redux store.
import { getState, store } from '../store.js';

import {
	selectAttachedImage,
	selectCurrentSproutConversation,
	selectCurrentSprout,
	selectCurrentSproutName,
	selectDraftMessage,
	selectHashForCurrentState,
	selectPageExtra,
	selectSproutData,
	selectSproutStreaming,
	selectMayCreateSprout,
	selectIsEditing,
	selectDialogOpen,
	selectMobile,
	selectAPIKeys,
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
	addSprout,
	attachImage,
	createNamedSprout,
	provideUserResponse,
	selectSprout,
	openEditor,
	setAPIKey,
	updateDraftMessage,
	updateWithMainPageExtra,
	forceOpenAPIKeysDialog
} from '../actions/data.js';

import dataManager from '../data_manager.js';

import {
	SproutDataMap,
	SproutLocation
} from '../types.js';

import {
	Sprout
} from '../../src/sprout.js';

import {
	ATTACH_FILE_ICON,
	IMAGE_ICON,
	PLUS_ICON,
	SEND_ICON,
	SYNC_ICON,
	WARNING_ICON,
	CANCEL_ICON,
	LOCK_ICON,
	PREVIEW_ICON,
	CLOUD_DOWNLOAD_ICON,
	SETTINGS_ICON
} from './my-icons.js';

import {
	assertUnreachable,
	pathIsRemote,
	shortenDisplayPath
} from '../../src/util.js';

import {
	promptImages,
	textForPrompt
} from '../../src/llm.js';

import {
	ImageURL,
	SproutConfig,
	Conversation,
	ConversationMessage,
	APIKeys,
	modelProvider,
} from '../../src/types.js';

import {
	signaller
} from '../signaller.js';

import {
	KeyboardAction,
	KeyboardActions,
	executeKeyboardAction,
	shortcutDisplayString
} from '../keyboard.js';

import {
	focusElementIfNoOtherFocus
} from '../util.js';

import './sprout-editor.js';
import './api-key-dialog.js';
import { TypedObject } from '../../src/typed-object.js';

const sendShortcut : KeyboardAction = {
	shortcut: {
		key: 'Enter',
		allowWhileEditing: true,
		disabled: () => {
			return selectDialogOpen(getState());
		}
	},
	action: () => {
		store.dispatch(provideUserResponse());
	}
};

const keyboardShortcuts : KeyboardActions = [
	sendShortcut
];

const markdownElement = (formattedString : string) => {
	//Replace single paragraph breaks with double paragraph breaks, so \n
	//renders a new paragraph. Markdown with collapse extra breaks anyway.
	formattedString = formattedString.replace(/(?<!\n)\n(?!\n)/g, '\n\n');

	// Convert Markdown to HTML
	const rawHtml = marked.parse(formattedString);

	if (typeof rawHtml != 'string') throw new Error('Expected string');

	// Sanitize the HTML
	const sanitizedHtml = DOMPurify.sanitize(rawHtml);

	// Render the sanitized HTML
	return unsafeHTML(sanitizedHtml);
};

@customElement('sprout-view')
class SproutView extends connect(store)(PageViewElement) {

	@state()
		_pageExtra = '';

	@state()
		_hashForCurrentState = '';

	@state()
		_apiKeys : APIKeys = {};

	@state()
		_sprouts : SproutDataMap = {};

	@state()
		_currentSproutName : SproutLocation | null = null;

	@state()
		_currentSprout : Sprout | null = null;

	@state()
		_currentSproutConfig : SproutConfig | null = null;

	@state()
		_currentSproutAllowsImages = false;

	@state()
		_currentSproutManagesState = false;

	@state()
		_sproutStreaming = false;

	@state()
		_mayCreateSprout = false;

	@state()
		_conversation : Conversation = [];
	
	@state()
		_imageUpload : ImageURL | null = '';

	@state()
		_renderDropTarget : boolean = false;

	@state()
		_draftMessage : string = '';
	
	@state()
		_editing : boolean = false;
	
	@state()
		_moblie : boolean = false;

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
					height: 100vh;
					width: 100%;
					display: flex;
					flex-direction: column;
					align-items: center;
				}

				.row {
					display: flex;
					flex-direction: row;
					align-items: center;
				}

				.column {
					max-width:60em;
					width: 100%;
					height: 100vh;
					box-sizing: border-box;
					display: flex;
					flex-direction: column;
					background-color: white;
					padding: 1em;
					//A subtle dropshadow spreading out left to right
					box-shadow: 0px 0px 3em 3em rgba(0,0,0,1.0), 0px 0px 3em 3em rgba(0,0,0,1.0);
				}

				#conversation {
					overflow-y: auto;
					width: 100%;
					flex:1;
					display: flex;
					flex-direction: column-reverse;
					align-items: center;
				}

				#conversation .inner {
					width: 100%;
				}

				.title {
					margin-left: 2em;
					font-size: 0.8em;
					width: 100%;
				}

				.toolbar {
					display: flex;
					flex-direction: row;
					align-items: center;
					padding-bottom: 1em;
					margin-bottom: 1em;
					border-bottom: var(--subtle-border);
				}

				.mobile .toolbar {
					flex-direction: column;
					align-items: flex-start;
				}

				.mobile .toolbar .controls {
					display: flex;
					flex-direction: row;
					align-items: center;
				}

				.mobile .toolbar .title {
					margin-left: 0;
				}

				.title h2 {
					margin-top: 0;
					margin-bottom: 0;
				}

				.title p {
					margin-top: 0;
					margin-bottom: 0;
				}

				.title svg {
					height: 1em;
					width: 1em;
					fill: var(--dark-gray-color);
				}

				.warning svg {
					fill: var(--app-warning-color);
				}

				.conversation-turn {
					width: 100%;
				}

				#conversation-input {
					width: 100%;
					display: flex;
					position: relative;
					box-sizing: border-box;
					padding-top: 1em;
					margin-top: 1em;
					border-top: var(--subtle-border);
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
					fill: var(--lighter-gray-color);
					outline: 2px dashed var(--disabled-color); /* Dashed border to indicate drop area */
					background-color: rgba(255, 255, 255, 0.7); /* Slight background highlight */
				}

				#conversation-input.drop-target .drop-target-message {
					display: flex;
				}

				.conversation-turn-speaker {
					font-size: 0.8em;
					color: var(--dark-gray-color);
					display: flex;
					flex-direction: row;
				}

				.conversation-turn-text em.error, .conversation-turn-text em.loading {
					color: var(--dark-gray-color);
				}

				.conversation-turn-text p {
					margin-top: 0;
					margin-bottom: 0;
				}

				.conversation-turn-speaker details {
					display: inline-block;
				}

				.flex {
					flex:1;
				}

				.conversation-turn-text em.loading {
					//Animate opacity to make it fade in and out
					opacity: 0;
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

				.cancelled .speaker {
					color: var(--app-warning-color);
					transition: color var(--fast-animation) ease-in-out;
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

		const remoteDomain = pathIsRemote(this._currentSproutName || '');

		const classes = {
			container: true,
			mobile: this._moblie
		};

		return html`
			<sprout-editor></sprout-editor>
			<api-key-dialog></api-key-dialog>
			<div class=${classMap(classes)}>
				<div class='column'>
					<div class='toolbar'>
						<div class='controls'>
							<label for='sprout-select'>Sprout:</label>
							<div class='row'>
								<select
									id='sprout-select'
									.value=${this._currentSproutName || ''}
									@change=${this._handleSproutChanged}
								>
									${Object.keys(this._sprouts).map((key) => html`
										<option
											.value=${key}
											.selected=${key == this._currentSproutName}
											.title=${key}
										>
											${shortenDisplayPath(key)}
										</option>
									`)}
								</select>
								<button
									class='small'
									@click=${this._handleAddSprout}
									title='Import a sprout from another location'
								>
									${CLOUD_DOWNLOAD_ICON}
								</button>
								${this._mayCreateSprout ? 
		html`
								<button
									class='small'
									@click=${this._handleCreateSprout}
									title='Create a sprout'
								>
									${PLUS_ICON}
								</button>
								` :
		html``}
							<!-- TODO: figure out a better place to put this ubtton that's less distracting -->
							<button
								class='small'
								@click=${this._handleOpenSettingsClicked}
								title='Manage API Keys'
							>${SETTINGS_ICON}</button>
							</div>
						</div>
						<div class='title'>
							<h2>${this._currentSproutConfig?.title || this._currentSproutName}
								<button
									class='small'
									@click=${this._handleViewSprout}
									title='View the current sprout'
								>
									${PREVIEW_ICON}
								</button>
							</h2>			
							<p class='description'>
								${this._currentSproutConfig?.description || 'A sprout without a description'}
							</p>
							<p class='messages'>
								${remoteDomain ? html`<span class='warning' .title=${`This domain does not vouch for the content you load from ${remoteDomain} or any other domain.`}>${WARNING_ICON} This is a remote sprout from <strong>${remoteDomain}</strong></span>` : ''}
							</p>
							<p class='messages'>
								${remoteDomain ? html`<span .title=${`This site reaches out to openai.com directly and doesn't pass any information to ${remoteDomain}, other than that someone fetched the sprout definition.`}>${LOCK_ICON} <strong>${remoteDomain}</strong> cannot see any of your information from this page</span>` : ''}
							</p>
						</div>
					</div>
					<div id='conversation'>
						<div class='inner'>
							${this._conversation.map((turn, index) => this._renderConversation(turn, {
		lastTurn: index == this._conversation.length - 1,
		showState: this._currentSproutManagesState
	}))}
						</div>
					</div>
					<div
						id='conversation-input'
						class='${this._renderDropTarget ? 'drop-target' : ''}'
						@dragover=${this._handleDragOver}
						@dragleave=${this._handleDragLeave}
						@drop=${this._handleDrop}
					>
						<div class='drop-target-message'>
							<span>${IMAGE_ICON} Drop images here</span>
						</div>
						<textarea
							autofocus
							id='conversation-input-textarea'
							?disabled=${this._sproutStreaming}
							.value=${this._draftMessage}
							@input=${this._handleDraftMessageInput}
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
								class='button round ${this._imageUpload ? 'highlight' : ''}'
								@click=${this._handleConversationImageInputClicked}
								title=${this._imageUpload ? 'Image uploaded' : 'Upload image'}
								?disabled=${this._sproutStreaming}
							>
								${this._imageUpload ? ATTACH_FILE_ICON : IMAGE_ICON}
							</button>
						`: ''}
						${this._sproutStreaming ? 
		html`
								<button
									class='button round'
									@click=${this._handleStopStreamingClicked}
									title='Stop the bot from thinking more so you can send another message'
								>	
									<!-- TODO: stop icon -->
									${CANCEL_ICON}
								</button>
		` : html`
								<button
									class='button round ${this._draftMessage || this._imageUpload ? 'default' : ''}'
									@click=${this._handleConversationInputSubmit}
									title=${'Send ' + shortcutDisplayString(sendShortcut.shortcut)}
									?disabled=${this._sproutStreaming}
								>
									${SEND_ICON}
								</button>
							`
}

					</div>
				</div>
			</div>
		`;
	}

	// This is called every time something is updated in the store.
	override stateChanged(state : RootState) {
		this._pageExtra = selectPageExtra(state);
		this._hashForCurrentState = selectHashForCurrentState(state);
		this._apiKeys = selectAPIKeys(state);
		this._sprouts = selectSproutData(state);
		this._currentSproutName = selectCurrentSproutName(state);
		this._sproutStreaming = selectSproutStreaming(state);
		this._currentSprout = selectCurrentSprout(state);
		this._conversation = selectCurrentSproutConversation(state);
		this._draftMessage = selectDraftMessage(state);
		this._imageUpload = selectAttachedImage(state);
		this._mayCreateSprout = selectMayCreateSprout(state);
		this._editing = selectIsEditing(state);
		this._moblie = selectMobile(state);
	}

	override firstUpdated() {
		//Using dispatch within updated can cause weird rentrant issues.
		setTimeout(() => this.firstRunDispatch(), 0);
		window.addEventListener('keydown', e => this._handleKeyDown(e));
		window.addEventListener('hashchange', () => this._handleHashChange());
		//We do this after packets have already been loaded from storage
		this._handleHashChange();
	}

	private async firstRunDispatch() {
		store.dispatch(addDefaultSprouts());
		store.dispatch(canonicalizePath());
		//iterate for each legal value in the ZodEnum modelProvider
		for (const provider of modelProvider.options) {
			const key = await dataManager.retrieveAPIKey(provider);
			if (key) {
				store.dispatch(setAPIKey(provider, key));
			}
		}
	}

	private sproutChanged(lastSprout? : Sprout | null) {
		if (!this._currentSprout) return;
		this._currentSproutAllowsImages = false;
		this._currentSprout.allowImages().then(allowImages => {
			this._currentSproutAllowsImages = allowImages;
		});
		this._currentSproutConfig = null;
		this._currentSprout.config().then(config => {
			this._currentSproutConfig = config;
		});
		this._currentSproutManagesState = false;
		this._currentSprout.managesState().then(managesState => {
			this._currentSproutManagesState = managesState;
		});
		if (lastSprout) signaller.finish(lastSprout);
		this._currentSprout.run(signaller);
	}

	override updated(changedProps : PropertyValues<this>) {
		if (changedProps.has('_hashForCurrentState')) {
			store.dispatch(canonicalizeHash());
		}
		if ((changedProps.has('_pageExtra')) && this._pageExtra) {
			store.dispatch(updateWithMainPageExtra(this._pageExtra));
		}
		if (changedProps.has('_currentSprout') && this._currentSprout) {
			const lastSprout = changedProps.get('_currentSprout');
			//Don't call store.dispatch things in the update.
			setTimeout(() => this.sproutChanged(lastSprout), 0);
		}
		if (changedProps.has('_sproutStreaming') && !this._sproutStreaming) {
			this._focusTextArea();
		}
		if (changedProps.has('_apiKeys')) {
			//This will have a few extra sets as multiple are set, but it will
			//settle because the action creator checks for equality. Previously
			//in bac7ad3 before the equality check this led to an infinite loop.
			for (const [provider, key] of TypedObject.entries(this._apiKeys)) {
				if (!key) continue;
				store.dispatch(setAPIKey(provider, key));
			}
		}
	}

	private _renderConversation(turn : ConversationMessage, opts : {lastTurn? : boolean, showState? : boolean} = {}) : TemplateResult {
		const { lastTurn, showState } = opts;
		let speaker = '';
		//Typescript assertUnreachable doesn't work with a union type otherwise
		const speakerType = turn.speaker;
		switch (speakerType) { 
		case 'sprout':
			speaker = 'Sprout';
			break;
		case 'user':
			speaker = 'User';
			break;
		default:
			assertUnreachable(speakerType);
		}
		const showLoading = turn.speaker === 'sprout' && this._sproutStreaming && lastTurn;
		const cancelled = turn.speaker === 'sprout' && turn.status == 'cancelled';
		const text = textForPrompt(turn.message);
		const images = promptImages(turn.message);
		let textEle =  markdownElement(text);
		if (!text.trim()) {
			textEle = this._sproutStreaming && turn.speaker == 'sprout' ? html`<em class='loading'>Thinking...</em>` : html`<em class='error'>No message</em>`;
		}
		return html`
			<div class='conversation-turn'>
				<div class='conversation-turn-speaker ${cancelled ? 'cancelled' : ''}'>
					<span class='speaker' title=${cancelled ? 'Response cancelled by user' : speaker}>${speaker}</span>
					<span class='loading ${showLoading ? '' : 'disabled'}'>${SYNC_ICON}</span>
					<div class='flex'></div>
					${showState && speakerType == 'sprout' 
		? html`<details>
						<summary>
							State
						</summary>
						${turn.state ? 
		html`<pre>${JSON.stringify(turn.state, null, '\t')}</pre>` :
		html`<em class='error'>Calculating state<span class='loading ${showLoading ? '' : 'disabled'}'>${SYNC_ICON}</span></em>`
}		
					</details>` : ''
}
				</div>
				<div class='conversation-turn-text'>${textEle}</div>
				${images.length > 0 ? html`<div class='conversation-turn-images'>
					${images.map((image) => html`<img src=${image.image} />`)}
				</div>` : ''}
			</div>
		`;
	}

	private _focusTextArea() {
		const textarea = this.shadowRoot!.getElementById('conversation-input-textarea') as HTMLTextAreaElement;
		if (!textarea) throw new Error('No textarea');
		//Don't steal focus when editing is ahppening.
		if (this._editing) return;
		focusElementIfNoOtherFocus(textarea);
	}

	private _handleOpenSettingsClicked() {
		store.dispatch(forceOpenAPIKeysDialog());
	}

	private _handleKeyDown(e : KeyboardEvent) {
		executeKeyboardAction(e, keyboardShortcuts);
	}

	private _handleDraftMessageInput(e : Event) {
		const textarea = e.target as HTMLTextAreaElement;
		store.dispatch(updateDraftMessage(textarea.value));
	}

	private _handleStopStreamingClicked() {
		//TODO: implement this.
		const sprout = this._currentSprout;
		if (!sprout) throw new Error('No sprout');
		signaller.stopStreaming(sprout);
	}

	private _handleAddSprout() {
		const sproutName = prompt('What is the name of the sprout you want to add?\nHere are some examples: `example/codenames`, `https://komoroske.com/example/codenames/`, `komoroske.com/example/codenames`');
		if (!sproutName) return;
		store.dispatch(addSprout(sproutName));
	}

	private _handleDragOver(e : DragEvent) {
		if (this._sproutStreaming) return;
		e.preventDefault();
		this._renderDropTarget = true;
	}

	private _handleDragLeave(e : DragEvent) {
		e.preventDefault();
		this._renderDropTarget = false;
	}

	private _handleDrop(e : DragEvent) {
		if (this._sproutStreaming) return;
		e.preventDefault();
		this._renderDropTarget = false;
		if (!e.dataTransfer) throw new Error('No data transfer');
		const files = e.dataTransfer.files;
		if (!files.length) return;
		const file = files[0];
		this._attachFile(file);
	}

	private _handleCreateSprout() {
		const name = prompt('What should the sprout be called?');
		if (!name) return;
		try {
			store.dispatch(createNamedSprout(name));
		} catch(err) {
			alert(`Could not create sprout: ${err}`);
		}
	}

	private _handleViewSprout() {
		store.dispatch(openEditor());
	}

	private _handleConversationInputSubmit() {
		store.dispatch(provideUserResponse());
	}

	private _handleConversationImageInputClicked() {
		const input = this.shadowRoot!.getElementById('image-upload') as HTMLInputElement;
		input.click();
	}

	private _attachFile(file : File) {
		store.dispatch(attachImage(file));
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