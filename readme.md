# Multithreaded Naive Bayesian Text Classifier

This project provides a **multithreaded Naive Bayesian text classification**
library written in **TypeScript** for NodeJS. It is designed for efficient
supervised learning and probabilistic classification of textual data into
predefined categories. The classifier supports **parallelized directory
training** via Node’s `worker_threads`, enabling significant performance
gains on multicore systems.

---

## Features

- **Naive Bayes text classification** with Laplace (add-one) smoothing
- **Multithreaded training** (`trainDirParallel`) for improved scalability
- **Support for arbitrary categories** and document-based datasets
- **Automatic vocabulary management**
- **Stopword filtering** from file
- **Softmax scoring** and maximum likelihood classification utilities
- **Synchronous and asynchronous training modes**
- **Simple API** suitable for classification of natural language documents

---

## Installation

Clone or copy the module into your NodeJS project:

```bash
git clone https://github.com/thepixelist11/bayesian-text-classifier.git
cd bayesian-text-classifier
npm install
```

Ensure that your NodeJS version supports ES modules and `worker_threads` (Node ≥ 16 recommended).

---

## Basic Usage

Below is an example of how the classifier may be used in a NodeJS environment
to classify categories and star ratings for Amazon reviews:

```typescript
import path from "path";
import url from "url";
import * as btc from "./bayesian-text-classifier.js";

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const main = async () => {
    const stopwords = btc.getStopwordsFromFile(path.join(__dirname, "english-stopwords"));
    const classifier_stars = new btc.Classifier(stopwords);
    const classifier_category = new btc.Classifier(stopwords);

    await classifier_stars.trainDirParallel(path.join(__dirname, "../data/amazon-reviews-stars"));
    await classifier_category.trainDirParallel(path.join(__dirname, "../data/amazon-reviews-category"));

    const reviews = [
        "These eyelashes do the job for the price...",
        "They burned my feet, but they did keep them warm...",
        "It was too small to fit any paper and the ink was purple..."
    ];

    for (const text of reviews) {
        const stars_scores = classifier_stars.classify(text, btc.softmax);
        const category_scores = classifier_category.classify(text, btc.softmax);

        console.log(`${text}: ${btc.getMostLikely(stars_scores)} stars, ${btc.getMostLikely(category_scores)}`);
    }
};

main();
```

This example requires directories `data/amazon-reviews-stars` and
`data/amazon-reviews-category` containing data in the format below.

---

## Data Format

Each category used for training must correspond to either:

1. A **directory** containing one or more text documents.
The structure should resemble the following:

```text
data/
 ├── amazon-reviews-stars/
 │    ├── 1/
 │    │   ├── review1.txt
 │    │   └── review2.txt
 │    ├── 2/
 │    ├── 3/
 │    ├── 4/
 │    └── 5/
 └── amazon-reviews-category/
      ├── electronics/
      ├── beauty/
      └── home/
```

Each subdirectory name represents a **category label**. The classifier will
read all files within each category during training.

2. A **file** containing one document per line.
The structure should resemble the following:

```text
data/
 ├── amazon-reviews-stars/
 │    ├── 1.txt
 │    ├── 2.txt
 │    ├── 3.txt
 │    ├── 4.txt
 │    └── 5.txt
 └── amazon-reviews-category/
      ├── electronics.txt
      ├── beauty.txt
      └── home.txt
```

Each file name represents a **category label**.
The classifier will read all lines within each category during training.

Typically, for short documents (like Amazon reviews), using the file-based
approach can be ideal. For large documents, the directory approach can be
better. Note that for very large datasets, using a file for each document may
cause issues (see inodes for Linux).

---

## API Reference

### `getStopwordsFromFile(path: string): Set<string>`

Reads a file containing stopwords (one or more per line, separated by non-word characters) and returns a `Set` of stopwords.

---

### `softmax(value: number, values: number[]): number`

Computes the softmax transformation of a log-probability value given the entire score set.
Useful for converting log-likelihoods into normalized probabilities.

---

### `getMostLikely(scores: Record<string, number>): string`

Returns the label corresponding to the highest score in a given score map.

---

### `new Classifier(stopwords?: Set<string>)`

Constructs a new Naive Bayesian classifier instance.
The optional `stopwords` set is used to exclude frequent, non-informative terms.

---

### `Classifier.trainText(document: string, category: string): void`

Trains the classifier on a single text sample associated with the specified category.

---

### `Classifier.trainFile(path: string, category: string): void`

Trains the classifier on the contents of a single file under a given category.

---

### `Classifier.trainDir(path: string): Promise<void>`

Trains the classifier in **parallel** using worker threads.
Each category (or file) is processed by a separate worker thread to accelerate training.

---

### `Classifier.classify(document: string, outputFn?: (val: number, vals: number[]) => number): Record<string, number>`

Computes the log-probability (or transformed probability) for each category given the input document.  
If `outputFn` (e.g., `softmax`) is provided, the results are transformed accordingly.

---

### `Classifier.finalizeTraining(): void`

Computes prior and likelihood probabilities based on accumulated word and document counts.
This method is automatically invoked after `trainDir()` or
`trainDirParallel()`. It must be called before attempting classification.

---

## Implementation Notes

- Uses **Laplace smoothing** (α = 1.0) to prevent zero-probability words.
- Maintains an explicit vocabulary to ensure consistent probability computation.
- Stopwords are ignored during tokenization to improve classification accuracy.
- The classifier expects **UTF-8 encoded** text files. Support for additional formats will be implemented in the future.

---

## Example Stopword File

```
the
a
an
and
or
in
on
with
at
of
to
for
```

---

## License

This project is licensed under the **MIT License**.
You may freely use, modify, and distribute this software with proper attribution.
