import { API } from './api.js';
import {
  STATE, MUSICIAN_POOL, GR_PRESETS,
  delay, escHtml, shortName, randomFrom,
  runDeliberation, runDebateRound, generateFinalVerdict
} from './game.js';

// ─────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────

function goTo(n) {
  for (let i = 1; i <= 5; i++) {
    const s = document.getElementById('s' + i);
    const pd = document.getElementById('pd' + i);
    const pl = document.getElementById('pl' + i);
    const pline = document.getElementById('pline' + i);
    if (s) s.className = 'screen' + (i === n ? ' active' : '');
    if (pd) pd.className = 'ps-dot' + (i < n ? ' done' : i === n ? ' cur' : '');
    if (pl) pl.className = 'ps-label' + (i < n ? ' done' : i === n ? ' cur' : '');
    if (pline) pline.className = 'ps-line' + (i < n ? ' done' : '');
  }
  STATE.currentScreen = n;
  if (n === 3) initDelib();
  if (n === 4) initDebate();
  if (n === 5) initEnding();
  window.scrollTo(0, 0);
}

window.goTo = goTo;

// ─────────────────────────────────────────
// S1: OPENING
// ─────────────────────────────────────────

function checkS1Ready() {
  document.getElementById('s1-next').disabled = !STATE.song;
}

window.confirmSong = async function () {
  const v = document.getElementById('song-in').value.trim();
  if (!v) return;

  const scBox = document.getElementById('sc-box');
  const errBox = document.getElementById('s1-err');
  errBox.style.display = 'none';
  scBox.style.display = 'block';
  document.getElementById('sc-sname').textContent = v;
  document.getElementById('sc-smeta').textContent = '正在分析……';
  document.getElementById('sc-stags').innerHTML = '';

  try {
    const res = await API.analyzeSong(v);
    STATE.song = res.data;

    document.getElementById('sc-sname').textContent = res.data.song;
    document.getElementById('sc-smeta').textContent =
      [res.data.artist, res.data.year].filter(Boolean).join(' · ') + ' · 分析完成';

    const tagsEl = document.getElementById('sc-stags');
    [...(res.data.emotion_tags || []), ...(res.data.music_tags || [])].forEach(t => {
      const s = document.createElement('span');
      s.className = 'tag tag-g';
      s.textContent = t;
      tagsEl.appendChild(s);
    });

    // 把 debate_gap 同步到 Gr 默认问题
    if (res.data.debate_gap) {
      document.getElementById('gr-q').textContent = res.data.debate_gap;
      updateGrChar();
    }

    // 选随机观众
    if (res.data.audience_suggestions?.length) {
      STATE.randAudience = res.data.audience_suggestions[0];
    }

    checkS1Ready();
  } catch (e) {
    scBox.style.display = 'none';
    errBox.style.display = 'block';
    document.getElementById('s1-err-msg').textContent = e.message;
  }
};

window.reroll = function (side) {
  const other = side === 'a' ? STATE.musicianB?.name : STATE.musicianA?.name;
  const cur = side === 'a' ? STATE.musicianA?.name : STATE.musicianB?.name;
  const p = randomFrom(MUSICIAN_POOL, [other, cur].filter(Boolean));
  if (!p) return;
  if (side === 'a') STATE.musicianA = { ...p };
  else STATE.musicianB = { ...p };
  document.getElementById(`${side}-era`).textContent = p.era;
  document.getElementById(`${side}-name`).textContent = p.name;
  document.getElementById(`${side}-desc`).textContent = p.desc;
};

window.rerollBoth = function () {
  const ia = Math.floor(Math.random() * MUSICIAN_POOL.length);
  let ib;
  do { ib = Math.floor(Math.random() * MUSICIAN_POOL.length); } while (ib === ia);
  STATE.musicianA = { ...MUSICIAN_POOL[ia] };
  STATE.musicianB = { ...MUSICIAN_POOL[ib] };
  ['a', 'b'].forEach(s => {
    const p = s === 'a' ? MUSICIAN_POOL[ia] : MUSICIAN_POOL[ib];
    document.getElementById(`${s}-era`).textContent = p.era;
    document.getElementById(`${s}-name`).textContent = p.name;
    document.getElementById(`${s}-desc`).textContent = p.desc;
  });
};

// init default musicians
STATE.musicianA = { ...MUSICIAN_POOL[0] };
STATE.musicianB = { ...MUSICIAN_POOL[8] };

