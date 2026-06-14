import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Swords, Brain, ArrowRight, Play } from 'lucide-react';

const SUBJECTS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "History",
  "Geography",
  "Computer Science",
  "General Knowledge"
];

export default function DivyamSetup() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [mode, setMode] = useState('standard');

  const handleStart = () => {
    navigate('/divyam-play', { state: { subject, mode, classGrade: userProfile?.classGrade || 10 } });
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 md:px-0">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-purple-500/20">
          <Brain className="w-8 h-8 text-purple-500" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">Divyam Mode</h1>
        <p className="text-muted-foreground text-base sm:text-lg">Enter the endless sandbox. Test your limits.</p>
      </div>

      <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-5 sm:p-6 mb-8 relative overflow-hidden">
        <div className="flex items-start gap-4 relative z-10">
          <ShieldAlert className="w-8 h-8 text-red-500 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-base sm:text-lg font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Anti-Cheat Active</h3>
            <p className="text-sm sm:text-base text-red-900/80 dark:text-red-200/80 font-medium">
              If you switch tabs or leave the browser window while in Divyam Mode, 
              <strong className="text-red-600 dark:text-red-400"> ALL XP gained in the current session will be instantly destroyed. </strong>
              You must click "Cash Out & Exit" to safely bank your XP!
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 sm:p-8 shadow-sm space-y-8 animate-in fade-in duration-500">
        
        {/* Subject Selection */}
        <div className="space-y-4">
          <label className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider">Choose Subject</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SUBJECTS.map(sub => (
              <button
                key={sub}
                onClick={() => setSubject(sub)}
                className={`p-3 rounded-xl border-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  subject === sub 
                    ? 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-400 scale-105' 
                    : 'border-border hover:border-purple-500/30 text-muted-foreground bg-background hover:scale-105'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>

        <hr className="border-border" />

        {/* Mode Selection */}
        <div className="space-y-4">
          <label className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider">Choose Difficulty</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <button
              onClick={() => setMode('standard')}
              className={`p-5 sm:p-6 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                mode === 'standard'
                  ? 'border-blue-500 bg-blue-500/5 ring-4 ring-blue-500/10'
                  : 'border-border hover:border-blue-500/30 bg-background'
              }`}
            >
              <h3 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2">
                Standard Mode
              </h3>
              <ul className="text-xs sm:text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>Endless questions</li>
                <li>No time limits</li>
                <li>Standard XP payout</li>
                <li>Chill practice environment</li>
              </ul>
            </button>

            <button
              onClick={() => setMode('hard')}
              className={`p-5 sm:p-6 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                mode === 'hard'
                  ? 'border-red-500 bg-red-500/5 ring-4 ring-red-500/10'
                  : 'border-border hover:border-red-500/30 bg-background'
              }`}
            >
              <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-red-500">
                <Swords className="w-5 h-5" /> Hard Mode
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                <li><strong className="text-red-500">10-second</strong> timer per question</li>
                <li><strong className="text-red-500">Negative XP</strong> for wrong/missed answers</li>
                <li><strong>2x Base XP</strong> payout</li>
                <li>Chance for massive Multiplier Drops</li>
              </ul>
            </button>

          </div>
        </div>

        <div className="pt-4">
          <button
            onClick={handleStart}
            className="w-full bg-foreground text-background py-4 rounded-xl font-black text-lg hover:bg-foreground/90 transition-all flex items-center justify-center gap-3"
          >
            <Play className="w-6 h-6 fill-current" />
            START DIVYAM MODE
          </button>
        </div>

      </div>
    </div>
  );
}
