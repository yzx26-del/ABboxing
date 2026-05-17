const { callDeepSeek, parseJSON, cors, PROMPTS } = require('./_shared');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { transcript, musicianA, musicianB, round, grQuestion } = req.body;
    const p = PROMPTS.judge(transcript, musicianA, musicianB, round, grQuestion);
    const raw = await callDeepSeek(p.system, p.user, 0.3, 600);
    const data = parseJSON(raw);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
