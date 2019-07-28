'use strict';

// ----------------- Internationalization ------------------
document.querySelectorAll('[data-i18n]').forEach(node => {
  let [text, attr] = node.dataset.i18n.split('|');
  text = chrome.i18n.getMessage(text);
  attr ? node[attr] = text : node.appendChild(document.createTextNode(text));
});
// ----------------- /Internationalization -----------------

const manifest = chrome.runtime.getManifest();

document.querySelector('#version').textContent = manifest.version;
document.querySelector('#edition').textContent = FOXYPROXY_BASIC ? 'FoxyProxy Basic' : 'FoxyProxy Standard';
document.querySelector('button').addEventListener('click', () => location.href = '/options.html');


// --- welcome on install/update
location.search === '?welcome' && document.querySelector('.welcome').classList.remove('hide');
