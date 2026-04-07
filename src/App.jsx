import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, deleteDoc } from 'firebase/firestore';
import { 
  Calendar, Download, ChevronRight, MapPin, Clock, Users, Car, CheckCircle2,
  AlertCircle, X, Copy, Info, Loader2, Wifi, WifiOff, Trash2, ArrowRight,
  Edit3, Save, ExternalLink, Paperclip, FileText, Image as ImageIcon, Link as LinkIcon, Plus, UserCircle, Hash,
  UserPlus, Settings, RefreshCw
} from 'lucide-react';

/** 優先: ビルド時の VITE_GEMINI_API_KEY（.env / CI）。未設定時のみ localStorage（設定画面） */
const getGeminiApiKey = () => {
  const fromEnv = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
  if (fromEnv) return fromEnv;
  return (localStorage.getItem('gemini_api_key') || '').trim();
};

// ==========================================
// 【重要設定 2】ご自身のFirebase設定を貼り付けてください
// ※Netlifyで動かすために絶対に必要です！
// ==========================================
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyDOElEjHKpomMS6zK8J51kUAZHNam5HHqE",
  authDomain: "soccer-club-manager.firebaseapp.com",
  projectId: "soccer-club-manager",
  storageBucket: "soccer-club-manager.firebasestorage.app",
  messagingSenderId: "357394035470",
  appId: "1:357394035470:web:0f5f41fb0eb208a946dd5f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// 環境によるパスエラーを防ぐ処理
let rawAppId = typeof __app_id !== 'undefined' ? String(__app_id) : 'soccer-club-mgr-app';
if (rawAppId.includes('/')) rawAppId = rawAppId.split('/')[0];
if (rawAppId.endsWith('_src')) rawAppId = rawAppId.slice(0, -4);
const appId = rawAppId;

// --- Helpers ---
const getDeadlineStatus = (deadlineStr) => {
  if (!deadlineStr) return 'none';
  const todayTime = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
  const [year, month, day] = deadlineStr.split('-').map(Number);
  const deadlineTime = new Date(year, month - 1, day).getTime();
  const diffDays = Math.round((deadlineTime - todayTime) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'passed';
  if (diffDays <= 3) return 'approaching';
  return 'normal';
};

const LinkedText = ({ text }) => {
  if (!text || typeof text !== 'string') return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return (
    <span className="whitespace-pre-wrap break-all leading-relaxed">
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          return (
            <a 
              key={i} 
              href={part} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 font-bold underline decoration-blue-300 underline-offset-4 inline-flex items-center gap-1 my-1 px-1 py-0.5 bg-blue-50 rounded transition-colors active:bg-blue-100" 
              onClick={(e) => e.stopPropagation()}
            >
              <LinkIcon className="w-3 h-3 shrink-0" />
              <span className="break-all inline-block align-bottom">{part}</span>
            </a>
          );
        }
        return part;
      })}
    </span>
  );
};

const formatEventDate = (dateStr, endDateStr) => {
  if (!dateStr) return '未定';
  const d1 = new Date(dateStr);
  const day1 = ['日', '月', '火', '水', '木', '金', '土'][d1.getDay()];
  const base = `${d1.getMonth() + 1}/${d1.getDate()}(${day1})`;
  if (endDateStr && endDateStr !== dateStr) {
    const d2 = new Date(endDateStr);
    const day2 = ['日', '月', '火', '水', '木', '金', '土'][d2.getDay()];
    return `${base} 〜 ${d2.getMonth() + 1}/${d2.getDate()}(${day2})`;
  }
  return base;
};

const generateStudentId = (name, number) => {
  if (!name || !number) return null;
  return `std_${name}_${number}`;
};

// 指定した日付が属する週の「月曜日」の日付を YYYY-MM-DD で返す
const getWeekKey = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const day = dateObj.getDay();
  // 日曜日は0, 月曜日は1... なので月曜からの差分を計算
  const diff = day === 0 ? 6 : day - 1;
  dateObj.setDate(dateObj.getDate() - diff);
  
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const date = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
};

// 月曜日の日付を受け取り「◯/〇(月) 〜 〇/〇(日)」の文字列を作成する
const formatWeekHeader = (weekKey) => {
  if (!weekKey) return '';
  const [y, m, d] = weekKey.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const month = dateObj.getMonth() + 1;
  const date = dateObj.getDate();
  
  // 6日足して日曜日を計算
  const dEnd = new Date(y, m - 1, d + 6);
  const endMonth = dEnd.getMonth() + 1;
  const endDate = dEnd.getDate();

  return `${month}/${date}(月) 〜 ${endMonth}/${endDate}(日)`;
};

