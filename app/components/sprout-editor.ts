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
	CANCEL_ICON,
	CHECK_CIRCLE_OUTLINE_ICON,
	CLOUD_DOWNLOAD_ICON,
	EDIT_ICON,
	PLUS_ICON
} from './my-icons.js';

import {
	SharedStyles
} from './shared-styles.js';

import {
	ButtonSharedStyles
} from './button-shared-styles.js';

import {
	closeEditor,
	downloadCurrentSprout,
	editingModifySprout,
	saveSprout,
	startEditing
} from '../actions/data.js';

import {
	selectChangesMade,
	selectCurrentSproutName,
	selectEditorOpen,
	selectIsEditing,
	selectMayEditCurrentSprout,
	selectMobile,
	selectSproutSnapshot
} from '../selectors.js';

import {
	SproutConfig,
	sproutConfigSchema,
	SproutName,
	subInstructionNameSchema,
	UncompiledPackagedSprout
} from '../../src/types.js';

import {
	TypedObject
} from '../../src/typed-object.js';

import {
	HelpStyles,
	help,
} from './help-badges.js';

import {
	assertUnreachable,
	clone
} from '../../src/util.js';

import {
	eleFromEvent,
	baseFileName
} from '../util.js';

type ConfigFieldInfo = {
	hidden: boolean,
	optional: boolean,
	description: string
}

const CONFIG_FIELDS : Record<keyof SproutConfig, ConfigFieldInfo> = {
	formatVersion: {
		hidden: true,
		optional: false,
		description: 'A format version number for the sprout'
	},
	title: {
		hidden: false,
		optional: true,
		description: 'The title of the sprout'
	},
	description: {
		hidden: false,
		optional: true,
		description: 'A description of the sprout'
	},
	allowImages: {
		hidden: false,
		optional: true,
		description: 'Whether the bot allows images'
	},
	allowFormatting: {
		hidden: false,
		optional: true,
		description: 'Whether the bot should return markdown formatting'
	}
};

@customElement('sprout-editor')
export class SproutEditor extends connect(store)(DialogElement) {
	
	@state()
		_snapshot : UncompiledPackagedSprout | null = null;

	@state()
		_currentSproutName : SproutName | null = null;

	@state()
		_editing = false;

	@state()
		_userMayEdit = false;

	@state()
		_changesMade = false;

	static override get styles() {
		return [
			...DialogElement.styles,
			SharedStyles,
			ButtonSharedStyles,
			HelpStyles,
			css`
				.buttons {
					display: flex;
					justify-content: flex-end;
				}

				.row {
					display: flex;
					flex-direction: column;
					position: relative;
				}

				.row .control {
					display: flex;
					flex-direction: row;
					width: 100%;
				}

				.row input[type=text] {
					flex: 1;
				}

				textarea {
					/* TODO: figure out why this is overflowing width-wize at 100% */
					width: calc(100% - 1em);
					min-height: 5em;
				}

				.indented {
					margin-left: 2em;
				}
			`
		];
	}

	override stateChanged(state : RootState) {
		this.open = selectEditorOpen(state);
		this.mobile = selectMobile(state);
		this._snapshot = selectSproutSnapshot(state);
		this._currentSproutName = selectCurrentSproutName(state);
		this._editing = selectIsEditing(state);
		this._changesMade = selectChangesMade(state);
		this._userMayEdit = selectMayEditCurrentSprout(state);
	}

	closeDialog(dismissed : boolean) {
		store.dispatch(closeEditor(dismissed));
	}

	save() {
		store.dispatch(saveSprout());
	}

	private hiddenConfigText(config : SproutConfig) : string {
		const items : string[] = [];
		for (const [key, value] of TypedObject.entries(config)) {
			const info = CONFIG_FIELDS[key];
			if (info.hidden) {
				items.push(`${key}:${String(value)}`);
			}
		}
		return items.join(', ');
	}

	private selectToAddMissingConfig(config : SproutConfig) : TemplateResult {
		if (!this._editing) return html``;
		const missingKeys = TypedObject.keys(sproutConfigSchema.shape).filter(key => !(key in config));
		if (missingKeys.length == 0) return html``;
		return html`
			<select class='indented' @change=${this._handleAddMissingConfigKey}>
				<option value=''>Add config key</option>
				${missingKeys.map(key => html`<option .value=${key} .title=${CONFIG_FIELDS[key].description}>${key}</option>`)}
			</select>`;
	}

	private rowForConfig(key : keyof SproutConfig, value : unknown) : TemplateResult {
		if (CONFIG_FIELDS[key].hidden) return html``;
		let control = html`<input
			type='text'
			?disabled=${!this._editing}
			data-key=${key}
			@change=${this._handleConfigControlChanged}
			.value=${String(value)}></input>`;
		switch (typeof value) {
		case 'boolean':
			control = html`<input
				type='checkbox'
				?disabled=${!this._editing}
				data-key=${key}
				@change=${this._handleConfigControlChanged}
				.checked=${value}></input>`;
			break;
		case 'number':
			control = html`<input
				type='number'
				?disabled=${!this._editing}
				data-key=${key}
				@change=${this._handleConfigControlChanged}
				.value=${String(value)}></input>`;
			break;
		}
		const removeButton = !CONFIG_FIELDS[key].optional || !this._editing ? html`` : html`
		<button
			class='small'
			title=${`Remove ${key}`}
			data-key=${key}
			@click=${this._handleConfigControlRemoved}
		>${CANCEL_ICON}</button>
		`;
		return html`<div class='row indented'><label>${key} ${help(CONFIG_FIELDS[key].description)}</label><div class='control'>${control}${removeButton}</div></div>`;
	}

