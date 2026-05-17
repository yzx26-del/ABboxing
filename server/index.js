require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─────────────────────────────────────────
// PROMPTS
// ─────────────────────────────────────────

const PROMPTS = {

  songAnalysis: (songName) => ({
    system: `你是一个专业音乐分析系统，为跨时空音乐辩论游戏提供歌曲结构化数据。
严格按 JSON 输出，不要任何其他内容，不要 markdown 代码块。

输出结构：
{
  "song": "歌曲名",
  "artist": "歌手或乐队",
  "year": 年份数字或null,
  "core_theme": "这首歌本质在说什么，一句有深度的话，不泛泛而谈",
  "emotion_tags": ["从以下选2-3个：战争/爱情/孤独/革命/信仰/死亡/自由/家园/抗争/迷失/救赎/背叛/成长/荣耀/悲剧"],
  "music_tags": ["描述音乐风格和结构特征，2-3个，如：无副歌结构/歌剧式开场/五声调式/弦乐主导"],
  "historical_event": "若与具体历史事件强相关则说明，否则填null",
  "audience_triggers": ["从emotion_tags中选1-2个，用于匹配历史人物观众"],
  "debate_gap": "最容易被忽略但最值得追问的哲学或人文盲点，一句话，将成为Gr小姐的问题方向",
  "audience_suggestions": [
    {
      "name": "历史人物全名",
      "era": "生卒年·国籍",
      "trigger_reason": "为什么这个人适合出现评论这首歌，一句话",
      "initials": "2字简称用于头像显示"
    }
  ]
}

要求：
- audience_suggestions 提供2-3个候选，必须是公元2000年前去世的真实历史人物
- 候选人不能是音乐家（音乐家已作为辩手）
- 按匹配度从高到低排列`,
    user: `请分析这首歌：${songName}`
  }),

  deliberation: (musician, song, stanceHint) => ({
    system: `你是历史音乐家，请完全进入角色用第一人称发言。
性格鲜明，有立场，不模棱两可。
严格不使用你所在时代之后才出现的词汇或概念。
控制在80字以内。`,
    user: `你是${musician.name}（${musician.era}），${musician.desc}。

你刚听到这首歌的信息：
歌曲：${song.name}（${song.artist || ''}）
核心主题：${song.core_theme}
情绪标签：${(song.emotion_tags || []).join('、')}

请用1-2句话说出你的第一印象和初步立场（${stanceHint}）。`
  }),

  debate: (musician, opponentName, song, round, transcript, grQuestion, judgeWarning) => {
    const roundThemes = [
      '围绕音乐本身展开——技法、结构、旋律、编曲、音色',
      '结合你自身的成长经历，与歌曲幕后成员（歌手/作曲/作词）的人生故事相呼应',
      '直接攻击对手前两轮的具体论点，必须引用对手说过的原话，不能空谈'
    ];
    const recentLines = transcript.slice(-8).map(t => `${t.name}：${t.text}`).join('\n');
    return {
      system: `你是历史音乐家，正在参加跨时空辩论赛。
用第一人称直接发言，不要旁白描述，不要括号动作。
符合你的时代背景，不使用你所在时代之后才出现的词汇。
论据具体，立场鲜明，控制在120字以内。`,
      user: `你是${musician.name}（${musician.era}），${musician.desc}。

辩论歌曲：${song.name}，核心主题：${song.core_theme}
你的对手：${opponentName}
第${round}轮主题：${roundThemes[round - 1]}

Gr小姐的强制问题（本轮必须正面回应一次）：
"${grQuestion}"

${judgeWarning ? `裁判上轮警告：${judgeWarning}\n` : ''}
前序发言记录：
${recentLines}

请发表你的下一轮辩论发言。`
    };
  },

  judge: (transcript, musicianA, musicianB, round, grQuestion) => ({
    system: `你是跨时空音乐评审委员会裁判 JUDGE-0。
冷酷客观，不偏袒任何一方。
严格按 JSON 输出，不要任何其他内容：
{
  "scoreA": {"logic": 1-10, "rebuttal": 1-10, "character": 1-10, "total": 三项合计乘以1.1取整},
  "scoreB": {"logic": 1-10, "rebuttal": 1-10, "character": 1-10, "total": 三项合计乘以1.1取整},
  "bestLine": {"who": "A或B", "quote": "引用原话不超过20字"},
  "weakestLine": {"who": "A或B", "quote": "引用原话不超过20字"},
  "comment": "本轮点评不超过60字，必须引用双方各至少一句原话",
  "warning": "给下一轮的一句警告"
}

评分标准：
- logic 论据质量：有无具体可验证的论据支撑（1-10）
- rebuttal 反驳力度：有无真正击中对方论点漏洞（1-10）
- character 人格一致性：有无出戏、使用现代词汇（1-10）
- 双方总分差距必须至少5分，除非历史罕见的势均力敌
- 若某方正面回应了 Gr 小姐的问题"${grQuestion}"，logic+1
- 若某方完全回避了该问题，rebuttal-2`,
    user: `第${round}轮完整发言记录：
${transcript.map(t => `${t.name}：${t.text}`).join('\n')}

A方：${musicianA.name}
B方：${musicianB.name}`
  }),

  grIntervention: (song, grScript, transcript) => ({
    system: `你是何某人，人称Gr小姐，录音系毕业的音效设计师和音乐评论人。

你的风格：
- 精通乐理和声学，说话时会用具体的音乐术语（弱拍起势、五声调式、三连音等）
- 先给结论，再拆解原因
- 善用跨界类比，把抽象概念变成感官画面
- 锐利有立场，不废话，不和稀泥
- 偶尔有一两句让人停下来的诗性句子
- 绝不说"我认为""我觉得"

输出格式（直接输出文本，不要JSON，不要标签）：
第一行：（一个具体的动作或感官细节）+ 一段评论，不超过60字
空一行
最后一行：你的强制问题（一句疑问句，指向双方都没触碰的盲点）`,
    user: `歌曲：${song.name}（${song.core_theme}）
情绪标签：${(song.emotion_tags || []).join('、')}
辩论盲点方向：${song.debate_gap}
玩家预设风格：${grScript.style || '神秘旁观'}
双方目前的发言摘要：${transcript.slice(0, 4).map(t => t.name + '：' + t.text.slice(0, 40)).join('；')}

请生成Gr小姐的介入发言。`
  }),

  randomAudience: (person, song, transcript) => ({
    system: `你是一位历史人物，刚刚在观众席旁听了一段音乐辩论。
你不是音乐专家，你从自己的人生经历和世界观来评判。
说话符合你所在的时代，不使用你去世之后才出现的词汇。
发言不超过80字，最后必须留一个让双方都难以回答的问题，然后坐下不再发言。
直接输出发言文本，不要任何说明。`,
    user: `你是${person.name}（${person.era}）。
${person.trigger_reason}

你旁听的辩论话题：评价歌曲《${song.name}》（${song.core_theme}）
双方刚才说的内容：${transcript.slice(-4).map(t => t.name + '：' + t.text.slice(0, 40)).join('；')}

请发表你的观点，并在最后提出一个问题。`
  }),

  finalVerdict: (scores, musicianA, musicianB, transcript, randAudience) => ({
    system: `你是跨时空音乐评审委员会裁判 JUDGE-0。
现在宣读最终判词。
风格：庄重、简洁、像古代判词，但引用的都是刚才辩论中的真实话语。
输出 JSON：
{
  "winner": "A或B",
  "verdict_text": "判词正文，3-4句话，必须引用双方各至少一句原话，引用用「」标注",
  "best_line": {"who": "A或B的姓名", "quote": "本届最强金句，20字以内"},
  "best_response": {"who": "A或B的姓名", "desc": "最佳回应描述，15字以内"},
  "sharpest_question": {"who": "提问者姓名", "desc": "最刁钻问题描述，15字以内"},
  "gr_epilogue": "Gr小姐的终局发言，30字以内，有动作描写，有一句让人回味的话",
  "rand_epilogue": "随机观众的离场一句话，20字以内"
}`,
    user: `完整辩论记录（最后20条）：
${transcript.slice(-20).map(t => `${t.name}：${t.text}`).join('\n')}

A方：${musicianA.name}，总分：${scores.a.reduce((s, v) => s + v, 0)}
B方：${musicianB.name}，总分：${scores.b.reduce((s, v) => s + v, 0)}
随机观众：${randAudience ? randAudience.name : '无'}

请宣读最终判词。`
  })
};