// --- App Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [currentTab, setCurrentTab] = useState('schedule');
  const [events, setEvents] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [rides, setRides] = useState([]);
  const [allStudents, setAllStudents] = useState({});
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);

  // --- Auth Initialization ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      } finally {
        setAuthReady(true);
      }
    };
    initAuth();
  }, []);

  // --- Profile Loading ---
  useEffect(() => {
    if (!authReady) return;
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const profileDoc = await getDoc(doc(db, 'artifacts', appId, 'users', u.uid));
          if (profileDoc.exists()) {
            setProfile(profileDoc.data());
          }
        } catch (err) {
          console.error("Profile load error:", err);
        }
      }
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, [authReady]);

  // --- Firestore Listeners ---
  useEffect(() => {
    if (!user || !authReady) return;

    const eventsRef = collection(db, 'artifacts', appId, 'public', 'data', 'events');
    const attendancesRef = collection(db, 'artifacts', appId, 'public', 'data', 'attendances');
    const ridesRef = collection(db, 'artifacts', appId, 'public', 'data', 'rides');
    const studentsRef = collection(db, 'artifacts', appId, 'public', 'data', 'students');

    const unsubEvents = onSnapshot(eventsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(a.date) - new Date(b.date));
      setEvents(data);
    }, (err) => console.error("Events error:", err));

    const unsubAttendances = onSnapshot(attendancesRef, (snapshot) => {
      setAttendances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Attendances error:", err));

    const unsubRides = onSnapshot(ridesRef, (snapshot) => {
      setRides(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Rides error:", err));

    const unsubStudents = onSnapshot(studentsRef, (snapshot) => {
      const studentMap = {};
      snapshot.docs.forEach(doc => { studentMap[doc.id] = doc.data(); });
      setAllStudents(studentMap);
    }, (err) => console.error("Students error:", err));

    return () => {
      unsubEvents();
      unsubAttendances();
      unsubRides();
      unsubStudents();
    };
  }, [user, authReady]);

  if (loading || (!user && auth.currentUser === null)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
        <p className="text-gray-400 text-sm font-medium">読み込み中...</p>
      </div>
    );
  }

  if (!user) return null;

  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="max-w-[480px] mx-auto bg-gray-50 min-h-screen relative shadow-2xl flex flex-col font-sans text-gray-900">
      <header className="bg-emerald-600 text-white px-4 py-4 sticky top-0 z-20 shadow-md flex justify-between items-center">
        <div>
          <h1 className="font-black text-lg tracking-wider">SOCCER CLUB MGR</h1>
          <p className="text-[10px] text-emerald-100 flex items-center gap-1 mt-0.5">
            <Users className="w-3 h-3" />
            試験運用中
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="bg-emerald-700/50 hover:bg-emerald-700 p-1.5 rounded-md transition-colors"
            title="設定"
          >
            <Settings className="w-4 h-4 text-emerald-200" />
          </button>
          <button
            onClick={() => setShowProfileSetup(true)}
            className="flex items-center gap-2 bg-emerald-700/50 hover:bg-emerald-700 px-3 py-1.5 rounded-md text-xs transition-colors"
          >
            <UserCircle className="w-4 h-4 text-emerald-200" />
            <span className="font-medium truncate max-w-[80px]">
              {profile ? profile.parentName : "未設定"}
            </span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {currentTab === 'schedule' && (
          <ScheduleView 
            events={events} 
            attendances={attendances} 
            rides={rides}
            profile={profile} 
            onSelectEvent={setSelectedEventId} 
          />
        )}
        {currentTab === 'import' && (
          <ImportView events={events} onSuccess={() => setCurrentTab('schedule')} onOpenSettings={() => setShowSettings(true)} />
        )}
      </main>

      <nav className="fixed bottom-0 w-full max-w-[480px] bg-white border-t border-gray-200 flex justify-around pb-safe z-20 shadow-lg">
        <button onClick={() => setCurrentTab('schedule')} className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${currentTab === 'schedule' ? 'text-emerald-600' : 'text-gray-400'}`}>
          <Calendar className="w-6 h-6" />
          <span className="text-[10px] font-bold">スケジュール</span>
        </button>
        <button onClick={() => setShowAddEvent(true)} className="flex-1 py-1 flex flex-col items-center gap-1 text-emerald-600">
          <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center -mt-5 shadow-lg active:scale-95 transition-transform">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <span className="text-[10px] font-bold">手動追加</span>
        </button>
        <button onClick={() => setCurrentTab('import')} className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${currentTab === 'import' ? 'text-emerald-600' : 'text-gray-400'}`}>
          <Download className="w-6 h-6" />
          <span className="text-[10px] font-bold">読み込む</span>
        </button>
      </nav>

      {selectedEvent && (
        <EventDetailModal 
          event={selectedEvent} 
          userId={user.uid}
          profile={profile}
          attendances={attendances}
          rides={rides}
          allStudents={allStudents}
          onClose={() => setSelectedEventId(null)} 
          onRequireProfile={() => {
            setSelectedEventId(null);
            setShowProfileSetup(true);
          }}
        />
      )}

      {showProfileSetup && (
        <ProfileSetupModal
          userId={user.uid}
          currentProfile={profile}
          onComplete={(p) => {
            setProfile(p);
            setShowProfileSetup(false);
          }}
          onClose={() => setShowProfileSetup(false)}
        />
      )}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {showAddEvent && (
        <AddEventModal
          onClose={() => setShowAddEvent(false)}
          onSaved={() => setShowAddEvent(false)}
        />
      )}
    </div>
  );
}

