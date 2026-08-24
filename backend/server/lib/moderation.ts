export type ModerationResult = {
  allowed: boolean;
  category?: 'profanity' | 'threat' | 'sexual' | 'abuse' | 'length';
};

const BLOCKED_PATTERNS: Array<{ category: ModerationResult['category']; pattern: RegExp }> = [
  { category: 'threat', pattern: /\b(?:kill|murder|rape|bomb|shoot)\s+(?:you|them|him|her|everyone)\b/i },
  { category: 'threat', pattern: /\b(?:kill yourself|go die|death threat)\b/i },
  { category: 'profanity', pattern: /\b(?:fuck|f+u+c+k|motherf+u+c+k|bitch|bastard|dick|cunt|slut|whore|asshole|bullshit|shithead)\b/i },
  { category: 'profanity', pattern: /\b(?:chutiya|chutiy|gand+u|harami|madarchod|behenchod|bhosdi|lund|randi|lauda)\b/i },
  { category: 'profanity', pattern: /(?:चूतिया|गांडू|हरामी|मादरचोद|बहनचोद|भोसड़ी|लौड़ा|रंडी)/u },
  { category: 'profanity', pattern: /(?:চোদা|চোদাচুদি|হারামি|বেশ্যা)/u },
  { category: 'profanity', pattern: /(?:தேவடியா|புண்டை|மயிரு|நாயே)/u },
  { category: 'profanity', pattern: /(?:ಲೋಫರ್|ಸೂಳೆ|ನಾಯಿಮಗ)/u },
  { category: 'profanity', pattern: /(?:లంజ|దెంగు|పూకు)/u },
  { category: 'profanity', pattern: /(?:ભાડવો|રાંડ|ચૂત)/u },
  { category: 'profanity', pattern: /(?:بکواس|حرامی|رنڈی)/u },
  { category: 'sexual', pattern: /\b(?:porn|xxx|sexually explicit|nude|nudes|child sexual|csam)\b/i },
  { category: 'abuse', pattern: /\b(?:idiot|moron|retard|stupid bastard|you are worthless)\b/i },
];

function normalizeForModeration(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase()
    .replace(/[4@]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[5$]/g, 's')
    .replace(/(.)\1{4,}/g, '$1$1')
    .replace(/[^\p{L}\p{M}\p{N}\s!?'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function moderateChatInput(value: unknown): ModerationResult {
  if (typeof value !== 'string') return { allowed: false, category: 'length' };
  if (value.length === 0 || value.length > 4000) return { allowed: false, category: 'length' };
  const normalized = normalizeForModeration(value);
  const match = BLOCKED_PATTERNS.find(({ pattern }) => pattern.test(normalized));
  return match ? { allowed: false, category: match.category } : { allowed: true };
}
