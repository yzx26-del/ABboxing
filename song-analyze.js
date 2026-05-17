const { callDeepSeek, parseJSON, cors, PROMPTS } = require('./_shared');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { songName } = req.body;
    if (!songName) return res.status(400).json({ ok: false, error: '请提供歌曲名称' });
    const p = PROMPTS.songAnalysis(songName);
    const raw = await callDeepSeek(p.system, p.user, 0.3, 1200);
    const data = parseJSON(raw);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
