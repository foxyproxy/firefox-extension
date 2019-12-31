'use strict';

// ----------------- Internationalization ------------------
document.querySelectorAll('[data-i18n]').forEach(node => {
  let [text, attr] = node.dataset.i18n.split('|');
  text = chrome.i18n.getMessage(text);
  attr ? node[attr] = text : node.appendChild(document.createTextNode(text));
});
// ----------------- /Internationalization -----------------


// ----------------- Spinner -------------------------------
const spinner = document.querySelector('.spinner');
function hideSpinner() {

  spinner.classList.remove('on');
  setTimeout(() => { spinner.style.display = 'none'; }, 600);
}

function showSpinner() {

  spinner.style.display = 'flex';
  spinner.classList.add('on');
}
// ----------------- /spinner ------------------------------
hideSpinner();

// addEventListener for all buttons & handle together
document.querySelectorAll('button').forEach(item => item.addEventListener('click', process));

function process(e) {
  switch (this.id || this.dataset.i18n) {
    case 'back': location.href = '/options.html'; break;
    case 'import': importList(); break;
  }
}

function importList() {
  
}
