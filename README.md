# Purify Browser Extension

> CyberPurify is a fast and lightweight purify browser extension that effectively blocks all types of explicit content, nsfw, ads and trackers on all web pages.

- [Installation](#installation)
  - [Chrome and Chromium-based browsers](#installation-chrome)
  - [Firefox](#installation-firefox)
  - [Opera](#installation-opera)
  - [Microsoft Edge](#installation-edge)
- [Development](#dev)
  - [Requirements](#dev-requirements)
  - [How to build](#dev-build)
  - [Linter](#dev-linter)
  - [Update localizations](#dev-localizations)

<a id="installation"></a>

## Installation

<a id="installation-chrome"></a>

### Chrome and Chromium-based browsers

Comming Soon...

<a id="installation-firefox"></a>

### Firefox

Comming Soon...

<a id="installation-opera"></a>

### Opera

Comming Soon...

<a id="installation-edge"></a>

### Microsoft Edge

Comming Soon...

<a id="dev"></a>

## Development

<a id="dev-requirements"></a>

### Requirements

- [nodejs](https://nodejs.org/en/download/)
- [yarn](https://yarnpkg.com/en/docs/install/)

Install local dependencies by running:

```
  yarn install
```

<a id="dev-build"></a>

### How to build

**How to run tests**

```
  yarn test
```

**Building the dev version**

Run the following command:

```
  yarn dev
```

This will create a build directory with unpacked extensions for all browsers:

```
  build/dev/chrome
  build/dev/firefox
  build/dev/edge
```

**Building the beta and release versions**

Before building the release version, you should manually download necessary resources: filters and public suffix list.

```
  yarn resources
```

```
  CREDENTIALS_PASSWORD=<password> yarn beta
  CREDENTIALS_PASSWORD=<password> yarn release
```

You will need to put certificate.pem and mozilla_credentials.json files to the `./private` directory. This build will create unpacked extensions and then pack them (crx for Chrome, xpi for Firefox).

**Building the sample extension with API**

Run the following command:

```
yarn sample-api
```

This will create a build directory with unpacked sample extension for chromium browsers:

```
build/dev/purify-api
```

<a id="dev-linter"></a>

### Linter

Despite our code my not currently comply with new style configuration,
please, setup `eslint` in your editor to follow up with it `.eslintrc`

<a id="dev-localizations"></a>

### Update localizations

To download and append localizations run:

```
  yarn locales-download
```

To upload new phrases to crowdin you need the file with phrases `./src/_locales/en/messages.json`. Then run:

```
  yarn locales-upload
```

### Get all keys from Chrome Storage

```javascript
chrome.storage.sync.get(null, function (items) {
  var allKeys = Object.keys(items);
  console.log(allKeys);
});
```

## Minimum supported browser versions

| Browser                 |      Version      |
| ----------------------- | :---------------: |
| Chromium Based Browsers |        55         |
| Firefox                 |        52         |
| Opera                   |        42         |
| Edge                    | 15.14942/39.14942 |

## Function Predict

```txt
className1: class name prediction 1
className2: class name prediction 2
probability1: score of class name 1
probability2: score of class name 2

Strictness = 30
coefficient = 1 - (Strictness / 100);
min_cn1 = 60 (if porn = 40)
max_cn1 = 100
min_cn2 = 25 (if porn = 15)
max_cn2 = 50

if Strictness === 100
  threshold1 = min_cn1
  threshold2 = min_cn2
else
  threshold1 = coefficient * (max_cn1 - min_cn1) + min_cn1
  threshold2 = coefficient * (max_cn2 - min_cn2) + min_cn2

result1 = className1 is (Porn, Hentai, Sexy) and probability1 > threshold1 / 100
result2 = className2 is (Porn, Hentai, Sexy) and probability2 > threshold2 / 100

Example

className1: Porn
className2: Neutral
probability1: 0.7599
probability2: 0.7612

Strictness = 60
coefficient = 1 - (60 / 100) = 0.4
min_cn1 = 40
max_cn1 = 100
min_cn2 = 25
max_cn2 = 50

threshold1 = 0.4 * (100 - 40) + 40 = 64.0
threshold2 = 0.4 * (50 - 25) + 25 = 35.0

result1 = 0.7599 > 64.0 / 100 = 0.7599 > 0.64 = true (NSFW)
result2 = not is Porn, Hentai, Sexy = false (SFW)


```
