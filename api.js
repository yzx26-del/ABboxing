// ─────────────────────────────────────────
// API CLIENT — 对应 Vercel Serverless Functions
// ─────────────────────────────────────────

async function apiCall(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || '请求失败');
  return data;
}

export const API = {
  health:           ()                                                          => fetch('/api/health').then(r => r.json()),
  analyzeSong:      (songName)                                                  => apiCall('/api/song-analyze',        { songName }),
  deliberationSpeak:(musician, song, stanceHint)                                => apiCall('/api/deliberation-speak',  { musician, song, stanceHint }),
  debateSpeak:      (musician, opponentName, song, round, transcript, grQ, warn)=> apiCall('/api/debate-speak',        { musician, opponentName, song, round, transcript, grQuestion: grQ, judgeWarning: warn }),
  judgeScore:       (transcript, musicianA, musicianB, round, grQ)              => apiCall('/api/judge-score',         { transcript, musicianA, musicianB, round, grQuestion: grQ }),
  grIntervene:      (song, grScript, transcript)                                => apiCall('/api/gr-intervene',        { song, grScript, transcript }),
  audienceSpeak:    (person, song, transcript)                                  => apiCall('/api/audience-speak',      { person, song, transcript }),
  finalVerdict:     (scores, musicianA, musicianB, transcript, randAudience)    => apiCall('/api/judge-verdict',       { scores, musicianA, musicianB, transcript, randAudience }),
};