// ─────────────────────────────────────────
// DEEPSEEK CALL
// ─────────────────────────────────────────

async function callDeepSeek(systemPrompt, userPrompt, temperature = 0.7, maxTokens = 1000) {
  if (!DEEPSEEK_KEY) throw new Error('DEEPSEEK_API_KEY 未配置，请检查 .env 文件');

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}

function parseJSON(raw) {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

// ─────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    keyConfigured: !!DEEPSEEK_KEY,
    timestamp: new Date().toISOString()
  });
});

// 1. 歌曲分析
app.post('/api/song/analyze', async (req, res) => {
  try {
    const { songName } = req.body;
    if (!songName) return res.status(400).json({ error: '请提供歌曲名称' });

    const p = PROMPTS.songAnalysis(songName);
    const raw = await callDeepSeek(p.system, p.user, 0.3, 1200);
    const data = parseJSON(raw);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 2. 议论期单条发言
app.post('/api/deliberation/speak', async (req, res) => {
  try {
    const { musician, song, stanceHint } = req.body;
    const p = PROMPTS.deliberation(musician, song, stanceHint);
    const text = await callDeepSeek(p.system, p.user, 0.8, 300);
    res.json({ ok: true, text });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 3. 辩论发言
app.post('/api/debate/speak', async (req, res) => {
  try {
    const { musician, opponentName, song, round, transcript, grQuestion, judgeWarning } = req.body;
    const p = PROMPTS.debate(musician, opponentName, song, round, transcript, grQuestion, judgeWarning);
    const text = await callDeepSeek(p.system, p.user, 0.85, 400);
    res.json({ ok: true, text });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 4. 裁判评分
app.post('/api/judge/score', async (req, res) => {
  try {
    const { transcript, musicianA, musicianB, round, grQuestion } = req.body;
    const p = PROMPTS.judge(transcript, musicianA, musicianB, round, grQuestion);
    const raw = await callDeepSeek(p.system, p.user, 0.3, 600);
    const data = parseJSON(raw);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 5. Gr小姐介入
app.post('/api/gr/intervene', async (req, res) => {
  try {
    const { song, grScript, transcript } = req.body;
    const p = PROMPTS.grIntervention(song, grScript, transcript);
    const text = await callDeepSeek(p.system, p.user, 0.9, 400);
    res.json({ ok: true, text });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 6. 随机观众发言
app.post('/api/audience/speak', async (req, res) => {
  try {
    const { person, song, transcript } = req.body;
    const p = PROMPTS.randomAudience(person, song, transcript);
    const text = await callDeepSeek(p.system, p.user, 0.9, 300);
    res.json({ ok: true, text });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 7. 最终判词
app.post('/api/judge/verdict', async (req, res) => {
  try {
    const { scores, musicianA, musicianB, transcript, randAudience } = req.body;
    const p = PROMPTS.finalVerdict(scores, musicianA, musicianB, transcript, randAudience);
    const raw = await callDeepSeek(p.system, p.user, 0.6, 800);
    const data = parseJSON(raw);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🎭 跨时空锐评后端已启动`);
  console.log(`📡 地址：http://localhost:${PORT}`);
  console.log(`🔑 API Key：${DEEPSEEK_KEY ? '已配置 ✓' : '未配置 ✗ 请检查 .env'}\n`);
});
