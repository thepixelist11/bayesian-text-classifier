function isConsonant(word: string, i: number): boolean {
    const char = word[i];

    if ("aeiou".includes(char)) return false;
    if (char === "y") {
        if (i === 0) return true;
        else return !isConsonant(word, i - 1)
    }

    return true;
}

function stemmerMeasure(word: string, endIndex: number): number {
    let count = 0;
    let in_vowel_seq = false;

    for (let i = 0; i <= endIndex; i++) {
        if (isConsonant(word, i)) {
            if (in_vowel_seq) {
                count++;
                in_vowel_seq = false;
            }
        } else {
            in_vowel_seq = true;
        }
    }
    return count;
}

function containsVowel(word: string, end_index: number) {
    for (let i = 0; i < end_index + 1; i++) {
        if (!isConsonant(word, i)) return true;
    }

    return false;
}

function endsWith(word: string, suffix: string) {
    if (suffix.length > word.length) return false;

    return word.slice(word.length - suffix.length) === suffix;
}

function endsWithDoubleConsonant(word: string) {
    if (word.length <= 1) return false;
    return isConsonant(word, word.length - 1) && isConsonant(word, word.length - 2);
}

function endsWithCVC(word: string) {
    if (word.length < 3) return false;
    if (!isConsonant(word, word.length - 1)) return false;
    if (isConsonant(word, word.length - 2)) return false;
    if (!isConsonant(word, word.length - 3)) return false;
    return !"wxy".includes(word[word.length - 1]);
}

function replaceSuffix(word: string, old_suffix: string, new_suffix: string) {
    return word.slice(0, word.length - old_suffix.length) + new_suffix;
}

export function porterStemmer(word: string) {
    word = word.toLowerCase();

    if (endsWith(word, "sses")) word = replaceSuffix(word, "sses", "ss");
    else if (endsWith(word, "ies")) word = replaceSuffix(word, "ies", "i");
    else if (endsWith(word, "ss")) word = replaceSuffix(word, "ss", "ss");
    else if (endsWith(word, "s")) word = replaceSuffix(word, "s", "");

    if (endsWith(word, "eed")) {
        let stem = word.slice(0, word.length - 3);
        if (stemmerMeasure(stem, stem.length - 1) > 0)
            word = replaceSuffix(word, "eed", "ee");
    } else if (
        (endsWith(word, "ed") && containsVowel(word, word.length - 3)) ||
        (endsWith(word, "ing") && containsVowel(word, word.length - 4))
    ) {
        if (endsWith(word, "ed")) word = replaceSuffix(word, "ed", "")
        else word = replaceSuffix(word, "ing", "");

        if (endsWith(word, "at")) word += "e";
        else if (endsWith(word, "bl")) word += "e";
        else if (endsWith(word, "iz")) word += "e";
        else if (endsWithDoubleConsonant(word))
            word = word.slice(0, word.length - 1);
        else if (stemmerMeasure(word, word.length - 1) == 1 && endsWithCVC(word))
            word += "e";
    }

    if (endsWith(word, "y") && containsVowel(word, word.length - 2))
        word = replaceSuffix(word, "y", "i");

    const step2Rules: [string, string][] = [
        ["ational", "ate"],
        ["tional", "tion"],
        ["enci", "ence"],
        ["anci", "ance"],
        ["izer", "ize"],
        ["abli", "able"],
        ["alli", "al"],
        ["entli", "ent"],
        ["eli", "e"],
        ["ousli", "ous"],
        ["ization", "ize"],
        ["ation", "ate"],
        ["ator", "ate"],
        ["alism", "al"],
        ["iveness", "ive"],
        ["fulness", "ful"],
        ["ousness", "ous"],
        ["aliti", "al"],
        ["iviti", "ive"],
        ["biliti", "ble"],
    ];
    for (let [suffix, replacement] of step2Rules) {
        if (endsWith(word, suffix)) {
            let stem = word.slice(0, word.length - suffix.length);
            if (stemmerMeasure(stem, stem.length - 1) > 0) {
                word = replaceSuffix(word, suffix, replacement);
            }
            break;
        }
    }

    const step3Rules: [string, string][] = [
        ["icate", "ic"],
        ["ative", ""],
        ["alize", "al"],
        ["iciti", "ic"],
        ["ical", "ic"],
        ["ful", ""],
        ["ness", ""],
    ];
    for (let [suffix, replacement] of step3Rules) {
        if (endsWith(word, suffix)) {
            let stem = word.slice(0, word.length - suffix.length);
            if (stemmerMeasure(stem, stem.length - 1) > 0) {
                word = replaceSuffix(word, suffix, replacement);
            }
            break;
        }
    }

    const step4Rules: string[] = [
        "al", "ance", "ence", "er", "ic", "able", "ible", "ant",
        "ement", "ment", "ent", "ion", "ou", "ism", "ate",
        "iti", "ous", "ive", "ize"
    ];
    for (let suffix of step4Rules) {
        if (endsWith(word, suffix)) {
            let stem = word.slice(0, word.length - suffix.length);
            if (suffix === "ion") {
                if (stemmerMeasure(stem, stem.length - 1) > 1 && /[st]$/.test(stem))
                    word = replaceSuffix(word, suffix, "");
            } else if (stemmerMeasure(stem, stem.length - 1) > 1) {
                word = replaceSuffix(word, suffix, "");
            }
            break;
        }
    }

    if (endsWith(word, "e")) {
        let stem = word.slice(0, word.length - 1);
        let m = stemmerMeasure(stem, stem.length - 1);
        if (m > 1 || (m == 1 && !endsWithCVC(stem)))
            word = replaceSuffix(word, "e", "");
    }
    if (endsWithDoubleConsonant(word) && word.endsWith("l")) {
        let stem = word.slice(0, word.length - 1);
        if (stemmerMeasure(stem, stem.length - 1) > 1)
            word = stem;
    }

    return word;
}
