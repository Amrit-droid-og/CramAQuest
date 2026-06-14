import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, Medal, Crown, Flame, Loader2, X } from 'lucide-react';

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoomedImage, setZoomedImage] = useState(null);
  const { currentUser } = useAuth();

  const getAvatarSrc = (url) => {
    if (url && (url.startsWith('http') || url.startsWith('data:image'))) {
      return url;
    }
    return 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp';
  };

  useEffect(() => {
    async function fetchLeaders() {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('totalXP', 'desc'), limit(50));
        const querySnapshot = await getDocs(q);
        
        const fetchedLeaders = [];
        querySnapshot.forEach((doc) => {
          fetchedLeaders.push({ id: doc.id, ...doc.data() });
        });
        
        setLeaders(fetchedLeaders);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchLeaders();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <header className="mb-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-primary/10 mb-4 shadow-sm border border-primary/20">
          <Trophy className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-3">Hall of Fame</h1>
        <p className="text-muted-foreground text-lg max-w-lg mx-auto">
          The top 50 scholars ascending the ranks. Compete to claim the crown!
        </p>
      </header>

      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
        <div className="divide-y divide-border">
          {leaders.map((user, index) => {
            const isCurrentUser = currentUser && currentUser.uid === user.id;
            let RankIcon = null;
            let rankColor = "text-muted-foreground";
            let bgHighlight = isCurrentUser ? 'bg-primary/5' : 'hover:bg-muted/50';
            
            if (index === 0) {
              RankIcon = Crown;
              rankColor = "text-yellow-500 drop-shadow-sm";
              bgHighlight = isCurrentUser ? 'bg-yellow-500/10' : 'bg-yellow-500/5 hover:bg-yellow-500/10';
            } else if (index === 1) {
              RankIcon = Medal;
              rankColor = "text-gray-400 drop-shadow-sm";
            } else if (index === 2) {
              RankIcon = Medal;
              rankColor = "text-amber-600 drop-shadow-sm";
            }

            return (
              <div 
                key={user.id} 
                className={`flex items-center p-3 sm:p-5 transition-all duration-200 ${bgHighlight} ${isCurrentUser ? 'border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
              >
                <div className={`w-10 sm:w-16 text-center font-black text-xl sm:text-2xl tracking-tighter ${rankColor}`}>
                  {RankIcon ? <RankIcon className="w-6 h-6 sm:w-8 sm:h-8 mx-auto" /> : `#${index + 1}`}
                </div>
                
                <div className="relative mx-2 sm:mx-5">
                  <div 
                    onClick={() => setZoomedImage(user)}
                    className="w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl overflow-hidden border-2 border-border/50 bg-background flex items-center justify-center text-xl sm:text-3xl shadow-sm cursor-zoom-in hover:scale-105 hover:border-primary/40 transition-all duration-300"
                    title={`View ${user.displayName}'s Profile`}
                  >
                    {user.photoURL && (user.photoURL.startsWith('http') || user.photoURL.startsWith('data:image')) ? (
                       <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                    ) : (
                       <img src="https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp" alt="Fallback Avatar" className="w-full h-full object-cover" />
                    )}
                  </div>
                  {index < 3 && (
                     <div className={`absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center border-2 border-background text-[9px] sm:text-[10px] font-bold text-white shadow-sm ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-amber-600'
                     }`}>
                       {index + 1}
                     </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 py-0.5 sm:py-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className={`font-bold text-base sm:text-xl truncate ${isCurrentUser ? 'text-primary' : 'text-foreground'}`}>
                      {user.displayName}
                    </h3>
                    {isCurrentUser && (
                      <span className="bg-primary/10 border border-primary/20 text-primary text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                        You
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono bg-muted px-1.5 py-0.5 rounded-md">
                      <span className="font-bold text-foreground">{user.totalXP || 0}</span> XP
                    </span>
                    <span className="flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                      <span className="font-bold text-foreground">{user.streakDays || 0}</span> <span className="hidden sm:inline">day streak</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {leaders.length === 0 && (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
              <Trophy className="w-12 h-12 text-muted/50" />
              <p>No scholars found yet. Be the first to earn XP!</p>
            </div>
          )}
        </div>
      </div>

      {/* Profile Detail Zoom Overlay */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
        >
          <div 
            className="relative max-w-sm w-full bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl flex flex-col items-center animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Picture */}
            <div className="w-40 h-40 rounded-2xl overflow-hidden border-4 border-slate-100 shadow-md mb-6 bg-slate-50">
              <img 
                src={getAvatarSrc(zoomedImage.photoURL)} 
                alt={zoomedImage.displayName} 
                className="w-full h-full object-cover" 
              />
            </div>

            {/* Details */}
            <h3 className="text-xl font-extrabold text-slate-900 leading-tight">
              {zoomedImage.displayName}
            </h3>
            <p className="text-xs font-bold text-primary uppercase tracking-wider bg-primary/10 px-2.5 py-0.5 rounded-full mt-2">
              Level {Math.floor((zoomedImage.totalXP || 0) / 100) + 1} Scholar
            </p>

            <div className="w-full border-t border-slate-100 mt-6 pt-5 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Total XP</p>
                <p className="text-xl font-black text-slate-800 mt-0.5 font-mono">{(zoomedImage.totalXP || 0).toLocaleString()} XP</p>
              </div>
              <div className="border-l border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Daily Streak</p>
                <p className="text-xl font-black text-slate-800 mt-0.5 flex items-center justify-center gap-1">
                  <Flame className="w-5 h-5 text-orange-500 fill-current animate-pulse" />
                  {zoomedImage.streakDays || 0}d
                </p>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 font-medium mt-6">
              Click anywhere outside to return to Leaderboard
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
