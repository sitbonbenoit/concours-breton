import { useState, useEffect, useRef } from "react";

// ─── STORAGE HELPERS (Airtable via Netlify Function) ─────────────────────────
const API = "/api/db";
const KEYS = { matches: "wc26_matches", bets: "wc26_bets", users: "wc26_users", adminPw: "wc26_admin_pw", groups: "wc26_groups", bonus: "wc26_bonus", redemptions: "wc26_redemptions", convRate: "wc26_conv_rate", announcement: "wc26_announcement" };

const TABLE_MAP = {
  wc26_users:        { table: "users",       keyField: "uid" },
  wc26_matches:      { table: "matches",     keyField: "mid" },
  wc26_bets:         { table: "bets",        keyField: "uid" },
  wc26_groups:       { table: "groups",      keyField: "gid" },
  wc26_bonus:        { table: "bonus",       keyField: "bid" },
  wc26_redemptions:  { table: "redemptions", keyField: "rid" },
};

async function callDB(body) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function loadAll() {
  return callDB({ action: "loadAll" });
}

async function saveOne(key, id, data) {
  const map = TABLE_MAP[key];
  if (!map) return;
  return callDB({ action: "save", table: map.table, keyField: map.keyField, keyValue: String(id), value: data });
}

async function deleteOne(key, id) {
  const map = TABLE_MAP[key];
  if (!map) return;
  return callDB({ action: "delete", table: map.table, keyField: map.keyField, keyValue: String(id) });
}

async function load(key) {
  if (key === "wc26_admin_pw" || key === "wc26_conv_rate") {
    const data = await callDB({ action: "loadAll" });
    return data.config?.[key] || null;
  }
  const map = TABLE_MAP[key];
  if (!map) return null;
  const data = await callDB({ action: "loadAll" });
  return data[map.table] || null;
}

async function save(key, val) {
  if (key === "wc26_admin_pw" || key === "wc26_conv_rate" || key === "wc26_announcement") {
    await callDB({ action: "saveConfig", key, value: String(val) });
    return;
  }
  const map = TABLE_MAP[key];
  if (!map) return;
  await Promise.all(Object.entries(val || {}).map(([id, data]) =>
    callDB({ action: "save", table: map.table, keyField: map.keyField, keyValue: String(id), value: data })
  ));
}

// ─── PARRAINAGE ───────────────────────────────────────────────────────────────
function generateReferralCode(name, existingCodes) {
  const base = name.toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // retire les accents
    .replace(/[^A-Z]/g, "")
    .slice(0, 5)
    .padEnd(3, "X");
  let code;
  do {
    const digits = String(Math.floor(100 + Math.random() * 900));
    code = base + digits;
  } while (existingCodes.includes(code));
  return code;
}
const REFERRAL_CAP = 5; // nombre max de parrainages récompensés par parrain

// ─── ALL 36 GROUP STAGE MATCHES (heure française) ─────────────────────────────
const WC2026_MATCHES = [
  // GROUPE A – Mexique, Afrique du Sud, Corée du Sud, Rép. Tchèque
  { id:1,  home:"🇲🇽 Mexique",       away:"🇿🇦 Afrique du Sud",  date:"2026-06-11T21:00", group:"Groupe A" },
  { id:2,  home:"🇰🇷 Corée du Sud",  away:"🇨🇿 Rép. Tchèque",   date:"2026-06-12T04:00", group:"Groupe A" },
  { id:3,  home:"🇨🇿 Rép. Tchèque", away:"🇿🇦 Afrique du Sud",  date:"2026-06-18T18:00", group:"Groupe A" },
  { id:4,  home:"🇲🇽 Mexique",       away:"🇰🇷 Corée du Sud",   date:"2026-06-19T03:00", group:"Groupe A" },
  { id:5,  home:"🇨🇿 Rép. Tchèque", away:"🇲🇽 Mexique",         date:"2026-06-25T03:00", group:"Groupe A" },
  { id:6,  home:"🇿🇦 Afrique du Sud",away:"🇰🇷 Corée du Sud",   date:"2026-06-25T03:00", group:"Groupe A" },
  // GROUPE B – Canada, Bosnie-Herzégovine, Qatar, Suisse
  { id:7,  home:"🇨🇦 Canada",        away:"🇧🇦 Bosnie-Herzégovine", date:"2026-06-12T21:00", group:"Groupe B" },
  { id:8,  home:"🇶🇦 Qatar",         away:"🇨🇭 Suisse",           date:"2026-06-13T21:00", group:"Groupe B" },
  { id:9,  home:"🇨🇭 Suisse",        away:"🇧🇦 Bosnie-Herzégovine", date:"2026-06-18T21:00", group:"Groupe B" },
  { id:10, home:"🇨🇦 Canada",        away:"🇶🇦 Qatar",            date:"2026-06-19T00:00", group:"Groupe B" },
  { id:11, home:"🇨🇭 Suisse",        away:"🇨🇦 Canada",           date:"2026-06-24T21:00", group:"Groupe B" },
  { id:12, home:"🇧🇦 Bosnie-Herzégovine", away:"🇶🇦 Qatar",       date:"2026-06-24T21:00", group:"Groupe B" },
  // GROUPE C – Brésil, Maroc, Haïti, Écosse
  { id:13, home:"🇧🇷 Brésil",        away:"🇲🇦 Maroc",           date:"2026-06-14T00:00", group:"Groupe C" },
  { id:14, home:"🇭🇹 Haïti",         away:"🏴󠁧󠁢󠁳󠁣󠁴󠁿 Écosse",         date:"2026-06-14T03:00", group:"Groupe C" },
  { id:15, home:"🏴󠁧󠁢󠁳󠁣󠁴󠁿 Écosse",       away:"🇲🇦 Maroc",           date:"2026-06-20T00:00", group:"Groupe C" },
  { id:16, home:"🇧🇷 Brésil",        away:"🇭🇹 Haïti",           date:"2026-06-20T03:00", group:"Groupe C" },
  { id:17, home:"🏴󠁧󠁢󠁳󠁣󠁴󠁿 Écosse",       away:"🇧🇷 Brésil",          date:"2026-06-25T00:00", group:"Groupe C" },
  { id:18, home:"🇲🇦 Maroc",         away:"🇭🇹 Haïti",           date:"2026-06-25T00:00", group:"Groupe C" },
  // GROUPE D – États-Unis, Paraguay, Australie, Turquie
  { id:19, home:"🇺🇸 États-Unis",    away:"🇵🇾 Paraguay",        date:"2026-06-13T03:00", group:"Groupe D" },
  { id:20, home:"🇦🇺 Australie",     away:"🇹🇷 Turquie",         date:"2026-06-13T06:00", group:"Groupe D" },
  { id:21, home:"🇹🇷 Turquie",       away:"🇵🇾 Paraguay",        date:"2026-06-19T06:00", group:"Groupe D" },
  { id:22, home:"🇺🇸 États-Unis",    away:"🇦🇺 Australie",       date:"2026-06-19T21:00", group:"Groupe D" },
  { id:23, home:"🇹🇷 Turquie",       away:"🇺🇸 États-Unis",      date:"2026-06-26T04:00", group:"Groupe D" },
  { id:24, home:"🇵🇾 Paraguay",      away:"🇦🇺 Australie",       date:"2026-06-26T04:00", group:"Groupe D" },
  // GROUPE E – Allemagne, Curaçao, Côte d'Ivoire, Équateur
  { id:25, home:"🇩🇪 Allemagne",     away:"🇨🇼 Curaçao",         date:"2026-06-14T19:00", group:"Groupe E" },
  { id:26, home:"🇨🇮 Côte d'Ivoire", away:"🇪🇨 Équateur",        date:"2026-06-15T01:00", group:"Groupe E" },
  { id:27, home:"🇩🇪 Allemagne",     away:"🇨🇮 Côte d'Ivoire",  date:"2026-06-20T22:00", group:"Groupe E" },
  { id:28, home:"🇪🇨 Équateur",      away:"🇨🇼 Curaçao",         date:"2026-06-21T02:00", group:"Groupe E" },
  { id:29, home:"🇪🇨 Équateur",      away:"🇩🇪 Allemagne",       date:"2026-06-25T22:00", group:"Groupe E" },
  { id:30, home:"🇨🇼 Curaçao",       away:"🇨🇮 Côte d'Ivoire",  date:"2026-06-25T22:00", group:"Groupe E" },
  // GROUPE F – Pays-Bas, Japon, Suède, Tunisie
  { id:31, home:"🇳🇱 Pays-Bas",      away:"🇯🇵 Japon",           date:"2026-06-14T22:00", group:"Groupe F" },
  { id:32, home:"🇸🇪 Suède",         away:"🇹🇳 Tunisie",         date:"2026-06-15T04:00", group:"Groupe F" },
  { id:33, home:"🇳🇱 Pays-Bas",      away:"🇸🇪 Suède",           date:"2026-06-20T19:00", group:"Groupe F" },
  { id:34, home:"🇹🇳 Tunisie",       away:"🇯🇵 Japon",           date:"2026-06-21T06:00", group:"Groupe F" },
  { id:35, home:"🇹🇳 Tunisie",       away:"🇳🇱 Pays-Bas",        date:"2026-06-26T01:00", group:"Groupe F" },
  { id:36, home:"🇯🇵 Japon",         away:"🇸🇪 Suède",           date:"2026-06-26T01:00", group:"Groupe F" },
  // GROUPE G – Belgique, Égypte, Iran, Nouvelle-Zélande
  { id:37, home:"🇧🇪 Belgique",      away:"🇪🇬 Égypte",          date:"2026-06-15T21:00", group:"Groupe G" },
  { id:38, home:"🇮🇷 Iran",          away:"🇳🇿 Nouvelle-Zélande", date:"2026-06-16T03:00", group:"Groupe G" },
  { id:39, home:"🇧🇪 Belgique",      away:"🇮🇷 Iran",            date:"2026-06-21T21:00", group:"Groupe G" },
  { id:40, home:"🇳🇿 Nouvelle-Zélande", away:"🇪🇬 Égypte",      date:"2026-06-22T03:00", group:"Groupe G" },
  { id:41, home:"🇳🇿 Nouvelle-Zélande", away:"🇧🇪 Belgique",     date:"2026-06-27T05:00", group:"Groupe G" },
  { id:42, home:"🇪🇬 Égypte",        away:"🇮🇷 Iran",            date:"2026-06-27T05:00", group:"Groupe G" },
  // GROUPE H – Espagne, Cap-Vert, Arabie Saoudite, Uruguay
  { id:43, home:"🇪🇸 Espagne",       away:"🇨🇻 Cap-Vert",        date:"2026-06-15T18:00", group:"Groupe H" },
  { id:44, home:"🇸🇦 Arabie Saoudite", away:"🇺🇾 Uruguay",       date:"2026-06-16T00:00", group:"Groupe H" },
  { id:45, home:"🇪🇸 Espagne",       away:"🇸🇦 Arabie Saoudite", date:"2026-06-21T18:00", group:"Groupe H" },
  { id:46, home:"🇺🇾 Uruguay",       away:"🇨🇻 Cap-Vert",        date:"2026-06-22T00:00", group:"Groupe H" },
  { id:47, home:"🇺🇾 Uruguay",       away:"🇪🇸 Espagne",         date:"2026-06-27T02:00", group:"Groupe H" },
  { id:48, home:"🇨🇻 Cap-Vert",      away:"🇸🇦 Arabie Saoudite", date:"2026-06-27T02:00", group:"Groupe H" },
  // GROUPE I – France, Sénégal, Norvège, Irak
  { id:49, home:"🇫🇷 France",        away:"🇸🇳 Sénégal",         date:"2026-06-16T21:00", group:"Groupe I 🇫🇷" },
  { id:50, home:"🇮🇶 Irak",          away:"🇳🇴 Norvège",          date:"2026-06-17T03:00", group:"Groupe I 🇫🇷" },
  { id:51, home:"🇫🇷 France",        away:"🇮🇶 Irak",            date:"2026-06-22T23:00", group:"Groupe I 🇫🇷" },
  { id:52, home:"🇳🇴 Norvège",       away:"🇸🇳 Sénégal",         date:"2026-06-23T03:00", group:"Groupe I 🇫🇷" },
  { id:53, home:"🇳🇴 Norvège",       away:"🇫🇷 France",          date:"2026-06-26T21:00", group:"Groupe I 🇫🇷" },
  { id:54, home:"🇸🇳 Sénégal",       away:"🇮🇶 Irak",            date:"2026-06-26T21:00", group:"Groupe I 🇫🇷" },
  // GROUPE J – Argentine, Algérie, Autriche, Jordanie
  { id:55, home:"🇦🇷 Argentine",     away:"🇩🇿 Algérie",         date:"2026-06-17T21:00", group:"Groupe J" },
  { id:56, home:"🇦🇹 Autriche",      away:"🇯🇴 Jordanie",        date:"2026-06-18T03:00", group:"Groupe J" },
  { id:57, home:"🇦🇷 Argentine",     away:"🇦🇹 Autriche",        date:"2026-06-23T21:00", group:"Groupe J" },
  { id:58, home:"🇩🇿 Algérie",       away:"🇯🇴 Jordanie",        date:"2026-06-24T03:00", group:"Groupe J" },
  { id:59, home:"🇩🇿 Algérie",       away:"🇦🇹 Autriche",        date:"2026-06-28T21:00", group:"Groupe J" },
  { id:60, home:"🇯🇴 Jordanie",      away:"🇦🇷 Argentine",       date:"2026-06-28T21:00", group:"Groupe J" },
  // GROUPE K – Portugal, Colombie, Ouzbékistan, Ghana
  { id:61, home:"🇵🇹 Portugal",      away:"🇨🇴 Colombie",        date:"2026-06-17T00:00", group:"Groupe K" },
  { id:62, home:"🇺🇿 Ouzbékistan",   away:"🇬🇭 Ghana",           date:"2026-06-17T06:00", group:"Groupe K" },
  { id:63, home:"🇵🇹 Portugal",      away:"🇺🇿 Ouzbékistan",     date:"2026-06-22T21:00", group:"Groupe K" },
  { id:64, home:"🇨🇴 Colombie",      away:"🇬🇭 Ghana",           date:"2026-06-23T03:00", group:"Groupe K" },
  { id:65, home:"🇨🇴 Colombie",      away:"🇵🇹 Portugal",        date:"2026-06-27T21:00", group:"Groupe K" },
  { id:66, home:"🇬🇭 Ghana",         away:"🇺🇿 Ouzbékistan",     date:"2026-06-27T21:00", group:"Groupe K" },
  // GROUPE L – Angleterre, Croatie, Ghana, Panama  (note: Ghana also in K – FIFA scheduling)
  { id:67, home:"🏴󠁧󠁢󠁥󠁮󠁧󠁿 Angleterre",  away:"🇭🇷 Croatie",          date:"2026-06-18T00:00", group:"Groupe L" },
  { id:68, home:"🇵🇦 Panama",        away:"🏴󠁧󠁢󠁥󠁮󠁧󠁿 Angleterre",     date:"2026-06-18T06:00", group:"Groupe L" },
  { id:69, home:"🏴󠁧󠁢󠁥󠁮󠁧󠁿 Angleterre",  away:"🇵🇦 Panama",           date:"2026-06-24T00:00", group:"Groupe L" },
  { id:70, home:"🇭🇷 Croatie",       away:"🏴󠁧󠁢󠁥󠁮󠁧󠁿 Angleterre",     date:"2026-06-24T06:00", group:"Groupe L" },
  { id:71, home:"🇭🇷 Croatie",       away:"🇵🇦 Panama",           date:"2026-06-29T21:00", group:"Groupe L" },
  { id:72, home:"🏴󠁧󠁢󠁥󠁮󠁧󠁿 Angleterre",  away:"🇭🇷 Croatie",          date:"2026-06-29T21:00", group:"Groupe L" },
].map(m => ({ ...m, homeScore: null, awayScore: null, finished: false }));