	override innerRender() : TemplateResult {

		const snapshot = this._snapshot;

		if (!snapshot) return html`No sprout.`;

		const config = sproutConfigSchema.parse(JSON.parse(snapshot['sprout.json']));
		const subInstructions = snapshot['sub_instructions'] || {};

		return html`
			<h2>${this._currentSproutName || 'Unnamed Sprout'}
				<button
					class='small'
					@click=${this._handleDownloadClicked}
					title='Download copy of sprout'
				>
					<!-- TODO: a better download icon -->
					${CLOUD_DOWNLOAD_ICON}
				</button>

				${this._userMayEdit ? 
		html`
					<button
						class='small'
						@click=${this._handleEditingClicked}
						?disabled=${this._editing}
						title=${this._editing ? 'Stop editing' : 'Edit sprout'}
					>
						${EDIT_ICON}
					</button>
					`:
		html``
}
			</h2>
			<label .title=${this.hiddenConfigText(config)}>Config ${help('Various configuratino properties for the sprout')}</label>
			<div>
				${config
		? html`${TypedObject.entries(config).map(([key, value]) => this.rowForConfig(key, value))}`
		: html`<em>No config</em>`}
				${this.selectToAddMissingConfig(config)}
			</div>
			<label>Instructions ${help('The main instructions that tell the bot what to do.')}</label>
			<textarea
				?disabled=${!this._editing}
				@change=${this._handleInstructionsChanged}
				.value=${snapshot['instructions.md']}
			></textarea>
			<label>Schema ${help('If provided, this should be a type defined in typescript.')}</label>
			<textarea
				?disabled=${!this._editing}
				@change=${this._handleSchemaTextChanged}
				.value=${snapshot['schema.ts'] || ''}
			></textarea>
			<label>Sub-instructions
				${help('Deeper instructions for specific actions that the bot can ask about.')}
				${this._editing ? html`
					<button
						class='small'
						@click=${this._handleAddSubInstruction}
						title='Add sub-instruction'
					>${PLUS_ICON}</button>
				` : html``}
			</label>
			${Object.keys(subInstructions).length > 0 ? 
		Object.entries(subInstructions).map(([key, value]) => html`
			<details>
				<summary>
					<label>${baseFileName(key)}</label>
					${this._editing ? html`
						<button
							class='small'
							title='Delete ${baseFileName(key)} sub-instruction'
							data-key=${key}
							@click=${this._handleSubInstructionRemoved}
						>${CANCEL_ICON}</button>
					` : html``}
				</summary>
				<textarea
					?disabled=${!this._editing}
					data-key=${key}
					@change=${this._handleSubInstructionChanged}
					.value=${value}
				></textarea>
			</details>
		`) :
		html`<em>No sub-instructions</em>`}
		`;
	}

	private _handleDownloadClicked() {
		store.dispatch(downloadCurrentSprout());
	}

	private _handleEditingClicked() {
		if (!this._editing) store.dispatch(startEditing());
	}

	private _handleInstructionsChanged(e : InputEvent) {
		const textarea = e.target as HTMLTextAreaElement;
		const newValue = textarea.value;

		const snapshot = this._snapshot;
		if (!snapshot) throw new Error('no snapshot');
		const clonedSnapshot = clone(snapshot);

		clonedSnapshot['instructions.md'] = newValue;

		store.dispatch(editingModifySprout(clonedSnapshot));
	}

	private _handleSchemaTextChanged(e : InputEvent) {
		const textarea = e.target as HTMLTextAreaElement;
		const newValue = textarea.value;

		const snapshot = this._snapshot;
		if (!snapshot) throw new Error('no snapshot');
		const clonedSnapshot = clone(snapshot);

		if (newValue === '') {
			delete clonedSnapshot['schema.ts'];
		} else {
			clonedSnapshot['schema.ts'] = newValue;
		}

		store.dispatch(editingModifySprout(clonedSnapshot));
	}

	private _handleAddMissingConfigKey(e : Event) {
		const ele = e.composedPath()[0];
		if (!(ele instanceof HTMLSelectElement)) throw new Error('Not select ele');
		const rawKey = ele.value;
		ele.value = '';
		if (rawKey === '') return;
		const key = sproutConfigSchema.keyof().parse(rawKey);

		const snapshot = this._snapshot;
		if (!snapshot) throw new Error('no snapshot');
		const clonedSnapshot = clone(snapshot);

		const config = sproutConfigSchema.parse(JSON.parse(clonedSnapshot['sprout.json']));

		switch (key) {
		case 'formatVersion':
			throw new Error('formatVersion may not be added');
		case 'title':
		case 'description':
			config[key] = '';
			break;
		case 'allowImages':
		case 'allowFormatting':
			config[key] = true;
			break;
		default:
			assertUnreachable(key);
		}

		clonedSnapshot['sprout.json'] = JSON.stringify(config, null, '\t');

		store.dispatch(editingModifySprout(clonedSnapshot));
	}

