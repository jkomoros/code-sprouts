import { css, html, PropertyValues, TemplateResult } from 'lit';
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
	startEditing
} from '../actions/data.js';

import {
	selectCurrentSprout,
	selectEditorOpen,
	selectIsEditing,
	selectMayEditCurrentSprout
} from '../selectors.js';

import {
	Sprout
} from '../../src/sprout.js';

import {
	SproutConfig, SubInstructionsMap
} from '../../src/types.js';

import {
	TypedObject
} from '../../src/typed-object.js';

@customElement('sprout-editor')
export class SproutEditor extends connect(store)(DialogElement) {
	
	@state()
		_currentSprout : Sprout | null = null;

	@state()
		_sproutBaseInstructions : string = '';

	@state()
		_sproutSchemaText : string = '';

	@state()
		_sproutConfig : SproutConfig | null = null;

	@state()
		_sproutSubInstructions : SubInstructionsMap = {};

	@state()
		_editing = false;

	@state()
		_userMayEdit = false;

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

				textarea {
					flex: 1;
				}
			`
		];
	}

	override stateChanged(state : RootState) {
		this.open = selectEditorOpen(state);
		this._currentSprout = selectCurrentSprout(state);
		this._editing = selectIsEditing(state);
		this._userMayEdit = selectMayEditCurrentSprout(state);
	}

	private sproutChanged() {
		if (!this._currentSprout) return;
		this._sproutBaseInstructions = '';
		this._currentSprout.baseInstructions().then(baseInstructions => {
			this._sproutBaseInstructions = baseInstructions;
		});
		this._sproutSchemaText = '';
		this._currentSprout.schemaText().then(schemaText => {
			this._sproutSchemaText = schemaText;
		});
		this._sproutConfig = null;
		this._currentSprout.config().then(config => {
			this._sproutConfig = config;
		});
		this._sproutSubInstructions = {};
		this._currentSprout.subInstructions().then(subInstructions => {
			this._sproutSubInstructions = subInstructions;
		});
	}

	override updated(changedProps : PropertyValues<this>) {
		if (changedProps.has('_currentSprout') && this._currentSprout) {
			//Don't call store.dispatch things in the update.
			setTimeout(() => this.sproutChanged(), 0);
		}
	}

	closeDialog() {
		store.dispatch(closeEditor());
	}

	private rowForConfig(key : keyof SproutConfig, value : unknown) : TemplateResult {
		let control = html`<input ?disabled=${!this._editing} .value=${String(value)}></input>`;
		switch (typeof value) {
		case 'boolean':
			control = html`<input type='checkbox' ?disabled=${!this._editing} .checked=${value}></input>`;
			break;
		case 'number':
			control = html`<input type='number' ?disabled=${!this._editing} .value=${String(value)}></input>`;
			break;
		}
		return html`<li><label>${key}</label>${control}</li>`;
	}

	override innerRender() : TemplateResult {

		const sprout = this._currentSprout;

		if (!sprout) return html`No sprout.`;

		return html`
			<h2>${sprout.name}
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
			<label>Config</label>
			<div>
				${this._sproutConfig
		? html`<ul>${TypedObject.entries(this._sproutConfig).map(([key, value]) => this.rowForConfig(key, value))}</ul>`
		: html`<em>No config</em>`}
			</div>
			<label>Instructions</label>
			<textarea
				?disabled=${!this._editing}
				.value=${this._sproutBaseInstructions}
			></textarea>
			<label>Schema</label>
			<textarea
				?disabled=${!this._editing}
				.value=${this._sproutSchemaText || ''}
			></textarea>
			<label>Sub-instructions</label>
			${Object.keys(this._sproutSubInstructions).length > 0 ? 
		Object.entries(this._sproutSubInstructions).map(([key, value]) => html`
			<details>
				<summary><label>${key}</label></summary>
				<textarea
					?disabled=${!this._editing}
					.value=${value.instructions}
				></textarea>
			</details>
		`) :
		html`<em>No sub-instructions</em>`}
		`;
	}

	private _handleEditingClicked() {
		if (!this._editing) store.dispatch(startEditing());
	}

	override _shouldClose(_cancelled : boolean) {
		this.closeDialog();
	}

	override buttonsRender() : TemplateResult {
		return html`
		<button class='round default' @click=${this.closeDialog}>${CHECK_CIRCLE_OUTLINE_ICON}</button>
	`;
	}

}

declare global {
	interface HTMLElementTagNameMap {
		'sprout-editor': SproutEditor;
	}
}