// ─── SCORING ──────────────────────────────────────────────────────────────────
function calcPoints(bet, match) {
  if (match.homeScore === null || match.awayScore === null) return 0;
  if (bet.homeScore === match.homeScore && bet.awayScore === match.awayScore) return 4;
  const betW  = bet.homeScore  > bet.awayScore  ? "H" : bet.homeScore  < bet.awayScore  ? "A" : "D";
  const realW = match.homeScore > match.awayScore ? "H" : match.homeScore < match.awayScore ? "A" : "D";
  return betW === realW ? 1 : 0;
}
function totalScore(uid, matches, bets, bonus) {
  const betPts = matches.filter(m=>m.finished).reduce((acc,m)=>{
    const b = bets[uid]?.[String(m.id)]; return acc + (b ? calcPoints(b,m) : 0);
  },0);
  const bonusPts = Object.values(bonus[uid]||{}).reduce((acc,b)=>acc+b.pts,0);
  return betPts + bonusPts;
}
function spentPoints(uid, redemptions) {
  return Object.values(redemptions[uid]||{}).filter(r=>r.status==="validated"||r.status==="used").reduce((acc,r)=>acc+r.pts,0);
}
function availablePoints(uid, matches, bets, bonus, redemptions) {
  return totalScore(uid, matches, bets, bonus) - spentPoints(uid, redemptions);
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [matches,      setMatches]      = useState([]);
  const [bets,         setBets]         = useState({});
  const [users,        setUsers]        = useState({});
  const [adminPw,      setAdminPw]      = useState("admin123");
  const [view,         setView]         = useState("home");
  const [currentUser,  setCurrentUser]  = useState(() => {
    try { const s = localStorage.getItem("concours_session"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [adminMode,    setAdminMode]    = useState(false);
  const [loaded,       setLoaded]       = useState(false);
  const [toast,        setToast]        = useState(null);
  const [groups,       setGroups]       = useState({});
  const [bonus,        setBonus]        = useState({});
  const [redemptions,  setRedemptions]  = useState({});
  const [convRate,     setConvRate]     = useState(10);
  const [announcement, setAnnouncement]  = useState("");

  // Sauvegarder/effacer la session automatiquement
  useEffect(() => {
    try {
      if (currentUser) localStorage.setItem("concours_session", JSON.stringify(currentUser));
      else localStorage.removeItem("concours_session");
    } catch {}
  }, [currentUser]);

  useEffect(() => {
    (async () => {
      try {
        const data = await loadAll();
        const matchValues = Object.values(data.matches || {});
        setMatches(matchValues.length > 0 ? matchValues : [...WC2026_MATCHES, ...PHASE_FINALE_MATCHES]);
        setBets(data.bets || {});
        setUsers(data.users || {});
        if (data.config?.wc26_admin_pw) setAdminPw(data.config.wc26_admin_pw);
        setGroups(data.groups || {});
        setBonus(data.bonus || {});
        setRedemptions(data.redemptions || {});
        if (data.config?.wc26_conv_rate) setConvRate(parseInt(data.config.wc26_conv_rate) || 10);
        setAnnouncement(data.config?.wc26_announcement || "");
      } catch(e) {
        console.error("Erreur chargement:", e);
        setMatches([...WC2026_MATCHES, ...PHASE_FINALE_MATCHES]);
      }
      setLoaded(true);
    })();
  }, []);

  const showToast = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
  const persistMatches = async m => {
    setMatches(m);
    const obj = Array.isArray(m) ? Object.fromEntries(m.map(x => [String(x.id), x])) : m;
    await Promise.all(Object.entries(obj).map(([id, data]) => saveOne(KEYS.matches, id, data)));
  };
  const persistBets    = async b => { setBets(b);    await save(KEYS.bets, b); };
  const persistUsers   = async u => {
    setUsers(u);
    // Sauvegarder chaque utilisateur individuellement
    await Promise.all(Object.entries(u).map(([id, data]) => saveOne(KEYS.users, id, data)));
  };
  const persistGroups      = async g => { setGroups(g);      await save(KEYS.groups, g); };
  const persistBonus       = async b => { setBonus(b);       await save(KEYS.bonus, b); };
  const persistRedemptions = async r => { setRedemptions(r); await save(KEYS.redemptions, r); };
  const persistConvRate    = async r => { setConvRate(r);    await save(KEYS.convRate, r); };
  const persistAnnouncement = async a => { setAnnouncement(a); await save(KEYS.announcement, a); };

  if (!loaded) return (
    <div style={S.loadWrap}>
      <div style={S.spinner} />
      <p style={{color:"#94a3b8",marginTop:16}}>Chargement…</p>
    </div>
  );

  return (
    <div style={S.root}>
      <Header view={view} setView={setView} currentUser={currentUser} setCurrentUser={setCurrentUser} adminMode={adminMode} setAdminMode={setAdminMode} />
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {view === "home"        && <HomeView setView={setView} currentUser={currentUser} setCurrentUser={setCurrentUser} users={users} persistUsers={persistUsers} bonus={bonus} persistBonus={persistBonus} adminPw={adminPw} setAdminMode={setAdminMode} showToast={showToast} announcement={announcement} />}
      {view === "bet"  && currentUser && <BetView matches={matches} bets={bets} currentUser={currentUser} users={users} persistUsers={persistUsers} bonus={bonus} persistBonus={persistBonus} persistBets={persistBets} showToast={showToast} />}
      {view === "leaderboard" && <LeaderboardView matches={matches} bets={bets} users={users} bonus={bonus} redemptions={redemptions} currentUser={currentUser} />}
      {view === "mygroup"     && <MyGroupView currentUser={currentUser} users={users} groups={groups} persistGroups={persistGroups} bets={bets} matches={matches} bonus={bonus} showToast={showToast} />}
      {view === "solde" && currentUser && <SoldeView currentUser={currentUser} matches={matches} bets={bets} bonus={bonus} redemptions={redemptions} persistRedemptions={persistRedemptions} convRate={convRate} showToast={showToast} />}
      {view === "regles" && <ReglesView setView={setView} />}
      {view === "profil" && currentUser && <ProfilView currentUser={currentUser} users={users} persistUsers={persistUsers} showToast={showToast} setCurrentUser={setCurrentUser} />}
      {view === "admin" && adminMode  && <AdminView matches={matches} setMatches={setMatches} persistMatches={persistMatches} bets={bets} setBets={setBets} users={users} setUsers={setUsers} persistUsers={persistUsers} persistBets={persistBets} groups={groups} persistGroups={persistGroups} bonus={bonus} setBonus={setBonus} persistBonus={persistBonus} redemptions={redemptions} persistRedemptions={persistRedemptions} convRate={convRate} persistConvRate={persistConvRate} adminPw={adminPw} setAdminPw={async p => { setAdminPw(p); await save(KEYS.adminPw, p); }} announcement={announcement} persistAnnouncement={persistAnnouncement} showToast={showToast} />}
    </div>
  );
}

// ─── HEADER ───────────────────────────────────────────────────────────────────
function Header({ view, setView, currentUser, setCurrentUser, adminMode, setAdminMode }) {
  const tabs = [
    { id:"home",        label:"Accueil" },
    { id:"bet",         label:"Mes Paris" },
    { id:"leaderboard", label:"Classement" },
    { id:"mygroup",     label:"Mon Groupe" },
    { id:"solde",       label:"Mon Solde" },
    { id:"regles",      label:"Règles" },
    ...(currentUser ? [{ id:"profil", label:"Mon Profil" }] : []),
    ...(adminMode && !currentUser ? [{ id:"admin", label:"Admin" }] : []),
  ];
  return (
    <header style={S.header}>
      <div style={S.headerInner}>
        <div style={S.logo}>
          <img
            src="https://raw.githubusercontent.com/anthropics/anthropic-cookbook/main/misc/blank.png"
            onError={e => { e.target.style.display="none"; }}
            alt=""
            style={{display:"none"}}
          />
          <div style={S.logoTextBlock}>
            <div style={S.logoTitle}>LE COMPTOIR BRETON</div>
            <div style={S.logoSub}>CONCOURS DE PRONOSTICS · COUPE DU MONDE 2026</div>
          </div>
        </div>
        <nav style={S.nav}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setView(t.id)} style={view === t.id ? S.tabActive : S.tab}>{t.label}</button>
          ))}
          {currentUser && <button onClick={() => { setCurrentUser(null); setAdminMode(false); }} style={S.logoutBtn}>Déconnexion</button>}
        </nav>
      </div>
    </header>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────

const PHASE_FINALE_MATCHES = [
  { id:9101, home:"2e Groupe A", away:"2e Groupe B", date:"2026-06-28T21:00", group:"16e de finale", finished:false },
  { id:9102, home:"1er Groupe C", away:"2e Groupe F", date:"2026-06-29T19:00", group:"16e de finale", finished:false },
  { id:9103, home:"1er Groupe E", away:"3e (A/B/C/D/F)", date:"2026-06-29T22:30", group:"16e de finale", finished:false },
  { id:9104, home:"1er Groupe F", away:"2e Groupe C", date:"2026-06-30T03:00", group:"16e de finale", finished:false },
  { id:9105, home:"2e Groupe E", away:"2e Groupe I", date:"2026-06-30T19:00", group:"16e de finale", finished:false },
  { id:9106, home:"1er Groupe I", away:"3e (C/D/F/G/H)", date:"2026-06-30T23:00", group:"16e de finale", finished:false },
  { id:9107, home:"1er Groupe A", away:"3e (C/E/F/H/I)", date:"2026-07-01T03:00", group:"16e de finale", finished:false },
  { id:9108, home:"1er Groupe L", away:"3e (E/H/I/J/K)", date:"2026-07-01T18:00", group:"16e de finale", finished:false },
  { id:9109, home:"1er Groupe G", away:"3e (A/E/H/I/J)", date:"2026-07-01T22:00", group:"16e de finale", finished:false },
  { id:9110, home:"1er Groupe D", away:"3e (B/E/F/I/J)", date:"2026-07-02T02:00", group:"16e de finale", finished:false },
  { id:9111, home:"1er Groupe H", away:"2e Groupe J", date:"2026-07-02T21:00", group:"16e de finale", finished:false },
  { id:9112, home:"2e Groupe K", away:"2e Groupe L", date:"2026-07-03T01:00", group:"16e de finale", finished:false },
  { id:9113, home:"1er Groupe B", away:"3e (E/F/G/I/J)", date:"2026-07-03T05:00", group:"16e de finale", finished:false },
  { id:9114, home:"2e Groupe D", away:"2e Groupe G", date:"2026-07-03T20:00", group:"16e de finale", finished:false },
  { id:9115, home:"1er Groupe J", away:"2e Groupe H", date:"2026-07-04T00:00", group:"16e de finale", finished:false },
  { id:9116, home:"1er Groupe K", away:"3e (D/E/I/J/L)", date:"2026-07-04T03:30", group:"16e de finale", finished:false },
  { id:9201, home:"Vainqueur 16e-1", away:"Vainqueur 16e-2", date:"2026-07-05T21:00", group:"8e de finale", finished:false },
  { id:9202, home:"Vainqueur 16e-3", away:"Vainqueur 16e-4", date:"2026-07-05T01:00", group:"8e de finale", finished:false },
  { id:9203, home:"Vainqueur 16e-5", away:"Vainqueur 16e-6", date:"2026-07-06T21:00", group:"8e de finale", finished:false },
  { id:9204, home:"Vainqueur 16e-7", away:"Vainqueur 16e-8", date:"2026-07-06T01:00", group:"8e de finale", finished:false },
  { id:9205, home:"Vainqueur 16e-9", away:"Vainqueur 16e-10", date:"2026-07-07T21:00", group:"8e de finale", finished:false },
  { id:9206, home:"Vainqueur 16e-11", away:"Vainqueur 16e-12", date:"2026-07-07T01:00", group:"8e de finale", finished:false },
  { id:9207, home:"Vainqueur 16e-13", away:"Vainqueur 16e-14", date:"2026-07-08T21:00", group:"8e de finale", finished:false },
  { id:9208, home:"Vainqueur 16e-15", away:"Vainqueur 16e-16", date:"2026-07-08T01:00", group:"8e de finale", finished:false },
  { id:9301, home:"Vainqueur 8e-1", away:"Vainqueur 8e-2", date:"2026-07-09T21:00", group:"Quart de finale", finished:false },
  { id:9302, home:"Vainqueur 8e-3", away:"Vainqueur 8e-4", date:"2026-07-10T21:00", group:"Quart de finale", finished:false },
  { id:9303, home:"Vainqueur 8e-5", away:"Vainqueur 8e-6", date:"2026-07-11T01:00", group:"Quart de finale", finished:false },
  { id:9304, home:"Vainqueur 8e-7", away:"Vainqueur 8e-8", date:"2026-07-11T21:00", group:"Quart de finale", finished:false },
  { id:9401, home:"Vainqueur QF-1", away:"Vainqueur QF-2", date:"2026-07-14T21:00", group:"Demi-finale", finished:false },
  { id:9402, home:"Vainqueur QF-3", away:"Vainqueur QF-4", date:"2026-07-15T21:00", group:"Demi-finale", finished:false },
  { id:9501, home:"Perdant DF-1", away:"Perdant DF-2", date:"2026-07-18T21:00", group:"3e place", finished:false },
  { id:9601, home:"Vainqueur DF-1", away:"Vainqueur DF-2", date:"2026-07-19T21:00", group:"Finale", finished:false },
];

// ─── PROFIL VIEW ──────────────────────────────────────────────────────────────
function ProfilView({ currentUser, users, persistUsers, showToast, setCurrentUser }) {
  const [oldPw,  setOldPw]  = useState("");
  const [newPw,  setNewPw]  = useState("");
  const [newPw2, setNewPw2] = useState("");

  // Génère un code de parrainage si l'utilisateur n'en a pas encore (anciens comptes)
  useEffect(() => {
    if (!users[currentUser.id]?.referralCode) {
      const existingCodes = Object.values(users).map(u => u.referralCode).filter(Boolean);
      const code = generateReferralCode(currentUser.name, existingCodes);
      const nu = { ...users, [currentUser.id]: { ...users[currentUser.id], referralCode: code } };
      persistUsers(nu);
    }
  }, [currentUser.id]);

  const myCode = users[currentUser.id]?.referralCode || "…";
  const referredUsers = Object.entries(users).filter(([,u]) => u.referredBy === currentUser.id);
  const referredCount = referredUsers.filter(([,u]) => u.referralBonusGiven).length;

  const copyCode = () => {
    navigator.clipboard?.writeText(myCode);
    showToast("Code copié ! Partage-le à tes amis 🎁");
  };

  const changePw = async () => {
    if (!oldPw||!newPw||!newPw2) return showToast("Remplis tous les champs","err");
    if (users[currentUser.id]?.password !== oldPw) return showToast("Mot de passe actuel incorrect","err");
    if (newPw.length < 4) return showToast("Minimum 4 caractères","err");
    if (newPw !== newPw2) return showToast("Les mots de passe ne correspondent pas","err");
    const nu = {...users,[currentUser.id]:{...users[currentUser.id],password:newPw}};
    await persistUsers(nu);
    setOldPw(""); setNewPw(""); setNewPw2("");
    showToast("Mot de passe modifié ✓");
  };

  return (
    <div style={S.page}>
      <div style={{maxWidth:480,margin:"0 auto",padding:"0 16px 40px"}}>
        <h2 style={{...S.pageTitle,textAlign:"center"}}>👤 Mon Profil</h2>
        <div style={S.card}>
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}>
            <div style={{...S.avatar,background:currentUser.color,width:56,height:56,fontSize:24}}>{currentUser.name[0].toUpperCase()}</div>
            <div>
              <div style={{fontFamily:"'Lexend',sans-serif",fontWeight:700,fontSize:18}}>{currentUser.name}</div>
              <div style={{fontSize:12,color:"#888"}}>Participant au Concours Breton</div>
            </div>
          </div>
        </div>

        <div style={{...S.card,border:"2px dashed #f5d9a0",background:"rgba(252,235,207,0.25)"}}>
          <h3 style={{...S.cardTitle,color:"#7a5200"}}>🎁 Parraine tes amis</h3>
          <p style={{fontSize:13,color:"#444",lineHeight:1.6,margin:"0 0 10px"}}>
            Donne ce code à tes amis lors de leur inscription. Dès que ton ami place son <strong>premier pari</strong>, vous gagnez chacun <strong>+10 pts bonus</strong> !
          </p>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{flex:1,fontFamily:"monospace",fontWeight:800,fontSize:22,color:"#7a5200",letterSpacing:3,textAlign:"center",background:"#fff",borderRadius:8,padding:"10px",border:"2px dashed #f5d9a0"}}>
              {myCode}
            </div>
            <button style={{...S.btnPrimary,background:"#8a5e00",borderColor:"#8a5e00"}} onClick={copyCode}>📋 Copier</button>
          </div>
          {referredCount > 0 && (
            <p style={{fontSize:12,color:"#7a5200",marginTop:10,marginBottom:0}}>
              ✅ Tu as déjà parrainé <strong>{referredCount}</strong> ami{referredCount>1?"s":""} avec succès
              {referredCount >= REFERRAL_CAP && <span> — limite de {REFERRAL_CAP} atteinte, les prochains parrainages ne donneront plus de points.</span>}
            </p>
          )}
        </div>

        <div style={S.card}>
          <h3 style={S.cardTitle}>🔑 Changer mon mot de passe</h3>
          <input style={S.input} type="password" placeholder="Mot de passe actuel" value={oldPw} onChange={e=>setOldPw(e.target.value)}/>
          <input style={S.input} type="password" placeholder="Nouveau mot de passe (min. 4 car.)" value={newPw} onChange={e=>setNewPw(e.target.value)}/>
          <input style={S.input} type="password" placeholder="Confirmer le nouveau mot de passe" value={newPw2} onChange={e=>setNewPw2(e.target.value)} onKeyDown={e=>e.key==="Enter"&&changePw()}/>
          <button style={S.btnPrimary} onClick={changePw}>Mettre à jour</button>
        </div>
      </div>
    </div>
  );
}