// ─────────────────────────────────────────
// S2: GR SETUP
// ─────────────────────────────────────────

window.usePreset = function (i, el) {
  document.querySelectorAll('.ps-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const p = GR_PRESETS[i];
  document.getElementById('gr-main').textContent = p.main;
  document.getElementById('gr-q').textContent = p.q;
  STATE.grScript.style = p.style;
  updateGrChar();
};

window.updateGrChar = function () {
  const m = document.getElementById('gr-main').textContent || '';
  const q = document.getElementById('gr-q').textContent || '';
  document.getElementById('gr-char').textContent = (m.length + q.length) + ' 字';
};

function saveGrScript() {
  STATE.grScript.main = document.getElementById('gr-main').textContent;
  STATE.grScript.question = document.getElementById('gr-q').textContent;
}

// ─────────────────────────────────────────
// S3: DELIBERATION
// ─────────────────────────────────────────

async function initDelib() {
  saveGrScript();
  STATE.transcript = [];
  STATE._randShown = false;

  document.getElementById('s3-song').textContent = STATE.song?.name || '';
  document.getElementById('s3-meta').textContent =
    [STATE.song?.artist, STATE.song?.year].filter(Boolean).join(' · ');

  // Reset rows
  ['d0','d1','d2','d3','d4'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('show');
  });
  document.getElementById('verdict-box').classList.remove('show');
  const cta = document.getElementById('delib-cta');
  cta.style.opacity = '0';
  cta.style.pointerEvents = 'none';

  // Update name labels
  document.getElementById('d0-name').textContent = shortName(STATE.musicianA.name);
  document.getElementById('d2-name').textContent = shortName(STATE.musicianA.name);
  document.getElementById('d1-name').textContent = shortName(STATE.musicianB.name);
  document.getElementById('d3-name').textContent = shortName(STATE.musicianB.name);
  document.getElementById('d4-q').textContent = STATE.grScript.question;
  document.getElementById('v-name-a').textContent = shortName(STATE.musicianA.name);
  document.getElementById('v-name-b').textContent = shortName(STATE.musicianB.name);

  await runDeliberation({
    onMessage: (side, musician, text) => {
      const ids = side === 'a' ? ['d0', 'd2'] : ['d1', 'd3'];
      const nextId = ids.find(id => !document.getElementById(id).classList.contains('show'));
      if (nextId) {
        document.getElementById(nextId + '-text').textContent = text;
        document.getElementById(nextId).classList.add('show');
      }
    },
    onVerdict: (stances) => {
      document.getElementById('v-stance-a').textContent = stances.a + '此曲';
      document.getElementById('v-stance-b').textContent = stances.b + '此曲';
      document.getElementById('verdict-box').classList.add('show');
      setTimeout(() => {
        document.getElementById('d4').classList.add('show');
        setTimeout(() => {
          cta.style.opacity = '1';
          cta.style.pointerEvents = 'auto';
        }, 500);
      }, 400);
    },
    onError: (msg) => {
      // fallback: show all rows静态
      ['d0','d1','d2','d3','d4'].forEach(id => document.getElementById(id)?.classList.add('show'));
      document.getElementById('verdict-box').classList.add('show');
      cta.style.opacity = '1';
      cta.style.pointerEvents = 'auto';
    }
  });
}

// ─────────────────────────────────────────
// S4: DEBATE
// ─────────────────────────────────────────

let voteResolve = null;

