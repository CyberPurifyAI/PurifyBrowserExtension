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
}

export const toxicClassifier = new ToxicClassifier();