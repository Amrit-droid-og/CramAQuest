import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { generateDivyamBatch } from '../lib/gemini';
import { ShieldAlert, Brain, CheckCircle2, XCircle, ArrowRight, Flame, Timer, Sparkles, AlertTriangle, ArrowLeft } from 'lucide-react';

export default function DivyamPlay() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  
  const setupData = location.state;
  if (!setupData || !setupData.subject) {
    return <Navigate to="/divyam-setup" replace />;
  }

  const { subject, mode, classGrade } = setupData;
  const isHard = mode === 'hard';

  // Gameplay State
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionXP, setSessionXP] = useState(0);
  const [isGenerating, setIsGenerating] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const isFetchingMoreRef = useRef(false);
  const batchCountRef = useRef(0);
  
  // Current Question State
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(isHard ? 10 : null);
  const timerRef = useRef(null);

  // Anti-Cheat State
  const [cheatTriggered, setCheatTriggered] = useState(false);

  // Hard Mode Multipliers
  const [activeMultiplier, setActiveMultiplier] = useState(1);
  const [multiplierQuestionsLeft, setMultiplierQuestionsLeft] = useState(0);
  const [error, setError] = useState(null);

  const currentQuestion = queue[currentIndex];

  // Fetch initial batch
  useEffect(() => {
    let active = true;
    async function initQuestions() {
      try {
        setIsGenerating(true);
        setError(null);
        const questions = await generateDivyamBatch(classGrade, subject, mode, 5);
        if (active) {
          setQueue(questions);
          setIsGenerating(false);
        }
      } catch (err) {
        console.error("Failed to load questions", err);
        if (active) {
          setError(err.message || "Server overload/error. Please cash out and visit tomorrow!");
          setIsGenerating(false);
        }
      }
    }
    initQuestions();
    return () => {
      active = false;
    };
  }, [classGrade, subject, mode]);

  // Anti-Cheat: Visibility Listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !cheatTriggered && !isGenerating && queue.length > 0) {
        setCheatTriggered(true);
        setSessionXP(0);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cheatTriggered, isGenerating, queue]);

  // Timer loop for Hard Mode
  useEffect(() => {
    if (!isHard || isGenerating || isAnswered || cheatTriggered || queue.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setTimeLeft(10);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHard, currentIndex, isAnswered, isGenerating, cheatTriggered, queue]);

  // Prefetch when near end
  useEffect(() => {
    if (queue.length === 0 || isFetchingMoreRef.current) return;
    if (currentIndex >= queue.length - 2) {
      prefetchNextBatch();
    }
  }, [currentIndex, queue]);

  const prefetchNextBatch = async () => {
    isFetchingMoreRef.current = true;
    setIsFetchingMore(true);
    try {
      const nextBatchIndex = batchCountRef.current + 1;
      const questions = await generateDivyamBatch(classGrade, subject, mode, 5, nextBatchIndex);
      batchCountRef.current = nextBatchIndex;
      setQueue(prev => [...prev, ...questions]);
    } catch (err) {
      console.error("Error prefetching questions", err);
      setError(err.message || "Server overload/error. Please cash out and visit tomorrow!");
    } finally {
      isFetchingMoreRef.current = false;
      setIsFetchingMore(false);
    }
  };

  const handleTimeOut = () => {
    setSelectedOption('timeout');
    setIsAnswered(true);
    
    // Penalize in Hard Mode
    if (isHard) {
      setSessionXP(prev => Math.max(0, prev - 10));
      // Reset multiplier progress on miss/incorrect
      setActiveMultiplier(1);
      setMultiplierQuestionsLeft(0);
    }
  };

  const handleSelectOption = (optionId) => {
    if (isAnswered) return;
    setSelectedOption(optionId);
  };

  const handleSubmit = () => {
    if (isAnswered || !selectedOption) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsAnswered(true);

    const isCorrect = selectedOption === currentQuestion.correctOptionId;
    const baseXP = currentQuestion.xpValue || (isHard ? 20 : 10);

    if (isCorrect) {
      let earnedXP = baseXP;
      if (isHard) {
        earnedXP = baseXP * activeMultiplier;
      }
      setSessionXP(prev => prev + earnedXP);

      // Hard Mode Multiplier Mechanics
      if (isHard) {
        if (multiplierQuestionsLeft > 0) {
          const nextQuestionsLeft = multiplierQuestionsLeft - 1;
          setMultiplierQuestionsLeft(nextQuestionsLeft);
          if (nextQuestionsLeft === 0) {
            setActiveMultiplier(1);
          }
        }

        // Random chance of dropping a multiplier (2x or 3x) for next 3 questions
        const dropChance = Math.random();
        if (dropChance < 0.25 && activeMultiplier === 1) {
          const dropMult = Math.random() < 0.8 ? 2 : 3;
          setActiveMultiplier(dropMult);
          setMultiplierQuestionsLeft(3);
        }
      }
    } else {
      // Incorrect
      if (isHard) {
        setSessionXP(prev => Math.max(0, prev - 10));
        // Reset multipliers
        setActiveMultiplier(1);
        setMultiplierQuestionsLeft(0);
      }
    }
  };

  const handleNext = () => {
    setSelectedOption(null);
    setIsAnswered(false);
    setCurrentIndex(prev => prev + 1);
  };

  const handleCashOut = async () => {
    if (!currentUser) return;
    
    if (sessionXP > 0) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          totalXP: increment(sessionXP)
        });
      } catch (err) {
        console.error("Error saving XP to firestore", err);
      }
    }
    navigate('/dashboard');
  };

  const handleExitCheat = () => {
    navigate('/dashboard');
  };

  if (cheatTriggered) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
        <div className="max-w-md w-full bg-red-50 border-2 border-red-200 rounded-3xl p-8 shadow-lg">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6 animate-bounce" />
          <h2 className="text-2xl font-black text-red-700 uppercase tracking-tight mb-3">Anti-Cheat Triggered</h2>
          <p className="text-red-900/80 font-medium mb-8 leading-relaxed">
            You switched tabs, minimized your browser window, or navigated away. 
            All session XP has been reset to <strong>0</strong> to keep the game fair.
          </p>
          <button
            onClick={handleExitCheat}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-md active:scale-95"
          >
            Exit to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between py-6 px-4 sm:px-6">
      {/* Header */}
      <div className="max-w-3xl w-full mx-auto flex items-center justify-between gap-4 mb-6 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-purple-600" />
          <div>
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight leading-tight">{subject} Sandbox</h2>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${isHard ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
              {mode} mode
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-xs font-bold text-slate-400 block uppercase">Session XP</span>
            <span className="text-lg font-black text-emerald-600">+{sessionXP} XP</span>
          </div>
          <button
            onClick={handleCashOut}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
          >
            Cash Out
          </button>
        </div>
      </div>

      {/* Main Game Screen */}
      <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col justify-center">
        {isGenerating ? (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
            <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Sparkles className="w-8 h-8 text-purple-600 animate-spin" style={{ animationDuration: '3s' }} />
            </div>
            <h3 className="text-xl font-bold mb-2">Generating Endless Sandbox...</h3>
            <p className="text-slate-500 text-sm">Please wait while the AI prepares your CBSE study quests.</p>
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600 animate-bounce" />
            </div>
            <h3 className="text-xl font-bold mb-2">Server Overload / Error</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">{error}</p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              {sessionXP > 0 && (
                <button
                  onClick={handleCashOut}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-8 rounded-xl cursor-pointer transition-all active:scale-95 shadow-sm"
                >
                  Cash Out (+{sessionXP} XP)
                </button>
              )}
              <button
                onClick={() => navigate('/divyam-setup')}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-8 rounded-xl cursor-pointer transition-all active:scale-95 shadow-sm"
              >
                Go Back
              </button>
            </div>
          </div>
        ) : queue.length === 0 ? (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
            <h3 className="text-xl font-bold mb-2">No Questions Found</h3>
            <p className="text-slate-500 text-sm mb-6">We couldn't generate questions for this subject. Please check your network connection or try another subject.</p>
            <button
              onClick={() => navigate('/divyam-setup')}
              className="bg-slate-800 text-white font-bold py-3 px-6 rounded-xl"
            >
              Go Back
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col relative overflow-hidden transition-all duration-300">
            {/* Anti-cheat banner */}
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-xs font-bold text-amber-700 flex items-center justify-center gap-2 -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-6 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
              Anti-Cheat Active: Switching tabs resets current XP!
            </div>

            {/* Time progress bar */}
            {isHard && !isAnswered && (
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-6">
                <div 
                  className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                    timeLeft > 4 ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${(timeLeft / 10) * 100}%` }}
                />
              </div>
            )}

            {/* Question Info */}
            <div className="flex justify-between items-center mb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Question #{currentIndex + 1}</span>
              {isHard && activeMultiplier > 1 && (
                <span className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-1 rounded-md">
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  {activeMultiplier}x Mult ({multiplierQuestionsLeft} Left)
                </span>
              )}
            </div>

            {/* Question Text */}
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug mb-8">
              {currentQuestion.questionText}
            </h3>

            {/* Option Buttons */}
            <div className="space-y-3 mb-8">
              {currentQuestion.options.map((option) => {
                const isSelected = selectedOption === option.id;
                const isCorrect = option.id === currentQuestion.correctOptionId;
                
                let optionClasses = "w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between text-sm sm:text-base cursor-pointer ";
                
                if (!isAnswered) {
                  optionClasses += isSelected 
                    ? "border-purple-600 bg-purple-50 text-purple-900 font-semibold" 
                    : "border-slate-200 hover:border-purple-300 hover:bg-slate-50 bg-white text-slate-700";
                } else {
                  if (isCorrect) {
                    optionClasses += "border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold";
                  } else if (isSelected && !isCorrect) {
                    optionClasses += "border-red-500 bg-red-50 text-red-950 font-semibold";
                  } else {
                    optionClasses += "border-slate-100 bg-slate-50/55 text-slate-400 opacity-60";
                  }
                }

                return (
                  <button
                    key={option.id}
                    onClick={() => handleSelectOption(option.id)}
                    disabled={isAnswered}
                    className={optionClasses}
                  >
                    <span className="font-medium pr-4">{option.text}</span>
                    {isAnswered && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
                    {isAnswered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Bottom Actions Section */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pt-4 border-t border-slate-100">
              <div className="flex-1">
                {isAnswered && (
                  <div className={`p-4 rounded-xl border ${
                    selectedOption === currentQuestion.correctOptionId 
                      ? 'bg-emerald-50/50 border-emerald-100 text-emerald-900' 
                      : 'bg-red-50/50 border-red-100 text-red-900'
                  } animate-in fade-in duration-300`}>
                    <p className="font-bold mb-1">
                      {selectedOption === currentQuestion.correctOptionId 
                        ? 'Correct!' 
                        : selectedOption === 'timeout' 
                        ? 'Time is up!' 
                        : 'Incorrect!'}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{currentQuestion.learningContext}</p>
                  </div>
                )}
              </div>

              <div className="w-full sm:w-auto flex-shrink-0 flex items-center justify-end">
                {!isAnswered ? (
                  <button
                    onClick={handleSubmit}
                    disabled={!selectedOption}
                    className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-8 py-3.5 rounded-xl font-bold transition-all disabled:opacity-50 text-base shadow-sm active:scale-95 cursor-pointer"
                  >
                    Submit Answer
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-base shadow-sm active:scale-95 cursor-pointer animate-in slide-in-from-right-4 duration-300"
                  >
                    Next Question
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="max-w-3xl w-full mx-auto text-center mt-6 text-xs text-slate-400 font-medium">
        Endless Sandbox dynamically generated by Google Gemini. Cash out anytime to save your score.
      </div>
    </div>
  );
}
