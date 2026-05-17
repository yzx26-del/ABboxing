const { callDeepSeek, cors, PROMPTS } = require('./_shared');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { person, song, transcript } = req.body;
    const p = PROMPTS.randomAudience(person, song, transcript);
    const text = await callDeepSeek(p.system, p.user, 0.9, 300);
    res.json({ ok: true, text });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
