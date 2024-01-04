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
import { clone } from '../../src/util.js';

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
		//TODO: actually save.
		store.dispatch(closeEditor(false));
	}

	private rowForConfig(key : keyof SproutConfig, value : unknown) : TemplateResult {
		let control = html`<input type='text' ?disabled=${!this._editing} .value=${String(value)}></input>`;
		switch (typeof value) {
		case 'boolean':
			control = html`<input type='checkbox' ?disabled=${!this._editing} .checked=${value}></input>`;
			break;
		case 'number':
			control = html`<input type='number' ?disabled=${!this._editing} .value=${String(value)}></input>`;
			break;
		}
		return html`<div class='row indented'><label>${key}</label>${control}</div>`;
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
			<label>Config ${help('Various configuratino properties for the sprout')}</label>
			<div>
				${config
		? html`${TypedObject.entries(config).map(([key, value]) => this.rowForConfig(key, value))}`
		: html`<em>No config</em>`}
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
			@click=${() => this.save}
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
