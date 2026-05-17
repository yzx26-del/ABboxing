// ─────────────────────────────────────────
// API CLIENT
// 所有与后端的通信都在这里
// ─────────────────────────────────────────

const API_BASE = '';  // 同域部署，留空即可；独立部署改为 'http://localhost:3000'

async function apiCall(endpoint, body) {
  const res = await fetch(`${API_BASE}/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || '请求失败');
  return data;
}

export const API = {

  // 检查后端连通性
  health: async () => {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.json();
  },

  // 歌曲分析
  analyzeSong: (songName) =>
    apiCall('song/analyze', { songName }),

  // 议论期：单条发言
  deliberationSpeak: (musician, song, stanceHint) =>
    apiCall('deliberation/speak', { musician, song, stanceHint }),

  // 辩论发言
  debateSpeak: (musician, opponentName, song, round, transcript, grQuestion, judgeWarning) =>
    apiCall('debate/speak', { musician, opponentName, song, round, transcript, grQuestion, judgeWarning }),

  // 裁判评分
  judgeScore: (transcript, musicianA, musicianB, round, grQuestion) =>
    apiCall('judge/score', { transcript, musicianA, musicianB, round, grQuestion }),

  // Gr小姐介入
  grIntervene: (song, grScript, transcript) =>
    apiCall('gr/intervene', { song, grScript, transcript }),

  // 随机观众发言
  audienceSpeak: (person, song, transcript) =>
    apiCall('audience/speak', { person, song, transcript }),

  // 最终判词
  finalVerdict: (scores, musicianA, musicianB, transcript, randAudience) =>
    apiCall('judge/verdict', { scores, musicianA, musicianB, transcript, randAudience }),
};
