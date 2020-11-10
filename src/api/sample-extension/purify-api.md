# Purify API

**Document version: 0.9**

This document is a draft of Purify's API.

## Including Purify files into extension manifest

Here is what should be done for Purify API to work.

#### 1. Add Purify's content script to the manifest:

```
    {
      "all_frames": true,
      "js": ["purify/purify-content.js"],
      "matches": [
        "http://*/*",
        "https://*/*"
      ],
      "match_about_blank": true,
      "run_at": "document_start"
    }
```

#### 2. Add Purify's script to the background page:

```
<script type="text/javascript" src="purify/purify-api.js"></script>
```

## API methods

Purify API is exposed through a global javascript object: `purifyApi`.

### `purifyApi.start`

Initializes Purify and starts it immediately.

#### Syntax

```javascript
purifyApi.start(
  configuration, // object, mandatory
  callback // function, optional
);
```

#### Parameters

##### `configuration`

**Syntax**

```javascript
configuration = {
  filters: [],
  whitelist: [],
  blacklist: [],
  rules: [],
  filtersMetadataUrl:
    "https://filters.adtidy.org/extension/chromium/filters.json",
  filterRulesUrl:
    "https://filters.adtidy.org/extension/chromium/filters/{filter_id}.txt",
};
```

**Properties**

`filters` (mandatory)
An array of filters identifiers. You can look for possible filters identifiers in the [filters metadata file](https://filters.adtidy.org/extension/chromium/filters.json).

`whitelist` (optional)

An array of domains, for which Purify won't work.

`blacklist` (optional)

This property completely changes Purify behavior. If it is defined, Purify will work for domains from the `blacklist` only. All other domains will be ignored. If `blacklist` is defined, `whitelist` will be ignored.

`rules` (optional)

An array of custom filtering rules. Here is an [article](https://cyberpurify.com/en/filterrules.html) describing filtering rules syntax.

These custom rules might be created by a user via Purify Assistant UI.

`filtersMetadataUrl` (mandatory)

An absolute path to a file, containing filters metadata. Once started, Purify will periodically check filters updates by downloading this file.

**Example:**

```
https://filters.adtidy.org/extension/chromium/filters.json
```

`filterRulesUrl` (mandatory)

URL mask used for fetching filters rules. `{filter_id}` parameter will be replaced with an actual filter identifier.

**Example:**

```
https://filters.adtidy.org/extension/chromium/filters/{filter_id}.txt

// English filter (filter id = 2) will be loaded from:
https://filters.adtidy.org/extension/chromium/2.txt
```

> **Please note, that we do not allow using `filters.adtidy.org` other than for testing purposes**. You have to use your own server for storing filters files. You can (and actually should) to use `filters.adtidy.org` for updating files on your side periodically.

### `purifyApi.stop`

Completely stops CyberPurify.

#### Syntax

```javascript
purifyApi.stop(
  callback // function, optional
);
```

### `purifyApi.configure`

This method modifies Purify configuration. Please note, that Purify must be already started.

#### Syntax

```javascript
purifyApi.configure(
  configuration, // object, mandatory
  callback // function, optional
);
```

### `purifyApi.onRequestBlocked`

This object allows adding and removing listeners for request blocking events.

#### Syntax

```javascript
// Registers an event listener
purifyApi.onRequestBlocked.addListener(
  callback // function, mandatory
);
// Removes specified event listener
purifyApi.onRequestBlocked.removeListener(
  callback // function, mandatory
);
```

#### callback parameter properties

`tabId`
Tab identifier.

`requestUrl`
Blocked request URL.

`referrerUrl`
Referrer URL.

`rule`
Filtering rule, which has blocked this request.

`filterId`
Rule's filter identifier.

`requestType`
Request mime type. Possible values are listed below.

- `DOCUMENT` - top-level frame document.
- `SUBDOCUMENT` - document loaded in a nested frame.
- `SCRIPT`
- `STYLESHEET`
- `OBJECT`
- `IMAGE`
- `XMLHTTPREQUEST`
- `MEDIA`
- `FONT`
- `WEBSOCKET`
- `OTHER`

### `purifyApi.openAssistant`

This method opens the Purify assistant UI in the specified tab. You should also add a listener for messages with type `assistant-create-rule` for rules, which are created by the Purify assistant.

#### Syntax

```javascript
purifyApi.openAssistant(
  tabId // number, mandatory
);
```

### `purifyApi.closeAssistant`

This method closes Purify assistant in the specified tab.

#### Syntax

```javascript
purifyApi.closeAssistant(
  tabId // number, mandatory
);
```

### Examples

```javascript
// Init the configuration
var configuration = {
  // English, Social and Spyware filters
  filters: [2, 3, 4],

  // Purify is disabled on www.example.com
  whitelist: ["www.example.com"],

  // Array with custom filtering rules
  rules: ["example.org##h1"],

  // Filters metadata file path
  filtersMetadataUrl:
    "https://filters.adtidy.org/extension/chromium/filters.json",

  // Filter file mask
  filterRulesUrl:
    "https://filters.adtidy.org/extension/chromium/filters/{filter_id}.txt",
};

// Add event listener for blocked requests
var onBlocked = function (details) {
  console.log(details);
};
purifyApi.onRequestBlocked.addListener(onBlocked);

// Add event listener for rules created by Purify Assistant
chrome.runtime.onMessage.addListener(function (message) {
  if (message.type === "assistant-create-rule") {
    console.log(
      "Rule " + message.ruleText + " was created by Purify Assistant"
    );
    configuration.rules.push(message.ruleText);
    purifyApi.configure(configuration, function () {
      console.log("Finished Purify API re-configuration");
    });
  }
});

purifyApi.start(configuration, function () {
  console.log("Finished Purify API initialization.");

  // Now we want to disable Purify on www.google.com
  configuration.whitelist.push("www.google.com");
  purifyApi.configure(configuration, function () {
    console.log("Finished Purify API re-configuration");
  });
});

// Disable Purify in 1 minute
setTimeout(function () {
  purifyApi.onRequestBlocked.removeListener(onBlocked);
  purifyApi.stop(function () {
    console.log("Purify API has been disabled.");
  });
}, 60 * 1000);
```