function SettingsModal({ onClose }) {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [saved, setSaved] = useState(false);
  const hasEnvGeminiKey = !!(import.meta.env.VITE_GEMINI_API_KEY || '').trim();

  const handleSave = () => {
    const v = apiKey.trim();
    if (v) localStorage.setItem('gemini_api_key', v);
    else localStorage.removeItem('gemini_api_key');
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 800);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-bold text-base flex items-center gap-2"><Settings className="w-4 h-4" /> 設定</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          <label className="text-xs font-bold text-gray-700">Gemini APIキー</label>
          {hasEnvGeminiKey && (
            <p className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1.5">
              ビルド時に <code className="text-[9px]">VITE_GEMINI_API_KEY</code> が設定されています（.env またはデプロイのシークレット）。こちらが優先されます。
            </p>
          )}
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={hasEnvGeminiKey ? '環境変数利用時は空で可' : 'AIzaSy...'}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-[10px] text-gray-400">
            {hasEnvGeminiKey
              ? '下の入力は任意です。環境変数が無い環境用に、このブラウザの localStorage にだけ保存されます。'
              : 'キーはこのデバイスのみに保存され、外部に送信されません。開発時はプロジェクト直下の .env に VITE_GEMINI_API_KEY=... でも設定できます。'}
          </p>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim() && !hasEnvGeminiKey}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-sm disabled:opacity-40"
          >
            {saved ? '保存しました！' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileSetupModal({ userId, currentProfile, onComplete, onClose }) {
  const [parentName, setParentName] = useState(currentProfile?.parentName || '');
  const [childName, setChildName] = useState(currentProfile?.childName || '');
  const [jerseyNumber, setJerseyNumber] = useState(currentProfile?.jerseyNumber || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!parentName || !childName || !jerseyNumber) return;
    setIsSaving(true);
    
    const cleanParentName = parentName.replace(/[\s\u3000]+/g, '');
    const cleanChildName = childName.replace(/[\s\u3000]+/g, '');
    const cleanJerseyNumber = jerseyNumber.trim();
    const studentId = generateStudentId(cleanChildName, cleanJerseyNumber);

    const profileData = {
      parentName: cleanParentName,
      childName: cleanChildName,
      jerseyNumber: cleanJerseyNumber,
      studentId: studentId,
      role: 'parent',
      updatedAt: new Date().toISOString()
    };
    
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', userId), profileData);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', studentId), {
        childName: cleanChildName,
        jerseyNumber: cleanJerseyNumber,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      onComplete(profileData);
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-xl shadow-xl overflow-hidden">
        <div className="px-4 py-4 flex items-center justify-between border-b bg-gray-50">
          <h3 className="font-bold text-gray-800">プロフィールの設定</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 mb-4">出欠や配車に回答するためには、以下の情報を設定してください。</p>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">保護者のお名前</label>
            <input type="text" placeholder="例：高村健二" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-base" value={parentName} onChange={e => setParentName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">お子様の氏名（漢字）</label>
            <input type="text" placeholder="例：高村悠太" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-base" value={childName} onChange={e => setChildName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">背番号</label>
            <input type="text" inputMode="numeric" placeholder="例：10" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-base" value={jerseyNumber} onChange={e => setJerseyNumber(e.target.value)} />
          </div>
          <button 
            onClick={handleSave}
            disabled={!parentName || !childName || !jerseyNumber || isSaving}
            className={`w-full py-3.5 mt-2 rounded-lg font-bold text-white shadow-md transition-all flex items-center justify-center gap-2
              ${!parentName || !childName || !jerseyNumber || isSaving ? 'bg-gray-300' : 'bg-emerald-600 active:bg-emerald-700'}
            `}
          >
            {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : '保存する'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScheduleView({ events, attendances, rides, profile, onSelectEvent }) {
  const [filter, setFilter] = useState('upcoming');
  const today = new Date().toISOString().split('T')[0];

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const eventDate = e.endDate ? e.endDate : e.date;
      return filter === 'upcoming' ? eventDate >= today : eventDate < today;
    });
  }, [events, filter, today]);

  const unansweredCount = useMemo(() => {
    if (!profile?.studentId) return 0;
    return events.filter(e => {
      const eventDate = e.endDate ? e.endDate : e.date;
      if (eventDate < today) return false;
      
      const attendance = attendances.find(a => a.eventId === e.id && a.studentId === profile.studentId);
      if (!attendance) return true;
      
      // 試合の場合のみ、参加していれば送迎の回答も必須とする
      if (e.type === '試合' && attendance.status === '参加') {
        const ride = rides.find(r => r.eventId === e.id && r.studentId === profile.studentId);
        if (!ride) return true;
      }
      
      return false;
    }).length;
  }, [events, attendances, rides, profile, today]);

  return (
    <div className="animate-in fade-in duration-300">
      {unansweredCount > 0 && (
        <div className="bg-emerald-100 border-l-4 border-emerald-500 p-3 m-4 rounded shadow-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
          <div className="text-emerald-800 font-medium text-sm">未回答の予定が {unansweredCount} 件あります</div>
        </div>
      )}

      <div className="flex border-b bg-white sticky top-0 z-10">
        <button onClick={() => setFilter('upcoming')} className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${filter === 'upcoming' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500'}`}>今後の予定</button>
        <button onClick={() => setFilter('past')} className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${filter === 'past' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500'}`}>過去の記録</button>
      </div>

      <div className="p-4 space-y-4">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-gray-400"><Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>予定はありません</p></div>
        ) : (
          filteredEvents.map((event, index) => {
            const attendance = profile ? attendances.find(a => a.eventId === event.id && a.studentId === profile.studentId) : null;
            const ride = profile ? rides?.find(r => r.eventId === event.id && r.studentId === profile.studentId) : null;
            const dateObj = new Date(event.date);
            const isCanceled = event.title?.includes('中止') || event.title?.includes('休み');
            const hasAttachments = event.hasAttachments;
            
            // 週区切りの計算
            const currentWeekKey = getWeekKey(event.date);
            const previousWeekKey = index > 0 ? getWeekKey(filteredEvents[index - 1].date) : null;
            const isNewWeek = previousWeekKey && currentWeekKey !== previousWeekKey;

            let isUnanswered = false;
            if (profile && (event.endDate || event.date) >= today && !isCanceled) {
              if (!attendance) {
                isUnanswered = true;
              } else if (event.type === '試合' && attendance.status === '参加' && !ride) {
                isUnanswered = true;
              }
            }

            // タイプに応じた色分け（3分類）
            let typeStyles = 'bg-gray-100 text-gray-700';
            if (event.type === '試合') typeStyles = 'bg-orange-100 text-orange-700';
            else if (event.type === '練習') typeStyles = 'bg-blue-100 text-blue-700';

            return (
              <React.Fragment key={event.id}>
                {isNewWeek && (
                  <div className="flex items-center py-1 my-2 opacity-80">
                    <div className="flex-1 border-t-2 border-dashed border-gray-200"></div>
                    <span className="mx-3 text-[10px] font-black text-gray-400 tracking-wider">
                      {formatWeekHeader(currentWeekKey)}
                    </span>
                    <div className="flex-1 border-t-2 border-dashed border-gray-200"></div>
                  </div>
                )}
                <div onClick={() => onSelectEvent(event.id)} className={`bg-white rounded-xl shadow-sm border p-4 relative overflow-hidden transition-all cursor-pointer ${isCanceled ? 'opacity-60 bg-gray-50' : 'active:scale-[0.98]'} ${isUnanswered && !isCanceled ? 'border-emerald-200' : 'border-gray-100'}`}>
                  {isUnanswered && !isCanceled && (
                    <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
                      <div className="absolute top-2 -right-6 w-24 bg-emerald-500 text-white text-[10px] font-bold text-center py-1 rotate-45 shadow-sm">未回答</div>
                    </div>
                  )}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center justify-center min-w-[55px]">
                      <span className="text-gray-500 text-[10px] font-bold uppercase">{dateObj.getMonth() + 1}月</span>
                      <span className="text-2xl font-black text-gray-800 leading-none my-1">{dateObj.getDate()}</span>
                      <span className="text-[10px] font-bold text-gray-400">({['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()]})</span>
                    </div>
                    <div className="flex-1 border-l border-gray-100 pl-4 py-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-black shrink-0 ${typeStyles}`}>{event.type}</span>
                        <h3 className={`font-bold text-sm leading-tight line-clamp-1 ${isCanceled ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{event.title}</h3>
                      </div>
                      <div className="space-y-1 mt-2">
                        <div className="flex items-center gap-1 text-gray-500 text-[10px]">
                          <Clock className="w-3 h-3" />
                          <span>
                            {event.startTime ? `${event.startTime} 〜 ${event.endTime || ''}` : (event.gatherTime ? `${event.gatherTime} 集合` : '時間未定')}
                          </span>
                        </div>
                        {event.location && <div className="flex items-start gap-1 text-gray-500 text-[10px]"><MapPin className="w-3 h-3 shrink-0" /><span className="line-clamp-1">{event.location}</span></div>}
                        {hasAttachments && <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold"><Paperclip className="w-3 h-3" /><span>添付あり</span></div>}
                      </div>
                    </div>
                  </div>
                  {!isCanceled && profile && (
                    <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold flex-wrap">
                        {attendance ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {attendance.status === '参加' ? <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />参加</span> : <span className="text-gray-500 bg-gray-100 px-2 py-1 rounded flex items-center gap-1"><X className="w-3 h-3" />欠席</span>}
                            {event.type === '試合' && attendance.status === '参加' && !ride && (
                              <span className="text-orange-500 bg-orange-50 px-2 py-1 rounded flex items-center gap-1 ml-1"><AlertCircle className="w-3 h-3" />送迎未回答</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-orange-500 bg-orange-50 px-2 py-1 rounded flex items-center gap-1"><AlertCircle className="w-3 h-3" />未回答</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}

const GENERIC_TOKENS = new Set(['tm', 'fc', 'vs', 'sc', 'ac', 'af', 'uk', 'sp', 'cf', 'fs', 'ss']);

function normalizeForMatch(s) {
  if (!s) return '';
  return s
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[　\s]+/g, ' ')
    .toLowerCase()
    .trim();
}

function titleScore(a, b) {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const split = s => s.split(/[\s\-・×,、]+/).filter(t => t.length > 1 && !GENERIC_TOKENS.has(t));
  const tokA = split(na);
  const tokB = split(nb);
  if (!tokA.length || !tokB.length) return 0;
  const setB = new Set(tokB);
  const intersection = tokA.filter(t => setB.has(t)).length;
  const union = new Set([...tokA, ...tokB]).size;
  return intersection / union;
}

function AddEventModal({ onClose, onSaved }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ date: today, type: '練習', title: '', gatherTime: '', startTime: '', endTime: '', location: '', memo: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.date || !form.title.trim()) { setError('日付とタイトルは必須です'); return; }
    setIsSaving(true);
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', id), {
        ...form, title: form.title.trim(), id, createdAt: now, updatedAt: now,
      });
      onSaved();
    } catch (e) {
      setError('保存に失敗しました');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ maxWidth: 480, margin: '0 auto' }}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl shadow-xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-4 py-4 border-b">
          <h2 className="font-bold text-gray-800">予定を手動追加</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="overflow-y-auto p-4 space-y-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 block mb-1">日付 *</label>
            <input type="date" className="w-full max-w-full appearance-none border border-gray-200 rounded-lg p-2 text-base outline-none focus:ring-2 focus:ring-emerald-500" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 block mb-1">種別 *</label>
            <div className="flex gap-2">
              {['練習', '試合', 'その他'].map(t => (
                <button key={t} type="button" onClick={() => set('type', t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${form.type === t ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 block mb-1">タイトル *</label>
            <input type="text" className="w-full border border-gray-200 rounded-lg p-2 text-base outline-none focus:ring-2 focus:ring-emerald-500" placeholder="例: DUC TM" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="space-y-2">
            {[['集合時間', 'gatherTime'], ['開始時間', 'startTime'], ['終了時間', 'endTime']].map(([label, key]) => (
              <div key={key} className="flex items-center gap-3">
                <label className="text-[10px] font-bold text-gray-500 w-14 shrink-0">{label}</label>
                <div className="relative flex-1 min-w-0">
                  <input type="time" className="w-full max-w-full appearance-none border border-gray-200 rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-emerald-500 pr-8" value={form[key]} onChange={e => set(key, e.target.value)} />
                  {form[key] && <button type="button" onClick={() => set(key, '')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">×</button>}
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 block mb-1">場所</label>
            <input type="text" className="w-full border border-gray-200 rounded-lg p-2 text-base outline-none focus:ring-2 focus:ring-emerald-500" placeholder="例: ○○グラウンド" value={form.location} onChange={e => set('location', e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 block mb-1">メモ</label>
            <textarea className="w-full border border-gray-200 rounded-lg p-2 text-base outline-none focus:ring-2 focus:ring-emerald-500 h-20 resize-none" placeholder="備考など" value={form.memo} onChange={e => set('memo', e.target.value)} />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>
        <div className="p-4 border-t bg-white">
          <button onClick={handleSave} disabled={isSaving || !form.date || !form.title.trim()}
            className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold shadow-lg disabled:opacity-40">
            {isSaving ? '保存中...' : '予定を追加'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportView({ events, onSuccess, onOpenSettings }) {
  const [text, setText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState('');
  const [previewDataList, setPreviewDataList] = useState(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (previewDataList !== null) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [previewDataList]);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      setError("APIキーが設定されていません。.env の VITE_GEMINI_API_KEY、または右上の設定から入力してください。");
      return;
    }

    setIsAnalyzing(true);
    setError('');

    const extractedUrls = [...new Set((text.match(/(https?:\/\/[^\s）)]+)/g) || []))];
    setAnalyzeStatus('スケジュールを解析中...');

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

      const urlNote = extractedUrls.length > 0
        ? `\n\n【URLについて】\nテキスト内に以下のURLが含まれています。URLの内容は参照できません。以下のURLを、関連する予定のmemoフィールドに【一字一句変更せず】そのままコピーして含めてください。絶対に短縮・省略・変形しないでください。\n${extractedUrls.join('\n')}`
        : '';

      const prompt = `
あなたはプロのジュニアサッカーチームの事務局員です。LINEの予定連絡を解析して、カレンダー登録用のJSONデータを作成してください。

【現在の文脈】
・現在は2026年3月です。
・メッセージ内の日付（4/4など）は「2026年」のものとして扱ってください。
・「中止」や「休み」と書かれている予定も抽出し、タイトルに「【中止】」を付けてください。

【解析ルール：種類 (type) の分類】
予定の種類（type）は必ず以下の3つのいずれかに分類してください。
1. "練習"：通常のトレーニングなど
2. "試合"：「試合」「大会」「TM」「遠征」などはすべてこれに統一します。
3. "その他"：「保護者会」「イベント」「飲み会」などはこれに統一します。

【URLの扱い】
テキスト内にURLが含まれる場合は、そのURLをその予定のmemoフィールドに含めてください。

【出力形式】
JSON配列で出力してください：
[ { "type": "練習"|"試合"|"その他", "title": "文字列", "date": "YYYY-MM-DD", "gatherTime": "HH:mm", "startTime": "HH:mm", "endTime": "HH:mm", "location": "文字列", "memo": "文字列" } ]

解析対象テキスト：
${text}${urlNote}
      `;

      const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 }
      };

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || "AI通信エラーが発生しました");
      }

      const response = await res.json();
      const rawText = response.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || '';
      // URLコンテキスト使用時はMarkdownコードブロックで返ることがあるためJSONを抽出
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)```/) || rawText.match(/```\s*(\[[\s\S]*?\])\s*```/) || rawText.match(/(\[[\s\S]*\])/);
      const jsonText = jsonMatch ? jsonMatch[1] : rawText;

      if (jsonText) {
        let parsed;
        try {
          parsed = JSON.parse(jsonText);
        } catch {
          throw new Error("AIの応答をJSON形式で解析できませんでした。もう一度お試しください。\n\n応答内容: " + rawText.slice(0, 200));
        }
        if (!Array.isArray(parsed)) parsed = [parsed];
        const validEvents = parsed.filter(item => item.title && item.date);
        
        if (validEvents.length === 0) {
          setError("予定が検出されませんでした。テキストの形式を確認してください。");
        } else {
          // 【既存の予定とのマッチング（更新判定）】
          // スコア = タイトル類似度(0-1)×3 + 種別一致(0 or 1)、閾値1.5以上でマッチ
          const MATCH_THRESHOLD = 1.5;
          const usedIds = new Set();
          const enriched = validEvents.map(newItem => {
            const sameDateEvents = events.filter(e => e.date === newItem.date && !usedIds.has(e.id));
            const scored = sameDateEvents
              .map(e => ({ event: e, score: titleScore(newItem.title, e.title) * 3 + (e.type === newItem.type ? 1 : 0) }))
              .sort((a, b) => b.score - a.score);
            const best = scored[0];
            const matched = best?.score >= MATCH_THRESHOLD ? best.event : null;
            const freshId = crypto.randomUUID();

            if (matched) {
              usedIds.add(matched.id);
              return {
                ...newItem,
                id: matched.id,
                _matchedId: matched.id,
                _freshId: freshId,
                isUpdate: true,
                originalTitle: matched.title
              };
            }
            return {
              ...newItem,
              id: freshId,
              _matchedId: null,
              _freshId: freshId,
              isUpdate: false
            };
          });

          setPreviewDataList(enriched);
        }
      }
    } catch (err) {
      console.error(err);
      setError(String(err.message || err) || "AI解析中にエラーが発生しました。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleUpdate = (idx) => {
    setPreviewDataList(list => list.map((item, i) => {
      if (i !== idx) return item;
      if (item.isUpdate) {
        return { ...item, id: item._freshId, isUpdate: false };
      } else if (item._matchedId) {
        return { ...item, id: item._matchedId, isUpdate: true };
      }
      return item;
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const promises = previewDataList.map(data => {
        const { isUpdate, originalTitle, _matchedId, _freshId, ...saveData } = data;
        const payload = {
          ...saveData,
          updatedAt: new Date().toISOString()
        };
        if (!isUpdate) {
          payload.createdAt = new Date().toISOString();
        }
        return setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', saveData.id), payload, { merge: true });
      });
      
      await Promise.all(promises);
      onSuccess();
    } catch (err) {
      setError('保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAllEvents = async () => {
    const confirm1 = window.confirm("【警告】登録されている「すべての予定」「出欠データ」「送迎データ」を完全に削除し、初期状態に戻します。\n本当によろしいですか？");
    if (!confirm1) return;
    const confirm2 = window.confirm("本当にすべて削除しますか？この操作は絶対に取り消せません。");
    if (!confirm2) return;

    setIsDeletingAll(true);
    try {
      const eventsSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'events'));
      const attSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'attendances'));
      const ridesSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'rides'));

      const promises = [
        ...eventsSnap.docs.map(d => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', d.id))),
        ...attSnap.docs.map(d => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'attendances', d.id))),
        ...ridesSnap.docs.map(d => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rides', d.id)))
      ];

      await Promise.all(promises);
      
      alert("すべてのデータを削除しました。");
      setText('');
      onSuccess();
    } catch (e) {
      console.error(e);
      alert("削除中にエラーが発生しました。");
    } finally {
      setIsDeletingAll(false);
    }
  };

  if (!previewDataList) {
    return (
      <div className="flex flex-col h-full animate-in fade-in duration-500">
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <h2 className="text-lg font-bold flex items-center gap-2 text-emerald-800"><Download className="w-5 h-5" /> スケジュール取り込み</h2>
          <p className="text-xs text-gray-500 leading-relaxed bg-white p-3 rounded-xl border border-gray-100">
            LINEの予定連絡をまるごとコピーして貼り付けてください。AIが日付・時間・場所を自動で判別します。<br/>
            <span className="font-bold text-emerald-600 mt-1 block">💡 既存の予定と日付・種別が一致するものは「更新」、一致しないものは「新規追加」されます。同日に複数の予定がある場合はそれぞれ別々に登録されます。</span>
          </p>
          <textarea className="w-full h-64 p-4 border rounded-xl text-base outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner bg-white font-sans" placeholder="ここにLINEメッセージを貼り付け..." value={text} onChange={e => setText(e.target.value)} />
          {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> <span className="break-all">{String(error)}</span></div>}
          <button onClick={handleAnalyze} disabled={!text.trim() || isAnalyzing} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
            {isAnalyzing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="animate-spin w-5 h-5" /> {analyzeStatus}
              </span>
            ) : '解析を開始'}
          </button>
        </div>
        
        <div className="p-4 bg-gray-100 border-t mt-auto">
          <button 
            onClick={handleDeleteAllEvents}
            disabled={isDeletingAll}
            className="w-full py-3 bg-white border border-red-200 text-red-500 rounded-xl font-bold text-xs flex items-center justify-center gap-2 active:bg-red-50 transition-colors shadow-sm"
          >
            {isDeletingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            【開発用】すべてのデータ（予定・出欠）をリセット
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
      <div className="p-4 border-b bg-white flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <h2 className="font-bold text-gray-800">解析結果 ({previewDataList.length}件)</h2>
        <button onClick={() => setPreviewDataList(null)} className="text-xs text-gray-500 underline decoration-gray-300 underline-offset-4">やり直す</button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {previewDataList.map((data, idx) => {
           let typeStyles = 'bg-gray-100 text-gray-700';
           if (data.type === '試合') typeStyles = 'bg-orange-100 text-orange-700';
           else if (data.type === '練習') typeStyles = 'bg-blue-100 text-blue-700';

           return (
            <div key={idx} className={`bg-white border rounded-xl p-3 shadow-sm flex gap-3 ${data.isUpdate ? 'border-blue-200 bg-blue-50/30' : ''}`}>
              <div className="text-emerald-600 font-bold text-xs shrink-0 pt-1 text-center">
                {data.date.substring(5)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-black shrink-0 ${typeStyles}`}>{data.type}</span>
                  <input
                    className="font-bold text-sm text-gray-800 bg-transparent border-b border-transparent focus:border-emerald-400 outline-none flex-1 min-w-0"
                    value={data.title}
                    onChange={e => setPreviewDataList(list => list.map((item, i) => i === idx ? { ...item, title: e.target.value } : item))}
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">{data.startTime || '時間未定'} 〜 / {data.location || '場所未定'}</p>
                
                {data.isUpdate && data.originalTitle && (
                  <p className="text-[9px] text-blue-500 mt-0.5">既存: {data.originalTitle}</p>
                )}
                <button onClick={() => handleToggleUpdate(idx)} className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border active:opacity-70 transition-opacity" style={data.isUpdate ? {color:'#2563eb',background:'#dbeafe',borderColor:'#93c5fd'} : {color:'#059669',background:'#d1fae5',borderColor:'#6ee7b7'}}>
                  {data.isUpdate ? <><RefreshCw className="w-3 h-3" /> 既存を更新（タップで新規に変更）</> : <><Plus className="w-3 h-3" /> 新規追加{data._matchedId ? '（タップで更新に変更）' : ''}</>}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-4 bg-white border-t"><button onClick={handleSave} disabled={isSaving} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold shadow-lg">{isSaving ? '保存中...' : 'これらをカレンダーに登録'}</button></div>
    </div>
  );
}

function EventDetailModal({ event, userId, profile, attendances, rides, allStudents, onClose, onRequireProfile }) {
  const [tab, setTab] = useState('details');
  const isCanceled = event.title?.includes('中止') || event.title?.includes('休み');

  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    const scrollY = main.scrollTop;
    main.style.overflow = 'hidden';
    main.style.position = 'fixed';
    main.style.top = `-${scrollY}px`;
    main.style.width = '100%';
    return () => {
      main.style.overflow = '';
      main.style.position = '';
      main.style.top = '';
      main.style.width = '';
      main.scrollTop = scrollY;
    };
  }, []);

  const handleUpdateType = async (newType) => {
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', event.id), {
        type: newType,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error(e);
      alert("種別の変更に失敗しました");
    }
  };

  let selectStyles = 'bg-gray-100 text-gray-700';
  if (isCanceled) selectStyles = 'bg-gray-200 text-gray-500';
  else if (event.type === '試合') selectStyles = 'bg-orange-100 text-orange-700';
  else if (event.type === '練習') selectStyles = 'bg-blue-100 text-blue-700';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 animate-in slide-in-from-bottom-full duration-300">
      <div className="bg-white px-4 py-4 flex items-center justify-between border-b sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2 flex-1 mr-4">
          <select 
            value={event.type || 'その他'}
            onChange={(e) => handleUpdateType(e.target.value)}
            disabled={isCanceled}
            className={`text-base px-2 py-0.5 rounded-md font-bold outline-none cursor-pointer appearance-none text-center ${selectStyles}`}
          >
            <option value="練習">練習</option>
            <option value="試合">試合</option>
            <option value="その他">その他</option>
          </select>
          <h2 className={`font-bold line-clamp-1 ${isCanceled ? 'text-gray-500 line-through' : ''}`}>{event.title}</h2>
        </div>
        <button onClick={onClose} className="p-2 -mr-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex border-b bg-white shrink-0 shadow-sm">
        {['details', 'transport', 'matching'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all ${tab === t ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-400'}`}>
            {t === 'details' ? '詳細・出欠' : t === 'transport' ? '送迎回答' : '配車プラン'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'details' && <TabDetails event={event} profile={profile} attendances={attendances} isCanceled={isCanceled} onRequireProfile={onRequireProfile} onClose={onClose} />}
        {tab === 'transport' && !isCanceled && <TabTransport event={event} profile={profile} rides={rides} attendances={attendances} onRequireProfile={onRequireProfile} />}
        {tab === 'matching' && !isCanceled && <TabMatching event={event} rides={rides} attendances={attendances} allStudents={allStudents} />}
      </div>
    </div>
  );
}

const compressImage = (file) => new Promise((resolve, reject) => {
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(objectUrl);
    const LIMIT = 800000;

    const tryCompress = (maxW) => {
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      for (let q = 0.8; q >= 0.1; q = Math.round((q - 0.1) * 10) / 10) {
        const dataUrl = canvas.toDataURL('image/jpeg', q);
        if (dataUrl.length <= LIMIT) return dataUrl;
      }
      return null;
    };

    for (const maxW of [1200, 800, 500, 300]) {
      const result = tryCompress(maxW);
      if (result) { resolve(result); return; }
    }
    // 最終手段: 300px・最低品質
    resolve(tryCompress(300) || tryCompress(150));
  };
  img.onerror = reject;
  img.src = objectUrl;
});

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

function LocationField({ event }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(event.location || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { setValue(event.location || ''); }, [event.location]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', event.id), {
        location: value,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 animate-in fade-in">
        <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
        <input
          type="text"
          autoFocus
          className="flex-1 border border-emerald-300 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsEditing(false); }}
          placeholder="場所を入力..."
        />
        <button onClick={() => setIsEditing(false)} className="text-[10px] text-gray-400 hover:text-gray-600 px-1">キャンセル</button>
        <button onClick={handleSave} disabled={isSaving} className="text-[10px] text-white bg-emerald-600 hover:bg-emerald-700 px-2 py-1 rounded flex items-center gap-1">
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}保存
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={`w-full text-left text-xs flex items-start gap-2 p-3 rounded-xl transition-colors group ${event.location ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-200'}`}
    >
      <MapPin className={`w-4 h-4 shrink-0 mt-0.5 ${event.location ? 'text-emerald-600' : 'text-gray-300'}`} />
      <span className={event.location ? 'text-gray-700' : 'text-gray-400 not-italic'}>{event.location || '場所を追加...'}</span>
    </button>
  );
}

function TabDetails({ event, profile, attendances, isCanceled, onRequireProfile, onClose }) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const familyAttendance = profile ? (attendances.find(a => a.eventId === event.id && a.studentId === profile.studentId) || {}) : {};
  const [status, setStatus] = useState(familyAttendance.status || '');
  const [comment, setComment] = useState(familyAttendance.comment || '');

  const [uploadProgress, setUploadProgress] = useState(null);
  const fileInputRef = useRef(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const [editData, setEditData] = useState({
    title: event.title || '',
    date: event.date || '',
    type: event.type || '練習',
    gatherTime: event.gatherTime || '',
    startTime: event.startTime || '',
    endTime: event.endTime || '',
    location: event.location || '',
    memo: event.memo || '',
  });

  useEffect(() => {
    setEditData({
      title: event.title || '',
      date: event.date || '',
      type: event.type || '練習',
      gatherTime: event.gatherTime || '',
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      location: event.location || '',
      memo: event.memo || '',
    });
  }, [event]);

  const [attachments, setAttachments] = useState([]);
  useEffect(() => {
    const ref = collection(db, 'artifacts', appId, 'public', 'data', 'events', event.id, 'attachments');
    return onSnapshot(ref, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      setAttachments(list);
    });
  }, [event.id]);

  const handleSaveEventDetails = async () => {
    if (!editData.title.trim()) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', event.id), {
        title: editData.title.trim(),
        date: editData.date,
        type: editData.type,
        gatherTime: editData.gatherTime,
        startTime: editData.startTime,
        endTime: editData.endTime,
        location: editData.location,
        memo: editData.memo,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setIsEditingEvent(false);
    } catch (e) {
      console.error(e);
      alert("予定の更新に失敗しました");
    }
  };

  const handleSaveAttendance = async (s) => {
    if (!profile) return onRequireProfile();
    setIsSaving(true);
    setStatus(s);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'attendances', `${event.id}_${profile.studentId}`), { 
        eventId: event.id, 
        studentId: profile.studentId, 
        status: s, 
        comment, 
        responderName: profile.parentName, 
        updatedAt: new Date().toISOString() 
      });
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > 5 * 1024 * 1024) {
      alert('5MB以下のファイルを選択してください');
      return;
    }

    setUploadProgress(10);
    try {
      let url;
      if (file.type.startsWith('image/')) {
        url = await compressImage(file);
      } else {
        url = await readAsDataUrl(file);
      }
      setUploadProgress(80);
      const attId = crypto.randomUUID();
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', event.id, 'attachments', attId), {
        name: file.name, url, createdAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', event.id), { hasAttachments: true }, { merge: true });
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 400);
    } catch (err) {
      console.error(err);
      alert(`保存に失敗しました\n${err.message}`);
      setUploadProgress(null);
    }
  };

  const handleDeleteFile = async (attId) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', event.id, 'attachments', attId));
      const remaining = attachments.filter(a => a.id !== attId);
      if (remaining.length === 0) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', event.id), { hasAttachments: false }, { merge: true });
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteEvent = async () => {
    const confirmDelete = window.confirm(`予定「${event.title}」をカレンダーから削除しますか？\n（この操作は取り消せません）`);
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', event.id));
      alert("予定を削除しました。");
      onClose();
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました。");
      setIsDeleting(false);
    }
  };

  return (
    <>
    <div className="space-y-6 pb-20">
      <div className={`bg-white rounded-xl p-5 shadow-sm border space-y-4 overflow-hidden ${isCanceled ? 'bg-gray-50 border-gray-200' : 'border-gray-100'}`}>
        <div className="flex items-center justify-between pb-2 border-b border-gray-50">
          <div className="font-bold text-gray-800 flex items-center gap-2"><Calendar className="w-4 h-4 text-emerald-600" />{formatEventDate(event.date, event.endDate)}</div>
          {isEditingEvent ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setIsEditingEvent(false)} className="text-[10px] text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors">キャンセル</button>
              <button onClick={handleSaveEventDetails} disabled={!editData.title.trim()} className="text-[10px] flex items-center gap-1 text-white bg-emerald-600 hover:bg-emerald-700 px-2 py-1 rounded transition-colors disabled:opacity-40"><Save className="w-3 h-3" />保存</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsEditingEvent(true)} 
                className="text-[10px] flex items-center gap-1 text-gray-500 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
              >
                <Edit3 className="w-3 h-3" />
                編集
              </button>
              <button 
                onClick={handleDeleteEvent} 
                disabled={isDeleting}
                className="text-[10px] flex items-center gap-1 text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors"
              >
                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                削除
              </button>
            </div>
          )}
        </div>

        {isEditingEvent ? (
          <div className="space-y-3 animate-in fade-in">
            <div>
              <label className="text-[10px] font-bold text-gray-500 block mb-1">タイトル *</label>
              <input type="text" className="w-full border border-gray-200 rounded-lg p-2 text-base outline-none focus:ring-2 focus:ring-emerald-500" value={editData.title} onChange={e => setEditData({...editData, title: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 block mb-1">日付</label>
              <input type="date" className="w-full max-w-full appearance-none border border-gray-200 rounded-lg p-2 text-base outline-none focus:ring-2 focus:ring-emerald-500" value={editData.date} onChange={e => setEditData({...editData, date: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 block mb-1">種別</label>
              <div className="flex gap-2">
                {['練習', '試合', 'その他'].map(t => (
                  <button key={t} type="button" onClick={() => setEditData({...editData, type: t})}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${editData.type === t ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {[['集合時間','gatherTime'],['開始時間','startTime'],['終了時間','endTime']].map(([label, key]) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-[10px] font-bold text-gray-500 w-14 shrink-0">{label}</label>
                  <div className="relative flex-1 min-w-0">
                    <input type="time" className="w-full max-w-full appearance-none border border-gray-200 rounded-lg px-3 py-2 text-base outline-none focus:ring-2 focus:ring-emerald-500 pr-8" value={editData[key]} onChange={e => setEditData({...editData, [key]: e.target.value})} />
                    {editData[key] && <button type="button" onClick={() => setEditData({...editData, [key]: ''})} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">×</button>}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 block mb-1">場所</label>
              <input type="text" className="w-full border border-gray-200 rounded-lg p-2 text-base outline-none focus:ring-2 focus:ring-emerald-500" value={editData.location} onChange={e => setEditData({...editData, location: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 block mb-1">メモ</label>
              <textarea className="w-full border border-gray-200 rounded-lg p-2 text-base h-20 outline-none focus:ring-2 focus:ring-emerald-500 resize-none" value={editData.memo} onChange={e => setEditData({...editData, memo: e.target.value})} />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 text-xs font-medium text-gray-600">
              <div className="bg-gray-50 p-2 rounded-lg flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" />{event.startTime || '未定'} 〜 {event.endTime || ''}</div>
              {event.gatherTime && <div className="bg-gray-50 p-2 rounded-lg flex items-center gap-2"><Users className="w-4 h-4" />集合: {event.gatherTime}</div>}
            </div>
            <LocationField event={event} />
            {event.memo && <div className="text-xs text-gray-600 leading-relaxed pt-2 border-t border-gray-50"><LinkedText text={event.memo} /></div>}
          </>
        )}
      </div>

      {!isCanceled && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-emerald-600" />
              添付資料・リンク
            </h3>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadProgress !== null}
              className="text-emerald-600 font-bold text-xs flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />追加
            </button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
          </div>
          {uploadProgress !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-gray-500 font-bold">
                <span>アップロード中...</span><span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}
          <div className="space-y-2">
            {attachments.length === 0 ? (
              <div className="text-[10px] text-gray-400 text-center py-6 bg-gray-50 rounded-xl border border-dashed not-italic">登録された資料はありません</div>
            ) : (
              attachments.map((file) => (
                <div key={file.id} className="group relative">
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-emerald-200 transition-all shadow-sm">
                    <div className="p-2 bg-emerald-50 rounded-full text-emerald-600"><FileText className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{file.name}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-300" />
                  </a>
                  {file.url?.startsWith('data:image') && (
                    <button type="button" onClick={() => setLightboxUrl(file.url)} className="mt-2 w-full rounded-xl overflow-hidden border border-gray-100 block">
                      <img src={file.url} alt={file.name} className="w-full h-32 object-cover" />
                    </button>
                  )}
                  <button onClick={() => handleDeleteFile(file.id)} className="absolute -top-1 -right-1 p-1 bg-white text-red-400 border border-red-100 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {!isCanceled && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-800">家族の出欠回答</h3>
            {familyAttendance.responderName && <span className="text-[9px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border">更新: {familyAttendance.responderName}</span>}
          </div>
          <div className="flex gap-3">
            <button onClick={() => handleSaveAttendance('参加')} disabled={isSaving} className={`flex-1 py-4 rounded-xl font-bold border-2 transition-all ${status === '参加' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 text-gray-400 active:bg-gray-50'}`}>参加</button>
            <button onClick={() => handleSaveAttendance('欠席')} disabled={isSaving} className={`flex-1 py-4 rounded-xl font-bold border-2 transition-all ${status === '欠席' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-100 text-gray-400 active:bg-gray-50'}`}>欠席</button>
          </div>
          {profile ? (
            <textarea className="w-full border border-gray-100 rounded-xl p-3 text-base h-24 outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50" placeholder="連絡事項・欠席理由など..." value={comment} onChange={e => setComment(e.target.value)} onBlur={() => status && handleSaveAttendance(status)} />
          ) : (
             <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-100 mt-2">
                <p className="text-xs text-gray-500 mb-2">出欠に回答するにはプロフィールの設定が必要です</p>
                <button onClick={onRequireProfile} className="text-xs bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm">設定する</button>
             </div>
          )}
        </div>
      )}
    </div>

    {lightboxUrl && (
      <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center" onClick={() => setLightboxUrl(null)}>
        <button className="absolute top-4 right-4 text-white p-2" onClick={() => setLightboxUrl(null)}><X className="w-6 h-6" /></button>
        <img src={lightboxUrl} alt="" className="max-w-full max-h-full object-contain p-4" onClick={e => e.stopPropagation()} />
      </div>
    )}
    </>
  );
}

function TabTransport({ event, profile, rides, attendances, onRequireProfile }) {
  if (!profile) {
    return (
      <div className="p-8 text-center bg-gray-50 rounded-xl border-2 border-dashed m-4">
        <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm font-bold mb-2">送迎の調整機能です</p>
        <p className="text-gray-400 text-xs mb-4">利用するにはプロフィールの設定が必要です</p>
        <button onClick={onRequireProfile} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm">設定する</button>
      </div>
    );
  }

  const familyRide = rides.find(r => r.eventId === event.id && r.studentId === profile.studentId) || {};
  const [isSaving, setIsSaving] = useState(false);
  const [role, setRole] = useState(familyRide.role || 'none');
  const [area, setArea] = useState(familyRide.area || '柏の葉');
  const [memo, setMemo] = useState(familyRide.memo || '');
  const [capacity, setCapacity] = useState(familyRide.capacity || 3);
  const [useParking, setUseParking] = useState(familyRide.useParking !== undefined ? familyRide.useParking : true);
  const [standbyCapacity, setStandbyCapacity] = useState(familyRide.standbyCapacity || 0);
  const [riderType, setRiderType] = useState(familyRide.type || 'child_only');
  const [riderCount, setRiderCount] = useState(familyRide.count || 1);
  const isAttending = attendances.find(a => a.eventId === event.id && a.studentId === profile.studentId)?.status === '参加';

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = { 
        eventId: event.id, 
        studentId: profile.studentId, 
        role, 
        area,
        memo,
        responderName: profile.parentName,
        updatedAt: new Date().toISOString() 
      };
      if (role === 'driver') {
        Object.assign(payload, { capacity, useParking, standbyCapacity });
      } else if (role === 'rider') {
        Object.assign(payload, { type: riderType, count: riderCount });
      }
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rides', `${event.id}_${profile.studentId}`), payload);
      alert("送迎回答を保存しました");
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  if (!isAttending) return <div className="p-8 text-center text-gray-400 text-sm bg-gray-50 rounded-xl border-2 border-dashed m-4 not-italic">「参加」の場合のみ回答可能です</div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-3">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">送迎アンケート</label>
        <RoleCard selected={role === 'driver'} onClick={() => setRole('driver')} icon={<Car className="w-5 h-5" />} title="車を出す" desc="相乗り提供が可能です" />
        <RoleCard selected={role === 'rider'} onClick={() => setRole('rider')} icon={<Users className="w-5 h-5" />} title="乗せてほしい" desc="同乗を希望します" />
        <RoleCard selected={role === 'none'} onClick={() => setRole('none')} icon={<X className="w-5 h-5" />} title="不要 / 自力移動" desc="自転車・徒歩・現地集合など" />
      </div>
      
      {role === 'driver' && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-5 shadow-sm animate-in fade-in">
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-2">相乗り可能人数（選手数）</label>
            <select className="w-full border border-gray-200 rounded-xl p-3 text-base bg-gray-50 outline-none" value={capacity} onChange={e => setCapacity(Number(e.target.value))}>
              {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} 人</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-2">乗合の集合エリア</label>
            <div className="flex gap-2">
              <AreaButton selected={area === '柏の葉'} onClick={() => setArea('柏の葉')} label="柏の葉" />
              <AreaButton selected={area === '柏たなか'} onClick={() => setArea('柏たなか')} label="柏たなか" />
            </div>
          </div>
        </div>
      )}

      {role === 'rider' && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-5 shadow-sm animate-in fade-in">
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-2">希望人数</label>
            <select className="w-full border border-gray-200 rounded-xl p-3 text-base bg-gray-50 outline-none" value={riderCount} onChange={e => setRiderCount(Number(e.target.value))}>
              {[1,2,3,4].map(n => <option key={n} value={n}>{n} 人</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-2">乗車希望エリア</label>
            <div className="flex gap-2">
              <AreaButton selected={area === '柏の葉'} onClick={() => setArea('柏の葉')} label="柏の葉" />
              <AreaButton selected={area === '柏たなか'} onClick={() => setArea('柏たなか')} label="柏たなか" />
            </div>
          </div>
        </div>
      )}

      {role !== 'none' && (
        <textarea className="w-full border border-gray-200 rounded-xl p-4 text-base h-24 outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm" placeholder="備考や配車に関する要望があれば入力してください..." value={memo} onChange={e => setMemo(e.target.value)} />
      )}
      
      <button onClick={handleSave} disabled={isSaving} className="w-full py-4 rounded-xl font-bold bg-gray-900 text-white shadow-lg active:scale-[0.98] transition-all flex justify-center items-center gap-2">
        {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : '回答を保存'}
      </button>
    </div>
  );
}

function RoleCard({ selected, onClick, icon, title, desc }) {
  return (
    <button onClick={onClick} className={`text-left p-4 rounded-xl border-2 transition-all flex items-start gap-4 ${selected ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-gray-100 bg-white'}`}>
      <div className={`p-3 rounded-xl ${selected ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{icon}</div>
      <div className="flex-1"><h4 className={`font-bold ${selected ? 'text-emerald-900' : 'text-gray-800'}`}>{title}</h4><p className="text-[10px] text-gray-500 mt-1 leading-tight">{desc}</p></div>
    </button>
  );
}

function AreaButton({ selected, onClick, label }) {
  return <button onClick={onClick} className={`flex-1 py-3 rounded-xl border-2 text-xs font-bold transition-all ${selected ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-white border-gray-100 text-gray-400'}`}>{label}</button>;
}

function TabMatching({ event, rides, attendances, allStudents }) {
  const [matchResult, setMatchResult] = useState(null);
  useEffect(() => {
    const attendingStudentIds = attendances.filter(a => a.eventId === event.id && a.status === '参加').map(a => a.studentId);
    const eventRides = rides.filter(r => r.eventId === event.id && attendingStudentIds.includes(r.studentId));
    
    const formatName = (sid) => {
      const std = allStudents[sid];
      if (!std) return "不明な選手";
      return `${std.childName} [#${std.jerseyNumber}]`;
    };

    const drivers = eventRides.filter(r => r.role === 'driver').map(d => ({ ...d, name: formatName(d.studentId), passengers: [], remain: d.capacity, area: d.area }));
    const riders = eventRides.filter(r => r.role === 'rider').map(r => ({ ...r, name: formatName(r.studentId), matched: false, area: r.area, count: r.count }));
    
    riders.forEach(rider => {
      if (rider.matched) return;
      for (let d of drivers) {
        if (d.area === rider.area && d.remain >= rider.count) {
          d.passengers.push(rider);
          d.remain -= rider.count;
          rider.matched = true;
          break;
        }
      }
    });

    riders.forEach(rider => {
      if (rider.matched) return;
      for (let d of drivers) {
        if (d.remain >= rider.count) {
          d.passengers.push(rider);
          d.remain -= rider.count;
          rider.matched = true;
          break;
        }
      }
    });
    
    setMatchResult({ drivers, unmatched: riders.filter(r => !r.matched) });
  }, [rides, event.id, attendances, allStudents]);

  if (!matchResult) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-emerald-600" /></div>;
  
  return (
    <div className="space-y-6 pb-20">
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"><p className="text-[10px] text-gray-400 font-bold mb-1 tracking-widest uppercase">提供可能座席</p><p className="text-2xl font-black text-emerald-600">{matchResult.drivers.reduce((a, d) => a + d.capacity, 0)}</p></div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"><p className="text-[10px] text-gray-400 font-bold mb-1 tracking-widest uppercase">未マッチ人数</p><p className={`text-2xl font-black ${matchResult.unmatched.length > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{matchResult.unmatched.length}</p></div>
      </div>
      <div className="space-y-3">
        {matchResult.drivers.map((d, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm border-l-4 border-l-emerald-500">
            <div className="flex justify-between items-center mb-3 font-bold text-sm text-gray-800">
              <div className="flex items-center gap-2"><Car className="w-4 h-4 text-emerald-600" />{d.name} 車</div>
              <span className="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100">空き: {d.remain}</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-[11px] leading-relaxed text-gray-600">
              {d.passengers.length === 0 ? <span className="not-italic text-gray-400">同乗者なし</span> : d.passengers.map(p => p.name).join('、')}
            </div>
          </div>
        ))}
        {matchResult.unmatched.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 shadow-sm border-l-4 border-l-red-500">
            <h4 className="text-xs font-bold text-red-600 mb-2">未マッチ（座席調整が必要）</h4>
            <div className="text-[11px] text-red-500">{matchResult.unmatched.map(r => r.name).join('、')}</div>
          </div>
        )}
      </div>
    </div>
  );
}