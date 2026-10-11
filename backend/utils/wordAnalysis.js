// utils/wordAnalysis.js - shared word/phrase-frequency engine used by
// routes/wordAnalysis.js for both "your own reviews" and "rival vendor" /
// "pasted external reviews" complaint mining.
//
// Deliberately simple (no NLP dependency): lowercase -> strip punctuation ->
// drop stopwords -> count single words and word-pairs, keeping one example
// sentence per phrase so the vendor can see the complaint in context, e.g.
// "battery life" (4) - "battery life dies in an hour".

const STOPWORDS = new Set([
  // English function words
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'was', 'were', 'are', 'be',
  'been', 'being', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'about',
  'as', 'by', 'this', 'that', 'these', 'those', 'it', 'its', 'i', 'my',
  'me', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'their',
  'not', 'no', 'so', 'very', 'too', 'just', 'than', 'then', 'if', 'when',
  'from', 'up', 'out', 'do', 'does', 'did', 'have', 'has', 'had', 'will',
  'would', 'can', 'could', 'should', 'get', 'got', 'also', 'even', 'much',
  'more', 'most', 'all', 'some', 'any', 'there', 'here', 'what', 'which',
  'who', 'how', 'because', 'after', 'before', 'again', 'am', 'was',
  // common review filler that carries no complaint signal by itself
  'product', 'item', 'order', 'ordered', 'received', 'delivery', 'delivered',
  'one', 'star', 'stars', 'review', 'reviews', 'really', 'overall',
  // common Hinglish/transliterated filler seen in Indian marketplace reviews
  'hai', 'ho', 'nahi', 'nahin', 'bahut', 'bhi', 'kya', 'ka', 'ki', 'ke',
  'se', 'yeh', 'woh', 'aur', 'to', 'thi', 'tha', 'the',
]);

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * @param {string[]} comments - raw review comment strings (any rating band)
 * @param {number} topN - how many phrases/words to return
 * @returns {{ reviewsAnalyzed: number, topPhrases: {phrase:string,count:number,example:string}[], topWords: {word:string,count:number,example:string}[] }}
 */
function analyzeComments(comments, topN = 10) {
  const cleaned = comments.map((c) => (c || '').trim()).filter((c) => c.length > 0);

  const unigramCounts = new Map();
  const unigramSample = new Map();
  const bigramCounts = new Map();
  const bigramSample = new Map();

  for (const comment of cleaned) {
    const tokens = tokenize(comment).filter((t) => !STOPWORDS.has(t) && t.length > 2);

    tokens.forEach((t) => {
      unigramCounts.set(t, (unigramCounts.get(t) || 0) + 1);
      if (!unigramSample.has(t)) unigramSample.set(t, comment);
    });

    for (let i = 0; i < tokens.length - 1; i++) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      bigramCounts.set(bigram, (bigramCounts.get(bigram) || 0) + 1);
      if (!bigramSample.has(bigram)) bigramSample.set(bigram, comment);
    }
  }

  // Phrases (bigrams) are the headline result - "battery life", "zipper
  // broke" reads far better than two separate words - but only surface ones
  // mentioned by more than one reviewer, otherwise it's noise from a single
  // sentence.
  const topPhrases = [...bigramCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([phrase, count]) => ({ phrase, count, example: bigramSample.get(phrase) }));

  const topWords = [...unigramCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count, example: unigramSample.get(word) }));

  return { reviewsAnalyzed: cleaned.length, topPhrases, topWords };
}

module.exports = { analyzeComments, tokenize };
