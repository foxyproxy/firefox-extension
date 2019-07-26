/*
A rework of getAllSettings() & usingSync()
there is a small (255) speed improvemet due to redeced bumebr of Promises (can become more if brwoser is doing a lot of things)
the logic has been reworked and simplified

I will add the code to handle getProxySettingById(id) within the same function


// currently ........
// usingSync()
1- new Promise
2- _initializeStorage()
  3.1 new Promise
  3.2 browser.storage.local.get()

// getAllSettings()
1- new Promise
2- _getAllSettingsNative()
3- _initializeStorage()
  3.1 new Promise
  3.2 browser.storage.local.get()
4- storage.get()

*/


/* --- experimental ---- */
// using chrome compatible code
// no need for usingSync()
// check for sync
chrome.storage.local.get(null, result => {
  // sync is NOT set or it is false, use this result
  if (!result.sync) { 
    prepareSettings(result);
    syncOnOff.checked = false;
    return;
  }
  // sync is set
  syncOnOff.checked = true;
  chrome.storage.sync.get(null, result => prepareSettings(result));
});


function prepareSettings(settings) {

  //if (settings && !settings.mode) { }// 5.0 settings
  
  let lastResortFound = false;
  const keys = Object.keys(settings);
  
  const def = {
    id: LASTRESORT,
    active: true,
    title: 'Default',
    notes: 'These are the settings that are used when no patterns match a URL.',
    color: '#0055E5',
    type: PROXY_TYPE_NONE,
    whitePatterns: [PATTERN_ALL_WHITE],
    blackPatterns: []
  };

  // base format
  const ret = {
    mode: 'disabled',
    proxySettings: [],
    logging: {
      size: 500,
      active: true
    }    
  };
  

  if (!keys.length) { // settings is {} // storage.js note ....  if (!settings) { // unreliable !{} is false
    ret.proxySettings = [def];
    return ret;
  }

  keys.forEach(key => {
  
    switch (key) {
    
      case MODE:
      case LOGGING:
        ret[key] = settings[key];
        break;
        
      case SYNC: break; // do nothing
    
      default:
        const temp = settings[key];
        temp.id = key; // Copy the id into the object because we are not using it as a key in the array
        delete temp.index; // Re-calculated when/if this object is written to disk again (user may move proxySetting up/down)
        temp.id === LASTRESORT && (lastResortFound = true);
        ret.proxySettings.push(temp);
    }
  });

  ret.proxySettings.sort((a, b) => a.index - b.index);

  !lastResortFound && ret.proxySettings.push(def); // add default lastresort

  return ret;
}
