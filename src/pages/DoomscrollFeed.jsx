import React, { useState, useEffect, useRef } from 'react';
import { generateDoomscrollBatch } from '../lib/gemini';
import { useAuth } from '../contexts/AuthContext';
import { useParticleEffects } from '../lib/useParticleEffects';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CheckCircle2, XCircle, Zap, Loader2, ArrowLeft, Heart, MessageCircle, Bookmark, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DoomscrollFeed() {
  const [questions, setQuestions] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState(null);
  const [answeredMap, setAnsweredMap] = useState({}); // { questionId: { selectedOptionId, isCorrect, isCrit } }
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef(null);
  const { currentUser } = useAuth();
  const { spawnFloatingText, triggerScreenShake, spawnSparks } = useParticleEffects();
  const navigate = useNavigate();

  const [lives, setLives] = useState(3);
  const [showSlotMachine, setShowSlotMachine] = useState(null); // { xp: number, isCrit: boolean }

  const topics = ["General Science", "History", "Logic", "Math Puzzles", "Space"];

  const loadMoreQuestions = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setFeedError(null);
    try {
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];
      const newQuestions = await generateDoomscrollBatch('10', randomTopic, 3);
      setQuestions(prev => [...prev, ...newQuestions]);
    } catch (error) {
      console.error("Failed to load doomscroll questions", error);
      setFeedError(error.message || "Server overload/error. Please cash out and visit tomorrow!");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadMoreQuestions();
  }, []);

  const handleScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.target;
    
    const index = Math.round(scrollTop / clientHeight);
    if (index !== activeIdx && !isNaN(index)) {
      setActiveIdx(index);
    }

    if (scrollHeight - scrollTop <= clientHeight * 2.5 && !loadingMore) {
      loadMoreQuestions();
    }
  };

  const handleAnswer = async (e, question, optionId) => {
    if (answeredMap[question.id] || lives <= 0) return;

    const isCorrect = optionId === question.correctOptionId;
    const isCrit = isCorrect && Math.random() < 0.2;
    const xpGained = isCorrect ? (isCrit ? 50 : 10) : 0;

    setAnsweredMap(prev => ({
      ...prev,
      [question.id]: { selectedOptionId: optionId, isCorrect, isCrit }
    }));

    if (isCorrect) {
      const rect = e.currentTarget.getBoundingClientRect();
      spawnSparks(rect.left + rect.width / 2, rect.top);
      
      // Slot machine effect
      setShowSlotMachine({ xp: xpGained, isCrit });
      setTimeout(() => setShowSlotMachine(null), 1500);

      if (currentUser && xpGained > 0) {
        const userRef = doc(db, 'users', currentUser.uid);
        updateDoc(userRef, {
          totalXP: increment(xpGained)
        }).catch(console.error);
      }
      
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollBy({ top: containerRef.current.clientHeight, behavior: 'smooth' });
        }
      }, 1500);
    } else {
       triggerScreenShake();
       setLives(prev => Math.max(0, prev - 1));
    }
  };

  if (lives <= 0) {
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center p-6 text-white text-center">
        <Heart className="w-24 h-24 text-gray-800 mb-6 animate-heart-shatter" />
        <h1 className="text-4xl font-black mb-4">Out of Energy!</h1>
        <p className="text-gray-400 mb-8">You lost all your lives. Take a break to regenerate them or review past mistakes.</p>
        <button 
          onClick={() => navigate('/dashboard')}
          className="bg-primary text-white font-bold py-4 px-8 rounded-full shadow-lg active:scale-95 transition-transform cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden select-none">
      {/* Top HUD */}
      <div className="absolute top-0 left-0 w-full p-4 z-50 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-1">
          {[...Array(3)].map((_, i) => (
            <Heart 
              key={i} 
              className={`w-5 h-5 ${i < lives ? 'text-red-500 fill-red-500 animate-heartbeat' : 'text-gray-700 fill-gray-800'}`} 
            />
          ))}
        </div>
        <div className="flex items-center gap-1 text-white font-black tracking-widest drop-shadow-lg">
          FOR YOU
        </div>
        <button onClick={() => navigate('/dashboard')} className="text-white hover:text-gray-300 transition-colors drop-shadow-md cursor-pointer">
          <ArrowLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Slot Machine XP Overlay */}
      {showSlotMachine && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-[0_0_20px_rgba(234,179,8,0.8)] animate-slot-spin">
            +{showSlotMachine.xp} XP
          </div>
          {showSlotMachine.isCrit && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-8xl opacity-20">💥</div>
          )}
        </div>
      )}

      {/* Snap Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory hide-scrollbar"
        style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
      >
        {questions.length === 0 && feedError && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black p-6 text-center text-white">
            <XCircle className="w-16 h-16 text-red-500 mb-6 animate-pulse" />
            <h3 className="text-xl font-bold mb-2">Server Overload / Error</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed max-w-xs">{feedError}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-white hover:bg-gray-100 text-black font-bold py-3 px-6 rounded-xl transition-all active:scale-95 shadow-md cursor-pointer"
            >
              Go Back
            </button>
          </div>
        )}

        {questions.map((q, idx) => {
          const ansState = answeredMap[q.id];
          const isActive = idx === activeIdx;
          const isPast = idx < activeIdx;
          
          let cardStyle = {
            transition: 'transform 0.9s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.8s ease, filter 0.8s ease',
            transformStyle: 'preserve-3d',
            backfaceVisibility: 'hidden',
            willChange: 'transform, opacity',
          };
          
          if (isActive) {
            cardStyle.transform = 'rotateX(0deg) scale(1) translateY(0)';
            cardStyle.opacity = 1;
            cardStyle.filter = 'none';
          } else if (isPast) {
            cardStyle.transform = 'rotateX(-60deg) scale(0.85) translateY(-120px)';
            cardStyle.opacity = 0;
            cardStyle.filter = 'blur(4px)';
          } else {
            cardStyle.transform = 'rotateX(60deg) scale(0.85) translateY(120px)';
            cardStyle.opacity = 0;
            cardStyle.filter = 'blur(4px)';
          }
          
          return (
            <div key={`${q.id}-${idx}`} className="w-full min-h-full snap-start flex items-center justify-center relative bg-gradient-to-b from-slate-900 to-black flex-shrink-0 overflow-hidden">
              
              {/* Subtle background flair based on answer state */}
              <div className={`absolute inset-0 opacity-20 pointer-events-none transition-colors duration-500 ${
                ansState?.isCorrect ? 'bg-green-500' : ansState?.isCorrect === false ? 'bg-red-500' : 'bg-transparent'
              }`} />

              <div 
                style={cardStyle}
                className="w-full max-w-md py-24 flex flex-col justify-center px-6 relative z-10"
              >
                <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-10 text-white leading-tight drop-shadow-xl text-center">
                  {q.questionText}
                </h2>
                
                <div className="space-y-3 sm:space-y-4">
                  {q.options.map(opt => {
                    const isSelected = ansState?.selectedOptionId === opt.id;
                    const isCorrectOpt = opt.id === q.correctOptionId;
                    
                    let btnClass = "w-full text-left p-4 sm:p-5 rounded-2xl border-2 transition-all font-bold flex items-center justify-between text-white backdrop-blur-md active:scale-95 shadow-lg ";
                    
                    if (!ansState) {
                      btnClass += "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20";
                    } else {
                      if (isCorrectOpt) {
                        btnClass += "border-green-400 bg-green-500/30 text-green-100";
                      } else if (isSelected && !isCorrectOpt) {
                        btnClass += "border-red-500 bg-red-600/40 text-red-100";
                      } else {
                        btnClass += "border-transparent bg-black/40 opacity-40";
                      }
                    }

                    return (
                      <button
                        key={opt.id}
                        onClick={(e) => handleAnswer(e, q, opt.id)}
                        disabled={!!ansState}
                        className={btnClass}
                      >
                        <span className="text-sm sm:text-base">{opt.text}</span>
                        {ansState && isCorrectOpt && <CheckCircle2 className="w-6 h-6 text-green-400 drop-shadow-md" />}
                        {ansState && isSelected && !isCorrectOpt && <XCircle className="w-6 h-6 text-red-400 drop-shadow-md" />}
                      </button>
                    );
                  })}
                </div>

                {ansState && (
                  <div className="mt-6 p-4 bg-black/60 backdrop-blur-lg border border-white/10 rounded-2xl text-white animate-in slide-in-from-bottom-4 duration-300 text-xs sm:text-sm">
                    <p className={`font-black mb-1 ${ansState.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                      {ansState.isCorrect ? "Spot on!" : "Incorrect."}
                    </p>
                    <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">{q.learningContext}</p>
                  </div>
                )}
              </div>

              {/* Floating Action Bar (Right Side) */}
              <div className="absolute right-4 bottom-32 flex flex-col items-center gap-6 z-20">
                <button className="flex flex-col items-center gap-1 group active:scale-95 transition-transform" title="Bookmark Question">
                  <div className="p-3 bg-black/40 rounded-full border border-white/10 backdrop-blur-sm group-hover:bg-yellow-500/20 transition-colors">
                    <Bookmark className="w-7 h-7 text-white" />
                  </div>
                </button>

                <button className="flex flex-col items-center gap-1 group active:scale-95 transition-transform" title="Share Question">
                  <div className="p-3 bg-black/40 rounded-full border border-white/10 backdrop-blur-sm group-hover:bg-white/20 transition-colors">
                    <Share2 className="w-7 h-7 text-white" />
                  </div>
                </button>
              </div>

            </div>
          );
        })}
        
        {questions.length > 0 && feedError && (
          <div className="w-full h-[100vh] snap-start flex flex-col items-center justify-center bg-black p-6 text-center text-white">
            <XCircle className="w-16 h-16 text-red-500 mb-6 animate-pulse" />
            <h3 className="text-xl font-bold mb-2">Failed to Load More</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed max-w-xs">{feedError}</p>
            <button
              onClick={loadMoreQuestions}
              className="bg-white hover:bg-gray-100 text-black font-bold py-3 px-6 rounded-xl transition-all active:scale-95 shadow-md cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}
        
        {loadingMore && (
          <div className="w-full h-[100vh] snap-start flex flex-col items-center justify-center bg-black">
            <Loader2 className="w-12 h-12 animate-spin text-white opacity-80 mb-4" />
            <p className="text-gray-400 font-bold tracking-widest animate-pulse">LOADING ALGORITHM...</p>
          </div>
        )}
      </div>
    </div>
  );
}
