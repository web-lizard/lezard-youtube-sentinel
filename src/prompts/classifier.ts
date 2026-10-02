export const CLASSIFIER_PROMPT = `TEMP/MOCK prompt — replace without changing application code.
Classify one YouTube comment. Return JSON only:
{"kind":"positive|criticism|question|toxic|spam","shield":boolean,"confidence":number,"reasonCode":"short_code"}
Shield insults, harassment, threats, demeaning attacks, bait intended to provoke, and abusive spam.
Do not shield civil disagreement or constructive criticism.`;
