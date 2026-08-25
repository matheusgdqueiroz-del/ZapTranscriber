const MAX_REPEATED_BLOCK_WORDS = 12;
const MIN_REPETITIONS_TO_COLLAPSE = 3;

export function cleanTranscript(value) {
  const words = String(value || "").trim().split(/\s+/u).filter(Boolean);
  const cleaned = [];
  let cursor = 0;

  while (cursor < words.length) {
    const repetition = findRepeatedBlock(words, cursor);

    if (!repetition) {
      cleaned.push(words[cursor]);
      cursor += 1;
      continue;
    }

    const copiesToKeep = repetition.blockSize === 1 ? 2 : 1;
    cleaned.push(...words.slice(cursor, cursor + repetition.blockSize * copiesToKeep));
    cursor += repetition.blockSize * repetition.count;
  }

  return cleaned.join(" ").replace(/\s+([,.;!?])/gu, "$1").trim();
}

function findRepeatedBlock(words, start) {
  const remaining = words.length - start;
  const maxBlockSize = Math.min(
    MAX_REPEATED_BLOCK_WORDS,
    Math.floor(remaining / MIN_REPETITIONS_TO_COLLAPSE)
  );
  let best = null;

  for (let blockSize = 1; blockSize <= maxBlockSize; blockSize += 1) {
    let count = 1;

    while (
      start + (count + 1) * blockSize <= words.length &&
      blocksMatch(words, start, start + count * blockSize, blockSize)
    ) {
      count += 1;
    }

    if (count < MIN_REPETITIONS_TO_COLLAPSE) {
      continue;
    }

    const coveredWords = count * blockSize;
    if (!best || coveredWords > best.coveredWords || (coveredWords === best.coveredWords && blockSize > best.blockSize)) {
      best = { blockSize, count, coveredWords };
    }
  }

  return best;
}

function blocksMatch(words, leftStart, rightStart, length) {
  for (let offset = 0; offset < length; offset += 1) {
    if (normalizeWord(words[leftStart + offset]) !== normalizeWord(words[rightStart + offset])) {
      return false;
    }
  }

  return true;
}

function normalizeWord(word) {
  return word.toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}]+/gu, "");
}
