'use strict';

const FOXYPROXY_BASIC = false;

// Bit-wise flags so we can add/remove these independently. We may add more later so PROTOCOL_ALL is future-proof.
const PROTOCOL_ALL = 1; // in case other protocols besides http and https are supported later
const PROTOCOL_HTTP = 2;
const PROTOCOL_HTTPS = 4;


// import | pac
const PROXY_TYPE_HTTP = 1;
const PROXY_TYPE_HTTPS = 2;
const PROXY_TYPE_SOCKS5 = 3;
const PROXY_TYPE_SOCKS4 = 4;
const PROXY_TYPE_NONE = 5; // DIRECT
const PROXY_TYPE_PAC = 6;
const PROXY_TYPE_WPAD = 7;
const PROXY_TYPE_SYSTEM = 8;
const PROXY_TYPE_PASS = 9;


const PATTERN_TYPE_WILDCARD = 1;
const PATTERN_TYPE_REGEXP = 2;



// bg | import | proxy | utils
const PATTERN_ALL_WHITE = {
  title: 'all URLs',
  active: true,
  pattern: '*',
  type: PATTERN_TYPE_WILDCARD,
  protocols: PROTOCOL_ALL
};

// patterns | proxy
// the local-internal blacklist are always used as a set
const blacklistSet = [
  {
    title: "local hostnames (usually no dots in the name). Pattern exists because 'Do not use this proxy for localhost and intranet/private IP addresses' is checked.",
    pattern: "^(?:[^:@/]+(?::[^@/]+)?@)?(?:localhost|127\\.\\d+\\.\\d+\\.\\d+)(?::\\d+)?(?:/.*)?$",
  },
  {
    title: "local subnets (IANA reserved address space). Pattern exists because 'Do not use this proxy for localhost and intranet/private IP addresses' is checked.",
    pattern: "^(?:[^:@/]+(?::[^@/]+)?@)?(?:192\\.168\\.\\d+\\.\\d+|10\\.\\d+\\.\\d+\\.\\d+|172\\.(?:1[6789]|2[0-9]|3[01])\\.\\d+\\.\\d+)(?::\\d+)?(?:/.*)?$",
  },
  {
    title: "localhost - matches the local host optionally prefixed by a user:password authentication string and optionally suffixed by a port number. The entire local subnet (127.0.0.0/8) matches. Pattern exists because 'Do not use this proxy for localhost and intranet/private IP addresses' is checked.",
    pattern: "^(?:[^:@/]+(?::[^@/]+)?@)?[\\w-]+(?::\\d+)?(?:/.*)?$"
  }
].map (item => {
  item.avtive = true;
  item.type = 2,            //PATTERN_TYPE_REGEXP,
  item.protocols = 1        // PROTOCOL_ALL  
  return item;
});



const LASTRESORT = 'k20d21508277536715';
const DEFAULT_PROXY_SETTING = {
  //id: Number.MAX_SAFE_INTEGER, // Not here so we dont save it to disk as an object property but instead as a key
  index: Number.MAX_SAFE_INTEGER,
  id: LASTRESORT,
  active: true,
  title: 'Default',
  notes: "These are the settings that are used when no patterns match a URL.",
  color: '#0055E5',
  type: PROXY_TYPE_NONE,
  whitePatterns: [PATTERN_ALL_WHITE],
  blackPatterns: []
}
