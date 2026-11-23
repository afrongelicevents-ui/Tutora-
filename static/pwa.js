// Tutora as an installed app: registers the service worker (production only) and runs the
// "Install Tutora" card and menu item. Plain script, about 2 KB, so pages that otherwise
// load no JavaScript stay light. The markup is rendered by the server (InstallCard.svelte,
// InstallItem.svelte) and starts hidden; this only shows what this phone can do.
(function () {
	'use strict';
	var me = document.currentScript;
	if (me && me.dataset.sw === '1' && 'serviceWorker' in navigator) {
		addEventListener('load', function () {
			navigator.serviceWorker.register('/service-worker.js').catch(function () {});
		});
	}

	var KEY = 'tutora-install-dismissed';
	var prompt = null;
	var standalone =
		matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
	var ua = navigator.userAgent;
	var ios =
		/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

	function seen() {
		try {
			return localStorage.getItem(KEY) === '1';
		} catch {
			return false;
		}
	}
	function remember() {
		try {
			localStorage.setItem(KEY, '1');
		} catch {
			/* private mode: the card may show again, that's all */
		}
	}
	function all(sel) {
		return Array.prototype.slice.call(document.querySelectorAll(sel));
	}
	function show(el, on) {
		if (el) el.hidden = !on;
	}

	function update() {
		var can = !standalone && (prompt !== null || ios);
		// the card on the home page: once, then never again on this phone
		all('[data-install-card]').forEach(function (card) {
			if (can && !seen()) {
				show(card, true);
				remember();
			} else if (!can) show(card, false);
		});
		// the item in the account menu: always there until the app is installed
		all('[data-install-item]').forEach(function (item) {
			show(item, !standalone);
			show(item.querySelector('[data-install-btn]'), can);
			show(item.querySelector('[data-install-help]'), !can);
		});
	}

	function install() {
		if (prompt) {
			var p = prompt;
			prompt = null;
			p.prompt();
			p.userChoice
				.then(function (c) {
					if (c && c.outcome === 'accepted') {
						standalone = true;
						remember();
					}
					update();
				})
				.catch(update);
		} else if (ios) {
			var sheet = document.querySelector('[data-install-ios]');
			if (sheet && sheet.showModal) sheet.showModal();
		}
	}

	addEventListener('beforeinstallprompt', function (e) {
		e.preventDefault();
		prompt = e;
		update();
	});
	addEventListener('appinstalled', function () {
		standalone = true;
		prompt = null;
		remember();
		update();
	});
	document.addEventListener('click', function (e) {
		var t = e.target instanceof Element ? e.target : null;
		if (!t) return;
		if (t.closest('[data-install-btn]')) {
			e.preventDefault();
			install();
		} else if (t.closest('[data-install-close]')) {
			e.preventDefault();
			remember();
			all('[data-install-card]').forEach(function (c) {
				show(c, false);
			});
		} else if (t.closest('[data-install-ios-close]')) {
			var d = t.closest('dialog');
			if (d) d.close();
		}
	});
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update);
	else update();
})();
