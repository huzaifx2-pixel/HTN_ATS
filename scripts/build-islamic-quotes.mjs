import fs from "node:fs";
import path from "node:path";

const temp = process.env.TEMP || process.env.TMPDIR || "/tmp";
const outDir = path.join(process.cwd(), "src", "data");
fs.mkdirSync(outDir, { recursive: true });

const quran = JSON.parse(fs.readFileSync(path.join(temp, "en-quotes.json"), "utf8"));
const nawawi = JSON.parse(fs.readFileSync(path.join(temp, "nawawi40.json"), "utf8"));
const riyad = JSON.parse(fs.readFileSync(path.join(temp, "riyad.json"), "utf8"));
const bukhari = JSON.parse(fs.readFileSync(path.join(temp, "bukhari.json"), "utf8"));

const INCLUDE =
  /\b(work|earn|earning|trade|trading|business|honest|honesty|trust|trustworthy|patience|patient|effort|strive|striving|provision|labor|labour|seek|seeking|excellence|success|ease|hardship|gratitude|grateful|knowledge|justice|fair|deal|dealing|help|helping|charity|persever|steadfast|rely|reliance|morning|early|intent|intention|sincer|diligent|wealth|give|giving|generous|hope|courage|strong|strength|benefit|useful|best|deed|deeds|reward|bless|persist|endure|content|moderat|balance|kind|kindness|truth|truthful|promise|duty|improve|peace|merchant|sell|selling|buy|buying|wage|livelihood|rizq|action|actions|good|better|opportunit|self|soul|heart|brother|neighbor|forgive|responsible|hard\s*work|prosperity|blessing|barakah|ihsan|tawakkul|provider|measure|weight|contract|covenant)\b/i;

const EXCLUDE =
  /\b(hell|hellfire|fire|punish|punishment|torment|adulter|fornicat|zina|kill|murder|slaughter|disbeliev|kufr|shirk|idol|polytheis|curse|cursed|doom|damned|grave|burial|funeral|menstru|urine|excrement|sexual|intercourse|losers|arrogant|blackened)\b/i;

