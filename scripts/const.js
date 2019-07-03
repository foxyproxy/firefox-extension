const FOXYPROXY_BASIC=false;

// Bit-wise flags so we can add/remove these independently. We may add more later so PROTOCOL_ALL is future-proof.
const PROTOCOL_ALL = 1; // in case other protocols besides http and https are supported later
const PROTOCOL_HTTP = 2;
const PROTOCOL_HTTPS = 4;

const DEFAULT_COLOR = "#66cc66";

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

const PATTERN_WHITE = 1;
const PATTERN_BLACK =2;

const PATTERNS = "patterns";
const USE_PROXY_FOR_ALL_URLS = 2;
const RANDOM = "random";
const ROUND_ROBIN = "roundrobin";
const DISABLED = "disabled";

const PATTERN_NEW = {
  title: "",
  active: true,
  pattern: "",
  type: PATTERN_TYPE_WILDCARD,
  protocols: PROTOCOL_ALL
};

const PATTERN_ALL_WHITE = {
  title: "all URLs",
  active: true,
  pattern: "*",
  type: PATTERN_TYPE_WILDCARD,
  protocols: PROTOCOL_ALL
};

const PATTERN_LOCALHOSTURLS_BLACK = {
    title: "local hostnames (usually no dots in the name). Pattern exists because 'Do not use this proxy for localhost and intranet/private IP addresses' is checked.",
    active: true,
    pattern: "^(?:[^:@/]+(?::[^@/]+)?@)?(?:localhost|127\\.\\d+\\.\\d+\\.\\d+)(?::\\d+)?(?:/.*)?$",
    type: PATTERN_TYPE_REGEXP,
    protocols: PROTOCOL_ALL
};

const PATTERN_INTERNALIPS_BLACK = {
  title: "local subnets (IANA reserved address space). Pattern exists because 'Do not use this proxy for localhost and intranet/private IP addresses' is checked.",
  active: true,
  pattern: "^(?:[^:@/]+(?::[^@/]+)?@)?(?:192\\.168\\.\\d+\\.\\d+|10\\.\\d+\\.\\d+\\.\\d+|172\\.(?:1[6789]|2[0-9]|3[01])\\.\\d+\\.\\d+)(?::\\d+)?(?:/.*)?$",
  type: PATTERN_TYPE_REGEXP,
  protocols: PROTOCOL_ALL
};

const PATTERN_LOCALHOSTNAMES_BLACK = {
  title: "localhost - matches the local host optionally prefixed by a user:password authentication string and optionally suffixed by a port number. The entire local subnet (127.0.0.0/8) matches. Pattern exists because 'Do not use this proxy for localhost and intranet/private IP addresses' is checked.",
  active: true,
  pattern: "^(?:[^:@/]+(?::[^@/]+)?@)?[\\w-]+(?::\\d+)?(?:/.*)?$",
  type: PATTERN_TYPE_REGEXP,
  protocols: PROTOCOL_ALL
};

const LASTRESORT = "k20d21508277536715";
const DEFAULT_PROXY_SETTING = {
  //id: Number.MAX_SAFE_INTEGER, // Not here so we dont save it to disk as an object property but instead as a key
  index: Number.MAX_SAFE_INTEGER,
  id: LASTRESORT,
  active: true,
  title: "Default",
  notes: "These are the settings that are used when no patterns match a URL.",
  color: "#0055E5",
  type: PROXY_TYPE_NONE,
  whitePatterns: [PATTERN_ALL_WHITE],
  blackPatterns: []
}

// Run-time generated properties of pattern objects:
// .regExp (result of new RegExp(pattern)) -- only present when type == PATTERN_TYPE_REGEXP

const MESSAGE_TYPE_CONSOLE = 1;
const MESSAGE_TYPE_LOG = 2;
const MESSAGE_TYPE_DELETING_ALL_SETTINGS = 3;
const MESSAGE_TYPE_DISABLED = 4;
