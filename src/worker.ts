import { parentPort, workerData } from "worker_threads";
import { getWords } from "./utils.js";

type ClassifierCategoryCounts = {
    document_count: number;
    total_word_count: number;
    words: Record<string, number>;
}
type LocalCategoryMap = Record<string, ClassifierCategoryCounts>;

function computeLocalCounts(docs: string[], category: string, stopwords: Set<string>) {
    const local: LocalCategoryMap = {};
    if (!local[category])
        local[category] = { document_count: 0, total_word_count: 0, words: {} };

    for (const doc of docs) {
        const words = getWords(doc, stopwords);
        const cat = local[category];
        cat.document_count++;
        for (const word of words) {
            cat.words[word] = (cat.words[word] || 0) + 1;
            cat.total_word_count++;
        }
    }

    return local;
}

const { docs, category, stopwords } = workerData;
const result = computeLocalCounts(docs, category, new Set(stopwords));
parentPort!.postMessage(result);
