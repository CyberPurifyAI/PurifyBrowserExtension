/**
 * ----------------------------------------------------------------------------------
 * PurifyBrowserExtension purify-hatespeech.js
 * Licensed under MIT (https://github.com/CyberPurify/CyberPurify/blob/main/LICENSE)
 * ----------------------------------------------------------------------------------
 */

/**
 * purify Hate speech
 */

purify.hateSpeech = (function(purify) {

    const HATESPEECH_MODEL_URL = purify.getURL("models/hatespeech/model.json");
    const HATESPEECH_MODEL_PROP = "hate-speech-model";

    const init = function() {
        purify.console.info("Initializing Hate Speech");
        initHateSpeechModel();
    };

    /*
     * Loads model hate speech
     */
    const initHateSpeechModel = () =>
        new Promise((resolve, reject) => {

            const success = function(response) {
                if (response && response.responseText) {
                    // purify.console.info("HATESPEECH_MODEL_URL --> " + response.responseText);

                    const responseHateSpeechs = response.responseText;

                    if (getHateSpeechFromLocalStorage(HATESPEECH_MODEL_PROP).length > 0) {
                        purify.localStorage.removeItem(HATESPEECH_MODEL_PROP);
                    }

                    purify.localStorage.setItem(
                        HATESPEECH_MODEL_PROP,
                        responseHateSpeechs
                        // JSON.stringify(responseHateSpeechs)
                    );

                    resolve(responseHateSpeechs);
                } else {
                    reject(createError("empty response", HATESPEECH_MODEL_URL, response));
                }
            };

            const error = (request, ex) => {
                const exMessage =
                    (ex && ex.message) || "couldn't load local filters blacklist";
                reject(purify.backend.createError(exMessage, HATESPEECH_MODEL_URL, request));
            };

            purify.backend.executeRequestAsync(HATESPEECH_MODEL_URL, "application/json", success, error);
        });

    const regexModelHateSpeech = (lang = 'en') => {
        let hateSpeechModel = getHateSpeechFromLocalStorage(HATESPEECH_MODEL_PROP);
        return hateSpeechModel[lang];
        // return /Instagram|facebook|company|network|api|data|design/gi;
    }

    /**
     * Retrieve hatespeechs from local storage
     * @param prop
     * @returns {Array}
     */
    function getHateSpeechFromLocalStorage(prop) {
        var hatespeechs = [];
        try {
            var json = purify.localStorage.getItem(prop);
            if (json) {
                hatespeechs = JSON.parse(json);
            }
        } catch (ex) {
            purify.console.error(
                "Error retrieve whitelist hatespeechs {0}, cause {1}",
                prop,
                ex
            );
        }
        return hatespeechs;
    }

    return {
        init,
        regexModelHateSpeech
        // nativeSelectorText,
        // replaceHateSpeech
    };
})(purify);