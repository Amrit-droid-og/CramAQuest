import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { generateDivyamBatch } from '../lib/gemini';
import { useParticleEffects } from '../lib/useParticleEffects';
import { Users, Send, ShieldAlert, Swords, Heart, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const RAID_ID = 'global-daily';

export default function BossRaid() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const { spawnFloatingText, triggerScreenShake } = useParticleEffects();
  
  const [raidState, setRaidState] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [error, setError] = useState(null);
  const chatEndRef = useRef(null);

  // Initialize or listen to Raid
  useEffect(() => {
    if (!currentUser) return;
    
    const raidRef = doc(db, 'raids', RAID_ID);
    
    const unsubscribe = onSnapshot(raidRef, async (docSnap) => {
      if (!docSnap.exists()) {
        // Initialize Boss if not exists
        try {
          const qs = await generateDivyamBatch('10', 'General Knowledge', 'hard', 10);
          await setDoc(raidRef, {
            bossName: 'The Mitochondria Behemoth',
            maxHp: 2000,
            currentHp: 2000,
            questions: qs,
            currentQuestionIndex: 0,
            chat: [],
            defeated: false,
            players: {}
          });
        } catch (e) {
          console.error("Failed to init boss", e);
          setError(e.message || "Server overload/error. Please cash out and visit tomorrow!");
        }
      } else {
        const data = docSnap.data();
        setRaidState(data);
        
        // Ensure player is registered
        if (data && (!data.players || !data.players[currentUser.uid])) {
          await updateDoc(raidRef, {
            [`players.${currentUser.uid}`]: {
              name: userProfile?.displayName || 'Unknown Hero',
              damage: 0
            }
          });
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser, userProfile]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [raidState?.chat]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold text-red-600 mb-2">Server Overload / Error</h2>
        <p className="text-muted-foreground text-sm mb-6 max-w-md">{error}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-8 rounded-xl cursor-pointer transition-all active:scale-95 shadow-sm"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!raidState) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-purple-500 mb-4" />
        <p className="text-xl font-bold">Summoning Raid Boss...</p>
      </div>
    );
  }

  const hpPercentage = Math.max(0, (raidState.currentHp / raidState.maxHp) * 100);
  const currentQ = raidState.questions[raidState.currentQuestionIndex];

  const handleAnswer = async (e, optionId) => {
    if (raidState.defeated) return;

    const isCorrect = optionId === currentQ.correctOptionId;
    const raidRef = doc(db, 'raids', RAID_ID);

    if (isCorrect) {
      const damage = Math.floor(Math.random() * 50) + 50; // 50-100 DMG
      
      triggerScreenShake();
      const rect = e.currentTarget.getBoundingClientRect();
      spawnFloatingText(`-${damage} DMG!`, rect.left + rect.width / 2, rect.top, 'text-red-500 font-black', true);

      // Check if this kills the boss
      const newHp = raidState.currentHp - damage;
      if (newHp <= 0) {
        await updateDoc(raidRef, {
          currentHp: 0,
          defeated: true,
          [`players.${currentUser.uid}.damage`]: increment(damage)
        });
      } else {
        // Move to next question if any, else loop
        const nextIdx = (raidState.currentQuestionIndex + 1) % raidState.questions.length;
        await updateDoc(raidRef, {
          currentHp: increment(-damage),
          currentQuestionIndex: nextIdx,
          [`players.${currentUser.uid}.damage`]: increment(damage)
        });
      }
    } else {
      triggerScreenShake();
      const rect = e.currentTarget.getBoundingClientRect();
      spawnFloatingText(`Miss!`, rect.left + rect.width / 2, rect.top, 'text-gray-500 font-bold', false);
    }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const raidRef = doc(db, 'raids', RAID_ID);
    await updateDoc(raidRef, {
      chat: arrayUnion({
        uid: currentUser.uid,
        name: userProfile?.displayName || 'Hero',
        message: chatInput.trim(),
        timestamp: new Date().toISOString()
      })
    });
    setChatInput('');
  };

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-80px)] flex flex-col md:flex-row gap-4 mt-4 px-2">
      
      {/* Left: Boss & Question Area */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Header */}
        <div className="bg-card border border-border p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-muted rounded-xl transition-colors border border-border">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-purple-500" />
              Global Boss Raid
            </h1>
            <p className="text-xs text-muted-foreground">{Object.keys(raidState.players || {}).length} Heroes connected</p>
          </div>
        </div>

        {/* Boss Arena */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-md flex flex-col items-center justify-center relative overflow-hidden group">
          <div className={`absolute inset-0 bg-red-500/5 ${raidState.currentHp < 500 ? 'animate-pulse' : ''}`} />
          
          <Swords className={`w-32 h-32 mb-6 transition-all ${raidState.defeated ? 'text-gray-600 rotate-180 scale-y-50' : 'text-red-500 animate-float-up'} drop-shadow-2xl`} style={{ animationIterationCount: 'infinite' }} />
          
          <h2 className="text-3xl font-black mb-2 relative z-10 text-center">{raidState.bossName}</h2>
          
          {/* HP Bar */}
          <div className="w-full max-w-md bg-muted rounded-full h-6 mb-2 border border-border overflow-hidden relative">
            <div 
              className="bg-gradient-to-r from-red-600 to-red-400 h-full transition-all duration-300"
              style={{ width: `${hpPercentage}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
              {raidState.currentHp} / {raidState.maxHp} HP
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm font-bold text-red-500 relative z-10">
            <Heart className="w-4 h-4 fill-red-500" /> {hpPercentage.toFixed(1)}%
          </div>
        </div>

        {/* Question Area */}
        <div className="flex-1 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-center">
          {raidState.defeated ? (
            <div className="text-center animate-in zoom-in duration-500">
              <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-green-600 mb-2">Boss Defeated!</h2>
              <p className="text-muted-foreground">The realm is safe... until tomorrow.</p>
            </div>
          ) : currentQ ? (
            <div className="animate-in fade-in duration-300">
               <h3 className="text-xl font-bold mb-6 text-center">{currentQ.questionText}</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 {currentQ.options.map(opt => (
                   <button
                     key={opt.id}
                     onClick={(e) => handleAnswer(e, opt.id)}
                     className="w-full text-left p-4 rounded-xl border-2 border-border hover:border-purple-500 hover:bg-purple-50 transition-colors font-medium"
                   >
                     {opt.text}
                   </button>
                 ))}
               </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground">Loading next attack phase...</p>
          )}
        </div>
      </div>

      {/* Right: Team Chat & Leaderboard */}
      <div className="w-full md:w-80 flex flex-col gap-4">
        {/* Chat */}
        <div className="flex-1 bg-card border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <div className="bg-muted p-3 border-b border-border flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-500" />
            <span className="font-bold text-sm">Team Comms</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background">
            {raidState.chat.length === 0 && (
              <p className="text-xs text-muted-foreground text-center">It's quiet... Drop a hint to your team!</p>
            )}
            {raidState.chat.map((msg, i) => (
              <div key={i} className="text-sm">
                <span className={`font-bold ${msg.uid === currentUser.uid ? 'text-purple-500' : 'text-blue-500'}`}>{msg.name}: </span>
                <span className="text-foreground">{msg.message}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendChat} className="p-3 border-t border-border bg-muted flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Send hint..."
              className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <button type="submit" disabled={!chatInput.trim()} className="bg-purple-500 text-white p-2 rounded-lg hover:bg-purple-600 disabled:opacity-50">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Damage Leaderboard */}
        <div className="h-48 bg-card border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <div className="bg-muted p-3 border-b border-border font-bold text-sm">Damage Output</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
            {Object.values(raidState.players || {})
              .sort((a, b) => b.damage - a.damage)
              .map((p, i) => (
                <div key={i} className="flex justify-between items-center bg-background border border-border px-3 py-2 rounded-lg">
                  <span className="font-medium truncate max-w-[120px]">{i+1}. {p.name}</span>
                  <span className="font-bold text-red-500">{p.damage} DMG</span>
                </div>
              ))}
          </div>
        </div>
      </div>

    </div>
  );
}