async function initDebate() {
  const feed = document.getElementById('feed');
  feed.innerHTML = '';
  STATE.scores = { a: [0, 0, 0], b: [0, 0, 0] };
  STATE.judgeWarning = '';
  STATE.currentRound = 1;

  // Sidebar
  document.getElementById('sb-song').textContent = STATE.song?.name || '';
  document.getElementById('sb-meta').textContent =
    [STATE.song?.artist, STATE.song?.year].filter(Boolean).join(' · ');
  document.getElementById('sb-av-a').textContent = STATE.musicianA.initial;
  document.getElementById('sb-av-b').textContent = STATE.musicianB.initial;
  document.getElementById('sb-na').textContent = shortName(STATE.musicianA.name);
  document.getElementById('sb-nb').textContent = shortName(STATE.musicianB.name);
  document.getElementById('sb-era-a').textContent = STATE.musicianA.era;
  document.getElementById('sb-era-b').textContent = STATE.musicianB.era;
  document.getElementById('sb-stance-a').textContent = STATE.stances.a;
  document.getElementById('sb-stance-b').textContent = STATE.stances.b;
  document.getElementById('score-la').textContent = shortName(STATE.musicianA.name);
  document.getElementById('score-lb').textContent = shortName(STATE.musicianB.name);

  // Rand audience
  if (STATE.randAudience) {
    document.getElementById('sb-rand-av').textContent = STATE.randAudience.initials || STATE.randAudience.name.slice(0, 2);
    document.getElementById('sb-rand-name').textContent = STATE.randAudience.name;
  }

  // Sidebar emotion tags
  const sbTags = document.getElementById('sb-tags');
  sbTags.innerHTML = '';
  (STATE.song?.emotion_tags || []).forEach(t => {
    const s = document.createElement('span');
    s.style.cssText = 'font-size:10px;padding:2px 7px;border-radius:10px;border:0.5px solid #eee;color:#bbb;margin:1px;font-family:system-ui';
    s.textContent = t;
    sbTags.appendChild(s);
  });

  // Gr 介入发言
  setInputZone('loading');
  try {
    const grRes = await API.grIntervene(STATE.song, STATE.grScript, STATE.transcript);
    const lines = grRes.text.split('\n').filter(l => l.trim());
    const grMain = lines[0] || STATE.grScript.main;
    const grQ = lines[lines.length - 1] || STATE.grScript.question;
    appendGrBlock(grMain, grQ);
  } catch (e) {
    appendGrBlock(STATE.grScript.main, STATE.grScript.question);
  }

  // Run all 3 rounds
  for (let round = 1; round <= 3; round++) {
    STATE.currentRound = round;
    updateSidebarRound(round);

    await runDebateRound(round, {
      onSpeak: (side, musician, text, turn) => {
        updateRoundUI(round, turn);
        appendBubble(side, musician, text);
      },
      onRandAudience: async (person, text) => {
        document.getElementById('sb-rand-row').style.display = 'flex';
        appendRandBlock(person, text);
      },
      onVoteRequest: () => new Promise(resolve => {
        voteResolve = resolve;
        setInputZone('vote');
      }),
      onJudge: (jdata, r) => {
        appendJudgeCard(jdata, r);
        updateScoreDisplay();
        document.getElementById('sc' + r).textContent =
          jdata.scoreA.total + '·' + jdata.scoreB.total;
      },
      onError: (msg) => appendErrorNote(msg),
    });

    setInputZone('loading');
    await delay(800);
  }

  setInputZone('done');
  await delay(1000);
  goTo(5);
}

function updateRoundUI(round, turn) {
  const labels = [
    '第一轮 · 第 ' + (turn + 1) + '/5 发言 · 音乐本身',
    '第二轮 · 第 ' + (turn + 1) + '/5 发言 · 人与歌',
    '第三轮 · 第 ' + (turn + 1) + '/5 发言 · 终极攻击',
  ];
  document.getElementById('round-label').textContent = labels[round - 1];
  const dots = document.getElementById('turn-dots');
  dots.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const d = document.createElement('div');
    d.className = 'pd' + (i < turn ? ' done' : i === turn ? ' cur' : '');
    dots.appendChild(d);
  }
}

function updateSidebarRound(round) {
  document.querySelectorAll('.sb-round').forEach((r, i) => {
    r.classList.toggle('cur', i === round - 1);
  });
}

function updateScoreDisplay() {
  const ta = STATE.scores.a.reduce((s, v) => s + v, 0);
  const tb = STATE.scores.b.reduce((s, v) => s + v, 0);
  document.getElementById('score-a').textContent = ta;
  document.getElementById('score-b').textContent = tb;
}

// ─────────────────────────────────────────
// FEED BUILDERS
// ─────────────────────────────────────────

function appendBubble(side, musician, text) {
  const feed = document.getElementById('feed');
  const row = document.createElement('div');
  row.className = 'msg-row';
  row.innerHTML =
    `<div class="av av-${side}" style="width:26px;height:26px;font-size:9px;margin-top:2px">${musician.initial}</div>` +
    `<div class="msg-body">` +
    `<div class="sender-${side}">${shortName(musician.name)}</div>` +
    `<div class="bubble bub-${side}">${escHtml(text)}</div>` +
    `</div>`;
  feed.appendChild(row);
  feed.scrollTop = feed.scrollHeight;
}