// ─── RÈGLES VIEW ──────────────────────────────────────────────────────────────
function ReglesView({ setView }) {
  return (
    <div style={S.page}>
      <div style={{maxWidth:600,margin:"0 auto",padding:"0 16px 40px"}}>
        <h2 style={{...S.pageTitle,textAlign:"center"}}>📋 Règles du Concours</h2>
        <div style={S.card}>
          <h3 style={S.cardTitle}>⚽ Principe du jeu</h3>
          <p style={{fontSize:14,color:"#444",lineHeight:1.7,margin:0}}>Pronostique le score exact de chaque match. Tes paris sont <strong>secrets jusqu'au coup d'envoi</strong> — personne ne peut les voir avant le début du match.</p>
        </div>
        <div style={S.card}>
          <h3 style={S.cardTitle}>🎯 Barème des points</h3>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",borderRadius:10,background:"rgba(100,116,139,0.06)"}}>
              <span style={{fontSize:28,fontWeight:800,color:"#94a3b8",minWidth:40,textAlign:"center"}}>0</span>
              <div><p style={{margin:0,fontWeight:700,fontSize:14}}>Score faux</p><p style={{margin:0,fontSize:12,color:"#888"}}>Mauvais vainqueur ou mauvais score</p></div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",borderRadius:10,background:"rgba(18,50,132,0.06)"}}>
              <span style={{fontSize:28,fontWeight:800,color:C.bleu,minWidth:40,textAlign:"center"}}>1</span>
              <div><p style={{margin:0,fontWeight:700,fontSize:14}}>Bon vainqueur</p><p style={{margin:0,fontSize:12,color:"#888"}}>Tu as trouvé qui gagne mais pas le score exact</p></div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",borderRadius:10,background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.3)"}}>
              <span style={{fontSize:28,fontWeight:800,color:"#f59e0b",minWidth:40,textAlign:"center"}}>4</span>
              <div><p style={{margin:0,fontWeight:700,fontSize:14}}>⭐ Score exact !</p><p style={{margin:0,fontSize:12,color:"#888"}}>Tu as trouvé le score exact — le jackpot !</p></div>
            </div>
          </div>
        </div>
        <div style={S.card}>
          <h3 style={S.cardTitle}>👥 Groupes privés</h3>
          <p style={{fontSize:14,color:"#444",lineHeight:1.7,margin:0}}>Crée un groupe privé et invite tes amis avec un <strong>code d'invitation</strong>. Tu peux voir le classement de ton groupe séparément du classement général.</p>
        </div>
        <div style={S.card}>
          <h3 style={S.cardTitle}>⭐ Points bonus</h3>
          <p style={{fontSize:14,color:"#444",lineHeight:1.7,margin:"0 0 10px"}}>
            L'équipe du Comptoir Breton peut attribuer des <strong>points bonus</strong> à certains participants (ex : les 25 premiers inscrits, défis spéciaux, surprises…). Ces points s'ajoutent à ton total et améliorent ta position au classement.
          </p>
          <p style={{fontSize:14,color:"#c0392b",lineHeight:1.7,margin:0,padding:"8px 12px",background:"rgba(192,57,43,0.06)",borderRadius:6,borderLeft:"3px solid #c0392b"}}>
            ⚠️ <strong>Important :</strong> si tu transformes des points en bon de réduction, ces points sont <strong>déduits de ton score au classement général</strong>. Réfléchis bien avant d'échanger !
          </p>
        </div>
        <div style={S.card}>
          <h3 style={S.cardTitle}>🎟️ Bons de réduction</h3>
          <p style={{fontSize:14,color:"#444",lineHeight:1.7,margin:"0 0 10px"}}>
            Échange tes points contre des réductions sur ton addition : <strong>10 points = 1€</strong>, jusqu'à <strong>200 points validés</strong> au total sur toute la durée du concours.
          </p>
          <p style={{fontSize:14,color:"#444",lineHeight:1.7,margin:"0 0 10px"}}>
            Une fois ta demande validée par l'équipe, un <strong>bon numérique</strong> apparaît dans "Mon Solde". Il comporte un code unique à présenter au serveur.
          </p>
          <div style={{padding:"10px 14px",background:"rgba(18,50,132,0.06)",borderRadius:6,borderLeft:"3px solid #123284",fontSize:13,color:"#444",lineHeight:1.7}}>
            📅 <strong>Le bon doit être présenté le jour même de ta venue au restaurant.</strong> Pensez à le mentionner idéalement au moment de votre réservation. Le serveur le marquera comme utilisé dans l'application — il ne pourra pas être réutilisé.
          </div>
        </div>
        <div style={S.card}>
          <h3 style={S.cardTitle}>🏆 Récompenses</h3>
          <p style={{fontSize:14,color:"#444",lineHeight:1.7,margin:0}}><strong>Les 5 premiers du classement général</strong> seront récompensés au nom de la gourmandise. Soyez perspicaces, bon courage à tous !</p>
        </div>
        <button style={{...S.btnPrimary,width:"100%",marginTop:8}} onClick={()=>setView("bet")}>⚽ Commencer à parier</button>
      </div>
    </div>
  );
}

