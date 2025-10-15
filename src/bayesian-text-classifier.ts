import fs from "fs";
import path from "path";
import * as url from "url";
import { getWords } from "./utils.js";
import workers, { workerData } from "worker_threads";

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

export function getStopwordsFromFile(pth: string) {
    const file = fs.readFileSync(path.resolve(pth), { encoding: "utf8" }).toLowerCase();
    const stopwords = file.split(/\W+/gi);
    const stopwordSet = new Set(stopwords);
    return stopwordSet;
}

export function softmax(val: number, vals: number[]) {
    const sum = vals.reduce((prev, curr) => prev + Math.exp(curr), 0);
    return Math.exp(val) / sum;
}

export function getMostLikely(scores: { [key: string]: number }) {
    let max_val = -Infinity;
    let max_key = "";
    for (const key in scores) {
        if (scores[key] > max_val) {
            max_val = scores[key];
            max_key = key;
        }
    }

    return max_key;
}

class ClassifierCategory {
    words: { [key: string]: number } = {};
    total_word_count: number = 0;
    document_count: number = 0;
    word_likelihoods: { [word: string]: number } = {};
    prior_probability: number = 0;
};
type ClassifierCategoryMap = { [key: string]: ClassifierCategory };

type ClassifierCategoryCounts = {
    document_count: number;
    total_word_count: number;
    words: Record<string, number>;
}
type LocalCategoryMap = Record<string, ClassifierCategoryCounts>;

export class Classifier {
    private category_names: Set<string> = new Set();
    private categories: ClassifierCategoryMap = {};
    private total_document_count: number = 0;
    private vocabulary: Set<string> = new Set();
    public finalized: boolean = false;

    constructor(private stopwords: Set<string> = new Set(), private depth: number = 1, public alpha: number = 1.0) { };

    private mergeLocalCounts(local: LocalCategoryMap) {
        for (const [category, local_cat] of Object.entries(local)) {
            if (!this.categories[category]) {
                this.categories[category] = new ClassifierCategory();
                this.category_names.add(category);
            }

            const global_cat = this.categories[category];

            global_cat.document_count += local_cat.document_count;
            global_cat.total_word_count += local_cat.total_word_count;
            this.total_document_count += local_cat.document_count;

            for (const [word, count] of Object.entries(local_cat.words)) {
                global_cat.words[word] = (global_cat.words[word] || 0) + count;
                this.vocabulary.add(word);
            }
        }
    }

    trainText(doc: string, category: string) {
        this.finalized = false;

        const words = getWords(doc, this.stopwords);

        this.category_names.add(category);

        if (!this.categories[category])
            this.categories[category] = new ClassifierCategory();

        const cat = this.categories[category];

        this.total_document_count++;
        cat.document_count++;

        for (let order = 0; order < this.depth; order++) {
            for (let i = 0; i < words.length; i++) {
                let word = words[i];

                for (let n = 1; n <= order; n++) {
                    if (!words[i + n]) break;
                    word += ` ${words[i + n]}`;
                }

                this.vocabulary.add(word);

                cat.words[word] = (cat.words[word] || 0) + 1;
                cat.total_word_count++;
            }
        }
    }

    public finalizeTraining() {
        for (const cat_name of this.category_names) {
            const cat = this.categories[cat_name];
            cat.prior_probability = cat.document_count / this.total_document_count;

            for (const word in cat.words) {
                cat.word_likelihoods[word] =
                    (cat.words[word] + this.alpha) /
                    (cat.total_word_count + this.alpha * this.vocabulary.size);
            }
        }

        this.finalized = true;
    }

    trainFile(pth: string, category: string) {
        if (!fs.statSync(path.resolve(pth)).isFile())
            throw new Error(`${path.resolve(pth)} is not a file.`);

        const doc = fs.readFileSync(path.resolve(pth), { encoding: "utf8" });

        this.trainText(doc, category);
    }

    async trainDir(pth: string) {
        const is_category_dir: { [key: string]: boolean } = {};

        const categories = fs.readdirSync(pth).filter(name =>
            fs.statSync(path.join(pth, name)).isDirectory() ||
            fs.statSync(path.join(pth, name)).isFile()
        );

        for (const cat of categories) {
            is_category_dir[cat] = fs.statSync(path.join(pth, cat)).isDirectory();
        }

        const workerPromises = categories.map(cat_name => {
            const cat_path = path.join(pth, cat_name);
            let docs: string[] = [];

            if (is_category_dir[cat_name])
                docs = fs.readdirSync(cat_path)
                    .map(f => fs.readFileSync(path.join(cat_path, f), { encoding: "utf8" }));
            else
                docs = fs.readFileSync(cat_path, { encoding: "utf8" }).split("\n");

            return new Promise((res, rej) => {
                const worker = new workers.Worker(path.join(__dirname, "worker.js"), {
                    workerData: {
                        docs,
                        category: cat_name,
                        stopwords: Array.from(this.stopwords),
                        depth: this.depth,
                    }
                });

                worker.on("message", (local: any) => res(local));
                worker.on("error", rej);
                worker.on("exit", code => {
                    if (code !== 0)
                        rej(new Error(`Worker stopped with exit code ${code}`));
                });
            }) as Promise<LocalCategoryMap>;
        });

        const locals = await Promise.all(workerPromises);
        for (const local of locals)
            this.mergeLocalCounts(local);

        this.finalizeTraining();
    }

    classify(doc: string, output_fn?: ((val: number, val_arr: number[]) => number)) {
        if (!this.vocabulary.size || !this.total_document_count || !this.finalized) {
            throw new Error("Model not yet trained and finalized.");
        }

        const words = getWords(doc, this.stopwords);
        const scores: { [key: string]: number } = {};

        for (const cat_name of this.category_names) {
            const cat = this.categories[cat_name];

            scores[cat_name] = Math.log(cat.prior_probability);

            for (let order = 0; order < this.depth; order++) {
                for (let i = 0; i < words.length; i++) {
                    let likelihood: number;
                    let word = words[i];

                    for (let n = 1; n <= order; n++) {
                        if (!words[i + n]) break;
                        word += ` ${words[i + n]}`;
                    }

                    if (cat.words[word]) {
                        likelihood = cat.word_likelihoods[word];
                    } else {
                        likelihood = (this.alpha) /
                            (cat.total_word_count + this.alpha * this.vocabulary.size);
                    }

                    scores[cat_name] += Math.log(likelihood);
                }
            }
        }

        if (!output_fn)
            return scores;

        let modified_scores: { [key: string]: number } = {};
        for (const cat_name in scores) {
            modified_scores[cat_name] = output_fn(scores[cat_name], [...Object.values(scores)]);
        }

        return modified_scores;
    }
}
