const { callDeepSeek, parseJSON, cors, PROMPTS } = require('./_shared');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { scores, musicianA, musicianB, transcript, randAudience } = req.body;
    const p = PROMPTS.finalVerdict(scores, musicianA, musicianB, transcript, randAudience);
    const raw = await callDeepSeek(p.system, p.user, 0.6, 800);
    const data = parseJSON(raw);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
