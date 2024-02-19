import { LitElement, html, css, TemplateResult } from 'lit';
import { connect } from 'pwa-helpers/connect-mixin.js';
import { installOfflineWatcher } from 'pwa-helpers/network.js';
import { installRouter } from 'pwa-helpers/router.js';
import { updateMetadata } from 'pwa-helpers/metadata.js';
import { installMediaQueryWatcher } from 'pwa-helpers/media-query.js';
import { classMap } from 'lit/directives/class-map.js';
import { customElement, property, state } from 'lit/decorators.js';

import { SharedStyles } from './shared-styles.js';
import { ButtonSharedStyles } from './button-shared-styles.js';

// This element is connected to the Redux store.
import { store } from '../store.js';

// These are the actions needed by this element.
import {
	navigate,
	updateMobile,
	updateOffline,
} from '../actions/app.js';

import {
	RootState
} from '../types_store.js';

import {
	SPROUT_VIEW_PATH
} from '../types.js';

import {
	selectMobile,
	selectPageExtra
} from '../selectors.js';

import {
	GITHUB_ICON,
	DISCORD_ICON
} from './my-icons.js';

@customElement('my-app')
class MyApp extends connect(store)(LitElement) {

	@property({ type : String })
		appTitle = '';

	@state()
		_page = '';

	@state()
		_pageExtra = '';

	@state()
		_offline = false;

	@state()
		_mobile = false;

	static override get styles() {
		return [
			SharedStyles,
			ButtonSharedStyles,
			css`
				:host {
					display: block;
					position: relative;
					height:100vh;
					width: 100vw;
					background-color: white;
					overflow:scroll;
					--stroke-width: 0px;

					--app-background-color: #EEE;
					--disabled-color: #CCC;
					--dark-gray-color: #666;
					--lighter-gray-color: #999;
					--app-primary-color: #51b9a3;
                    --app-secondary-color: #5e2b97;
					--app-light-text-color: white;
                    --app-warning-color: #CC0000;
					/* Also encoded as CONTROLS_WIDTH above */
					--controls-width: 18em;
					--default-border: 1px solid var(--dark-gray-color);
                    --subtle-border: 1px solid var(--disabled-color);

                    --disabled-filter: opacity(30%);

                    --fast-animation: 0.5s;
                    --slow-animation: 2s;
				}

				header {
					display: flex;
					flex-direction: column;
					align-items: center;
				}

				.toolbar-list > a {
					display: inline-block;
					color: black;
					text-decoration: none;
					padding: 0 8px;
				}

				.toolbar-list > a[selected] {
					font-weight: bold;
				}

				/* Workaround for IE11 displaying <main> as inline */
				main {
					display: block;
					font-size: 0.8em;

					position:relative;

					background-color: var(--app-background-color);

					height: 100vh;
					width: 100vw;
					display: flex;
					flex-direction: column;
					align-items: center;
				}

				.container {
					height: 100vh;
					width: 100vw;
					display: flex;
					flex-direction: column;
					align-items: center;
				}

				.page {
					display: none;
				}

				.page[active] {
					display: block;
				}

				footer {
					border-top: 1px solid #ccc;
					text-align: center;
				}

				/* Wide layout */
				@media (min-width: 460px) {
					header {
						flex-direction: row;
					}
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

				.extras {
					width: 100%;
					display: flex;
					flex-direction: row;
					justify-content: flex-end;
				}

				.extras a.button.small {
					display:inline-block;
					margin-right: 0.5em;
				}
			`
		];
	}

	override render() : TemplateResult {

		const classes = {
			container: true,
			mobile: this._mobile
		};

		return html`
			<!-- Main content -->
			<main role="main" class="main-content">
				<sprout-editor></sprout-editor>
				<api-key-dialog></api-key-dialog>
				<div class=${classMap(classes)}>
					<div class='column'>
						<div class='extras'>
								<a class='button small' href='https://github.com/jkomoros/code-sprouts' target='_blank' title='View on GitHub'>
									${GITHUB_ICON}
								</a>
								<a class='button small' href='https://discord.gg/2CMjve594M' target='_blank' title='Join the Discord'>
									${DISCORD_ICON}
								</a>
						</div>
						<sprout-view class="page" ?active="${this._page === SPROUT_VIEW_PATH}"></sprout-view>
						<my-view404 class="page" ?active="${this._page === 'view404'}"></my-view404>
					</div>
				</div>
			</main>
		`;
	}

	override firstUpdated() {
		installRouter((location) => store.dispatch(navigate(decodeURIComponent(location.pathname))));
		installOfflineWatcher((offline) => store.dispatch(updateOffline(offline)));
		installMediaQueryWatcher('(max-width: 900px)',(isMobile) => {
			store.dispatch(updateMobile(isMobile));
		});
	}

	override updated(changedProps : Map<keyof MyApp, MyApp[keyof MyApp]>) {
		if (changedProps.has('_pageExtra')) {
			const extra = this._pageExtra.endsWith('/') ? this._pageExtra.slice(0, -1) : this._pageExtra;
			const pageTitle = extra + ' - ' + this.appTitle;
			updateMetadata({
				title: pageTitle,
				description: pageTitle
				// This object also takes an image property, that points to an img src.
			});
		}
	}

	override stateChanged(state : RootState) {
		this._page = state.app.page;
		this._pageExtra = selectPageExtra(state);
		this._offline = state.app.offline;
		this._mobile = selectMobile(state);
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'my-app': MyApp;
	}
}
