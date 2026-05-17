import { API } from './api.js';

// ─────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────

export const STATE = {
  song: null,
  musicianA: null,
  musicianB: null,
  grScript: { main: '', question: '', style: '神秘旁观' },
  stances: { a: '反对', b: '支持' },
  transcript: [],
  scores: { a: [0, 0, 0], b: [0, 0, 0] },
  randAudience: null,
  judgeWarning: '',
  currentRound: 1,
  currentScreen: 1,
};

// ─────────────────────────────────────────
// MUSICIAN POOL
// ─────────────────────────────────────────

export const MUSICIAN_POOL = [
  { era: '1756–1791·奥地利', name: '沃尔夫冈·莫扎特', desc: '古典主义巅峰，对结构与形式有近乎偏执的追求，极度鄙视庸俗', initial: '莫' },
  { era: '1770–1827·德国',   name: '路德维希·贝多芬', desc: '用失聪与苦难锤炼出史诗，相信音乐是人类意志的最终表达', initial: '贝' },
  { era: '1813–1883·德国',   name: '理查德·瓦格纳',   desc: '音乐剧场的野心家，相信艺术应当唤醒民族的集体灵魂', initial: '瓦' },
  { era: '1840–1893·俄国',   name: '彼得·柴可夫斯基', desc: '旋律天才，在华丽与忧郁之间永远撕裂，情感重于一切技法', initial: '柴' },
  { era: '1685–1750·德国',   name: '约翰·塞巴斯蒂安·巴赫', desc: '复调音乐的神，把每一个音符都视为对上帝的祷告', initial: '巴' },
  { era: '1867–1934·匈牙利', name: '弗朗兹·李斯特',   desc: '钢琴魔王，把表演本身变成了艺术，名誉与才华一样过盛', initial: '李' },
  { era: '1862–1918·法国',   name: '克劳德·德彪西',   desc: '印象主义创始人，用音乐描绘光与影，拒绝任何既有规则', initial: '德' },
  { era: '1900–1971·美国',   name: '路易斯·阿姆斯特朗', desc: '爵士乐的代名词，小号与嗓音都是通往天堂的阶梯', initial: '路' },
  { era: '1940–1980·英国',   name: '约翰·列侬',       desc: '摇滚叛逆者，相信音乐是社会变革的武器，拒绝一切商业包装', initial: '列' },
  { era: '1942–1970·美国',   name: '吉米·亨德里克斯', desc: '电吉他之神，用噪音重新定义了美，三年改变了整个摇滚史', initial: '吉' },
  { era: '1898–1937·美国',   name: '罗伯特·约翰逊',   desc: '蓝调之魂，传说把灵魂卖给魔鬼换来天才，27岁离世', initial: '约' },
  { era: '1923–1963·法国',   name: '艾迪特·琵雅芙',   desc: '法国灵魂，用沙哑的声线把所有的爱与痛唱成传奇', initial: '琵' },
];

export const GR_PRESETS = [
  { style: '神秘旁观', main: '（壁炉里的木柴轻轻爆出一声，火光照亮你手中那张牌的边缘）两位都说得很精彩。但我有一个问题，想请两位在剩余发言中正面回答——', q: '如果这首歌的作者明天就死去，你们的评价会改变吗？' },
  { style: '犀利质问', main: '（把手中的牌翻面，冷冷地看着两位）说了这么久，我只听到你们在说自己。没有一个人真正说这首歌本身。所以我只问一件事——', q: '这首歌里，有没有一个音符是多余的？' },
  { style: '温柔入局', main: '（轻轻放下茶杯，微微一笑）两位说的，我都听见了。其实你们都没有错。只是……你们忘了问一个最重要的人。', q: '如果让第一次听这首歌就哭出来的那个人来评分，他会给几分？' },
  { style: '哲学追问', main: '（缓缓站起，声音很轻）亚里士多德说，音乐可以净化灵魂。我不知道这首歌能不能做到。但我有一个问题——', q: '这首歌结束后，你们的灵魂有没有哪怕一秒钟感到安静？' },
  { style: '戏谑嘲讽', main: '（翻了个白眼，懒洋洋地靠在椅背上）好了好了，两位大师吵得差不多了吧？我就不客气了，直接问——', q: '如果这首歌是默默无名的人写的，你们还会这样评价吗？' },
  { style: '沉默后开口', main: '（沉默了很长时间，壁炉里的火噼啪作响）……（终于开口）', q: '你们争了这么久——有没有可能，你们其实都是对的？' },
];

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