	private _handleConfigControlRemoved(e : Event) {
		const ele = eleFromEvent(e, HTMLButtonElement);

		const key = sproutConfigSchema.keyof().parse(ele.dataset.key);

		const snapshot = this._snapshot;
		if (!snapshot) throw new Error('no snapshot');
		const clonedSnapshot = clone(snapshot);

		const config = sproutConfigSchema.parse(JSON.parse(clonedSnapshot['sprout.json']));

		if (!CONFIG_FIELDS[key].optional) throw new Error(`Can't remove ${key} because it's required`);

		delete config[key];

		clonedSnapshot['sprout.json'] = JSON.stringify(config, null, '\t');

		store.dispatch(editingModifySprout(clonedSnapshot));
	}

	private _handleConfigControlChanged(e : InputEvent) {
		const ele = e.composedPath()[0];
		if (!(ele instanceof HTMLInputElement)) throw new Error('not input ele');
		const key = sproutConfigSchema.keyof().parse(ele.dataset.key);

		const snapshot = this._snapshot;
		if (!snapshot) throw new Error('no snapshot');
		const clonedSnapshot = clone(snapshot);

		const config = sproutConfigSchema.parse(JSON.parse(clonedSnapshot['sprout.json']));
		switch(key) {
		case 'formatVersion':
			throw new Error('Cannot change version');
		case 'title':
		case 'description':
			if (config[key] === ele.value) return;
			config[key] = ele.value;
			break;
		case 'allowFormatting':
		case 'allowImages':
			if (config[key] === ele.checked) return;
			config[key] = ele.checked;
			break;
		default:
			assertUnreachable(key);
		}

		clonedSnapshot['sprout.json'] = JSON.stringify(config, null, '\t');

		store.dispatch(editingModifySprout(clonedSnapshot));
	}

	private _handleAddSubInstruction() {

		const rawName = prompt('What should the sub-instruction\'s name be?');
		if (rawName === null) return;

		const nameParseResult = subInstructionNameSchema.safeParse(rawName);
		
		if (!nameParseResult.success) {
			alert(`${rawName} is not a legal name`);
			return;
		}

		const fileName = `${nameParseResult.data}.md`;

		const snapshot = this._snapshot;
		if (!snapshot) throw new Error('no snapshot');
		const clonedSnapshot = clone(snapshot);

		const subInstructions = clonedSnapshot['sub_instructions'] || {};

		clonedSnapshot['sub_instructions'] = {
			...subInstructions,
			[fileName]: ''
		};

		store.dispatch(editingModifySprout(clonedSnapshot));
	}

	private _handleSubInstructionChanged(e : InputEvent) {

		const ele = e.composedPath()[0];
		if (!(ele instanceof HTMLTextAreaElement)) throw new Error('not text area');

		const subInstructionFileName = ele.dataset.key;

		if (!subInstructionFileName) throw new Error('Unknown name');

		const newValue = ele.value;

		const snapshot = this._snapshot;
		if (!snapshot) throw new Error('no snapshot');
		const clonedSnapshot = clone(snapshot);

		const subInstructions = clonedSnapshot['sub_instructions'] || {};

		clonedSnapshot['sub_instructions'] = {
			...subInstructions,
			[subInstructionFileName]: newValue
		};

		store.dispatch(editingModifySprout(clonedSnapshot));
	}

	private _handleSubInstructionRemoved(e : InputEvent) {

		const ele = eleFromEvent(e, HTMLButtonElement);

		const subInstructionFileName = ele.dataset.key;

		if (!subInstructionFileName) throw new Error('Unknown name');

		const snapshot = this._snapshot;
		if (!snapshot) throw new Error('no snapshot');
		const clonedSnapshot = clone(snapshot);

		const subInstructions = clone(clonedSnapshot['sub_instructions'] || {});

		delete subInstructions[subInstructionFileName];

		clonedSnapshot['sub_instructions'] = subInstructions;

		store.dispatch(editingModifySprout(clonedSnapshot));
	}

	override _shouldClose(dismissed : boolean) {
		this.closeDialog(dismissed);
	}

	override buttonsRender() : TemplateResult {
		return html`
		<button
			class='round'
			@click=${this.closeDialog}
			title='Cancel'
		>${CANCEL_ICON}</button>
		${this._editing ? html`<button
			class='round default'
			@click=${this.save}
			title=${this._changesMade ? 'Save changes' : 'No changes to save'}
			?disabled=${!this._changesMade}
		>${CHECK_CIRCLE_OUTLINE_ICON}</button>` : html``}
	`;
	}

}

declare global {
	interface HTMLElementTagNameMap {
		'sprout-editor': SproutEditor;
	}
}
