// ─────────────────────────────────────────
// 共享工具：DeepSeek 调用 + 所有 Prompt
// ─────────────────────────────────────────

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

async function callDeepSeek(systemPrompt, userPrompt, temperature = 0.7, maxTokens = 1000) {
  if (!DEEPSEEK_KEY) throw new Error('DEEPSEEK_API_KEY 未配置');

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
    const t = await res.text();
    throw new Error(`DeepSeek ${res.status}: ${t.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}

function parseJSON(raw) {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

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
  "debate_gap": "最容易被忽略但最值得追问的哲学或人文盲点，一句话",
  "audience_suggestions": [
    {
      "name": "历史人物全名",
      "era": "生卒年·国籍",
      "trigger_reason": "为什么这个人适合出现评论这首歌，一句话",
      "initials": "2字简称"
    }
  ]
}

audience_suggestions 提供2-3个，必须是2000年前去世的真实历史人物，不能是音乐家。`,
    user: `请分析这首歌：${songName}`
  }),

  deliberation: (musician, song, stanceHint) => ({
    system: `你是历史音乐家，请完全进入角色用第一人称发言。性格鲜明，有立场，不模棱两可。严格不使用你所在时代之后才出现的词汇。控制在80字以内。`,
    user: `你是${musician.name}（${musician.era}），${musician.desc}。
你刚听到这首歌：${song.name}（${song.artist || ''}），核心主题：${song.core_theme}，情绪标签：${(song.emotion_tags || []).join('、')}。
请说出你的第一印象和初步立场（${stanceHint}）。`
  }),

  debate: (musician, opponentName, song, round, transcript, grQuestion, judgeWarning) => {
    const themes = [
      '围绕音乐本身展开——技法、结构、旋律、编曲、音色',
      '结合你自身的成长经历，与歌曲幕后成员的人生故事相呼应',
      '直接攻击对手前两轮的具体论点，必须引用对手说过的原话，不能空谈'
    ];
    const recent = (transcript || []).slice(-8).map(t => `${t.name}：${t.text}`).join('\n');
    return {
      system: `你是历史音乐家，正在参加跨时空辩论赛。用第一人称直接发言，不要旁白，不要括号动作。符合你的时代背景，不使用你之后才出现的词汇。论据具体，立场鲜明，控制在120字以内。`,
      user: `你是${musician.name}（${musician.era}），${musician.desc}。
辩论歌曲：${song.name}，核心主题：${song.core_theme}
对手：${opponentName}，第${round}轮主题：${themes[round - 1]}
Gr小姐强制问题（本轮必须正面回应一次）："${grQuestion}"
${judgeWarning ? `裁判上轮警告：${judgeWarning}` : ''}
前序发言：\n${recent}
请发表你的下一轮辩论发言。`
    };
  },

  judge: (transcript, musicianA, musicianB, round, grQuestion) => ({
    system: `你是跨时空音乐评审委员会裁判JUDGE-0。冷酷客观，不偏袒。
严格按JSON输出，不要任何其他内容：
{"scoreA":{"logic":1-10,"rebuttal":1-10,"character":1-10,"total":三项合计乘以1.1取整},"scoreB":{"logic":1-10,"rebuttal":1-10,"character":1-10,"total":三项合计乘以1.1取整},"bestLine":{"who":"A或B","quote":"引用原话不超过20字"},"weakestLine":{"who":"A或B","quote":"引用原话不超过20字"},"comment":"本轮点评不超过60字，必须引用双方各至少一句原话","warning":"给下一轮的一句警告"}
评分：logic论据质量/rebuttal反驳力度/character人格一致性各1-10分。双方总分差距必须至少5分。
若某方正面回应了"${grQuestion}"则logic+1；完全回避则rebuttal-2。`,
    user: `第${round}轮发言记录：\n${(transcript || []).map(t => `${t.name}：${t.text}`).join('\n')}\nA方：${musicianA.name}，B方：${musicianB.name}`
  }),

  grIntervention: (song, grScript, transcript) => ({
    system: `你是何某人，人称Gr小姐，录音系毕业的音效设计师和音乐评论人。
风格：精通乐理，说话锐利有立场，不废话，善用跨界类比，偶尔有诗性句子。先给结论再拆解。绝不说"我认为""我觉得"。
输出格式（直接输出文本，不要JSON不要标签）：
第一行：（一个具体的动作或感官细节）+ 评论，不超过60字
空一行
最后一行：强制问题（一句疑问句，指向双方都没触碰的盲点）`,
    user: `歌曲：${song.name}（${song.core_theme}）
情绪标签：${(song.emotion_tags || []).join('、')}
辩论盲点方向：${song.debate_gap}
介入风格：${grScript.style || '神秘旁观'}
双方发言摘要：${(transcript || []).slice(0, 4).map(t => t.name + '：' + t.text.slice(0, 40)).join('；')}
请生成Gr小姐的介入发言。`
  }),

  randomAudience: (person, song, transcript) => ({
    system: `你是一位历史人物，刚在观众席旁听了一段音乐辩论。从自己的人生经历和世界观评判。符合你所在时代，不使用你去世后才出现的词汇。发言不超过80字，最后留一个让双方都难以回答的问题，然后坐下不再发言。直接输出发言文本。`,
    user: `你是${person.name}（${person.era}）。${person.trigger_reason}
辩论话题：评价歌曲《${song.name}》（${song.core_theme}）
双方刚才说的：${(transcript || []).slice(-4).map(t => t.name + '：' + t.text.slice(0, 40)).join('；')}
请发表你的观点并提出问题。`
  }),

  finalVerdict: (scores, musicianA, musicianB, transcript, randAudience) => ({
    system: `你是跨时空音乐评审委员会裁判JUDGE-0，现在宣读最终判词。
风格：庄重简洁，像古代判词，引用辩论中的真实话语。
严格按JSON输出：
{"winner":"A或B","verdict_text":"判词正文3-4句，必须引用双方各至少一句原话用「」标注","best_line":{"who":"姓名","quote":"最强金句20字以内"},"best_response":{"who":"姓名","desc":"最佳回应描述15字以内"},"sharpest_question":{"who":"提问者姓名","desc":"最刁钻问题描述15字以内"},"gr_epilogue":"Gr小姐终局发言30字以内，有动作描写，有一句让人回味的话","rand_epilogue":"随机观众离场一句话20字以内"}`,
    user: `完整辩论记录（最后20条）：\n${(transcript || []).slice(-20).map(t => `${t.name}：${t.text}`).join('\n')}
A方：${musicianA.name}，总分：${(scores.a || []).reduce((s, v) => s + v, 0)}
B方：${musicianB.name}，总分：${(scores.b || []).reduce((s, v) => s + v, 0)}
随机观众：${randAudience ? randAudience.name : '无'}
请宣读最终判词。`
  })
};

module.exports = { callDeepSeek, parseJSON, cors, PROMPTS };