export function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function shortName(fullName) {
  // 取姓名最后一个词作为短名
  return fullName.split('·').pop().trim().split(' ').slice(-1)[0];
}

export function randomFrom(arr, exclude = []) {
  const candidates = arr.filter(m => !exclude.includes(m.name));
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ─────────────────────────────────────────
// GAME FLOW
// ─────────────────────────────────────────

export async function runDeliberation(callbacks) {
  const { song, musicianA, musicianB, grScript } = STATE;
  const { onMessage, onVerdict, onError } = callbacks;

  const stances = [
    { m: musicianA, hint: '倾向反对或持保留态度', side: 'a' },
    { m: musicianB, hint: '倾向支持或持赞赏态度', side: 'b' },
    { m: musicianA, hint: '进一步阐明反对立场，可回应对手', side: 'a' },
    { m: musicianB, hint: '进一步阐明支持立场，可回应对手', side: 'b' },
  ];

  for (const { m, hint, side } of stances) {
    try {
      const res = await API.deliberationSpeak(m, song, hint);
      STATE.transcript.push({ name: m.name, text: res.text, side });
      onMessage(side, m, res.text);
      await delay(600);
    } catch (e) {
      onError(e.message);
    }
  }

  STATE.stances = { a: '反对', b: '支持' };
  onVerdict(STATE.stances);
}

export async function runDebateRound(round, callbacks) {
  const { onSpeak, onRandAudience, onJudge, onVoteRequest } = callbacks;
  const { musicianA, musicianB, song, grScript, transcript } = STATE;

  for (let turn = 0; turn < 5; turn++) {
    const isA = turn % 2 === 0;
    const musician = isA ? musicianA : musicianB;
    const opponent = isA ? musicianB.name : musicianA.name;
    const side = isA ? 'a' : 'b';

    try {
      const res = await API.debateSpeak(
        musician, opponent, song, round,
        transcript, grScript.question, STATE.judgeWarning
      );
      STATE.transcript.push({ name: musician.name, text: res.text, side });
      onSpeak(side, musician, res.text, turn);
    } catch (e) {
      callbacks.onError && callbacks.onError(e.message);
    }

    // 随机观众：第1轮第3发言时触发
    if (round === 1 && turn === 2 && STATE.randAudience && !STATE._randShown) {
      STATE._randShown = true;
      try {
        const res = await API.audienceSpeak(STATE.randAudience, song, transcript);
        STATE.transcript.push({ name: STATE.randAudience.name, text: res.text, side: 'rand' });
        onRandAudience(STATE.randAudience, res.text);
      } catch (e) {
        callbacks.onError && callbacks.onError(e.message);
      }
    }

    await delay(400);
  }

  // 等玩家投票
  const playerVote = await onVoteRequest();
  STATE.transcript.push({ name: '玩家', text: playerVote.reason, side: 'player' });

  // 裁判评分
  try {
    const roundTranscript = transcript.filter(t => t.side === 'a' || t.side === 'b').slice(-10);
    const res = await API.judgeScore(roundTranscript, musicianA, musicianB, round, grScript.question);
    const jdata = res.data;
    STATE.scores.a[round - 1] = jdata.scoreA.total;
    STATE.scores.b[round - 1] = jdata.scoreB.total;
    STATE.judgeWarning = jdata.warning || '';
    onJudge(jdata, round);
  } catch (e) {
    callbacks.onError && callbacks.onError(e.message);
  }
}

export async function generateFinalVerdict() {
  const { scores, musicianA, musicianB, transcript, randAudience } = STATE;
  const res = await API.finalVerdict(scores, musicianA, musicianB, transcript, randAudience);
  return res.data;
}
