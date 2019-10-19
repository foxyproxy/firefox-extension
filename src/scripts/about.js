'use strict';

// ----------------- Internationalization ------------------
document.querySelectorAll('[data-i18n]').forEach(node => {
  let [text, attr] = node.dataset.i18n.split('|');
  text = chrome.i18n.getMessage(text);
  attr ? node[attr] = text : node.appendChild(document.createTextNode(text));
});
// ----------------- /Internationalization -----------------

document.addEventListener('keyup', evt => {
  if (evt.keyCode === 27) {
    location.href = '/options.html';
  }
});

const manifest = chrome.runtime.getManifest();
document.querySelector('#version').textContent = manifest.version;
document.querySelector('#edition').textContent = 'FoxyProxy ' + (FOXYPROXY_BASIC ? 'Basic' : 'Standard');
document.querySelector('button').addEventListener('click', () => location.href = '/options.html');

// --- remove nodes completely for FP Basic
FOXYPROXY_BASIC && document.querySelectorAll('.notForBasic').forEach(item => item.remove());

// --- welcome on install/update
location.search === '?welcome' && document.querySelector('.welcome').classList.remove('hide');
