import { parentPort, workerData } from "worker_threads";
import { getWords } from "./utils.js";

type ClassifierCategoryCounts = {
    document_count: number;
    total_word_count: number;
    words: Record<string, number>;
}
type LocalCategoryMap = Record<string, ClassifierCategoryCounts>;

function computeLocalCounts(docs: string[], category: string, stopwords: Set<string>, depth: number) {
    const local: LocalCategoryMap = {};
    if (!local[category])
        local[category] = { document_count: 0, total_word_count: 0, words: {} };

    for (const doc of docs) {
        const words = getWords(doc, stopwords);

        const cat = local[category];
        cat.document_count++;

        for (let order = 0; order < depth; order++) {
            for (let i = 0; i < words.length; i++) {
                let word = words[i];

                for (let n = 1; n <= order; n++) {
                    if (!words[i + n]) break;
                    word += ` ${words[i + n]}`;
                }

                cat.words[word] = (cat.words[word] || 0) + 1;
                cat.total_word_count++;
            }
        }
    }

    return local;
}

const { docs, category, stopwords, depth } = workerData;
const result = computeLocalCounts(docs, category, new Set(stopwords), depth);
parentPort!.postMessage(result);