function appendGrBlock(main, question) {
  const feed = document.getElementById('feed');
  const div = document.createElement('div');
  div.className = 'gr-block';
  div.innerHTML =
    `<div class="av av-gr" style="width:26px;height:26px;font-size:9px;margin-top:2px">Gr</div>` +
    `<div class="gr-bubble-wrap">` +
    `<div class="sender-gr">Gr 小姐 <span class="etag etag-gr">观众席介入</span></div>` +
    `<div class="bubble bub-gr">${escHtml(main)}<div class="gr-q">${escHtml(question)}</div></div>` +
    `</div>`;
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

function appendRandBlock(person, text) {
  const feed = document.getElementById('feed');
  const div = document.createElement('div');
  div.className = 'gr-block';
  div.innerHTML =
    `<div class="av av-rand" style="width:26px;height:26px;font-size:9px;margin-top:2px">${person.initials}</div>` +
    `<div class="gr-bubble-wrap">` +
    `<div class="sender-rand">${escHtml(person.name)} <span class="etag etag-rand">随机观众</span></div>` +
    `<div class="bubble bub-rand">${escHtml(text)}</div>` +
    `</div>`;
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

function appendJudgeCard(jdata, round) {
  const feed = document.getElementById('feed');
  const na = shortName(STATE.musicianA.name);
  const nb = shortName(STATE.musicianB.name);
  const div = document.createElement('div');
  div.className = 'judge-card';
  div.innerHTML =
    `<div class="jc-hd"><div class="jc-title">终极裁判 · 第${round}轮评分</div><div class="jc-round">Round ${round}/3</div></div>` +
    `<div class="jscores">` +
    `<div class="jscore"><div class="jscore-who-a">${na}</div><div class="jscore-n">${jdata.scoreA.total}</div><div class="jscore-d">论据${jdata.scoreA.logic}·反驳${jdata.scoreA.rebuttal}·人格${jdata.scoreA.character}</div></div>` +
    `<div class="jscore"><div class="jscore-who-b">${nb}</div><div class="jscore-n">${jdata.scoreB.total}</div><div class="jscore-d">论据${jdata.scoreB.logic}·反驳${jdata.scoreB.rebuttal}·人格${jdata.scoreB.character}</div></div>` +
    `</div>` +
    `<div class="jc-text">` +
    `<span class="jc-hl">最强：</span>${escHtml(jdata.bestLine?.who === 'A' ? na : nb)}「${escHtml(jdata.bestLine?.quote || '')}」 ` +
    `<span class="jc-hl">最弱：</span>「${escHtml(jdata.weakestLine?.quote || '')}」<br>` +
    `${escHtml(jdata.comment || '')}` +
    (jdata.warning ? `<div class="jc-warn">${escHtml(jdata.warning)}</div>` : '') +
    `</div>`;
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

function appendErrorNote(msg) {
  const feed = document.getElementById('feed');
  const div = document.createElement('div');
  div.style.cssText = 'background:#fff5f5;border:0.5px solid #ffcdd2;border-radius:8px;padding:8px 12px;font-size:11px;color:#e57373;margin-bottom:8px;font-family:system-ui';
  div.textContent = '⚠ ' + msg;
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

// ─────────────────────────────────────────
// INPUT ZONE
// ─────────────────────────────────────────

function setInputZone(mode) {
  const iz = document.getElementById('input-zone');
  if (mode === 'loading') {
    iz.innerHTML = '<div class="iz-hint"><span class="blink"></span>AI 正在生成回复…</div>';
  } else if (mode === 'vote') {
    const na = shortName(STATE.musicianA.name);
    const nb = shortName(STATE.musicianB.name);
    iz.innerHTML =
      `<div style="font-size:11px;color:#888;margin-bottom:7px;font-family:system-ui">本轮结束 · 你支持哪方？说明理由后投票（理由质量影响票权）</div>` +
      `<div class="vote-sides" id="vote-sides-iz">` +
      `<button class="vs-btn" onclick="selectVote(this,'a')">${na}</button>` +
      `<button class="vs-btn" onclick="selectVote(this,'b')">${nb}</button>` +
      `</div>` +
      `<div class="vote-row">` +
      `<input id="vote-reason" class="iz-input" placeholder="说明你支持的理由……" />` +
      `<button class="vote-send" onclick="submitVote()">投票</button>` +
      `</div>`;
  } else if (mode === 'done') {
    iz.innerHTML = '<div style="font-size:12px;color:#888;padding:8px 0;text-align:center;font-family:system-ui">辩论结束，正在生成最终判词…</div>';
  }
}

window.selectVote = function (el, side) {
  document.querySelectorAll('#vote-sides-iz .vs-btn').forEach(b => b.className = 'vs-btn');
  el.className = 'vs-btn sel-' + side;
};

window.submitVote = function () {
  const reason = document.getElementById('vote-reason')?.value.trim() || '';
  const selected = document.querySelector('#vote-sides-iz .vs-btn.sel-a, #vote-sides-iz .vs-btn.sel-b');
  if (!selected) { alert('请先选择支持哪方'); return; }
  const side = selected.classList.contains('sel-a') ? 'a' : 'b';

  // 显示玩家气泡
  const feed = document.getElementById('feed');
  const row = document.createElement('div');
  row.className = 'msg-row right';
  row.innerHTML =
    `<div class="av av-pl" style="width:26px;height:26px;font-size:9px;margin-top:2px">你</div>` +
    `<div class="msg-body"><div class="sender-pl">你</div><div class="bubble bub-pl">${escHtml(reason || '支持' + selected.textContent)}</div></div>`;
  feed.appendChild(row);
  feed.scrollTop = feed.scrollHeight;

  if (voteResolve) {
    voteResolve({ side, reason });
    voteResolve = null;
  }
};

// ─────────────────────────────────────────
// S5: ENDING
// ─────────────────────────────────────────

async function initEnding() {
  const { scores, musicianA, musicianB, randAudience } = STATE;
  const ta = scores.a.reduce((s, v) => s + v, 0);
  const tb = scores.b.reduce((s, v) => s + v, 0);
  const na = shortName(musicianA.name);
  const nb = shortName(musicianB.name);

  document.getElementById('end-na').textContent = na;
  document.getElementById('end-nb').textContent = nb;
  document.getElementById('end-tot-a').textContent = ta;
  document.getElementById('end-tot-b').textContent = tb;
  document.getElementById('end-det-a').textContent =
    `R1 ${scores.a[0]} · R2 ${scores.a[1]} · R3 ${scores.a[2]}`;
  document.getElementById('end-det-b').textContent =
    `R1 ${scores.b[0]} · R2 ${scores.b[1]} · R3 ${scores.b[2]}`;

  // Round breakdown
  for (let i = 1; i <= 3; i++) {
    document.getElementById('rb' + i + 'a').textContent = scores.a[i - 1];
    document.getElementById('rb' + i + 'b').textContent = scores.b[i - 1];
  }

  if (randAudience) {
    document.getElementById('end-rand-name').textContent = randAudience.name;
    document.getElementById('rand-ep-av').textContent = randAudience.initials || randAudience.name.slice(0, 2);
    document.getElementById('rand-ep-name').textContent = randAudience.name;
  }

  // Generate final verdict via API
  try {
    const vdata = await generateFinalVerdict();
    document.getElementById('end-verdict-text').innerHTML =
      `<div style="font-size:14px;font-weight:500;color:#111;margin-bottom:8px;font-family:system-ui">` +
      `经本委员会三轮审议，${escHtml(vdata.winner === 'A' ? musicianA.name : musicianB.name)}以 ` +
      `<span class="${vdata.winner === 'A' ? 'qa' : 'qb'}">${ta > tb ? ta : tb} : ${ta > tb ? tb : ta}</span> 胜出。` +
      `</div>${escHtml(vdata.verdict_text)}`;

    if (vdata.best_line) document.querySelector('.aw:nth-child(1) .aw-na, .aw:nth-child(1) .aw-nb')?.setAttribute('textContent', vdata.best_line.who === 'A' ? na : nb);
    if (vdata.gr_epilogue) document.querySelector('.gr-ep-t').textContent = vdata.gr_epilogue;
    if (vdata.rand_epilogue) document.querySelector('.rand-ep-t').textContent = vdata.rand_epilogue;
  } catch (e) {
    // 静态fallback已在HTML里
  }
}

window.restart = function () {
  STATE.song = null;
  STATE.transcript = [];
  STATE.scores = { a: [0, 0, 0], b: [0, 0, 0] };
  document.getElementById('song-in').value = '';
  document.getElementById('sc-box').style.display = 'none';
  document.getElementById('s1-err').style.display = 'none';
  document.getElementById('s1-next').disabled = true;
  goTo(1);
};

// init
updateGrChar();
