import * as toxicity from '@tensorflow-models/toxicity';

class ToxicClassifier {
    constructor() {
        this.load();
    }

    /**
     * * Load Toxicity Classifier
     */
    async load() {
        console.log('Loading ToxicClassifier...');
        // The minimum prediction confidence.
        const threshold = 0.9;

        // Load the model.
        // Users optionally pass in a threshold and an array of labels to include.
        this.modelToxic = await toxicity.load(threshold);
        this.labelsToxic = this.modelToxic.model.outputNodes.map(d => d.split('/')[0]);
    }

    /**
     *
     * @param {*} callback
     * @param {[]|object} inputs {id_node, text}
     * @returns
     */
    async classify(callback, inputs) {
        if (!this.modelToxic) {
            console.log('Waiting for model to load...');
            setTimeout(() => { this.classify(callback, inputs) }, 5000);
            return;
        }

        const input_predictions = inputs.map(d => d.text);
        const results = await this.modelToxic.classify(input_predictions);

        callback({
            action: 'toxicity_predicted',
            predicted: inputs.map((data, index) => {
                results.forEach((classification) => {
                    data[classification.label] = classification.results[index].match;
                });
                return data;
            })
        });
    };

    /**
     *
     * @param {*} callback
     * @param {[]|object} inputs {id_node, text}
     * @returns
     */
    async predicting(callback, inputs) {
        await Promise.all(inputs.map(async(node, k) => {
            let sentences = node.text.split('. ').filter(Boolean);
            const result_sentences = await this.modelToxic.classify(sentences);

            return await Promise.all(sentences.map(async(data, index) => {
                let replace_flag = false;
                for (let i = 0; i < result_sentences.length; i++) {
                    const classification = result_sentences[i];
                    if (classification.results[index].match === true) {
                        data = await this.replaceHateSpeech(sentences[index]);
                        replace_flag = classification.results[index].match;
                        break;
                    }
                }
                return { text: data, replace_flag };
            }));

        })).then((processed) => {
            return callback({
                action: 'toxicity_predicted',
                predicted: inputs.map((n, k) => {
                    n.text = processed[k].map(n => n.text).join(". ");
                    for (let i = 0; i < processed[k].length; i++) {
                        n.replace_flag = processed[k][i].replace_flag;
                        if (n.replace_flag === true) {
                            break;
                        }
                    }
                    return n;
                })
            });
        });
    }

    /**
     * * replace text UpperCase and non-uppercase
     * * replace multi text
     * * convert length text to number length *
     * @param {*} textnode
     * @param {string} choose
     * @returns {string}
     */
    async replaceHateSpeech(textnode, choose = 'text') {
        return new Promise((resolve, reject) => {
            let text_replace = '',
                character = '*';
            switch (choose) {
                case 'text':
                    for (let i = 0; i < textnode.length; i++) {
                        if (textnode[i] !== ' ') {
                            text_replace += character;
                        } else {
                            text_replace += ' ';
                        }
                    }
                    break;
            }
            return resolve(text_replace);
        });
    }
}

export const toxicClassifier = new ToxicClassifier();