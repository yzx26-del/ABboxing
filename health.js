module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ ok: true, keyConfigured: !!process.env.DEEPSEEK_API_KEY });
};
