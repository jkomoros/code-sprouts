import { css, html, TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';

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
	CHECK_CIRCLE_OUTLINE_ICON
} from './my-icons.js';

import {
	SharedStyles
} from './shared-styles.js';

import {
	ButtonSharedStyles
} from './button-shared-styles.js';

import {
	setEditorOpen
} from '../actions/data.js';

import {
	selectEditorOpen
} from '../selectors.js';

@customElement('sprout-editor')
export class SproutEditor extends connect(store)(DialogElement) {
	
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
	}

	closeDialog() {
		store.dispatch(setEditorOpen(false));
	}

	override innerRender() : TemplateResult {

		return html`TODO: implement`;
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
