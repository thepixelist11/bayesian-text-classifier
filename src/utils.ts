export function getWords(text: string, stopwords: Set<string> = new Set()) {
    return text.toLowerCase()
        .split(/\W+/g)
        .filter(word => word.length > 0 && !stopwords.has(word));
}

