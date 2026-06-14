import React, { useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Trophy, ArrowRight, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function PlayQuest() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const gameData = location.state?.gameData;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [scoreXP, setScoreXP] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [droppedPowerup, setDroppedPowerup] = useState(null);

  const isDailyQuest = location.state?.isDailyQuest || false;

  if (!gameData || !gameData.questions) {
    return <Navigate to="/dashboard" replace />;
  }

  const currentQuestion = gameData.questions[currentQuestionIndex];
  
  const activeMultiplier = userProfile?.activeMultiplier || 1.0;
  const expiry = userProfile?.multiplierExpiry ? new Date(userProfile.multiplierExpiry).getTime() : 0;
  const isMultiplierActive = activeMultiplier > 1 && expiry > Date.now();
  const currentMultiplier = isMultiplierActive ? activeMultiplier : 1.0;

  let finalXP = Math.round(scoreXP * currentMultiplier);
  if (isDailyQuest) {
    finalXP += 50; // Daily Quest Bonus
  }

  const handleSelectOption = (optionId) => {
    if (isAnswered) return;
    setSelectedOption(optionId);
  };

  const handleSubmit = () => {
    if (!selectedOption) return;
    
    setIsAnswered(true);
    if (selectedOption === currentQuestion.correctOptionId) {
      setScoreXP((prev) => prev + (currentQuestion.xpValue || 20));
    }
  };

  const handleNext = async () => {
    if (currentQuestionIndex < gameData.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      // Finish game
      setIsFinished(true);
      if (currentUser && scoreXP > 0) {
        
        let newMultiplier = userProfile?.activeMultiplier || 1.0;
        let newExpiry = userProfile?.multiplierExpiry || null;
        let powerupMsg = null;
        
        // Random Powerup Drop Logic
        const dropChance = Math.random();
        if (dropChance > (isDailyQuest ? 0.3 : 0.6)) {
           const typeRoll = Math.random();
           if (typeRoll > 0.8) {
              newMultiplier = 3.0;
              newExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
              powerupMsg = "Epic 3x Powerup (15m)!";
           } else if (typeRoll > 0.5) {
              newMultiplier = 2.0;
              newExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
              powerupMsg = "Rare 2x Powerup (5m)!";
           } else {
              newMultiplier = 2.0;
              newExpiry = new Date(Date.now() + 1 * 60 * 1000).toISOString();
              powerupMsg = "Standard 2x Powerup (1m)!";
           }
           setDroppedPowerup(powerupMsg);
        }

        const userRef = doc(db, 'users', currentUser.uid);
        const todayStr = new Date().toLocaleDateString('sv');
        const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString('sv');
        const nowStr = new Date().toISOString();
        
        let newStreak = userProfile.streakDays || 0;
        const lastQuestDate = userProfile.lastQuestDate;
        
        if (!lastQuestDate) {
          // First quest ever
          newStreak = 1;
        } else if (lastQuestDate === yesterdayStr) {
          // Continued streak
          newStreak += 1;
        } else if (lastQuestDate === todayStr) {
          // Already played today, keep current streak
        } else {
          // Streak was broken (played more than 1 day ago), reset to 1
          newStreak = 1;
        }

        await updateDoc(userRef, {
          totalXP: increment(finalXP),
          streakDays: newStreak,
          activeMultiplier: newMultiplier,
          multiplierExpiry: newExpiry,
          lastQuestDate: todayStr,
          lastQuestTimestamp: nowStr
        });
      }
    }
  };

  if (isFinished) {
    return (
      <div className="max-w-2xl mx-auto text-center mt-6 sm:mt-12 bg-card p-6 sm:p-10 rounded-2xl border border-border shadow-sm">
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center">
            <Trophy className="w-12 h-12 text-orange-500 animate-bounce" />
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4">Quest Complete!</h1>
        <div className="space-y-2 mb-8 bg-muted/50 p-4 rounded-xl max-w-sm mx-auto border border-border">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Base Quest XP:</span>
            <span>{scoreXP} XP</span>
          </div>
          {isMultiplierActive && (
            <div className="flex justify-between text-sm text-blue-500 font-semibold">
              <span>Powerup Boost:</span>
              <span>{currentMultiplier}x ⚡</span>
            </div>
          )}
          {isDailyQuest && (
            <div className="flex justify-between text-sm text-purple-500 font-semibold">
              <span>Daily Challenge Bonus:</span>
              <span>+50 XP 🎯</span>
            </div>
          )}
          <hr className="border-border my-1" />
          <div className="flex justify-between font-bold text-lg text-primary">
            <span>Total Earned:</span>
            <span className="text-orange-500">{finalXP} XP</span>
          </div>
        </div>

        {droppedPowerup && (
          <div className="mb-8 p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl max-w-sm mx-auto animate-in zoom-in slide-in-from-bottom-4 duration-500">
            <p className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-1">Powerup Dropped!</p>
            <p className="text-lg font-black text-foreground">{droppedPowerup}</p>
          </div>
        )}
        <button 
          onClick={() => navigate('/dashboard')}
          className="bg-primary text-primary-foreground px-8 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-1 md:px-0">
      <header className="mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Quest</h2>
          <h1 className="text-2xl font-bold tracking-tight">{gameData.questTitle}</h1>
        </div>
        <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 flex-shrink-0">
          <Trophy className="w-4 h-4" /> {scoreXP} XP
        </div>
      </header>

      {gameData.isFallback && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-sm rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Failsafe Mode Active:</span> All live Gemini AI models failed (likely due to an invalid API Key, quota limits, or network issues). A mock quiz has been loaded to keep your session running. Please check your API key configuration.
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-5 sm:p-8 shadow-sm animate-in fade-in duration-500">
        <div className="mb-6 flex justify-between items-center text-xs sm:text-sm text-muted-foreground font-medium">
          <span>Question {currentQuestionIndex + 1} of {gameData.questions.length}</span>
          <span>+{currentQuestion.xpValue || 20} XP Potential</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 leading-tight">
          {currentQuestion.questionText}
        </h3>

        <div className="space-y-3 sm:space-y-4 mb-8">
          {currentQuestion.options.map((option) => {
            const isSelected = selectedOption === option.id;
            const isCorrect = option.id === currentQuestion.correctOptionId;
            
            let optionClasses = "w-full text-left p-3.5 sm:p-4 rounded-xl border-2 transition-all flex items-center justify-between text-sm sm:text-base cursor-pointer ";
            
            if (!isAnswered) {
              optionClasses += isSelected 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/40 bg-background";
            } else {
              if (isCorrect) {
                optionClasses += "border-green-500 bg-green-50 text-green-900";
              } else if (isSelected && !isCorrect) {
                optionClasses += "border-red-500 bg-red-50 text-red-900";
              } else {
                optionClasses += "border-border/50 bg-background/50 opacity-50";
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
                {isAnswered && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />}
                {isAnswered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className={`p-4 rounded-xl mb-8 border ${
            selectedOption === currentQuestion.correctOptionId 
              ? 'bg-green-50 border-green-200 text-green-900' 
              : 'bg-red-50 border-red-200 text-red-900'
          }`}>
            <p className="font-semibold mb-1">
              {selectedOption === currentQuestion.correctOptionId ? 'Excellent!' : 'Not quite right.'}
            </p>
            <p className="text-sm">{currentQuestion.learningContext}</p>
          </div>
        )}

        <div className="flex justify-end">
          {!isAnswered ? (
            <button
              onClick={handleSubmit}
              disabled={!selectedOption}
              className="bg-primary text-primary-foreground px-8 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Check Answer
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="bg-primary text-primary-foreground px-8 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              {currentQuestionIndex < gameData.questions.length - 1 ? 'Next Question' : 'Finish Quest'}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