// ─── COUNTDOWN BANNER ────────────────────────────────────────────────────────
function CountdownBanner() {
  const [timeLeft, setTimeLeft] = useState(null);
  useEffect(() => {
    const target = new Date("2026-06-11T21:00:00+02:00");
    const calc = () => {
      const diff = target - new Date();
      if (diff <= 0) { setTimeLeft(null); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ d, h, m, s });
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, []);
  if (!timeLeft) return null;
  return (
    <div style={{background:"linear-gradient(135deg,#02050C,#123284)",borderRadius:16,padding:"16px 24px",margin:"20px auto",maxWidth:420,color:"#fff",fontFamily:"'Lexend',sans-serif"}}>
      <div style={{fontSize:11,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,0.6)",marginBottom:10}}>⏱ Premier match dans</div>
      <div style={{display:"flex",gap:12,justifyContent:"center"}}>
        {[{v:timeLeft.d,l:"Jours"},{v:timeLeft.h,l:"Heures"},{v:timeLeft.m,l:"Min"},{v:timeLeft.s,l:"Sec"}].map(({v,l})=>(
          <div key={l} style={{textAlign:"center",minWidth:52,background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"8px 4px"}}>
            <div style={{fontSize:28,fontWeight:800,lineHeight:1}}>{String(v).padStart(2,"0")}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:4}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:10}}>🇲🇽 Mexique vs 🇿🇦 Afrique du Sud · Jeudi 11 Juin 2026</div>
    </div>
  );
}

function HomeView({ setView, currentUser, setCurrentUser, users, persistUsers, bonus, persistBonus, adminPw, setAdminMode, showToast, announcement }) {
  const [mode,      setMode]      = useState(null);
  const [name,      setName]      = useState("");
  const [userPw,    setUserPw]    = useState("");
  const [userPw2,   setUserPw2]   = useState("");
  const [adminInput,setAdminInput]= useState("");
  const [loading,   setLoading]   = useState(false);
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#6366f1","#ec4899","#14b8a6","#8b5cf6","#f43f5e"];

  const resetForm = () => { setName(""); setUserPw(""); setUserPw2(""); setAdminInput(""); setReferralCodeInput(""); };

  const handleRegister = async () => {
    if (loading) return;
    if (!name.trim())           return showToast("Entre ton prénom !", "err");
    if (!userPw.trim())         return showToast("Choisis un mot de passe !", "err");
    if (userPw !== userPw2)     return showToast("Les mots de passe ne correspondent pas !", "err");
    if (userPw.length < 4)      return showToast("Mot de passe trop court (4 caractères min) !", "err");
    if (Object.values(users).find(u => u.name.toLowerCase() === name.toLowerCase()))
      return showToast("Ce nom est déjà pris !", "err");
    // ── Vérifier le code de parrainage AVANT de créer le compte ──
    let referredByUid = null;
    if (referralCodeInput.trim()) {
      const found = Object.entries(users).find(([,u]) => u.referralCode === referralCodeInput.trim());
      if (!found) return showToast("Code de parrainage invalide. Vérifie l'orthographe ou laisse le champ vide.", "err");
      referredByUid = found[0];
    }

    setLoading(true);
    try {
      const id = name.toLowerCase().replace(/[^a-z0-9]/g,"_") + "_" + Date.now();
      const color = COLORS[Object.keys(users).length % COLORS.length];
      const existingCodes = Object.values(users).map(u => u.referralCode).filter(Boolean);
      const myReferralCode = generateReferralCode(name.trim(), existingCodes);
      const nu = {
        ...users,
        [id]: {
          name: name.trim(), color, password: userPw,
          referralCode: myReferralCode,
          ...(referredByUid ? { referredBy: referredByUid, referralBonusGiven: false } : {}),
        }
      };
      await persistUsers(nu);

      setCurrentUser({ id, name: nu[id].name, color: nu[id].color });
      setAdminMode(false);
      showToast(referredByUid
        ? `Bienvenue ${name.trim()} ! 🎉 Place ton 1er pari pour débloquer vos +10 pts de parrainage 🎁`
        : `Bienvenue ${name.trim()} ! 🎉`);
      setView("bet");
    } finally { setLoading(false); }
  };

  const handleLogin = () => {
    const found = Object.entries(users).find(([,u]) => u.name.toLowerCase() === name.toLowerCase());
    if (!found) return showToast("Joueur introuvable !", "err");
    if (found[1].password && found[1].password !== userPw)
      return showToast("Mot de passe incorrect !", "err");
    setCurrentUser({ id: found[0], name: found[1].name, color: found[1].color });
    setAdminMode(false);
    showToast(`Bon retour ${found[1].name} ! ⚽`);
    setView("bet");
  };

  const handleAdmin = () => {
    if (adminInput === adminPw) { setAdminMode(true); setView("admin"); showToast("Mode admin activé"); }
    else showToast("Mot de passe incorrect !", "err");
  };

  if (currentUser) return (
    <div style={S.page}>
      {announcement && (
        <div style={{background:C.bleu,color:"#fff",padding:"10px 16px",textAlign:"center",fontSize:13,fontWeight:600,fontFamily:"'Lexend',sans-serif",lineHeight:1.5}}>
          📢 {announcement}
        </div>
      )}
      <div style={S.hero}>
        <div style={{ ...S.avatar, background: currentUser.color, width:72, height:72, fontSize:30, margin:"0 auto 16px" }}>{currentUser.name[0].toUpperCase()}</div>
        <h2 style={S.heroName}>Bonjour, {currentUser.name} !</h2>
        <p style={S.heroSub}>Prêt à faire tes pronostics sur les 72 matchs de la phase de groupes ?</p>
        <div style={S.heroButtons}>
          <button style={S.btnPrimary} onClick={() => setView("bet")}>⚽ Mes Paris</button>
          <button style={S.btnSecondary} onClick={() => setView("leaderboard")}>🏆 Classement</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      {announcement && (
        <div style={{background:C.bleu,color:"#fff",padding:"10px 16px",textAlign:"center",fontSize:13,fontWeight:600,fontFamily:"'Lexend',sans-serif",lineHeight:1.5}}>
          📢 {announcement}
        </div>
      )}
      <div style={S.hero}>
        <img src="/logo.png" alt="Le Comptoir Breton" style={{width:150,height:150,objectFit:"contain",margin:"0 auto 16px",display:"block"}} />
        <h1 style={S.heroTitle}>Le Concours Breton</h1>
        <p style={S.heroDesc}>Les 5 premiers du classement général seront récompensés au nom de la gourmandise.<br />Soyez perspicace. Bon courage à tous.</p>

        {!mode && (
          <div style={S.heroButtons}>
            <button style={S.btnPrimary} onClick={() => { resetForm(); setMode("register"); }}>🆕 S'inscrire</button>
            <button style={S.btnSecondary} onClick={() => { resetForm(); setMode("login"); }}>🔑 Se connecter</button>
          </div>
        )}

        <div style={S.statsRow}>
          <div style={{...S.statBox,cursor:"pointer"}} onClick={()=>setView("bet")}><span style={{fontSize:28}}>⚽</span><span style={S.statLabel}>Mes Paris</span></div>
          <div style={{...S.statBox,cursor:"pointer"}} onClick={()=>setView("leaderboard")}><span style={{fontSize:28}}>🏆</span><span style={S.statLabel}>Mon Classement</span></div>
          <div style={{...S.statBox,cursor:"pointer"}} onClick={()=>setView("solde")}><span style={{fontSize:28}}>⭐</span><span style={S.statLabel}>Mes Bonus</span></div>
        </div>
        <p style={{textAlign:"center",fontSize:13,margin:"8px 0 0",color:C.bleu}}>
          <span style={{cursor:"pointer",textDecoration:"underline",fontWeight:600}} onClick={()=>setView("solde")}>✨ Obtiens des points bonus</span>
          {" "}et transforme-les en gourmandises !
        </p>
        {!mode && <p style={{textAlign:"center",margin:"8px 0 0"}}><button style={{...S.btnGhost,fontSize:11,padding:"4px 12px",color:"#aaa",borderColor:"#ddd"}} onClick={()=>{resetForm();setMode("admin");}}>⚙️ Admin</button></p>}
        {mode === "register" && (
          <div style={S.card}>
            <h3 style={S.cardTitle}>🆕 Créer un compte</h3>
            <input style={S.input} placeholder="Ton prénom (visible de tous)" value={name} onChange={e=>setName(e.target.value)} autoFocus />
            <input style={S.input} type="password" placeholder="Mot de passe (min. 4 caractères)" value={userPw} onChange={e=>setUserPw(e.target.value)} />
            <input style={S.input} type="password" placeholder="Confirmer le mot de passe" value={userPw2} onChange={e=>setUserPw2(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleRegister()} />
            <p style={{fontSize:12,color:"#64748b",margin:0}}>🔒 Ton mot de passe protège l'accès à tes paris.</p>

            {Object.keys(users).length > 0 && (
              <>
                <label style={{fontSize:12,color:"#64748b",fontWeight:600}}>🎁 Code de parrainage (optionnel — +10 pts pour vous deux après ton 1er pari !)</label>
                <input style={S.input} placeholder="Ex : THOMAS482" value={referralCodeInput}
                  onChange={e=>setReferralCodeInput(e.target.value.toUpperCase())} maxLength={10} />
              </>
            )}
            <button style={{...S.btnPrimary,opacity:loading?0.7:1,cursor:loading?"not-allowed":"pointer"}} onClick={handleRegister} disabled={loading}>{loading?"⏳ Inscription en cours…":"Rejoindre le concours 🚀"}</button>
            <button style={S.btnLink} onClick={() => setMode(null)}>Annuler</button>
          </div>
        )}
        {mode === "login" && (
          <div style={S.card}>
            <h3 style={S.cardTitle}>🔑 Se connecter</h3>
            <input style={S.input} placeholder="Ton prénom" value={name} onChange={e=>setName(e.target.value)} autoFocus />
            <input style={S.input} type="password" placeholder="Mot de passe" value={userPw} onChange={e=>setUserPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} />
            <button style={S.btnPrimary} onClick={handleLogin}>Accéder à mes paris 🔓</button>
            <button style={S.btnLink} onClick={() => setMode(null)}>Annuler</button>
          </div>
        )}
        {mode === "admin" && (
          <div style={S.card}>
            <h3 style={S.cardTitle}>⚙️ Accès Administrateur</h3>
            <input style={S.input} type="password" placeholder="Mot de passe admin" value={adminInput} onChange={e=>setAdminInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdmin()} autoFocus />
            <button style={S.btnPrimary} onClick={handleAdmin}>Entrer</button>
            <button style={S.btnLink} onClick={() => setMode(null)}>Annuler</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── COUNTDOWN HOOK ───────────────────────────────────────────────────────────
function useCountdown(targetDate) {
  const calc = () => {
    const diff = new Date(targetDate) - new Date();
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { h, m, s, diff };
  };
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(t);
  }, [targetDate]);
  return left;
}

// ─── COUNTDOWN BADGE ──────────────────────────────────────────────────────────
function CountdownBadge({ date }) {
  const left = useCountdown(date);
  if (!left) return null;
  const urgent = left.diff < 3600000; // < 1h
  const style = {
    display:"inline-flex", alignItems:"center", gap:4,
    background: urgent ? "rgba(192,57,43,0.1)" : "rgba(18,50,132,0.07)",
    border: `1px solid ${urgent ? "rgba(192,57,43,0.3)" : "rgba(18,50,132,0.2)"}`,
    color: urgent ? "#c0392b" : "#123284",
    borderRadius:3, padding:"2px 8px", fontSize:10,
    fontFamily:"'Lexend',sans-serif", fontWeight:700, letterSpacing:1,
  };
  const txt = left.h > 0
    ? `⏱ ${left.h}h ${String(left.m).padStart(2,"0")}min`
    : `⏱ ${String(left.m).padStart(2,"0")}:${String(left.s).padStart(2,"0")}`;
  return <span style={style}>{txt}</span>;
}

// ─── SHARE BUTTON ─────────────────────────────────────────────────────────────
function ShareButton({ currentUser, bets, matches, users }) {
  const [copied, setCopied] = useState(false);

  const buildText = () => {
    const finished = matches.filter(m => m.finished);
    const total = finished.reduce((acc, m) => {
      const bet = bets[currentUser.id]?.[String(m.id)];
      return acc + (bet ? calcPoints(bet, m) : 0);
    }, 0);
    const exact = finished.filter(m => {
      const b = bets[currentUser.id]?.[String(m.id)];
      return b && calcPoints(b, m) === 4;
    }).length;
    const scores = Object.entries(users).map(([uid, u]) => {
      let t = 0;
      finished.forEach(m => { const b = bets[uid]?.[String(m.id)]; if (b) t += calcPoints(b, m); });
      return { name: u.name, total: t };
    }).sort((a,b) => b.total - a.total);
    const rank = scores.findIndex(s => s.name === currentUser.name) + 1;
    const lines = [
      "🏆 Le Concours du Comptoir — Coupe du Monde 2026",
      "",
      `👤 ${currentUser.name}`,
      `📊 ${total} pts · ${exact} score${exact>1?"s":""} exact${exact>1?"s":""}`,
      `🎯 Classement : ${rank > 0 ? `${rank}e / ${scores.length}` : "–"}`,
      "",
      "🥇 Top 3 :",
      ...scores.slice(0,3).map((s,i) => `  ${["🥇","🥈","🥉"][i]} ${s.name} — ${s.total} pts`),
      "",
      "Rejoins le concours sur lecomptoirbreton.fr !",
    ];
    return lines.join("\n");
  };

  const handleShare = async () => {
    const text = buildText();
    try {
      if (navigator.share) {
        await navigator.share({ title: "Le Concours du Comptoir", text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {}
  };

  return (
    <button onClick={handleShare} style={{...S.btnSecondary, fontSize:12, padding:"8px 16px"}}>
      {copied ? "✓ Copié !" : "📤 Partager mon score"}
    </button>
  );
}

// ─── BET VIEW ─────────────────────────────────────────────────────────────────
function BetView({ matches, bets, currentUser, persistBets, users, persistUsers, bonus, persistBonus, showToast }) {
  const [draft,        setDraft]        = useState({});
  const [filterGroup,  setFilterGroup]  = useState("Tous");
  const [search,       setSearch]       = useState("");
  const [popupMatch,   setPopupMatch]   = useState(null);
  const [popupSearch,  setPopupSearch]  = useState("");

  useEffect(() => {
    const myBets = bets[currentUser.id] || {};
    const init = {};
    matches.forEach(m => {
      init[m.id] = myBets[String(m.id)]
        ? { home: String(myBets[String(m.id)].homeScore), away: String(myBets[String(m.id)].awayScore) }
        : { home: "", away: "" };
    });
    setDraft(init);
  }, [matches, bets, currentUser.id]);

  const saveBet = async matchId => {
    const { home, away } = draft[matchId] || {};
    if (home === "" || away === "") return showToast("Entre les deux scores !", "err");
    const h = parseInt(home), a = parseInt(away);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return showToast("Scores invalides !", "err");
    const match = matches.find(m => m.id === matchId);
    if (match.finished) return showToast("Ce match est terminé !", "err");
    if (new Date(match.date) <= new Date()) return showToast("Les paris sont fermés pour ce match !", "err");

    const isFirstBet = Object.keys(bets[currentUser.id]||{}).length === 0;
    const nb = { ...bets, [currentUser.id]: { ...(bets[currentUser.id]||{}), [String(matchId)]: { homeScore:h, awayScore:a } } };
    await persistBets(nb);

    // ── Bonus de parrainage : déclenché au 1er pari du filleul ──
    let referralMsg = "";
    const me = users[currentUser.id];
    if (isFirstBet && me?.referredBy && me.referralBonusGiven !== true) {
      const referrerUid = me.referredBy;
      const referrer = users[referrerUid];
      if (referrer) {
        // Vérifier le plafond de parrainages déjà récompensés pour ce parrain
        const alreadyRewarded = Object.values(users).filter(u => u.referredBy === referrerUid && u.referralBonusGiven === true).length;
        if (alreadyRewarded < REFERRAL_CAP) {
          const today = new Date().toLocaleDateString("fr-FR");
          const newBonus = { ...bonus };
          newBonus[referrerUid] = { ...(newBonus[referrerUid]||{}), [`ref_${currentUser.id}`]: { pts:10, label:`🎁 Parrainage de ${me.name}`, date: today } };
          newBonus[currentUser.id] = { ...(newBonus[currentUser.id]||{}), [`ref_in_${currentUser.id}`]: { pts:10, label:`🎁 Parrainé par ${referrer.name}`, date: today } };
          await persistBonus(newBonus);

          const nu = { ...users, [currentUser.id]: { ...users[currentUser.id], referralBonusGiven: true } };
          await persistUsers(nu);

          referralMsg = " · 🎁 +10 pts de parrainage débloqués pour vous deux !";
        } else {
          // Limite atteinte : on marque tout de même comme "traité" pour ne pas re-tester à chaque pari
          const nu = { ...users, [currentUser.id]: { ...users[currentUser.id], referralBonusGiven: true } };
          await persistUsers(nu);
        }
      }
    }

    showToast("Pari enregistré ! 🔒" + referralMsg);
  };

  const matchGroups = ["Tous", ...new Set(matches.map(m => m.group))];
  const myBetsCount = Object.keys(bets[currentUser.id] || {}).length;
  const openMatches = matches.filter(m => !m.finished && new Date(m.date) > new Date()).length;

  const now2 = new Date();
  const filtered = matches
    .filter(m => {
      const groupOk = filterGroup === "Tous" || m.group === filterGroup;
      const searchOk = !search || m.home.toLowerCase().includes(search.toLowerCase()) || m.away.toLowerCase().includes(search.toLowerCase());
      return groupOk && searchOk;
    })
    .sort((a, b) => {
      const aClosed = a.finished || new Date(a.date) <= now2;
      const bClosed = b.finished || new Date(b.date) <= now2;
      if (aClosed && !bClosed) return 1;
      if (!aClosed && bClosed) return -1;
      return new Date(a.date) - new Date(b.date);
    });

  return (
    <div style={S.page}>
      <div style={S.pageHeader}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div>
            <h2 style={S.pageTitle}>Mes Pronostics</h2>
            <p style={S.pageSub}>{myBetsCount} pari{myBetsCount>1?"s":""} enregistré{myBetsCount>1?"s":""} · {openMatches} match{openMatches>1?"s":""} encore ouvert{openMatches>1?"s":""}</p>
          </div>
          <ShareButton currentUser={currentUser} bets={bets} matches={matches} users={users} />
        </div>
        {(() => {
          const finishedM = matches.filter(m=>m.finished);
          const myPts = finishedM.reduce((acc,m)=>{ const b=(bets[currentUser.id]||{})[String(m.id)]; return acc+(b?calcPoints(b,m):0); },0);
          const myExact = finishedM.filter(m=>{ const b=(bets[currentUser.id]||{})[String(m.id)]; return b&&calcPoints(b,m)===4; }).length;
          if (finishedM.length===0) return null;
          return (
            <div style={{display:"flex",gap:12,marginTop:12,flexWrap:"wrap"}}>
              <div style={{background:C.bleu,borderRadius:10,padding:"8px 18px",display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:22,fontWeight:800,color:"#fff",fontFamily:"'Lexend',sans-serif"}}>{myPts}</span>
                <span style={{fontSize:11,color:"rgba(255,255,255,0.75)",textTransform:"uppercase",letterSpacing:1}}>pts gagnés</span>
              </div>
              <div style={{background:"rgba(18,50,132,0.06)",borderRadius:10,padding:"8px 18px",display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:22,fontWeight:800,color:C.bleu,fontFamily:"'Lexend',sans-serif"}}>{myExact}</span>
                <span style={{fontSize:11,color:"#64748b",textTransform:"uppercase",letterSpacing:1}}>⭐ scores exacts</span>
              </div>
            </div>
          );
        })()}
      </div>

      <div style={S.filterBar}>
        <input style={{...S.input, maxWidth:220, fontSize:13}} placeholder="🔍 Rechercher une équipe…" value={search} onChange={e=>setSearch(e.target.value)} />
        <div style={S.groupFilter}>
          {matchGroups.map(g => (
            <button key={g} onClick={()=>setFilterGroup(g)} style={filterGroup===g ? S.groupBtnActive : S.groupBtn}>
              {g === "Tous" ? "Tous" : g.replace("Groupe ","G")}
            </button>
          ))}
        </div>
      </div>

      {/* ── Avertissement phase éliminatoire ── */}
      {filterGroup !== "Tous" && ["16e de finale","8e de finale","Quart de finale","Demi-finale","3e place","Finale"].includes(filterGroup) && (
        <div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",gap:10,alignItems:"flex-start"}}>
          <span style={{fontSize:18}}>⏱️</span>
          <p style={{margin:0,fontSize:13,color:"#7a5200",lineHeight:1.6}}>
            <strong>Phase éliminatoire :</strong> les paris portent sur le score à l'issue du <strong>temps réglementaire (90 min)</strong>. Les prolongations et les tirs aux buts ne sont pas pris en compte.
          </p>
        </div>
      )}

      {/* ── Classement du groupe sélectionné (phase de groupes uniquement) ── */}
      {filterGroup !== "Tous" && !["16e de finale","8e de finale","Quart de finale","Demi-finale","3e place","Finale"].includes(filterGroup) && (() => {
        const groupMatches = matches.filter(m => m.group === filterGroup && m.finished);
        const teams = [...new Set(matches.filter(m=>m.group===filterGroup).flatMap(m=>[m.home,m.away]))];
        const standings = teams.map(team => {
          let pts=0, played=0, won=0, drawn=0, lost=0, gf=0, ga=0;
          groupMatches.forEach(m => {
            const isHome = m.home===team, isAway = m.away===team;
            if (!isHome && !isAway) return;
            played++;
            gf += isHome ? m.homeScore : m.awayScore;
            ga += isHome ? m.awayScore : m.homeScore;
            const diff = m.homeScore - m.awayScore;
            if (diff===0) { pts+=1; drawn++; }
            else if ((isHome&&diff>0)||(isAway&&diff<0)) { pts+=3; won++; }
            else lost++;
          });
          return { team, pts, played, won, drawn, lost, gf, ga, diff:gf-ga };
        }).sort((a,b)=>b.pts-a.pts||b.diff-a.diff||b.gf-a.gf);

        return (
          <div style={{background:"rgba(18,50,132,0.04)",border:"1px solid rgba(18,50,132,0.12)",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13}}>
            <div style={{fontWeight:700,color:"#123284",fontFamily:"'Lexend',sans-serif",marginBottom:8,fontSize:12,letterSpacing:1,textTransform:"uppercase"}}>📊 Classement {filterGroup}</div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{color:"#888",fontSize:11}}>
                  <th style={{textAlign:"left",padding:"2px 4px"}}>#</th>
                  <th style={{textAlign:"left",padding:"2px 4px"}}>Équipe</th>
                  <th style={{padding:"2px 6px"}}>J</th>
                  <th style={{padding:"2px 6px"}}>G</th>
                  <th style={{padding:"2px 6px"}}>N</th>
                  <th style={{padding:"2px 6px"}}>P</th>
                  <th style={{padding:"2px 6px"}}>Diff</th>
                  <th style={{padding:"2px 6px",fontWeight:700,color:"#123284"}}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s,i) => (
                  <tr key={s.team} style={{borderTop:"1px solid rgba(0,0,0,0.05)",background:i<2?"rgba(18,50,132,0.04)":"transparent"}}>
                    <td style={{padding:"4px",color:"#888",fontSize:12}}>{i+1}</td>
                    <td style={{padding:"4px",fontWeight:i<2?700:400,fontSize:12,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.team}</td>
                    <td style={{textAlign:"center",padding:"4px 6px",fontSize:12}}>{s.played}</td>
                    <td style={{textAlign:"center",padding:"4px 6px",fontSize:12}}>{s.won}</td>
                    <td style={{textAlign:"center",padding:"4px 6px",fontSize:12}}>{s.drawn}</td>
                    <td style={{textAlign:"center",padding:"4px 6px",fontSize:12}}>{s.lost}</td>
                    <td style={{textAlign:"center",padding:"4px 6px",fontSize:12,color:s.diff>0?"#1e7d4f":s.diff<0?"#c0392b":"#888"}}>{s.diff>0?"+":""}{s.diff}</td>
                    <td style={{textAlign:"center",padding:"4px 6px",fontSize:12,fontWeight:700,color:"#123284"}}>{s.pts}</td>
                  </tr>
                ))}
                {standings.length===0 && <tr><td colSpan={8} style={{textAlign:"center",color:"#888",fontSize:12,padding:8}}>Aucun match terminé dans ce groupe</td></tr>}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* ── Popup paris des autres participants ── */}
      {popupMatch && (() => {
        const m = popupMatch;
        const participants = Object.entries(users).filter(([uid]) => uid !== currentUser.id);
        const filtered2 = participants.filter(([,u]) => !popupSearch || u.name.toLowerCase().includes(popupSearch.toLowerCase()));
        const now3 = new Date();
        const kicked = new Date(m.date) <= now3 || m.finished;
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>{setPopupMatch(null);setPopupSearch("");}}>
            <div style={{background:"#fff",borderRadius:16,padding:20,maxWidth:420,width:"100%",maxHeight:"80vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}} onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <h3 style={{margin:0,fontSize:15,fontFamily:"'Lexend',sans-serif",color:"#123284"}}>{m.home} vs {m.away}</h3>
                <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#888"}} onClick={()=>{setPopupMatch(null);setPopupSearch("");}}>✕</button>
              </div>
              {!kicked && <p style={{fontSize:12,color:"#f59e0b",margin:"0 0 10px",textAlign:"center"}}>⏳ Paris secrets jusqu'au coup d'envoi</p>}
              {kicked && (
                <>
                  <input style={{...S.input,fontSize:13,marginBottom:10}} placeholder="🔍 Rechercher un participant…" value={popupSearch} onChange={e=>setPopupSearch(e.target.value)} />
                  {filtered2.length === 0 && <p style={{textAlign:"center",color:"#888",fontSize:13}}>Aucun participant trouvé</p>}
                  {filtered2.map(([uid, u]) => {
                    const bet = bets[uid]?.[String(m.id)];
                    const pts = bet && m.finished ? calcPoints(bet, m) : null;
                    return (
                      <div key={uid} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",borderRadius:8,background:"rgba(18,50,132,0.04)",marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{...S.avatar,background:u.color,width:28,height:28,fontSize:13}}>{u.name[0].toUpperCase()}</div>
                          <span style={{fontSize:13,fontWeight:600}}>{u.name}</span>
                        </div>
                        {bet ? (
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <span style={{fontWeight:700,fontSize:14}}>{bet.homeScore} - {bet.awayScore}</span>
                            {pts !== null && <span style={{fontSize:11,padding:"2px 6px",borderRadius:10,background:pts===4?"#f59e0b":pts===1?"#94a3b8":"#e2e8f0",color:pts===4?"#fff":pts===1?"#fff":"#64748b",fontWeight:700}}>{pts===4?"⭐4":pts===1?"✓1":"✗0"}</span>}
                          </div>
                        ) : <span style={{fontSize:12,color:"#94a3b8"}}>Pas de pari</span>}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {filtered.map(match => {
        const myBet = bets[currentUser.id]?.[String(match.id)];
        const now = new Date();
        const matchDate = new Date(match.date);
        const closed = match.finished || matchDate <= now;
        const d = draft[match.id] || { home:"", away:"" };
        const pts = myBet && match.finished ? calcPoints(myBet, match) : null;
        const hoursUntil = (matchDate - now) / 3600000;
        const showCountdown = !closed && hoursUntil <= 48;
        const isUrgent = !closed && hoursUntil <= 2;

        return (
          <div key={match.id} style={closed ? {...S.matchCard,...S.matchCardClosed} : isUrgent ? {...S.matchCard, border:"2px solid #c0392b", boxShadow:"0 0 0 3px rgba(192,57,43,0.12)"} : S.matchCard}>
            {isUrgent && !myBet && (
              <div style={{background:"rgba(192,57,43,0.08)",border:"1px solid rgba(192,57,43,0.25)",borderRadius:6,padding:"6px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16}}>⚡</span>
                <span style={{fontSize:12,fontWeight:700,color:"#c0392b",fontFamily:"'Lexend',sans-serif"}}>Dernier moment pour parier !</span>
                <CountdownBadge date={match.date} />
              </div>
            )}
            {isUrgent && myBet && (
              <div style={{background:"rgba(18,50,132,0.06)",border:"1px solid rgba(18,50,132,0.2)",borderRadius:6,padding:"6px 12px",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16}}>✅</span>
                <span style={{fontSize:12,fontWeight:700,color:"#123284",fontFamily:"'Lexend',sans-serif"}}>Pari enregistré — match dans</span>
                <CountdownBadge date={match.date} />
              </div>
            )}
            <div style={S.matchMeta}>
              <span style={S.groupTag}>{match.group}</span>
              <span style={{fontSize:12,color:"#6b6b6b"}}>
                {matchDate.toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})} · {matchDate.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}
              </span>
              {showCountdown && <CountdownBadge date={match.date} />}
              {closed && <span style={S.closedBadge}>{match.finished?"✅ Terminé":"🔒 Fermé"}</span>}
            </div>
            <div style={S.matchRow}>
              <span style={S.teamName}>{match.home}</span>
              <div style={S.scoreInputs}>
                {closed ? (
                  <div style={S.lockedBet}>
                    {myBet ? (
                      <>
                        <span style={S.lockedScore}>{myBet.homeScore}</span>
                        <span style={S.scoreSep}>-</span>
                        <span style={S.lockedScore}>{myBet.awayScore}</span>
                        {match.finished && (
                          <span style={pts===4?S.ptsBadgeGold:pts===1?S.ptsBadgeSilver:S.ptsBadgeGrey}>
                            {pts===4?"⭐ 4 pts":pts===1?"✓ 1 pt":"✗ 0 pt"}
                          </span>
                        )}
                      </>
                    ) : <span style={S.noBet}>Pas de pari</span>}
                  </div>
                ) : (
                  <>
                    <input style={S.scoreInput} type="number" min="0" max="20" value={d.home} onChange={e=>setDraft(p=>({...p,[match.id]:{...p[match.id],home:e.target.value}}))} placeholder="0" />
                    <span style={S.scoreSep}>-</span>
                    <input style={S.scoreInput} type="number" min="0" max="20" value={d.away} onChange={e=>setDraft(p=>({...p,[match.id]:{...p[match.id],away:e.target.value}}))} placeholder="0" />
                  </>
                )}
              </div>
              <span style={S.teamName}>{match.away}</span>
            </div>
            {match.finished && <div style={S.resultRow}>Résultat officiel : <strong>{match.homeScore} - {match.awayScore}</strong></div>}
            {!closed && (
              <div style={S.matchFooter}>
                {bets[currentUser.id]?.[String(match.id)] && <span style={S.savedBadge}>🔒 Enregistré</span>}
                <button style={S.saveBetBtn} onClick={()=>saveBet(match.id)}>{myBet?"Modifier":"Parier"}</button>
              </div>
            )}
            <div style={{textAlign:"center",marginTop:6}}>
              <button style={{background:"none",border:"none",fontSize:12,color:"#123284",cursor:"pointer",textDecoration:"underline",padding:"2px 0"}} onClick={()=>{setPopupMatch(match);setPopupSearch("");}}>
                👥 Voir les paris des participants
              </button>
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && <div style={S.emptyState}><p>Aucun match trouvé.</p></div>}
    </div>
  );
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────
function LeaderboardView({ matches, bets, users, bonus, redemptions, currentUser }) {
  const now = new Date();
  // Un match est "révélé" si son heure est passée OU s'il est déjà terminé (finished:true)
  const kickedOff = matches.filter(m => new Date(m.date) <= now || m.finished);
  // Matchs terminés = résultat saisi (peu importe la date)
  const finished = matches.filter(m => m.finished);
  // Matchs dont le KO est passé mais résultat pas encore saisi
  const awaitingResult = kickedOff.filter(m => !m.finished);

  // Classement calculé uniquement sur les matchs terminés
  const scores = Object.entries(users).map(([uid, u]) => {
    let betPts=0, exact=0, correct=0;
    finished.forEach(m => {
      const bet = bets[uid]?.[String(m.id)];
      if (!bet) return;
      const p = calcPoints(bet, m);
      betPts += p; if (p===4) exact++; if (p===1) correct++;
    });
    const bonusPts  = Object.values(bonus[uid]||{}).reduce((acc,b)=>acc+b.pts,0);
    const spentPts  = spentPoints(uid, redemptions);
    const total     = betPts + bonusPts - spentPts;
    return { uid, ...u, total, betPts, bonusPts, spentPts, exact, correct, played: Object.keys(bets[uid]||{}).length };
  }).sort((a,b) => b.total-a.total || b.exact-a.exact);

  const medals = ["🥇","🥈","🥉"];
  const podiumStyle = [S.leaderFirst, {}, {}];
  const myRef = useRef(null);
  useEffect(() => { if (myRef.current) setTimeout(() => myRef.current.scrollIntoView({ behavior:"smooth", block:"center" }), 200); }, []);

  const exportCSV = () => {
    const rows = [["Rang","Nom","Points","Exacts","Vainqueurs","Bonus","Échangés"]];
    scores.forEach((p,i) => rows.push([i+1,p.name,p.total,p.exact,p.correct,p.bonusPts,p.spentPts]));
    const csv = rows.map(r=>r.join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
    a.download = "classement-concours-breton.csv"; a.click();
  };

  const printLeaderboard = () => {
    const w = window.open("","_blank");
    const rows = scores.map((p,i)=>`<tr style="background:${i%2===0?"#f8f9fa":"#fff"}${currentUser&&p.uid===currentUser.id?";font-weight:bold;background:#e8eeff":""}"><td style="padding:8px 12px;text-align:center">${["🥇","🥈","🥉"][i]||i+1}</td><td style="padding:8px 12px">${p.name}${currentUser&&p.uid===currentUser.id?" ◀":""}</td><td style="padding:8px 12px;text-align:center;font-weight:bold;color:#123284">${p.total}</td><td style="padding:8px 12px;text-align:center">⭐${p.exact}</td><td style="padding:8px 12px;text-align:center">✓${p.correct}</td><td style="padding:8px 12px;text-align:center">${p.bonusPts>0?"+"+p.bonusPts:"—"}</td></tr>`).join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Classement Concours Breton</title><style>body{font-family:Arial,sans-serif;padding:32px}h1{color:#123284}table{width:100%;border-collapse:collapse;font-size:14px}th{background:#123284;color:#fff;padding:10px 12px;text-align:left}@media print{button{display:none}}</style></head><body><h1>🏆 Le Concours Breton — Classement</h1><p>${finished.length} match${finished.length>1?"s":""} · ${scores.length} participant${scores.length>1?"s":""} · ${new Date().toLocaleDateString("fr-FR")}</p><button onclick="window.print()" style="background:#123284;color:#fff;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;margin-bottom:16px">🖨️ Imprimer</button><table><thead><tr><th>Rang</th><th>Participant</th><th>Points</th><th>Exacts</th><th>Vainqueurs</th><th>Bonus</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    w.document.close();
  };

  return (
    <div style={S.page}>
      <div style={S.pageHeader}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
          <div>
            <h2 style={S.pageTitle}>Classement Général</h2>
            <p style={S.pageSub}>
              {finished.length} match{finished.length>1?"s":""} comptabilisé{finished.length>1?"s":""}
              {awaitingResult.length > 0 && ` · ${awaitingResult.length} en attente de résultat`}
              {" · "}{Object.keys(users).length} participant{Object.keys(users).length>1?"s":""}
            </p>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button style={{...S.btnGhost,fontSize:12,padding:"6px 12px"}} onClick={exportCSV}>⬇️ CSV</button>
            <button style={{...S.btnGhost,fontSize:12,padding:"6px 12px"}} onClick={printLeaderboard}>🖨️ Imprimer</button>
          </div>
        </div>
      </div>

      {awaitingResult.length > 0 && (
        <div style={S.pendingBanner}>
          <span style={{fontSize:16}}>⏳</span>
          <div>
            <strong style={{fontFamily:"'Lexend',sans-serif",fontSize:13}}>En attente du résultat admin</strong>
            <p style={{margin:"3px 0 0",fontSize:12,color:"#6b6b6b",fontStyle:"italic"}}>
              {awaitingResult.map(m => `${m.home} vs ${m.away}`).join(", ")} — coup d'envoi passé, paris de tous visibles, résultat à saisir par l'admin.
            </p>
          </div>
        </div>
      )}

      {scores.length === 0 ? (
        <div style={S.emptyState}><div style={S.emptyIcon}>🏆</div><p>Le classement s'affichera une fois les matchs terminés.</p></div>
      ) : (
        <div style={S.leaderboard}>
          {scores.map((p,i) => {
            const isMe = currentUser && p.uid === currentUser.id;
            return (
              <div key={p.uid} ref={isMe?myRef:null} style={{...(i<3?{...S.leaderRow,...(podiumStyle[i]||{})}:S.leaderRow),...(isMe?{border:"2px solid #123284",background:"rgba(18,50,132,0.08)",boxShadow:"0 0 0 3px rgba(18,50,132,0.15)",borderRadius:12}:{})}}>
                <span style={S.rank}>{medals[i]||`${i+1}`}</span>
                <div style={{...S.avatar,background:p.color}}>{p.name[0].toUpperCase()}</div>
                <div style={S.leaderInfo}>
                  <div style={S.leaderName}>{p.name}{isMe&&<span style={{fontSize:11,background:"#123284",color:"#fff",borderRadius:8,padding:"1px 6px",marginLeft:6}}>Moi</span>}{i===0&&<span style={S.crownBadge}> 👑 Leader</span>}</div>
                  <div style={S.leaderStats}>{p.exact} exact · {p.correct} vainqueur{p.bonusPts>0&&<span style={{color:"#7a5200",fontWeight:700}}> · +{p.bonusPts} bonus</span>}{p.spentPts>0&&<span style={{color:"#c0392b"}}> · -{p.spentPts} échangés</span>}</div>
                </div>
                <div style={S.leaderScore}>{p.total}<span style={S.leaderPtsLabel}>pts</span></div>
              </div>
            );
          })}
        </div>
      )}


    </div>
  );
}

// ─── SOLDE VIEW ───────────────────────────────────────────────────────────────
function SoldeView({ currentUser, matches, bets, bonus, redemptions, persistRedemptions, convRate, showToast }) {
  const [pts,    setPts]    = useState("");
  const [reason, setReason] = useState("");
  const [showBon, setShowBon] = useState(null); // rid du bon à afficher

  const uid = currentUser.id;
  const earned     = totalScore(uid, matches, bets, bonus);
  const spent      = spentPoints(uid, redemptions);
  const avail      = earned - spent;
  const euros      = convRate > 0 ? (avail / convRate).toFixed(2) : 0;
  const MAX_TOTAL  = 200;
  const validatedPts = Object.values(redemptions[uid]||{}).filter(r=>r.status==="validated"||r.status==="used").reduce((a,r)=>a+r.pts,0);
  const remainingAllowed = Math.max(0, MAX_TOTAL - validatedPts);

  const myRedemptions = Object.entries(redemptions[uid] || {}).sort((a,b) => b[1].createdAt - a[1].createdAt);
  const pendingCount  = myRedemptions.filter(([,r]) => r.status === "pending").length;

  const requestRedemption = async () => {
    const p = parseInt(pts);
    if (isNaN(p) || p <= 0) return showToast("Nombre de points invalide !", "err");
    if (p > avail) return showToast(`Tu n'as que ${avail} points disponibles !`, "err");
    if (p < convRate) return showToast(`Minimum ${convRate} points pour une demande !`, "err");
    if (validatedPts >= MAX_TOTAL) return showToast(`Tu as atteint la limite de ${MAX_TOTAL} points échangés !`, "err");
    if (p > remainingAllowed) return showToast(`Il te reste ${remainingAllowed} pts échangeables (limite : ${MAX_TOTAL} pts validés) !`, "err");
    const euros = (p / convRate).toFixed(2);
    const id = "r_" + Date.now();
    const nr = { ...redemptions, [uid]: { ...(redemptions[uid]||{}), [id]: {
      pts: p, euros, reason: reason.trim() || "Réduction crêperie",
      status: "pending", createdAt: Date.now(),
      date: new Date().toLocaleDateString("fr-FR")
    }}};
    await persistRedemptions(nr);
    setPts(""); setReason("");
    showToast(`Demande envoyée ! ${p} pts → ${euros}€ 🎉`);
  };

  const statusStyle = s => s === "validated"
    ? { background:"rgba(30,125,79,0.1)", color:"#1e7d4f", border:"1px solid rgba(30,125,79,0.3)" }
    : s === "used"
    ? { background:"rgba(18,50,132,0.1)", color:"#123284", border:"1px solid rgba(18,50,132,0.3)" }
    : s === "refused"
    ? { background:"rgba(192,57,43,0.1)", color:"#c0392b", border:"1px solid rgba(192,57,43,0.3)" }
    : { background:"rgba(245,158,11,0.1)", color:"#8a5e00", border:"1px solid rgba(245,158,11,0.3)" };

  const statusLabel = s => s === "validated" ? "✅ Validée" : s === "used" ? "🎟️ Utilisée" : s === "refused" ? "✗ Refusée" : "⏳ En attente";

  return (
    <div style={S.page}>
      <div style={S.pageHeader}>
        <h2 style={S.pageTitle}>Mon Solde</h2>
        <p style={S.pageSub}>Échange tes points contre des réductions à la crêperie</p>
      </div>

      {/* Solde cards */}
      <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
        <div style={S.soldeCard}>
          <div style={S.soldeNum}>{earned}</div>
          <div style={S.soldeLabel}>Points gagnés</div>
        </div>
        <div style={{...S.soldeCard,background:"rgba(192,57,43,0.07)",border:"1px solid rgba(192,57,43,0.2)"}}>
          <div style={{...S.soldeNum,color:"#c0392b"}}>-{spent}</div>
          <div style={S.soldeLabel}>Points échangés</div>
        </div>
        <div style={{...S.soldeCard,background:C.naturel,border:`2px solid ${C.naturelD}`}}>
          <div style={{...S.soldeNum,color:"#7a5200"}}>{avail}</div>
          <div style={S.soldeLabel}>Points disponibles</div>
          <div style={{fontSize:11,color:"#7a5200",fontFamily:"'Lexend',sans-serif",marginTop:2}}>≈ {euros}€</div>
        </div>
      </div>

      <div style={{fontSize:12,color:"#6b6b6b",fontStyle:"italic",marginBottom:20,padding:"8px 12px",background:"rgba(18,50,132,0.05)",borderRadius:4,borderLeft:`3px solid ${C.bleu}`}}>
        Taux de conversion : <strong style={{color:C.bleu}}>{convRate} pts = 1€</strong> de réduction
      </div>

      {/* Formulaire de demande */}
      {avail >= convRate && remainingAllowed > 0 ? (
        <div style={{...S.card,marginBottom:24}}>
          <h3 style={S.cardTitle}>Faire une demande d'échange</h3>
          <div style={{fontSize:12,color:"#6b6b6b",marginBottom:8,padding:"6px 10px",background:"rgba(18,50,132,0.05)",borderRadius:4}}>
            Limite : <strong style={{color:C.bleu}}>{validatedPts}/{MAX_TOTAL} pts</strong> validés au total
            {remainingAllowed < 50 && remainingAllowed > 0 && <span style={{color:"#f59e0b",fontWeight:700}}> · Plus que {remainingAllowed} pts échangeables !</span>}
            {remainingAllowed === 0 && <span style={{color:"#c0392b",fontWeight:700}}> · Limite atteinte !</span>}
          </div>
          <input style={S.input} type="number" min={convRate} step={convRate}
            placeholder={`Nombre de points (min. ${convRate})`}
            value={pts} onChange={e=>setPts(e.target.value)} />
          {pts && parseInt(pts) >= convRate && (
            <div style={{fontSize:13,color:"#1e7d4f",fontWeight:700,fontFamily:"'Lexend',sans-serif"}}>
              → {parseInt(pts)} pts = {(parseInt(pts)/convRate).toFixed(2)}€ de réduction
            </div>
          )}
          <input style={S.input} placeholder="Note (facultatif, ex: pour ma prochaine visite)" value={reason} onChange={e=>setReason(e.target.value)} />
          <button style={S.btnPrimary} onClick={requestRedemption}>Envoyer la demande 🎁</button>
        </div>
      ) : (
        <div style={{...S.card,marginBottom:24,textAlign:"center",color:"#6b6b6b"}}>
          <p style={{fontStyle:"italic"}}>Il te faut au moins <strong style={{color:C.bleu}}>{convRate} points</strong> pour faire une demande.<br />Tu peux transformer jusqu'à <strong style={{color:C.bleu}}>{MAX_TOTAL} points validés</strong> au total.<br />Tu en as actuellement <strong>{avail}</strong>.</p>
        </div>
      )}

      {/* Historique des bonus */}
      {Object.keys(bonus[uid]||{}).length > 0 && (
        <div style={S.section}>
          <h3 style={S.sectionTitle}>⭐ Historique des points bonus</h3>
          {Object.entries(bonus[uid]||{}).sort((a,b)=>(b[1].date||"").localeCompare(a[1].date||"")).map(([bid,b]) => (
            <div key={bid} style={{...S.matchCard,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Lexend',sans-serif",fontWeight:700,fontSize:14,color:"#7a5200"}}>+{b.pts} pts bonus</div>
                <div style={{fontSize:12,color:"#6b6b6b",fontStyle:"italic"}}>{b.label}{b.date ? ` · ${b.date}` : ""}</div>
              </div>
              <span style={{background:"rgba(245,158,11,0.15)",color:"#7a5200",border:"1px solid rgba(245,158,11,0.4)",borderRadius:4,padding:"3px 10px",fontSize:11,fontFamily:"'Lexend',sans-serif",fontWeight:700}}>
                ⭐ Bonus
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Historique des échanges */}
      {myRedemptions.length > 0 && (
        <div style={S.section}>
          <h3 style={S.sectionTitle}>Historique de mes demandes</h3>
          {myRedemptions.map(([rid, r]) => (
            <div key={rid} style={{...S.matchCard,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",opacity:r.status==="used"?0.6:1}}>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Lexend',sans-serif",fontWeight:700,fontSize:14,textDecoration:r.status==="used"?"line-through":"none"}}>{r.pts} pts → {r.euros}€</div>
                <div style={{fontSize:12,color:"#6b6b6b",fontStyle:"italic"}}>{r.reason} · {r.date}{r.usedDate&&<span style={{color:"#123284"}}> · Utilisé le {r.usedDate}</span>}</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {r.status === "validated" && (
                  <button style={{...S.btnPrimary,fontSize:12,padding:"5px 12px"}} onClick={()=>setShowBon(rid)}>
                    🎟️ Mon bon
                  </button>
                )}
                <span style={{...statusStyle(r.status),borderRadius:4,padding:"3px 10px",fontSize:11,fontFamily:"'Lexend',sans-serif",fontWeight:700}}>
                  {statusLabel(r.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* ── BON NUMÉRIQUE PLEIN ÉCRAN ── */}
      {showBon && (() => {
        const r = (redemptions[uid]||{})[showBon];
        if (!r) return null;
        const code = "BRETON-" + showBon.replace("r_","").slice(-6).toUpperCase();
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setShowBon(null)}>
            <div style={{background:"#fff",borderRadius:20,padding:32,maxWidth:380,width:"100%",textAlign:"center",boxShadow:"0 30px 80px rgba(0,0,0,0.5)"}} onClick={e=>e.stopPropagation()}>
              {/* Header */}
              <div style={{background:C.bleu,borderRadius:12,padding:"16px 24px",marginBottom:20}}>
                <div style={{fontFamily:"'Lexend',sans-serif",fontWeight:800,fontSize:13,color:"rgba(252,235,207,0.7)",letterSpacing:2,marginBottom:4}}>LE COMPTOIR BRETON</div>
                <div style={{fontFamily:"'Lexend',sans-serif",fontWeight:800,fontSize:20,color:"#fff"}}>BON DE RÉDUCTION</div>
              </div>
              {/* Montant */}
              <div style={{fontSize:64,fontWeight:900,color:C.bleu,fontFamily:"'Lexend',sans-serif",lineHeight:1}}>
                {r.euros}€
              </div>
              <div style={{fontSize:13,color:"#888",margin:"4px 0 20px"}}>de réduction sur votre addition</div>
              {/* Infos */}
              <div style={{background:"#f4f2ed",borderRadius:10,padding:"12px 16px",marginBottom:20,textAlign:"left"}}>
                <div style={{fontSize:13,marginBottom:6}}><strong>Bénéficiaire :</strong> {currentUser.name}</div>
                <div style={{fontSize:13,marginBottom:6}}><strong>Points échangés :</strong> {r.pts} pts</div>
                <div style={{fontSize:13,marginBottom:6}}><strong>Motif :</strong> {r.reason}</div>
                <div style={{fontSize:13}}><strong>Date :</strong> {r.date}</div>
              </div>
              {/* Code unique */}
              <div style={{border:"2px dashed #123284",borderRadius:10,padding:"12px 16px",marginBottom:20}}>
                <div style={{fontSize:11,color:"#888",marginBottom:4,letterSpacing:1}}>CODE BON</div>
                <div style={{fontFamily:"monospace",fontWeight:800,fontSize:22,color:C.bleu,letterSpacing:3}}>{code}</div>
              </div>
              {/* Note */}
              <p style={{fontSize:11,color:"#aaa",margin:"0 0 16px",fontStyle:"italic"}}>Présentez ce bon au serveur. Il sera marqué comme utilisé après validation.</p>
              <button style={{...S.btnGhost,width:"100%"}} onClick={()=>setShowBon(null)}>Fermer</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── DIAGNOSTIC PANEL ────────────────────────────────────────────────────────
function DiagPanel({ matches, bets, users, bonus }) {
  const [info, setInfo] = useState(null);

  const run = () => {
    const lines = [];
    lines.push(`👥 Utilisateurs: ${Object.keys(users).length}`);
    Object.entries(users).forEach(([uid, u]) => {
      const userBets = bets[uid] || {};
      const betKeys = Object.keys(userBets);
      lines.push(`  • ${u.name} (${uid}) → ${betKeys.length} paris, clés: [${betKeys.slice(0,3).join(', ')}${betKeys.length>3?'...':''}]`);
    });
    lines.push('');
    lines.push(`⚽ Matchs: ${matches.length} (${matches.filter(m=>m.finished).length} terminés)`);
    if (matches.length > 0) {
      const m = matches[0];
      lines.push(`  Premier match id: ${m.id} (type: ${typeof m.id})`);
    }
    lines.push('');
    // Test calcul Alice
    const alice = Object.entries(users).find(([,u]) => u.name === 'Alice');
    if (alice) {
      const [uid] = alice;
      const aliceBets = bets[uid] || {};
      let total = 0;
      matches.filter(m=>m.finished).forEach(m => {
        const b1 = aliceBets[m.id];
        const b2 = aliceBets[String(m.id)];
        const b = b1 || b2;
        if (b) {
          const pts = (b.homeScore === m.homeScore && b.awayScore === m.awayScore) ? 4
            : ((b.homeScore > b.awayScore ? 'H' : b.homeScore < b.awayScore ? 'A' : 'D') ===
               (m.homeScore > m.awayScore ? 'H' : m.homeScore < m.awayScore ? 'A' : 'D')) ? 1 : 0;
          total += pts;
          lines.push(`  Alice m${m.id}(${typeof m.id}): clé num=${!!b1} str=${!!b2} → pari ${b.homeScore}-${b.awayScore} vs ${m.homeScore}-${m.awayScore} = ${pts}pts`);
        } else {
          lines.push(`  Alice m${m.id}: ❌ AUCUN PARI TROUVÉ (clés dispo: ${Object.keys(aliceBets).slice(0,5).join(',')})`);
        }
      });
      const bonusPts = Object.values(bonus[uid]||{}).reduce((a,b)=>a+b.pts,0);
      lines.push(`  → Total Alice: ${total} pts paris + ${bonusPts} bonus = ${total+bonusPts}`);
      // Extra debug
      lines.push('');
      lines.push(`Bonus objet: ${JSON.stringify(bonus).slice(0,200)}`);
      lines.push(`Redemptions objet: ${JSON.stringify(bonus).slice(0,100)}`);
      const spentPts = Object.values(bonus[uid]||{}).filter(r=>r.status==="validated").reduce((a,r)=>a+r.pts,0);
      lines.push(`spentPts calculé: ${spentPts}`);
      lines.push(`TOTAL FINAL: ${total} + ${bonusPts} - ${spentPts} = ${total + bonusPts - spentPts}`);
    } else {
      lines.push('Alice non trouvée dans les utilisateurs');
    }
    setInfo(lines.join('\n'));
  };

  return (
    <div>
      <button style={{...S.btnSecondary, fontSize:12, padding:"6px 14px"}} onClick={run}>
        Analyser les données
      </button>
      {info && (
        <pre style={{fontSize:11, marginTop:10, padding:10, background:"#02050C", color:"#22c55e",
          borderRadius:4, overflow:"auto", maxHeight:300, fontFamily:"monospace", lineHeight:1.5}}>
          {info}
        </pre>
      )}
    </div>
  );
}

// ─── GROUP LEADERBOARD ────────────────────────────────────────────────────────
function GroupLeaderboard({ group, users, bets, matches, bonus, showCode=false }) {
  const now = new Date();
  const finished = matches.filter(m => m.finished);
  const members = Object.entries(users).filter(([uid]) => group.members.includes(uid));
  const scores = members.map(([uid,u]) => {
    let betPts=0, exact=0, correct=0;
    finished.forEach(m => {
      const bet = bets[uid]?.[String(m.id)];
      if (!bet) return;
      const p = calcPoints(bet,m);
      betPts+=p; if(p===4) exact++; if(p===1) correct++;
    });
    const bonusPts = Object.values(bonus[uid]||{}).reduce((acc,b)=>acc+b.pts,0);
    return { uid, ...u, total:betPts+bonusPts, betPts, bonusPts, exact, correct };
  }).sort((a,b)=>b.total-a.total||b.exact-a.exact);

  const medals = ["🥇","🥈","🥉"];
  return (
    <div>
      {showCode && (
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,background:"rgba(18,50,132,0.06)",border:"1px solid rgba(18,50,132,0.15)",borderRadius:5,padding:"10px 14px"}}>
          <span style={{fontSize:13,color:"#6b6b6b",fontStyle:"italic"}}>Code d'invitation :</span>
          <code style={{fontFamily:"monospace",fontWeight:800,fontSize:18,color:"#123284",letterSpacing:3}}>{group.code}</code>
          <button style={{...S.btnSecondary,padding:"4px 12px",fontSize:11}} onClick={()=>{
            navigator.clipboard.writeText(group.code);
          }}>Copier</button>
        </div>
      )}
      {scores.length === 0
        ? <p style={{color:"#6b6b6b",fontStyle:"italic",textAlign:"center",padding:20}}>Aucun membre encore.</p>
        : scores.map((p,i) => (
          <div key={p.uid} style={i===0?{...S.leaderRow,...S.leaderFirst}:S.leaderRow}>
            <span style={S.rank}>{medals[i]||`${i+1}`}</span>
            <div style={{...S.avatar,background:p.color}}>{p.name[0].toUpperCase()}</div>
            <div style={S.leaderInfo}>
              <div style={S.leaderName}>{p.name}{i===0&&<span style={S.crownBadge}> 👑</span>}</div>
              <div style={S.leaderStats}>{p.exact} exact · {p.correct} vainqueur{p.bonusPts>0&&<span style={{color:"#7a5200"}}> · +{p.bonusPts} bonus</span>}</div>
            </div>
            <div style={S.leaderScore}>{p.total}<span style={S.leaderPtsLabel}>pts</span></div>
          </div>
        ))
      }
    </div>
  );
}

// ─── MY GROUP VIEW ────────────────────────────────────────────────────────────
function MyGroupView({ currentUser, users, groups, persistGroups, bets, matches, bonus, showToast }) {
  const [mode,      setMode]      = useState(null); // "create"|"join"
  const [groupName, setGroupName] = useState("");
  const [joinCode,  setJoinCode]  = useState("");

  if (!currentUser) return (
    <div style={S.page}>
      <div style={S.emptyState}><p>Connecte-toi pour accéder aux groupes.</p></div>
    </div>
  );

  // Groups this user belongs to
  const myGroups = Object.entries(groups).filter(([,g]) => g.members.includes(currentUser.id));

  const genCode = () => Math.random().toString(36).substring(2,8).toUpperCase();

  const createGroup = async () => {
    if (!groupName.trim()) return showToast("Donne un nom à ton groupe !", "err");
    const id = "g_" + Date.now();
    const code = genCode();
    const ng = { ...groups, [id]: { name: groupName.trim(), code, members: [currentUser.id], createdBy: currentUser.id, createdAt: new Date().toLocaleDateString("fr-FR") } };
    await persistGroups(ng);
    setGroupName(""); setMode(null);
    showToast(`Groupe "${groupName.trim()}" créé ! Code : ${code}`);
  };

  const joinGroup = async () => {
    const entry = Object.entries(groups).find(([,g]) => g.code === joinCode.trim().toUpperCase());
    if (!entry) return showToast("Code invalide !", "err");
    const [gid, g] = entry;
    if (g.members.includes(currentUser.id)) return showToast("Tu es déjà dans ce groupe !", "err");
    const ng = { ...groups, [gid]: { ...g, members: [...g.members, currentUser.id] } };
    await persistGroups(ng);
    setJoinCode(""); setMode(null);
    showToast(`Tu as rejoint "${g.name}" ! 🎉`);
  };

  const leaveGroup = async (gid) => {
    const g = groups[gid];
    const newMembers = g.members.filter(uid => uid !== currentUser.id);
    if (newMembers.length === 0) {
      const ng = {...groups}; delete ng[gid];
      await persistGroups(ng);
    } else {
      await persistGroups({ ...groups, [gid]: { ...g, members: newMembers } });
    }
    showToast("Groupe quitté");
  };

  return (
    <div style={S.page}>
      <div style={S.pageHeader}>
        <h2 style={S.pageTitle}>Mon Groupe</h2>
        <p style={S.pageSub}>Crée ou rejoins un groupe pour un classement entre amis</p>
      </div>

      {!mode && (
        <div style={{display:"flex",gap:10,marginBottom:24,flexWrap:"wrap"}}>
          <button style={S.btnPrimary} onClick={()=>setMode("create")}>+ Créer un groupe</button>
          <button style={S.btnSecondary} onClick={()=>setMode("join")}>🔑 Rejoindre avec un code</button>
        </div>
      )}

      {mode === "create" && (
        <div style={{...S.card,marginBottom:24}}>
          <h3 style={S.cardTitle}>Créer un groupe</h3>
          <input style={S.input} placeholder="Nom du groupe (ex: Les Potes du Comptoir)" value={groupName} onChange={e=>setGroupName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createGroup()} autoFocus />
          <p style={{fontSize:12,color:"#6b6b6b",margin:0,fontStyle:"italic"}}>Un code d'invitation de 6 lettres sera généré automatiquement.</p>
          <div style={{display:"flex",gap:8}}>
            <button style={S.btnPrimary} onClick={createGroup}>Créer</button>
            <button style={S.btnLink} onClick={()=>setMode(null)}>Annuler</button>
          </div>
        </div>
      )}

      {mode === "join" && (
        <div style={{...S.card,marginBottom:24}}>
          <h3 style={S.cardTitle}>Rejoindre un groupe</h3>
          <input style={{...S.input,textTransform:"uppercase",letterSpacing:3,fontFamily:"monospace",fontSize:18,fontWeight:700}} placeholder="CODE" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={6} onKeyDown={e=>e.key==="Enter"&&joinGroup()} autoFocus />
          <div style={{display:"flex",gap:8}}>
            <button style={S.btnPrimary} onClick={joinGroup}>Rejoindre</button>
            <button style={S.btnLink} onClick={()=>setMode(null)}>Annuler</button>
          </div>
        </div>
      )}

      {myGroups.length === 0 ? (
        <div style={S.emptyState}>
          <div style={S.emptyIcon}>👥</div>
          <p>Tu n'es encore dans aucun groupe.<br />Crée le tien ou rejoins celui d'un ami !</p>
        </div>
      ) : (
        myGroups.map(([gid, g]) => (
          <div key={gid} style={{...S.card,marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{...S.cardTitle,marginBottom:2}}>{g.name}</div>
                <div style={{fontSize:12,color:"#6b6b6b",fontStyle:"italic"}}>{g.members.length} membre{g.members.length>1?"s":""} · créé le {g.createdAt}</div>
              </div>
              <button style={{...S.btnDanger,fontSize:11}} onClick={()=>leaveGroup(gid)}>Quitter</button>
            </div>
            <GroupLeaderboard group={g} users={users} bets={bets} matches={matches} bonus={bonus} showCode={true} />
          </div>
        ))
      )}
    </div>
  );
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────
function AdminView({ matches, setMatches, persistMatches, bets, setBets, users, setUsers, persistUsers, persistBets, groups, persistGroups, bonus, setBonus, persistBonus, redemptions, persistRedemptions, convRate, persistConvRate, adminPw, setAdminPw, announcement, persistAnnouncement, showToast }) {
  const [tab,        setTab]        = useState("results");
  const [editScores, setEditScores] = useState({});
  const [newPw,      setNewPw]      = useState("");
  const [search,     setSearch]     = useState("");
  const [filterGrp,  setFilterGrp]  = useState("Tous");
  const [bonusUid,   setBonusUid]   = useState("");
  const [bonusPts,   setBonusPts]   = useState("");
  const [bonusLabel,   setBonusLabel]   = useState("");
  const [confirmTest,  setConfirmTest]  = useState(false);
  const [announceInput, setAnnounceInput] = useState(announcement || "");
  const [confirmReset, setConfirmReset] = useState(false);

  // ── Sauvegarde UNIQUEMENT le match modifié (1 requête) ──
  // Évite la course de concurrence: persistMatches() ré-écrivait les 104 matchs
  // à chaque clic (104 requêtes Airtable en parallèle), et une vague "en retard"
  // d'un clic précédent pouvait écraser le résultat d'un clic plus récent.
  const saveOneMatch = async (id, patch) => {
    const updated = { ...matches.find(m => m.id === id), ...patch };
    setMatches(matches.map(m => m.id === id ? updated : m));
    await saveOne(KEYS.matches, id, updated);
  };

  const finishMatch = async id => {
    const es = editScores[id];
    if (!es || es.home==="" || es.away==="") return showToast("Entre les scores !", "err");
    const h=parseInt(es.home), a=parseInt(es.away);
    if (isNaN(h)||isNaN(a)) return showToast("Scores invalides !", "err");
    await saveOneMatch(id, { homeScore:h, awayScore:a, finished:true });
    showToast("Résultat enregistré 🏁");
  };

  const resetMatch = async id => {
    await saveOneMatch(id, { homeScore:null, awayScore:null, finished:false });
    showToast("Match réinitialisé");
  };

  const deleteUser = async uid => {
    // confirm() replaced inline — see delete button below
    const nu={...users}; delete nu[uid];
    const nb={...bets};  delete nb[uid];
    await persistUsers(nu); await persistBets(nb);
    showToast("Participant supprimé");
  };

  const changePw = async () => {
    if (!newPw.trim()) return showToast("Mot de passe vide !", "err");
    await setAdminPw(newPw.trim()); setNewPw(""); showToast("Mot de passe mis à jour 🔑");
  };

  const matchGroups = ["Tous", ...new Set(matches.map(m => m.group))];
  const filtered = matches.filter(m => {
    const gOk = filterGrp==="Tous" || m.group===filterGrp;
    const sOk = !search || m.home.toLowerCase().includes(search.toLowerCase()) || m.away.toLowerCase().includes(search.toLowerCase());
    return gOk && sOk;
  });
  const pending = filtered.filter(m => !m.finished);
  const done    = filtered.filter(m =>  m.finished);

  return (
    <div style={S.page}>
      <div style={S.pageHeader}><h2 style={S.pageTitle}>⚙️ Administration</h2></div>
      <div style={S.adminTabs}>
        {["results","users","bonus","redemptions","settings"].map(t => (
          <button key={t} style={tab===t?S.adminTabActive:S.adminTab} onClick={()=>setTab(t)}>
            {t==="results"?"⚽ Résultats":t==="users"?"👥 Participants":t==="bonus"?"⭐ Bonus":t==="redemptions"?"🎁 Échanges":"🔧 Paramètres"}
          </button>
        ))}
      </div>

      {tab === "results" && (
        <div>
          <div style={S.filterBar}>
            <input style={{...S.input,maxWidth:200,fontSize:13}} placeholder="🔍 Équipe…" value={search} onChange={e=>setSearch(e.target.value)} />
            <div style={S.groupFilter}>
              {matchGroups.map(g => (
                <button key={g} onClick={()=>setFilterGrp(g)} style={filterGrp===g?S.groupBtnActive:S.groupBtn}>
                  {g==="Tous"?"Tous":g.replace("Groupe ","G")}
                </button>
              ))}
            </div>
          </div>

          {pending.length > 0 && (
            <>
              <h3 style={S.sectionTitle}>Matchs à saisir ({pending.length})</h3>
              {pending.map(m => (
                <div key={m.id} style={S.adminMatchCard}>
                  <div style={S.adminMatchHeader}>
                    <span style={S.groupTag}>{m.group}</span>
                    <strong style={{flex:1}}>{m.home} vs {m.away}</strong>
                    <span style={{fontSize:12,color:"#64748b"}}>{new Date(m.date).toLocaleString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
                  </div>
                  <div style={S.adminScoreRow}>
                    <span style={{fontSize:13,color:"#94a3b8"}}>Score :</span>
                    <input style={S.scoreInputSm} type="number" min="0" placeholder="Dom."
                      value={editScores[m.id]?.home??""}
                      onChange={e=>setEditScores(p=>({...p,[m.id]:{...p[m.id],home:e.target.value}}))} />
                    <span style={{color:"#475569",fontWeight:700}}>-</span>
                    <input style={S.scoreInputSm} type="number" min="0" placeholder="Ext."
                      value={editScores[m.id]?.away??""}
                      onChange={e=>setEditScores(p=>({...p,[m.id]:{...p[m.id],away:e.target.value}}))} />
                    <button style={S.btnSuccess} onClick={()=>finishMatch(m.id)}>✓ Valider</button>
                  </div>
                </div>
              ))}
            </>
          )}

          {done.length > 0 && (
            <>
              <h3 style={{...S.sectionTitle,marginTop:24}}>Matchs terminés ({done.length})</h3>
              {done.map(m => (
                <div key={m.id} style={{...S.adminMatchCard,opacity:0.7}}>
                  <div style={S.adminMatchHeader}>
                    <span style={S.groupTag}>{m.group}</span>
                    <strong style={{flex:1}}>{m.home} {m.homeScore}-{m.awayScore} {m.away}</strong>
                    <span style={S.finishedTag}>✅</span>
                    <button style={S.btnGhost} onClick={()=>resetMatch(m.id)}>↩ Reset</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === "users" && (
        <div>
          {Object.keys(users).length === 0 ? (
            <div style={S.emptyState}><p>Aucun participant inscrit.</p></div>
          ) : Object.entries(users).map(([uid,u]) => {
            const betCount = Object.keys(bets[uid]||{}).length;
            const total = Object.entries(bets[uid]||{}).reduce((acc,[mid,bet])=>{
              const m=matches.find(x=>String(x.id)===String(mid));
              return acc + (m&&m.finished?calcPoints(bet,m):0);
            },0);
            return (
              <div key={uid} style={S.userCard}>
                <div style={{...S.avatar,background:u.color}}>{u.name[0]}</div>
                <div style={S.leaderInfo}>
                  <div style={S.leaderName}>{u.name}</div>
                  <div style={S.leaderStats}>{betCount} pari{betCount>1?"s":""} · {total} pt{total>1?"s":""}</div>
                </div>
                <button style={S.btnDanger} onClick={async()=>{
                  if(window._delConfirm===uid){await deleteUser(uid);window._delConfirm=null;}
                  else{window._delConfirm=uid;showToast("Clique à nouveau pour confirmer la suppression","err");}
                }}>🗑</button>
              </div>
            );
          })}
        </div>
      )}

      {tab === "bonus" && (
        <div>
          <div style={S.card}>
            <h3 style={S.cardTitle}>⭐ Attribuer des points bonus</h3>
            <select style={S.input} value={bonusUid} onChange={e=>setBonusUid(e.target.value)}>
              <option value="">— Choisir un participant —</option>
              {Object.entries(users).map(([uid,u]) => (
                <option key={uid} value={uid}>{u.name}</option>
              ))}
            </select>
            <input style={S.input} type="number" placeholder="Nombre de points (ex: 10)" value={bonusPts} onChange={e=>setBonusPts(e.target.value)} />
            <input style={S.input} placeholder="Motif (ex: 25 premiers inscrits)" value={bonusLabel} onChange={e=>setBonusLabel(e.target.value)} />
            <button style={S.btnPrimary} onClick={async ()=>{
              if (!bonusUid || !bonusPts || !bonusLabel) return showToast("Remplis tous les champs !", "err");
              const pts = parseInt(bonusPts);
              if (isNaN(pts)) return showToast("Points invalides !", "err");
              const id = Date.now().toString();
              const nb = { ...bonus, [bonusUid]: { ...(bonus[bonusUid]||{}), [id]: { pts, label: bonusLabel, date: new Date().toLocaleDateString("fr-FR") } } };
              await persistBonus(nb);
              setBonusUid(""); setBonusPts(""); setBonusLabel("");
              showToast("Bonus attribué ✅");
            }}>Attribuer le bonus</button>
          </div>
          <h3 style={S.sectionTitle}>Bonus attribués</h3>
          {Object.keys(bonus).length === 0
            ? <div style={S.emptyState}><p>Aucun bonus attribué pour l'instant.</p></div>
            : Object.entries(users).map(([uid,u]) => {
                const userBonus = bonus[uid];
                if (!userBonus || Object.keys(userBonus).length === 0) return null;
                return (
                  <div key={uid} style={S.card}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{...S.avatarSm,background:u.color}}>{u.name[0]}</div>
                      <strong style={{fontFamily:"'Lexend',sans-serif"}}>{u.name}</strong>
                    </div>
                    {Object.entries(userBonus).map(([bid,b]) => (
                      <div key={bid} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.grisClair}`}}>
                        <span style={{fontSize:13,fontStyle:"italic"}}>{b.label}</span>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <span style={{...S.ptsBadgeGold,fontSize:13}}>+{b.pts} pts</span>
                          <span style={{fontSize:11,color:C.gris}}>{b.date}</span>
                          <button style={S.btnDanger} onClick={async()=>{
                            const nb = {...bonus};
                            delete nb[uid][bid];
                            if (Object.keys(nb[uid]).length===0) delete nb[uid];
                            await persistBonus(nb);
                            showToast("Bonus supprimé");
                          }}>🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })
          }
        </div>
      )}

      {tab === "redemptions" && (
        <div>
          {(() => {
            const allPending = Object.entries(users).flatMap(([uid,u]) =>
              Object.entries(redemptions[uid]||{})
                .filter(([,r])=>r.status==="pending")
                .map(([rid,r])=>({uid,rid,userName:u.name,userColor:u.color,...r}))
            ).sort((a,b)=>a.createdAt-b.createdAt);
            const allDone = Object.entries(users).flatMap(([uid,u]) =>
              Object.entries(redemptions[uid]||{})
                .filter(([,r])=>r.status!=="pending")
                .map(([rid,r])=>({uid,rid,userName:u.name,userColor:u.color,...r}))
            ).sort((a,b)=>b.createdAt-a.createdAt);
            return (
              <>
                <div style={{fontSize:12,color:"#6b6b6b",fontStyle:"italic",marginBottom:16,padding:"8px 12px",background:"rgba(18,50,132,0.05)",borderRadius:4,borderLeft:`3px solid ${C.bleu}`}}>
                  Taux actuel : <strong style={{color:C.bleu}}>{convRate} pts = 1€</strong>
                  <button style={{...S.btnGhost,fontSize:11,padding:"3px 10px",marginLeft:12}} onClick={()=>{
                    const r = parseInt(prompt(`Nouveau taux (pts pour 1€) — actuel : ${convRate}`));
                    if (!isNaN(r) && r > 0) { persistConvRate(r); showToast(`Taux mis à jour : ${r} pts = 1€`); }
                  }}>Modifier</button>
                </div>
                {allPending.length === 0
                  ? <div style={S.emptyState}><p>Aucune demande en attente.</p></div>
                  : <>
                    <h3 style={S.sectionTitle}>Demandes en attente ({allPending.length})</h3>
                    {allPending.map(r => (
                      <div key={r.rid} style={{...S.card,marginBottom:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                          <div style={{...S.avatarSm,background:r.userColor}}>{r.userName[0]}</div>
                          <strong style={{fontFamily:"'Lexend',sans-serif"}}>{r.userName}</strong>
                          <span style={{fontSize:12,color:"#6b6b6b",fontStyle:"italic"}}>{r.date}</span>
                        </div>
                        <div style={{fontSize:15,fontWeight:700,fontFamily:"'Lexend',sans-serif",color:C.bleu,marginBottom:4}}>
                          {r.pts} pts → {r.euros}€
                        </div>
                        {r.reason && <div style={{fontSize:12,color:"#6b6b6b",fontStyle:"italic",marginBottom:10}}>{r.reason}</div>}
                        <div style={{display:"flex",gap:8}}>
                          <button style={S.btnSuccess} onClick={async()=>{
                            const nr={...redemptions,[r.uid]:{...(redemptions[r.uid]||{}),[r.rid]:{...redemptions[r.uid][r.rid],status:"validated"}}};
                            await persistRedemptions(nr); showToast(`✅ Validé pour ${r.userName}`);
                          }}>✅ Valider</button>
                          <button style={S.btnDanger} onClick={async()=>{
                            const nr={...redemptions,[r.uid]:{...(redemptions[r.uid]||{}),[r.rid]:{...redemptions[r.uid][r.rid],status:"refused"}}};
                            await persistRedemptions(nr); showToast(`Refusé`);
                          }}>✗ Refuser</button>
                        </div>
                      </div>
                    ))}
                  </>
                }
                {allDone.length > 0 && (
                  <>
                    <h3 style={{...S.sectionTitle,marginTop:24}}>Historique ({allDone.length})</h3>
                    {allDone.map(r => (
                      <div key={r.rid} style={{...S.adminMatchCard,flexDirection:"column",gap:8,opacity:r.status==="used"?0.65:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <div style={{...S.avatarSm,background:r.userColor}}>{r.userName[0]}</div>
                          <div style={{flex:1}}>
                            <span style={{fontFamily:"'Lexend',sans-serif",fontWeight:700,fontSize:13,textDecoration:r.status==="used"?"line-through":"none"}}>{r.userName}</span>
                            <span style={{fontSize:12,color:"#6b6b6b",marginLeft:8}}>{r.pts} pts → {r.euros}€ · {r.date}</span>
                            {r.usedDate && <span style={{fontSize:11,color:"#123284",marginLeft:8}}>· Utilisé le {r.usedDate}</span>}
                          </div>
                          <span style={{borderRadius:3,padding:"2px 8px",fontSize:11,fontFamily:"'Lexend',sans-serif",fontWeight:700,
                            ...(r.status==="used"?{background:"rgba(18,50,132,0.1)",color:"#123284"}:r.status==="validated"?{background:"rgba(30,125,79,0.1)",color:"#1e7d4f"}:{background:"rgba(192,57,43,0.1)",color:"#c0392b"})}}>
                            {r.status==="used"?"🎟️ Utilisée":r.status==="validated"?"✅ Validée":"✗ Refusée"}
                          </span>
                        </div>
                        {r.status === "validated" && (
                          <div style={{display:"flex",gap:10,alignItems:"center"}}>
                            <button style={{...S.btnPrimary,fontSize:12,padding:"5px 14px"}} onClick={async()=>{
                              const nr={...redemptions,[r.uid]:{...(redemptions[r.uid]||{}),[r.rid]:{...redemptions[r.uid][r.rid],status:"used",usedDate:new Date().toLocaleDateString("fr-FR")}}};
                              await persistRedemptions(nr); showToast(`Bon de ${r.userName} marqué comme utilisé ✓`);
                            }}>🎟️ Marquer comme utilisé</button>
                            <span style={{fontSize:11,color:"#888",fontStyle:"italic"}}>Code : BRETON-{r.rid.replace("r_","").slice(-6).toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}

      {tab === "settings" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={S.card}>
            <h3 style={S.cardTitle}>📢 Annonce visible par tous</h3>
            <p style={S.pageSub}>Affiche un bandeau en haut de la page d'accueil pour tous les participants. Laisse vide pour ne rien afficher.</p>
            <textarea
              style={{...S.input, minHeight:70, resize:"vertical", fontFamily:"'Zilla Slab',serif"}}
              placeholder="Ex : 🎉 Félicitations à Alice pour son score parfait ! Les paris pour le prochain match ferment à 21h00."
              value={announceInput}
              onChange={e=>setAnnounceInput(e.target.value)}
            />
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button style={S.btnPrimary} onClick={async()=>{
                await persistAnnouncement(announceInput.trim());
                showToast(announceInput.trim() ? "Annonce publiée ✓" : "Annonce supprimée ✓");
              }}>Publier</button>
              {announcement && (
                <button style={S.btnGhost} onClick={async()=>{
                  setAnnounceInput("");
                  await persistAnnouncement("");
                  showToast("Annonce supprimée ✓");
                }}>Effacer l'annonce actuelle</button>
              )}
            </div>
          </div>

          <div style={S.card}>
            <h3 style={S.cardTitle}>🔑 Mot de passe admin</h3>
            <p style={S.pageSub}>Actuel : <code style={S.code}>{adminPw}</code></p>
            <input style={S.input} type="password" placeholder="Nouveau mot de passe" value={newPw} onChange={e=>setNewPw(e.target.value)} />
            <button style={S.btnPrimary} onClick={changePw}>Mettre à jour</button>
          </div>

          <div style={{...S.card,border:"2px dashed #38bdf8",background:"rgba(56,189,248,0.05)",marginBottom:12}}>
            <h3 style={{...S.cardTitle,color:"#123284"}}>🔍 Diagnostic storage</h3>
            <DiagPanel matches={matches} bets={bets} users={users} bonus={bonus} />
          </div>

          <div style={{...S.card,border:"2px dashed #f5d9a0",background:"rgba(252,235,207,0.3)"}}>
            <h3 style={{...S.cardTitle,color:"#8a5e00"}}>🧪 Données de test</h3>
            <p style={{fontSize:13,color:"#6b6b6b",fontStyle:"italic",margin:0}}>
              Injecte 10 matchs fictifs terminés avec 5 participants et leurs paris pour tester toutes les fonctionnalités.
            </p>
            {!confirmTest
              ? <button style={{...S.btnPrimary,background:"#8a5e00",borderColor:"#8a5e00"}} onClick={()=>setConfirmTest(true)}>🧪 Charger les données de test</button>
              : <div style={{display:"flex",flexDirection:"column",gap:8,padding:"12px",background:"rgba(192,57,43,0.07)",borderRadius:6,border:"1px solid rgba(192,57,43,0.2)"}}>
                  <p style={{margin:0,fontSize:13,fontWeight:700,fontFamily:"'Lexend',sans-serif",color:"#c0392b"}}>⚠️ Cela va remplacer tous les matchs et participants actuels. Confirmer ?</p>
                  <div style={{display:"flex",gap:8}}>
                    <button style={S.btnDanger} onClick={async () => {
              setConfirmTest(false);
              const COLORS = ["#123284","#c0392b","#1e7d4f"];
              const testUsers = {
                "test_thomas": { name:"Thomas", color:COLORS[0], password:"test123" },
                "test_marie":  { name:"Marie",  color:COLORS[1], password:"test123" },
                "test_leo":    { name:"Léo",    color:COLORS[2], password:"test123" },
              };

              // 5 matchs : 2 terminés + 1 KO passé sans résultat + 2 à venir
              const now = new Date();
              const d = (h) => new Date(now.getTime() + h*3600000).toISOString().slice(0,16);

              const testMatches = [
                { id:9001, home:"🇫🇷 France",  away:"🇩🇪 Allemagne", date:d(-48), group:"Groupe Test", homeScore:2, awayScore:1, finished:true },
                { id:9002, home:"🇧🇷 Brésil",  away:"🇦🇷 Argentine", date:d(-24), group:"Groupe Test", homeScore:1, awayScore:1, finished:true },
                { id:9003, home:"🇪🇸 Espagne", away:"🇵🇹 Portugal",  date:d(-2),  group:"Groupe Test", homeScore:null, awayScore:null, finished:false },
                { id:9004, home:"🇮🇹 Italie",  away:"🇧🇪 Belgique",  date:d(2),   group:"Groupe Test", homeScore:null, awayScore:null, finished:false },
                { id:9005, home:"🇯🇵 Japon",   away:"🇲🇦 Maroc",     date:d(26),  group:"Groupe Test", homeScore:null, awayScore:null, finished:false },
              ];

              const paris = {
                "test_thomas": [[2,1],[1,1],[2,0],[1,0],[0,1]],
                "test_marie":  [[1,0],[0,0],[1,1],[2,1],[1,0]],
                "test_leo":    [[2,0],[1,1],[3,0],[0,0],[2,2]],
              };

              const testBets = {};
              Object.entries(paris).forEach(([uid, bList]) => {
                testBets[uid] = {};
                testMatches.forEach((m, i) => {
                  testBets[uid][String(m.id)] = { homeScore: bList[i][0], awayScore: bList[i][1] };
                });
              });

              const testBonus = { "test_thomas": { "b1": { pts:5, label:"Premier inscrit !", date:new Date().toLocaleDateString("fr-FR") } } };

              // Effacer d'abord toutes les clés existantes pour éviter les résidus
              try { await window.storage.delete(KEYS.matches, true); } catch {}
              try { await window.storage.delete(KEYS.bets, true); } catch {}
              try { await window.storage.delete(KEYS.users, true); } catch {}
              try { await window.storage.delete(KEYS.bonus, true); } catch {}
              try { await window.storage.delete(KEYS.redemptions, true); } catch {}
              // Petite pause pour s'assurer que les suppressions sont prises en compte
              await new Promise(r => setTimeout(r, 200));
              await persistMatches(testMatches);
              await persistUsers(testUsers);
              await persistBets(testBets);
              await persistBonus(testBonus);
              showToast("✅ Données de test chargées ! Mot de passe : test");
            }}>Oui, charger</button>
                    <button style={S.btnGhost} onClick={()=>setConfirmTest(false)}>Annuler</button>
                  </div>
                </div>
            }

            {!confirmReset
              ? <button style={{...S.btnDanger,alignSelf:"flex-start"}} onClick={()=>setConfirmReset(true)}>🗑 Supprimer les données de test</button>
              : <div style={{display:"flex",flexDirection:"column",gap:8,padding:"12px",background:"rgba(192,57,43,0.07)",borderRadius:6,border:"1px solid rgba(192,57,43,0.2)"}}>
                  <p style={{margin:0,fontSize:13,fontWeight:700,fontFamily:"'Lexend',sans-serif",color:"#c0392b"}}>⚠️ Supprimer participants de test et remettre les vrais matchs ?</p>
                  <div style={{display:"flex",gap:8}}>
                    <button style={S.btnDanger} onClick={async()=>{
                      setConfirmReset(false);
                      showToast("Suppression en cours…");

                      // Identifier tous les uid de test présents
                      const testUids = [
                        ...Object.keys(users).filter(uid => uid.startsWith("test_")),
                        ...Object.keys(bets).filter(uid => uid.startsWith("test_")),
                        ...Object.keys(bonus).filter(uid => uid.startsWith("test_")),
                      ];
                      const uniqueTestUids = [...new Set(testUids)];

                      // Suppression réelle côté Airtable (users, bets, bonus)
                      await Promise.all(uniqueTestUids.flatMap(uid => [
                        deleteOne(KEYS.users, uid),
                        deleteOne(KEYS.bets, uid),
                        deleteOne(KEYS.bonus, uid),
                      ]));

                      // Suppression réelle des 5 matchs fictifs (ids 9001-9005) UNIQUEMENT
                      // ⚠️ On NE touche PAS aux 104 vrais matchs : un upsert écraserait
                      // les résultats déjà saisis par l'admin (finished/scores).
                      await Promise.all([9001,9002,9003,9004,9005,9006,9007,9008,9009,9010].map(id => deleteOne(KEYS.matches, String(id))));

                      // Retirer les matchs de test de l'état local (sans toucher aux vrais)
                      const realMatches = matches.filter(m => ![9001,9002,9003,9004,9005,9006,9007,9008,9009,9010].includes(m.id));
                      setMatches(realMatches);

                      // Mettre à jour l'état local immédiatement
                      const nu  = Object.fromEntries(Object.entries(users).filter(([uid]) => !uid.startsWith("test_")));
                      const nb  = Object.fromEntries(Object.entries(bets).filter(([uid]) => !uid.startsWith("test_")));
                      const nbo = Object.fromEntries(Object.entries(bonus).filter(([uid]) => !uid.startsWith("test_")));
                      setUsers(nu); setBets(nb); setBonus(nbo);

                      showToast("Données de test supprimées ✓ — rechargement…");
                      // Recharger la page pour garantir un état 100% propre dans cet onglet
                      setTimeout(() => window.location.reload(), 1200);
                    }}>Oui, supprimer</button>
                    <button style={S.btnGhost} onClick={()=>setConfirmReset(false)}>Annuler</button>
                  </div>
                </div>
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  return <div style={{...S.toast,background:type==="err"?"#ef4444":"#22c55e"}}>{msg}</div>;
}

// ─── STYLES — CHARTE COMPTOIR BRETON ─────────────────────────────────────────
// Couleurs : Bleu océan #123284 · Gris clair #f4f2ed · Ancre noire #02050C · Naturel #fcebcf
// Typos    : Lexend (titres) · Zilla Slab (textes) — Google Fonts
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Lexend:wght@400;600;700;800&family=Zilla+Slab:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap');
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
* { box-sizing: border-box; }
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button { opacity:1; }
`;
if (typeof document !== "undefined" && !document.getElementById("lcb-fonts")) {
  const st = document.createElement("style");
  st.id = "lcb-fonts";
  st.textContent = FONT_IMPORT;
  document.head.appendChild(st);
}

const C = {
  bleu:"#123284", bleuDark:"#0d2468", bleuLight:"#1a3fa0",
  fond:"#f4f2ed", noir:"#02050C", naturel:"#fcebcf", naturelD:"#f5d9a0",
  blanc:"#ffffff", gris:"#6b6b6b", grisClair:"#e0dcd4",
  rouge:"#c0392b", vert:"#1e7d4f",
};

const S = {
  root:{ minHeight:"100vh", background:C.fond, fontFamily:"'Zilla Slab',Georgia,serif", color:C.noir },
  loadWrap:{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",background:C.fond },
  spinner:{ width:40,height:40,border:`3px solid ${C.grisClair}`,borderTop:`3px solid ${C.bleu}`,borderRadius:"50%",animation:"spin 1s linear infinite" },
  header:{ background:C.bleu, borderBottom:`3px solid ${C.bleuDark}`, position:"sticky", top:0, zIndex:100, boxShadow:"0 2px 16px rgba(18,50,132,0.3)" },
  headerInner:{ maxWidth:1100,margin:"0 auto",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10 },
  logo:{ display:"flex",alignItems:"center",gap:14 },
  logoTextBlock:{ display:"flex",flexDirection:"column" },
  logoTitle:{ fontSize:15,fontWeight:800,letterSpacing:3,color:C.blanc,fontFamily:"'Lexend',sans-serif",textTransform:"uppercase",lineHeight:1.1 },
  logoSub:{ fontSize:9,color:"rgba(255,255,255,0.55)",letterSpacing:2,fontFamily:"'Lexend',sans-serif",textTransform:"uppercase",marginTop:3 },
  nav:{ display:"flex",gap:6,flexWrap:"wrap",alignItems:"center" },
  tab:{ background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.8)",padding:"7px 15px",borderRadius:3,cursor:"pointer",fontSize:11,fontFamily:"'Lexend',sans-serif",fontWeight:600,letterSpacing:1,textTransform:"uppercase",transition:"all .15s" },
  tabActive:{ background:C.blanc,border:`1px solid ${C.blanc}`,color:C.bleu,padding:"7px 15px",borderRadius:3,cursor:"pointer",fontSize:11,fontFamily:"'Lexend',sans-serif",fontWeight:800,letterSpacing:1,textTransform:"uppercase" },
  logoutBtn:{ background:"transparent",border:"1px solid rgba(255,255,255,0.3)",color:"rgba(255,255,255,0.65)",padding:"6px 12px",borderRadius:3,cursor:"pointer",fontSize:10,fontFamily:"'Lexend',sans-serif",letterSpacing:1,textTransform:"uppercase" },
  page:{ maxWidth:820,margin:"0 auto",padding:"28px 16px 80px",animation:"fadeUp .35s ease" },
  pageHeader:{ marginBottom:24,borderBottom:`2px solid ${C.grisClair}`,paddingBottom:14 },
  pageTitle:{ fontSize:20,fontWeight:800,margin:0,color:C.bleu,fontFamily:"'Lexend',sans-serif",textTransform:"uppercase",letterSpacing:2 },
  pageSub:{ color:C.gris,margin:"5px 0 0",fontSize:13,fontFamily:"'Zilla Slab',serif",fontStyle:"italic" },
  hero:{ textAlign:"center",padding:"36px 16px" },
  heroIcon:{ fontSize:44,margin:"0 0 14px" },
  heroTitle:{ fontSize:28,fontWeight:800,color:C.bleu,fontFamily:"'Lexend',sans-serif",textTransform:"uppercase",letterSpacing:2,margin:"0 0 10px" },
  heroDesc:{ color:"#444",fontSize:15,lineHeight:1.8,maxWidth:520,margin:"0 auto 22px",fontFamily:"'Zilla Slab',serif" },
  heroName:{ fontSize:20,fontWeight:700,margin:"0 0 6px",color:C.bleu,fontFamily:"'Lexend',sans-serif" },
  heroSub:{ color:C.gris,marginBottom:20,fontSize:14,fontStyle:"italic" },
  heroButtons:{ display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginTop:16 },
  ruleCards:{ display:"flex",gap:12,justifyContent:"center",margin:"18px 0 22px",flexWrap:"wrap" },
  ruleCard:{ background:C.blanc,border:`2px solid ${C.grisClair}`,borderRadius:5,padding:"12px 20px",display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:90 },
  rulePts:{ fontSize:22,fontWeight:800,color:C.bleu,fontFamily:"'Lexend',sans-serif" },
  statsRow:{ display:"flex",gap:12,justifyContent:"center",margin:"14px 0 24px",flexWrap:"wrap" },
  statBox:{ background:C.bleu,borderRadius:5,padding:"12px 22px",display:"flex",flexDirection:"column",alignItems:"center",gap:2 },
  statNum:{ fontSize:24,fontWeight:800,color:C.blanc,fontFamily:"'Lexend',sans-serif" },
  statLabel:{ fontSize:10,color:"rgba(255,255,255,0.65)",fontFamily:"'Lexend',sans-serif",letterSpacing:1,textTransform:"uppercase" },
  card:{ background:C.blanc,border:`1px solid ${C.grisClair}`,borderRadius:6,padding:24,marginBottom:16,display:"flex",flexDirection:"column",gap:12,boxShadow:"0 2px 10px rgba(18,50,132,0.06)" },
  cardTitle:{ fontSize:14,fontWeight:700,margin:0,color:C.bleu,fontFamily:"'Lexend',sans-serif",textTransform:"uppercase",letterSpacing:1 },
  filterBar:{ display:"flex",flexDirection:"column",gap:10,marginBottom:16 },
  groupFilter:{ display:"flex",flexWrap:"wrap",gap:5 },
  groupBtn:{ background:C.blanc,border:`1px solid ${C.grisClair}`,color:C.gris,padding:"4px 10px",borderRadius:3,cursor:"pointer",fontSize:10,fontFamily:"'Lexend',sans-serif",fontWeight:600,letterSpacing:1,textTransform:"uppercase" },
  groupBtnActive:{ background:C.bleu,border:`1px solid ${C.bleu}`,color:C.blanc,padding:"4px 10px",borderRadius:3,cursor:"pointer",fontSize:10,fontFamily:"'Lexend',sans-serif",fontWeight:700,letterSpacing:1,textTransform:"uppercase" },
  btnPrimary:{ background:C.bleu,color:C.blanc,border:`2px solid ${C.bleu}`,padding:"11px 26px",borderRadius:4,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'Lexend',sans-serif",textTransform:"uppercase",letterSpacing:1 },
  btnSecondary:{ background:"transparent",color:C.bleu,border:`2px solid ${C.bleu}`,padding:"11px 26px",borderRadius:4,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'Lexend',sans-serif",textTransform:"uppercase",letterSpacing:1 },
  btnGhost:{ background:"transparent",color:C.gris,border:`1px solid ${C.grisClair}`,padding:"8px 18px",borderRadius:4,cursor:"pointer",fontSize:12,fontFamily:"'Lexend',sans-serif" },
  btnLink:{ background:"none",border:"none",color:C.bleu,cursor:"pointer",fontSize:13,textDecoration:"underline",fontFamily:"'Zilla Slab',serif",fontStyle:"italic" },
  btnDanger:{ background:"rgba(192,57,43,0.07)",color:C.rouge,border:"1px solid rgba(192,57,43,0.25)",padding:"6px 12px",borderRadius:4,cursor:"pointer",fontSize:12,fontFamily:"'Lexend',sans-serif" },
  btnSuccess:{ background:"rgba(30,125,79,0.08)",color:C.vert,border:"1px solid rgba(30,125,79,0.3)",padding:"6px 16px",borderRadius:4,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'Lexend',sans-serif" },
  saveBetBtn:{ background:C.bleu,color:C.blanc,border:`2px solid ${C.bleu}`,padding:"6px 18px",borderRadius:4,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"'Lexend',sans-serif",textTransform:"uppercase",letterSpacing:1 },
  input:{ background:C.blanc,border:`1.5px solid ${C.grisClair}`,borderRadius:4,color:C.noir,padding:"10px 14px",fontSize:14,outline:"none",width:"100%",fontFamily:"'Zilla Slab',serif" },
  section:{ marginBottom:28 },
  sectionTitle:{ fontSize:10,fontWeight:700,letterSpacing:2.5,color:C.gris,textTransform:"uppercase",marginBottom:12,fontFamily:"'Lexend',sans-serif",borderLeft:`3px solid ${C.bleu}`,paddingLeft:8 },
  matchCard:{ background:C.blanc,border:`1px solid ${C.grisClair}`,borderRadius:5,padding:14,marginBottom:7,boxShadow:"0 1px 4px rgba(18,50,132,0.04)" },
  matchCardClosed:{ background:C.fond,opacity:0.82 },
  matchMeta:{ display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap" },
  matchRow:{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:8 },
  teamName:{ fontWeight:600,fontSize:14,flex:1,textAlign:"center",fontFamily:"'Lexend',sans-serif",color:C.noir },
  scoreInputs:{ display:"flex",alignItems:"center",gap:7 },
  scoreInput:{ width:50,textAlign:"center",background:C.fond,border:`2px solid ${C.bleu}`,borderRadius:4,color:C.bleu,padding:"7px",fontSize:18,fontWeight:800,outline:"none",fontFamily:"'Lexend',sans-serif" },
  scoreSep:{ color:C.grisClair,fontWeight:800,fontSize:18 },
  lockedBet:{ display:"flex",alignItems:"center",gap:7 },
  lockedScore:{ fontSize:18,fontWeight:800,color:C.bleu,fontFamily:"'Lexend',sans-serif" },
  noBet:{ fontSize:12,color:C.gris,fontStyle:"italic",fontFamily:"'Zilla Slab',serif" },
  matchFooter:{ display:"flex",alignItems:"center",justifyContent:"flex-end",gap:8,marginTop:10 },
  savedBadge:{ fontSize:11,color:C.vert,fontFamily:"'Lexend',sans-serif",fontWeight:600 },
  closedBadge:{ background:C.grisClair,color:C.gris,borderRadius:3,padding:"2px 8px",fontSize:10,fontFamily:"'Lexend',sans-serif",letterSpacing:1,textTransform:"uppercase",fontWeight:600 },
  resultRow:{ textAlign:"center",marginTop:6,fontSize:12,color:C.gris,fontStyle:"italic",fontFamily:"'Zilla Slab',serif" },
  ptsBadgeGold:{ background:C.naturel,color:"#7a5200",border:`1px solid ${C.naturelD}`,borderRadius:3,padding:"2px 8px",fontSize:11,fontWeight:700,fontFamily:"'Lexend',sans-serif" },
  ptsBadgeSilver:{ background:C.grisClair,color:C.gris,border:`1px solid ${C.grisClair}`,borderRadius:3,padding:"2px 8px",fontSize:11,fontWeight:700,fontFamily:"'Lexend',sans-serif" },
  ptsBadgeGrey:{ background:"rgba(192,57,43,0.07)",color:C.rouge,border:"1px solid rgba(192,57,43,0.18)",borderRadius:3,padding:"2px 8px",fontSize:11,fontWeight:700,fontFamily:"'Lexend',sans-serif" },
  leaderboard:{ display:"flex",flexDirection:"column",gap:7,marginBottom:28 },
  leaderRow:{ background:C.blanc,border:`1px solid ${C.grisClair}`,borderRadius:5,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,boxShadow:"0 1px 4px rgba(18,50,132,0.05)" },
  leaderFirst:{ background:C.naturel,border:`2px solid ${C.naturelD}` },
  rank:{ fontSize:20,width:32,textAlign:"center" },
  avatar:{ width:40,height:40,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:16,color:C.blanc,flexShrink:0,fontFamily:"'Lexend',sans-serif" },
  avatarSm:{ width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12,color:C.blanc,flexShrink:0,fontFamily:"'Lexend',sans-serif" },
  leaderInfo:{ flex:1 },
  leaderName:{ fontWeight:700,fontSize:15,fontFamily:"'Lexend',sans-serif",color:C.noir },
  leaderStats:{ fontSize:12,color:C.gris,marginTop:2,fontStyle:"italic",fontFamily:"'Zilla Slab',serif" },
  leaderScore:{ fontSize:28,fontWeight:800,color:C.bleu,fontFamily:"'Lexend',sans-serif" },
  leaderPtsLabel:{ fontSize:11,color:C.gris,marginLeft:3,fontFamily:"'Zilla Slab',serif" },
  resultBadge:{ background:C.bleu,borderRadius:4,padding:"4px 14px",fontSize:17,fontWeight:800,color:C.blanc,fontFamily:"'Lexend',sans-serif" },
  betsReveal:{ display:"flex",flexWrap:"wrap",gap:6,marginTop:10 },
  betRevealRow:{ display:"flex",alignItems:"center",gap:6,background:C.fond,border:`1px solid ${C.grisClair}`,borderRadius:4,padding:"5px 10px" },
  betRevealName:{ fontSize:12,fontWeight:600,fontFamily:"'Lexend',sans-serif" },
  betRevealScore:{ fontSize:12,color:C.gris },
  emptyState:{ textAlign:"center",padding:"50px 20px",color:C.gris },
  emptyIcon:{ fontSize:44,marginBottom:10 },
  adminTabs:{ display:"flex",gap:6,marginBottom:20,flexWrap:"wrap" },
  adminTab:{ background:C.blanc,border:`1px solid ${C.grisClair}`,color:C.gris,padding:"8px 16px",borderRadius:4,cursor:"pointer",fontSize:11,fontFamily:"'Lexend',sans-serif",fontWeight:600,letterSpacing:1,textTransform:"uppercase" },
  adminTabActive:{ background:C.bleu,border:`1px solid ${C.bleu}`,color:C.blanc,padding:"8px 16px",borderRadius:4,cursor:"pointer",fontSize:11,fontFamily:"'Lexend',sans-serif",fontWeight:700,letterSpacing:1,textTransform:"uppercase" },
  adminMatchCard:{ background:C.blanc,border:`1px solid ${C.grisClair}`,borderRadius:5,padding:13,marginBottom:7 },
  adminMatchHeader:{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6 },
  adminScoreRow:{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" },
  scoreInputSm:{ width:56,textAlign:"center",background:C.fond,border:`2px solid ${C.bleu}`,borderRadius:4,color:C.bleu,padding:"6px",fontSize:15,fontWeight:800,outline:"none",fontFamily:"'Lexend',sans-serif" },
  groupTag:{ background:C.bleu,color:C.blanc,borderRadius:3,padding:"2px 8px",fontSize:10,fontFamily:"'Lexend',sans-serif",fontWeight:700,letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap" },
  finishedTag:{ background:C.vert,color:C.blanc,borderRadius:3,padding:"2px 7px",fontSize:10,fontFamily:"'Lexend',sans-serif",fontWeight:700 },
  userCard:{ background:C.blanc,border:`1px solid ${C.grisClair}`,borderRadius:5,padding:"12px 16px",display:"flex",alignItems:"center",gap:14,marginBottom:7 },
  code:{ background:C.fond,border:`1px solid ${C.grisClair}`,borderRadius:3,padding:"1px 6px",fontFamily:"monospace",color:C.bleu,fontSize:12 },
  soldeCard:{ background:C.blanc,border:`1px solid ${C.grisClair}`,borderRadius:6,padding:"16px 22px",display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:110,boxShadow:"0 1px 4px rgba(18,50,132,0.05)" },
  soldeNum:{ fontSize:28,fontWeight:800,color:C.bleu,fontFamily:"'Lexend',sans-serif" },
  soldeLabel:{ fontSize:10,color:C.gris,fontFamily:"'Lexend',sans-serif",letterSpacing:1,textTransform:"uppercase" },
  toast:{ position:"fixed",bottom:22,right:18,color:C.blanc,fontWeight:700,fontSize:13,padding:"12px 20px",borderRadius:4,zIndex:9999,boxShadow:"0 4px 24px rgba(18,50,132,0.25)",fontFamily:"'Lexend',sans-serif",letterSpacing:1 },
  pendingBanner:{ display:"flex",alignItems:"flex-start",gap:12,background:"rgba(252,235,207,0.6)",border:"1.5px solid #f5d9a0",borderRadius:5,padding:"12px 16px",marginBottom:20 },
  crownBadge:{ fontSize:11,fontFamily:"'Lexend',sans-serif",fontWeight:600,color:"#7a5200",marginLeft:6 },
};
