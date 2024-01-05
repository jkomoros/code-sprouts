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
	EDIT_ICON
} from './my-icons.js';

import {
	SharedStyles
} from './shared-styles.js';

import {
	ButtonSharedStyles
} from './button-shared-styles.js';

import {
	closeEditor,
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
	selectSproutSnapshot
} from '../selectors.js';

import {
	SproutConfig,
	sproutConfigSchema,
	SproutName,
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

const HIDDEN_CONFIG_FIELDS : Partial<Record<keyof SproutConfig, true>> = {
	version: true
};

//TODO: calculate this automatically based on sproutConfigSchema meta-programming
const REQUIRED_CONFIG_FIELDS : Partial<Record<keyof SproutConfig, true>> = {
	version: true
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

				textarea {
					flex: 1;
				}

				.row {
					display: flex;
					flex-direction: column;
					position: relative;
				}

				.row input[type=text] {
					width: 100%;
				}

				.indented {
					margin-left: 2em;
				}
			`
		];
	}

	override stateChanged(state : RootState) {
		this.open = selectEditorOpen(state);
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
			if (HIDDEN_CONFIG_FIELDS[key]) {
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
				${missingKeys.map(key => html`<option .value=${key}>${key}</option>`)}
			</select>`;
	}

	private rowForConfig(key : keyof SproutConfig, value : unknown) : TemplateResult {
		if (HIDDEN_CONFIG_FIELDS[key]) return html``;
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
		const removeButton = REQUIRED_CONFIG_FIELDS[key] || !this._editing ? html`` : html`
		<button
			class='small'
			title=${`Remove ${key}`}
			data-key=${key}
			@click=${this._handleConfigControlRemoved}
		>${CANCEL_ICON}</button>
		`;
		return html`<div class='row indented'><label>${key}</label>${control}${removeButton}</div>`;
	}

	override innerRender() : TemplateResult {

		const snapshot = this._snapshot;

		if (!snapshot) return html`No sprout.`;

		const config = sproutConfigSchema.parse(JSON.parse(snapshot['sprout.json']));
		const subInstructions = snapshot['sub_instructions'] || {};

		return html`
			<h2>${this._currentSproutName || 'Unnamed Sprout'}
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
				.value=${snapshot['schema.ts'] || ''}
			></textarea>
			<label>Sub-instructions ${help('Deeper instructions for specific actions that the bot can ask about.')}</label>
			${Object.keys(subInstructions).length > 0 ? 
		Object.entries(subInstructions).map(([key, value]) => html`
			<details>
				<summary><label>${key}</label></summary>
				<textarea
					?disabled=${!this._editing}
					.value=${value}
				></textarea>
			</details>
		`) :
		html`<em>No sub-instructions</em>`}
		`;
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
		case 'version':
			throw new Error('version may not be added');
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
		let ele : HTMLButtonElement | null =  null;
		for (const candidate of e.composedPath()) {
			if (candidate instanceof HTMLButtonElement) {
				ele = candidate;
				break;
			}
		}

		if (!ele) throw new Error('No button ele found');

		const key = sproutConfigSchema.keyof().parse(ele.dataset.key);

		const snapshot = this._snapshot;
		if (!snapshot) throw new Error('no snapshot');
		const clonedSnapshot = clone(snapshot);

		const config = sproutConfigSchema.parse(JSON.parse(clonedSnapshot['sprout.json']));

		if (REQUIRED_CONFIG_FIELDS[key]) throw new Error(`Can't remove ${key} because it's required`);

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
		case 'version':
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