function clean(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/^["'\u201c\u201d]+|["'\u201c\u201d]+$/g, "")
    .trim();
}

function isOneLine(t) {
  return t.length >= 28 && t.length <= 110;
}

function isThemeMatch(t) {
  return INCLUDE.test(t) && !EXCLUDE.test(t);
}

const seen = new Set();
const quotes = [];

function add(text, maxLen = 110) {
  const t = clean(text);
  if (t.length < 28 || t.length > maxLen) return false;
  if (!isThemeMatch(t)) return false;
  const key = t.toLowerCase();
  if (seen.has(key)) return false;
  seen.add(key);
  quotes.push(t);
  return true;
}

const extra = [
  "Tie your camel, then put your trust in Allah.",
  "The best of people are those most beneficial to people.",
  "Verily, with hardship comes ease.",
  "Allah does not burden a soul beyond that it can bear.",
  "Actions are judged by intentions.",
  "Speak good or remain silent.",
  "The upper hand is better than the lower hand.",
  "Give the worker their wages before their sweat dries.",
  "Leave that which makes you doubt for that which does not.",
  "Make things easy and do not make them difficult.",
  "He who does not thank people does not thank Allah.",
  "Richness is contentment of the soul.",
  "Allah loves that when you do a job, you do it with excellence.",
  "The most beloved deeds are those done consistently, even if small.",
  "Whoever eases a difficulty, Allah eases a difficulty for them.",
  "Part of excellence is leaving what does not concern you.",
  "A kind word is charity.",
  "Smiling in the face of your brother is charity.",
  "Seek livelihood in the early hours of the morning.",
  "No one eats better food than what they earn with their hands.",
  "And that there is not for man except that for which he strives.",
  "Indeed, Allah is with the patient.",
  "Whoever puts their trust in Allah, He is enough for them.",
  "Allah is the best of providers.",
  "Indeed, Allah commands justice and excellence.",
  "Give full measure and weight in justice.",
  "Allah has permitted trade and forbidden usury.",
  "And do good; indeed, Allah loves the doers of good.",
  "And say, Work, for Allah will see your work.",
  "So race to good deeds.",
  "And cooperate in righteousness and piety.",
  "If you are grateful, I will surely increase you.",
  "Allah does not change a people until they change themselves.",
  "And consult with them in the matter.",
  "And do not deprive people of their due.",
  "Be just; that is nearer to righteousness.",
  "And speak to people good words.",
  "Prefer a little with blessing over much with unrest.",
  "Excellence is doing a job well even when no one is watching.",
  "Start early, work sincerely, and leave the results to Allah.",
  "Honest trade brings lasting blessing.",
  "Your rizq is written, but your effort is required.",
  "Patience in business is profit in disguise.",
  "A fair deal today builds trust for tomorrow.",
  "Work with your hands and eat from what you earn.",
  "Do not delay good work; opportunity rarely waits.",
  "Speak less, deliver more, and keep your promises.",
  "Barakah grows where honesty lives.",
  "The best investment is sincerity in your effort.",
  "Help others succeed, and your own path opens.",
  "Stay consistent; small daily work compounds.",
  "Leave doubtful earnings for clear and clean ones.",
  "Gratitude multiplies provision.",
  "Control your anger and you protect your reputation.",
  "Knowledge without action is a tree without fruit.",
  "Action without sincerity is motion without meaning.",
  "Trust Allah after you have done your part.",
  "Make it easy for clients, and Allah makes it easy for you.",
  "A cheerful face is a quiet form of charity at work.",
  "Pay people on time; delayed dues darken blessing.",
  "Do not envy another's success; ask Allah for your own.",
  "Hardship passes; disciplined work remains.",
  "Plan carefully, act bravely, and rely on Allah.",
  "The one who serves people best rises highest.",
  "Keep your contracts clear and your character cleaner.",
  "Wealth that harms your soul is not true wealth.",
  "Contentment is richness that cannot be stolen.",
  "Learn every day; markets reward the prepared.",
  "Silence is wisdom when words would spoil a deal.",
  "Forgive quickly so your mind can return to work.",
  "Do good work in private; Allah sees what people miss.",
  "A trustworthy person is rare capital.",
  "Avoid debt that steals your peace.",
  "Compete in excellence, not in arrogance.",
  "Morning effort carries special blessing.",
  "Finish what you start with ihsan.",
  "Your character is your strongest brand.",
  "Ask Allah for beneficial knowledge and accepted work.",
  "When stuck, pray, then take the next honest step.",
  "Do not boast of success; thank the One who granted it.",
  "Serve with excellence and leave vanity aside.",
  "Justice in trade is worship in action.",
  "Keep your tongue from harming your livelihood.",
  "A calm heart makes clearer business decisions.",
  "Replace worry with work and remembrance.",
  "Be firm in principle and gentle in manner.",
  "The best leaders begin by serving.",
  "Protect trust more than profit.",
  "If a path is unclear, choose the more honest one.",
  "Success without integrity is failure postponed.",
  "Spend moderately and invest wisely.",
  "Your reputation walks into rooms before you do.",
  "Turn setbacks into lessons, then move forward.",
  "Keep promises even when it costs you.",
  "Hire for character, train for skill.",
  "Listen more than you speak in negotiation.",
  "Charity does not decrease wealth.",
  "Whoever is slow to anger is strong in leadership.",
  "Seek halal income as an act of worship.",
  "Discipline beats motivation when motivation fades.",
  "Ask for increase, then work as if the answer is coming.",
  "A team that trusts each other outruns talent alone.",
  "Be present in your work; distraction wastes rizq.",
  "Measure twice, deal once, and remain fair.",
  "Do not mock small beginnings.",
  "Humility attracts help; arrogance repels it.",
  "Write agreements; memory fades, ink remains.",
  "Return trusts promptly.",
  "Courage is continuing after a failed attempt.",
  "Keep learning from those ahead of you.",
  "Share credit freely; claim blame carefully.",
  "Rest enough to work well tomorrow.",
  "Do not chase every opportunity; choose what suits your values.",
  "Pray for guidance before major decisions.",
  "A delayed honest answer is better than a quick false one.",
  "Build systems that make goodness easy.",
  "Treat juniors with dignity; they remember forever.",
  "Never underprice your integrity.",
  "When blessed, lift others with you.",
  "Time is capital; spend it on what matters.",
  "Avoid gossip; it taxes focus and reputation.",
  "Let results speak louder than self-praise.",
  "Be patient with slow growth if the roots are sound.",
  "Ask Allah for sufficiency, not just surplus.",
  "A good intention elevates ordinary work.",
  "Close the day with gratitude and an improved plan.",
  "Do not fear honest competition.",
  "Protect your prayer times even on busy days.",
  "Wealth follows value created for others.",
  "Stay soft-hearted and hard-working.",
  "Refuse shady shortcuts that poison sleep.",
  "Lead by example when standards slip.",
  "Your best marketing is a fulfilled promise.",
  "Begin with Bismillah and end with Alhamdulillah.",
];

for (const t of extra) add(t);

for (const row of quran) add(row.content);
for (const h of nawawi.hadiths || []) add(h.english?.text);
for (const h of riyad.hadiths || []) add(h.english?.text);
for (const h of bukhari.hadiths || []) add(h.english?.text);

if (quotes.length < 1000) {
  for (const row of quran) add(row.content, 130);
  for (const h of riyad.hadiths || []) add(h.english?.text, 130);
  for (const h of bukhari.hadiths || []) {
    if (quotes.length >= 1000) break;
    add(h.english?.text, 130);
  }
}

const final = quotes.slice(0, 1000);
const outPath = path.join(outDir, "islamic-quotes.json");
fs.writeFileSync(outPath, `${JSON.stringify(final.map((text) => ({ text })))}\n`);

console.log(
  JSON.stringify(
    {
      wrote: final.length,
      avgLen: Math.round(final.reduce((a, b) => a + b.length, 0) / Math.max(1, final.length)),
      maxLen: final.length ? Math.max(...final.map((t) => t.length)) : 0,
      sample: final.slice(0, 10),
      outPath,
    },
    null,
    2,
  ),
);
