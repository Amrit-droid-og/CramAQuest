import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { collection, query, where, getCountFromServer, doc, updateDoc, increment, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useParticleEffects } from '../lib/useParticleEffects';
import { 
  Crown, Trophy, Sparkles, BookOpen, Swords, Smartphone, 
  MessageSquare, Users, Send, Heart, Bookmark, Share2, 
  Flame, Zap, User, PlusCircle, AlertCircle, PlayCircle, Loader2,
  CheckCircle2, XCircle, Upload, FileText, RotateCw
} from 'lucide-react';
import { generateDailyQuest, generateQuestFromText, generateQuestFromFile, generateRandomFlashcard } from '../lib/gemini';

const ENCOUNTERS = [
  {
    id: 'enc-1',
    questionText: "Which organelle is known as the 'powerhouse of the cell' for generating ATP? 🔋",
    options: [
      { id: 'a', text: 'Nucleus' },
      { id: 'b', text: 'Ribosome' },
      { id: 'c', text: 'Mitochondria' },
      { id: 'd', text: 'Lysosome' }
    ],
    correctOptionId: 'c',
    learningContext: "Correct! Mitochondria produce most of the cell's adenosine triphosphate (ATP), which is used as a source of chemical energy."
  },
  {
    id: 'enc-2',
    questionText: "What is the speed of light in a vacuum? ⚡",
    options: [
      { id: 'a', text: 'Approx. 300,000 km/s' },
      { id: 'b', text: 'Approx. 150,000 km/s' },
      { id: 'c', text: 'Approx. 1,000 km/s' },
      { id: 'd', text: 'Approx. 300 km/h' }
    ],
    correctOptionId: 'a',
    learningContext: "Correct! Light travels at roughly 299,792 kilometers per second in a vacuum."
  },
  {
    id: 'enc-3',
    questionText: "Which gas makes up the majority of Earth's atmosphere? 🌍",
    options: [
      { id: 'a', text: 'Oxygen' },
      { id: 'b', text: 'Carbon Dioxide' },
      { id: 'c', text: 'Nitrogen' },
      { id: 'd', text: 'Argon' }
    ],
    correctOptionId: 'c',
    learningContext: "Correct! Nitrogen makes up about 78% of Earth's atmosphere, followed by Oxygen at 21%."
  },
  {
    id: 'enc-4',
    questionText: "Which particle carries a negative electric charge in an atom? ⚛️",
    options: [
      { id: 'a', text: 'Proton' },
      { id: 'b', text: 'Neutron' },
      { id: 'c', text: 'Electron' },
      { id: 'd', text: 'Positron' }
    ],
    correctOptionId: 'c',
    learningContext: "Correct! Electrons form the outer shell of atoms and carry a negative charge (-1e)."
  }
];

export default function Dashboard() {
  const { currentUser, userProfile, setUserProfile } = useAuth();
  const navigate = useNavigate();
  const { spawnFloatingText, triggerScreenShake, spawnSparks } = useParticleEffects();
  
  const fileInputRef = useRef(null);
  const quickForgeFileRef = useRef(null);

  const getAvatarSrc = (url) => {
    if (url && (url.startsWith('http') || url.startsWith('data:image'))) {
      return url;
    }
    return 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp';
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 200 * 1024) {
      spawnFloatingText("Image must be under 200KB!", window.innerWidth / 2, window.innerHeight / 2, 'text-red-500 font-bold', false);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          photoURL: base64String
        });
        
        setUserProfile(prev => ({
          ...prev,
          photoURL: base64String
        }));
        
        spawnFloatingText("Profile Updated! ✨", window.innerWidth / 2, window.innerHeight / 2, 'text-green-500 font-bold', false);
      } catch (err) {
        console.error("Failed to update profile pic:", err);
      }
    };
    reader.readAsDataURL(file);
  };
  
  const [rank, setRank] = useState(null);
  const [activeMultiplier, setActiveMultiplier] = useState(1);
  const [multiplierTimeLeft, setMultiplierTimeLeft] = useState(null);
  
  // Custom Quest Forge states
  const [forgeTab, setForgeTab] = useState('text'); // 'text' or 'file'
  const [forgeText, setForgeText] = useState('');
  const [forgeFile, setForgeFile] = useState(null);
  const [forgeNumQuestions, setForgeNumQuestions] = useState(5);
  const [isForging, setIsForging] = useState(false);
  const [forgeError, setForgeError] = useState('');

  // Daily Challenge Generation state
  const [isGeneratingDaily, setIsGeneratingDaily] = useState(false);

  // Interactive Feed Card 1: Direct-Play Flashcard
  const [feedQuestion, setFeedQuestion] = useState(ENCOUNTERS[0]);
  const [flashcardAnswered, setFlashcardAnswered] = useState(false);
  const [flashcardSelected, setFlashcardSelected] = useState(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedErrorMsg, setFeedErrorMsg] = useState(null);

  // Dynamic Boss Raid State
  const [bossState, setBossState] = useState(null);

  // Dynamic Top 3 Podium State
  const [topThree, setTopThree] = useState([]);

  // Interactive Feed Card 3: Feynman AI teaser state
  const [feynmanInput, setFeynmanInput] = useState('');
  const [feynmanTopic, setFeynmanTopic] = useState('Wave-Particle Duality');

  // Realtime XP Updater Pop
  const [xpAnimation, setXpAnimation] = useState(null);
  const prevXpRef = useRef(userProfile?.totalXP || 0);

  useEffect(() => {
    if (userProfile && userProfile.totalXP !== undefined) {
      const currentXp = userProfile.totalXP;
      const prevXp = prevXpRef.current;
      if (currentXp > prevXp) {
        const diff = currentXp - prevXp;
        setXpAnimation({ amount: diff, key: Date.now() });
      }
      prevXpRef.current = currentXp;
    }
  }, [userProfile?.totalXP]);

  const loadNewFeedQuestion = async () => {
    if (feedLoading) return;
    setFeedLoading(true);
    setFeedErrorMsg(null);
    setFlashcardAnswered(false);
    setFlashcardSelected(null);
    try {
      const grade = userProfile?.classGrade || 10;
      const newQ = await generateRandomFlashcard(grade);
      setFeedQuestion(newQ);
    } catch (err) {
      console.error("Failed to generate flashcard:", err);
      setFeedErrorMsg(err.message || "Failed to load question.");
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile) {
      loadNewFeedQuestion();
    }
  }, [userProfile?.classGrade]);

  // Live Boss Raid subscription
  useEffect(() => {
    const bossRef = doc(db, 'raids', 'global-daily');
    const unsubscribe = onSnapshot(bossRef, (docSnap) => {
      if (docSnap.exists()) {
        setBossState(docSnap.data());
      }
    });
    return () => unsubscribe();
  }, []);

  // Live Top 3 Leaderboard Podium subscription
  useEffect(() => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('totalXP', 'desc'), limit(3));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = [];
      snapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() });
      });
      setTopThree(fetched);
    }, (error) => {
      console.error("Failed to load live podium:", error);
    });

    return () => unsubscribe();
  }, []);

  // Live Current User Rank
  useEffect(() => {
    if (!userProfile) return;
    async function fetchRank() {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('totalXP', '>', userProfile.totalXP || 0));
        const snapshot = await getCountFromServer(q);
        const greaterCount = snapshot.data().count;
        setRank(greaterCount + 1);
      } catch (error) {
        console.error("Error fetching rank:", error);
      }
    }
    fetchRank();
  }, [userProfile]);

  // Expiry Checker for local multiplier
  useEffect(() => {
    if (!userProfile) return;
    
    const checkMultiplier = () => {
      const currentMult = userProfile.activeMultiplier || 1;
      const expiry = userProfile.multiplierExpiry ? new Date(userProfile.multiplierExpiry).getTime() : 0;
      const now = Date.now();
      
      if (currentMult > 1 && expiry > now) {
        setActiveMultiplier(currentMult);
        const secsLeft = Math.floor((expiry - now) / 1000);
        const mins = Math.floor(secsLeft / 60);
        const secs = secsLeft % 60;
        setMultiplierTimeLeft(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
      } else {
        setActiveMultiplier(1);
        setMultiplierTimeLeft(null);
      }
    };

    checkMultiplier();
    const interval = setInterval(checkMultiplier, 1000);
    return () => clearInterval(interval);
  }, [userProfile]);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!userProfile) {
    return <div className="flex justify-center items-center h-64 text-muted-foreground">Loading profile...</div>;
  }

  // RPG Calculations
  const userXP = userProfile.totalXP || 0;
  const currentLevel = Math.floor(userXP / 100) + 1;
  const xpInCurrentLevel = userXP % 100;
  const progressPercentage = xpInCurrentLevel; // 100 XP per level

  // Direct Interactive Flashcard Selection
  const handleFeedFlashcardSelect = async (e, optionId) => {
    if (flashcardAnswered) return;
    setFlashcardSelected(optionId);
    setFlashcardAnswered(true);

    const isCorrect = optionId === feedQuestion.correctOptionId;
    if (isCorrect) {
      const rect = e.currentTarget.getBoundingClientRect();
      spawnSparks(rect.left + rect.width / 2, rect.top);
      spawnFloatingText("+15 XP", rect.left + rect.width / 2, rect.top - 20, 'text-green-500 font-bold', false);
      
      // Update XP in Firebase
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          totalXP: increment(15)
        });
        // Update local state context
        setUserProfile(prev => ({
          ...prev,
          totalXP: (prev.totalXP || 0) + 15
        }));
      } catch (err) {
        console.error("Failed to credit dashboard XP:", err);
      }
    } else {
      triggerScreenShake();
    }
  };

  // Direct Feynman Teaser Redirect
  const handleFeynmanTeaserSubmit = (e) => {
    e.preventDefault();
    if (!feynmanInput.trim() || !feynmanTopic.trim()) return;
    navigate('/feynman', { 
      state: { 
        topic: feynmanTopic.trim(), 
        initialMessage: feynmanInput.trim() 
      } 
    });
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Quick Forge Submit (Supports Text and PDF/Image Files)
  const handleQuickForgeSubmit = async (e) => {
    e.preventDefault();
    if (isForging) return;
    setForgeError('');

    try {
      let gameData;
      setIsForging(true);

      if (forgeTab === 'text') {
        if (!forgeText.trim()) {
          throw new Error("Please paste some study notes first.");
        }
        gameData = await generateQuestFromText(forgeText, forgeNumQuestions);
      } else {
        if (!forgeFile) {
          throw new Error("Please select a PDF or Image document.");
        }
        const base64Data = await fileToBase64(forgeFile);
        gameData = await generateQuestFromFile(base64Data, forgeFile.type, forgeNumQuestions);
      }

      navigate('/play', { state: { gameData } });
    } catch (err) {
      setForgeError(err.message || "Forge failed. Check connection or API quota.");
      console.error(err);
    } finally {
      setIsForging(false);
    }
  };

  const handleForgeFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (selected.size > 10 * 1024 * 1024) {
        setForgeError("File size exceeds 10MB limit.");
        setForgeFile(null);
        return;
      }
      setForgeError('');
      setForgeFile(selected);
    }
  };

  // Quick Play Daily Challenge
  const handlePlayDaily = async () => {
    if (isGeneratingDaily) return;
    setIsGeneratingDaily(true);
    setForgeError('');
    try {
      const classGrade = userProfile.classGrade || 10;
      const gameData = await generateDailyQuest(classGrade);
      navigate('/play', { state: { gameData, isDailyQuest: true } });
    } catch (error) {
      console.error(error);
      setForgeError(error.message || "Failed to generate Daily Quest.");
    } finally {
      setIsGeneratingDaily(false);
    }
  };

  const handleStoriesWheel = (e) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY * 0.8;
    }
  };

  // Live Boss metrics
  const activeBossName = bossState ? bossState.bossName : "The Mitochondria Behemoth";
  const activeBossMaxHp = bossState ? bossState.maxHp : 2000;
  const activeBossCurrentHp = bossState ? bossState.currentHp : 1200;
  const activeBossPercent = bossState ? Math.max(0, (bossState.currentHp / bossState.maxHp) * 100) : 60;
  const activeBossDefeated = bossState ? bossState.defeated : false;
  const activeRaidScholarsCount = bossState && bossState.players ? Object.keys(bossState.players).length : 12;

  return (
    <div className="max-w-6xl mx-auto px-2 md:px-0">
      <style>{`
        @keyframes floatFadeUp {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.8);
          }
          15% {
            opacity: 1;
            transform: translateY(0) scale(1.15);
          }
          80% {
            opacity: 1;
            transform: translateY(-8px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-18px) scale(0.9);
          }
        }
        .animate-float-fade {
          animation: floatFadeUp 1.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
      
      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Column: Stories & Study Feed */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Instagram-Style Stories Bar */}
          <div 
            onWheel={handleStoriesWheel}
            className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl p-4 shadow-sm overflow-x-auto flex gap-6 hide-scrollbar sticky top-[68px] z-30 transition-all duration-300"
          >
            
            {/* Story item: You (Streak) */}
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer">
              <div className="relative p-1">
                <div className="w-16 h-16 rounded-full border-2 border-orange-500 flex items-center justify-center bg-orange-50 shadow-sm relative z-10">
                  <Flame className="w-8 h-8 text-orange-500 animate-pulse" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white rounded-full text-[9px] font-black px-1.5 py-0.5 z-20 shadow-sm">
                  {userProfile.streakDays || 0}d
                </div>
              </div>
              <span className="text-xs font-semibold text-muted-foreground text-center max-w-[75px] truncate">Streak</span>
            </div>

            {/* Story item: Dopamine Feed (TikTok scroll) */}
            <div 
              onClick={() => navigate('/feed')}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
            >
              <div className="relative p-1">
                <div className="w-16 h-16 rounded-full flex items-center justify-center bg-green-50 shadow-sm relative z-10 transition-transform group-hover:scale-105 animate-story-green">
                  <Smartphone className="w-8 h-8 text-green-600" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-green-600 text-white rounded-full text-[9px] font-black px-1.5 py-0.5 z-20 shadow-sm uppercase">
                  Feed
                </div>
              </div>
              <span className="text-xs font-semibold text-muted-foreground text-center max-w-[75px] truncate group-hover:text-primary transition-colors">For You</span>
            </div>

            {/* Story item: Feynman AI Student */}
            <div 
              onClick={() => navigate('/feynman')}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
            >
              <div className="relative p-1">
                <div className="w-16 h-16 rounded-full flex items-center justify-center bg-blue-50 shadow-sm relative z-10 transition-transform group-hover:scale-105 animate-story-blue">
                  <MessageSquare className="w-8 h-8 text-blue-500" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full text-[9px] font-black px-1.5 py-0.5 z-20 shadow-sm uppercase">
                  AI
                </div>
              </div>
              <span className="text-xs font-semibold text-muted-foreground text-center max-w-[75px] truncate group-hover:text-primary transition-colors">Feynman</span>
            </div>

            {/* Story item: Global Boss Raid */}
            <div 
              onClick={() => navigate('/raid')}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
            >
              <div className="relative p-1">
                <div className="w-16 h-16 rounded-full flex items-center justify-center bg-purple-50 shadow-sm relative z-10 transition-transform group-hover:scale-105 animate-story-purple">
                  <Swords className="w-8 h-8 text-purple-600" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-purple-600 text-white rounded-full text-[9px] font-black px-1.5 py-0.5 z-20 shadow-sm uppercase">
                  Raid
                </div>
              </div>
              <span className="text-xs font-semibold text-muted-foreground text-center max-w-[75px] truncate group-hover:text-primary transition-colors">Boss Raid</span>
            </div>

            {/* Story item: Leaderboard */}
            <div 
              onClick={() => navigate('/leaderboard')}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
            >
              <div className="relative p-1">
                <div className="w-16 h-16 rounded-full flex items-center justify-center bg-yellow-50 shadow-sm relative z-10 transition-transform group-hover:scale-105 animate-story-gold">
                  <Trophy className="w-8 h-8 text-yellow-600" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-white rounded-full text-[9px] font-black px-1.5 py-0.5 z-20 shadow-sm">
                  Rank
                </div>
              </div>
              <span className="text-xs font-semibold text-muted-foreground text-center max-w-[75px] truncate group-hover:text-primary transition-colors">Top 50</span>
            </div>

            {/* Story item: Sandbox (Divyam Mode) */}
            <div 
              onClick={() => navigate('/divyam-setup')}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
            >
              <div className="relative p-1">
                <div className="w-16 h-16 rounded-full border-2 border-gray-300 flex items-center justify-center bg-gray-50 shadow-sm relative z-10 transition-transform group-hover:scale-105">
                  <BookOpen className="w-8 h-8 text-gray-600" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-gray-600 text-white rounded-full text-[9px] font-black px-1.5 py-0.5 z-20 shadow-sm uppercase">
                  Sandbox
                </div>
              </div>
              <span className="text-xs font-semibold text-muted-foreground text-center max-w-[75px] truncate group-hover:text-primary transition-colors">Divyam</span>
            </div>

          </div>

          {/* Timeline Feed */}
          <div className="space-y-6">

            {/* FEED POST 1: Direct-Play Interactive Flashcard */}
            <div className="bg-card border border-border rounded-2xl shadow-sm bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">CramAQuest AI</h4>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Suggested Mini-Encounter</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={loadNewFeedQuestion}
                    disabled={feedLoading}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    title="Load another question"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${feedLoading ? 'animate-spin' : ''}`} />
                    <span className="text-[10px] font-bold">New</span>
                  </button>
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">+15 XP</span>
                </div>
              </div>
              
              <div className="p-6">
                {feedLoading ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
                    <p className="text-xs text-muted-foreground font-bold tracking-wide animate-pulse">GENERATING QUESTION...</p>
                  </div>
                ) : feedErrorMsg ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
                    <p className="text-sm font-bold text-red-600 mb-2">Error Loading Question</p>
                    <p className="text-xs text-muted-foreground mb-4">{feedErrorMsg}</p>
                    <button
                      type="button"
                      onClick={loadNewFeedQuestion}
                      className="bg-primary text-white text-xs font-bold py-2 px-4 rounded-xl cursor-pointer hover:bg-primary/95 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-lg font-bold text-foreground mb-5 leading-tight">{feedQuestion.questionText}</h3>
                    
                    <div className="space-y-2.5">
                      {feedQuestion.options.map(opt => {
                        const isSelected = flashcardSelected === opt.id;
                        const isCorrectOpt = opt.id === feedQuestion.correctOptionId;
                        
                        let btnClass = "w-full text-left p-3.5 rounded-xl border-2 transition-all font-semibold flex items-center justify-between text-sm active:scale-98 cursor-pointer ";
                        
                        if (!flashcardAnswered) {
                          btnClass += "border-border bg-background hover:border-primary/40 hover:bg-muted/10 text-muted-foreground hover:text-foreground";
                        } else {
                          if (isCorrectOpt) {
                            btnClass += "border-green-500 bg-green-50 text-green-900";
                          } else if (isSelected && !isCorrectOpt) {
                            btnClass += "border-red-500 bg-red-50 text-red-900";
                          } else {
                            btnClass += "border-border/30 bg-background/50 opacity-40";
                          }
                        }

                        return (
                          <button
                            key={opt.id}
                            onClick={(e) => handleFeedFlashcardSelect(e, opt.id)}
                            disabled={flashcardAnswered}
                            className={btnClass}
                          >
                            <span>{opt.text}</span>
                            {flashcardAnswered && isCorrectOpt && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            {flashcardAnswered && isSelected && !isCorrectOpt && <XCircle className="w-4 h-4 text-red-500" />}
                          </button>
                        );
                      })}
                    </div>

                    {flashcardAnswered && (
                      <div className="mt-4 p-3 bg-muted/30 border border-border rounded-xl text-xs text-muted-foreground leading-relaxed animate-in slide-in-from-top-2">
                        {flashcardSelected === feedQuestion.correctOptionId ? (
                          <span className="font-bold text-green-600 block mb-0.5">Correct!</span>
                        ) : (
                          <span className="font-bold text-red-500 block mb-0.5">Incorrect!</span>
                        )}
                        {feedQuestion.learningContext}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* FEED POST 2: Co-op Boss Raid Alert (LIVE!) */}
            <div className="bg-card border border-red-200 rounded-2xl shadow-sm bg-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider animate-pulse">
                {activeBossDefeated ? "Victorious" : "Active Raid"}
              </div>
              
              <div className="p-4 border-b border-border flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                  <Swords className="w-5 h-5 text-red-600 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Global Guild Raid</h4>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Joint Boss Battle</p>
                </div>
              </div>

              <div className="p-6 text-center">
                <h3 className="text-xl font-black mb-1.5 text-red-600">{activeBossName}</h3>
                <p className="text-xs text-muted-foreground mb-4 font-medium">
                  {activeBossDefeated 
                    ? "The boss has been conquered by our scholars! Return tomorrow for the next raid."
                    : `${activeRaidScholarsCount} active scholars are attacking. Help defeat the exam boss!`}
                </p>
                
                {/* Health Bar */}
                <div className="w-full max-w-md mx-auto bg-gray-100 rounded-full h-5 mb-5 border border-border overflow-hidden relative">
                  <div 
                    className={`h-full animate-pulse transition-all duration-500 ${
                      activeBossDefeated ? 'bg-emerald-500' : 'bg-gradient-to-r from-red-600 to-red-400'
                    }`}
                    style={{ width: `${activeBossPercent}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow">
                    {activeBossDefeated ? "DEFEATED (0 / 2000 HP)" : `${activeBossCurrentHp} / ${activeBossMaxHp} HP`}
                  </div>
                </div>

                <button
                  onClick={() => navigate('/raid')}
                  className="bg-gradient-to-r from-red-500 to-purple-600 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-md hover:from-red-600 hover:to-purple-700 transition-all flex items-center gap-2 mx-auto active:scale-95 cursor-pointer"
                >
                  <Swords className="w-4 h-4" /> 
                  {activeBossDefeated ? "View Leaderboards" : "Enter Raid Lobby"}
                </button>
              </div>

              <div className="px-4 py-3 bg-red-50/20 border-t border-border flex items-center justify-between text-xs text-muted-foreground font-semibold">
                <span>⚔️ Deal damage with correct study answers</span>
                <span className="text-purple-600">+100 XP Mastery Reward</span>
              </div>
            </div>

            {/* FEED POST 3: Feynman AI conversation starter bubble */}
            <div className="bg-card border border-border rounded-2xl shadow-sm bg-white overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Feynman AI Student</h4>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Physics Concept Encounter</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">+150 XP Potential</span>
              </div>

              <div className="p-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Feynman Bot is struggling with **{feynmanTopic}**. Teach him simply to claim the XP!
                </p>
                
                {/* Simulated Conversation Bubble */}
                <div className="flex gap-3 mb-6 items-start">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 font-bold text-xs uppercase">
                    AI
                  </div>
                  <div className="bg-blue-50 border border-blue-100 text-blue-900 rounded-2xl rounded-tl-sm p-4 max-w-[85%] text-xs leading-relaxed font-semibold">
                    {feynmanTopic.toLowerCase().trim() === 'wave-particle duality' ? (
                      "Wait! If light is a wave, how does it bounce off mirrors like tiny tennis balls? I'm so confused! 😵"
                    ) : (
                      `Wait, how does ${feynmanTopic} work? I'm so confused! 😵`
                    )}
                  </div>
                </div>

                <form onSubmit={handleFeynmanTeaserSubmit} className="space-y-3">
                  <div>
                    <label htmlFor="dashboardFeynmanTopic" className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Topic to Teach</label>
                    <input
                      id="dashboardFeynmanTopic"
                      type="text"
                      value={feynmanTopic}
                      onChange={(e) => setFeynmanTopic(e.target.value)}
                      placeholder="e.g. Wave-Particle Duality, Photosynthesis..."
                      className="w-full border border-slate-200 rounded-xl px-4 py-2 text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label htmlFor="dashboardFeynmanExp" className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Your First Explanation</label>
                    <div className="flex gap-2">
                      <input
                        id="dashboardFeynmanExp"
                        type="text"
                        value={feynmanInput}
                        onChange={(e) => setFeynmanInput(e.target.value)}
                        placeholder="Explain it simply to the bot..."
                        className="flex-1 border border-input rounded-xl px-4 py-2.5 text-xs bg-muted/50 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                      />
                      <button
                        type="submit"
                        disabled={!feynmanInput.trim() || !feynmanTopic.trim()}
                        className="bg-blue-500 text-white rounded-xl px-4 py-2.5 font-bold text-xs hover:bg-blue-600 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" /> Teach
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            {/* FEED POST 4: Mini Leaderboard Podium (LIVE!) */}
            <div className="bg-card border border-border rounded-2xl shadow-sm bg-white overflow-hidden animate-in fade-in duration-500">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Scholar Standings</h4>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Live Rank Update</p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/leaderboard')}
                  className="text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  View Top 50
                </button>
              </div>

              <div className="p-6">
                <h4 className="text-sm font-bold text-center text-muted-foreground mb-4">Currently leading the study boards:</h4>
                
                {topThree.length === 0 ? (
                  <div className="flex justify-center items-center h-20 text-xs text-muted-foreground">Loading standings...</div>
                ) : (
                  /* Podiums visualization */
                  <div className="flex items-end justify-center gap-3 sm:gap-6 pt-4 pb-2">
                    
                    {/* 2nd place */}
                    <div className="flex flex-col items-center flex-1">
                      {topThree[1] ? (
                        <>
                          <div className="w-10 h-10 rounded-full border border-slate-200 overflow-hidden bg-slate-50 text-xl shadow-sm mb-1.5 font-bold flex items-center justify-center">
                            <img src={getAvatarSrc(topThree[1].photoURL)} alt="Rank 2" className="w-full h-full object-cover" />
                          </div>
                          <span className="text-xs font-bold truncate max-w-[80px] text-center">{topThree[1].displayName}</span>
                          <span className="text-[9px] text-muted-foreground font-bold font-mono">{(topThree[1].totalXP || 0).toLocaleString()} XP</span>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center bg-gray-50 text-xl shadow-sm mb-1.5 font-bold">🥈</div>
                          <span className="text-xs font-bold truncate max-w-[80px] text-center">Divyam</span>
                          <span className="text-[9px] text-muted-foreground font-bold font-mono">1,820 XP</span>
                        </>
                      )}
                      <div className="w-full bg-gray-100 border border-gray-200 h-14 rounded-t-lg mt-2 flex items-center justify-center text-xs font-black text-gray-400">#2</div>
                    </div>

                    {/* 1st place */}
                    <div className="flex flex-col items-center flex-1">
                      <Crown className="w-4 h-4 text-yellow-500 animate-bounce mb-1" />
                      {topThree[0] ? (
                        <>
                          <div className="w-12 h-12 rounded-full border-2 border-yellow-400 overflow-hidden bg-yellow-50 text-2xl shadow-md mb-1.5 font-bold flex items-center justify-center">
                            <img src={getAvatarSrc(topThree[0].photoURL)} alt="Rank 1" className="w-full h-full object-cover" />
                          </div>
                          <span className="text-xs font-black text-primary truncate max-w-[90px] text-center">{topThree[0].displayName}</span>
                          <span className="text-[9px] text-yellow-600 font-black font-mono">{(topThree[0].totalXP || 0).toLocaleString()} XP</span>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full border-2 border-yellow-400 flex items-center justify-center bg-yellow-50 text-2xl shadow-md mb-1.5 font-bold">🥇</div>
                          <span className="text-xs font-black text-primary truncate max-w-[90px] text-center">Sage Owl</span>
                          <span className="text-[9px] text-yellow-600 font-black font-mono">2,450 XP</span>
                        </>
                      )}
                      <div className="w-full bg-gradient-to-b from-yellow-100 to-yellow-50 border border-yellow-200 h-20 rounded-t-lg mt-2 flex items-center justify-center text-sm font-black text-yellow-600">#1</div>
                    </div>

                    {/* 3rd place */}
                    <div className="flex flex-col items-center flex-1">
                      {topThree[2] ? (
                        <>
                          <div className="w-10 h-10 rounded-full border border-slate-200 overflow-hidden bg-slate-50 text-xl shadow-sm mb-1.5 font-bold flex items-center justify-center">
                            <img src={getAvatarSrc(topThree[2].photoURL)} alt="Rank 3" className="w-full h-full object-cover" />
                          </div>
                          <span className="text-xs font-bold truncate max-w-[80px] text-center">{topThree[2].displayName}</span>
                          <span className="text-[9px] text-muted-foreground font-bold font-mono">{(topThree[2].totalXP || 0).toLocaleString()} XP</span>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-full border border-amber-600/30 flex items-center justify-center bg-amber-50 text-xl shadow-sm mb-1.5 font-bold">🥉</div>
                          <span className="text-xs font-bold truncate max-w-[80px] text-center">Explorer</span>
                          <span className="text-[9px] text-muted-foreground font-bold font-mono">1,350 XP</span>
                        </>
                      )}
                      <div className="w-full bg-amber-50 border border-amber-200/50 h-10 rounded-t-lg mt-2 flex items-center justify-center text-xs font-black text-amber-700">#3</div>
                    </div>

                  </div>
                )}
              </div>
            </div>

            {/* FEED POST 5: upgraded Quest Forge Card (Supports Drag-Drop PDF & file extraction) */}
            <div className="bg-card border border-border rounded-2xl shadow-sm bg-white overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center">
                    <PlusCircle className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Forge Custom Quest</h4>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">AI Instant Transformation</p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                {/* Tab selector */}
                <div className="flex gap-1.5 p-1 bg-slate-100 rounded-lg mb-4 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => { setForgeTab('text'); setForgeError(''); }}
                    className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer ${
                      forgeTab === 'text'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Paste Text
                  </button>
                  <button
                    type="button"
                    onClick={() => { setForgeTab('file'); setForgeError(''); }}
                    className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer ${
                      forgeTab === 'file'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Upload Document
                  </button>
                </div>

                <form onSubmit={handleQuickForgeSubmit} className="space-y-4">
                  {forgeTab === 'text' ? (
                    <textarea
                      rows="3"
                      value={forgeText}
                      onChange={(e) => setForgeText(e.target.value)}
                      placeholder="Paste textbook outlines, concepts, or raw revision notes..."
                      disabled={isForging}
                      className="w-full p-3 border border-slate-200 rounded-xl text-xs resize-none bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary/45 disabled:opacity-50 text-slate-800"
                    />
                  ) : (
                    <div className="border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 text-center relative hover:bg-slate-100/50 transition-colors">
                      <input 
                        type="file"
                        ref={quickForgeFileRef}
                        accept="application/pdf,image/*"
                        onChange={handleForgeFileChange}
                        disabled={isForging}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="pointer-events-none flex flex-col items-center">
                        <Upload className="w-5 h-5 text-slate-400 mb-1" />
                        <p className="text-[11px] font-bold text-slate-700">
                          {forgeFile ? forgeFile.name : "Select PDF or Image"}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {forgeFile ? `${(forgeFile.size / 1024 / 1024).toFixed(2)} MB` : "Supports PDF / Image up to 10MB"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Settings Bar */}
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <label htmlFor="dashboardForgeQuestions" className="font-bold text-slate-500 uppercase text-[10px]">Questions:</label>
                      <input
                        id="dashboardForgeQuestions"
                        type="number"
                        min="1"
                        max="30"
                        value={forgeNumQuestions}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (val > 30) setForgeNumQuestions(30);
                          else if (val < 1) setForgeNumQuestions(1);
                          else setForgeNumQuestions(val || 5);
                        }}
                        disabled={isForging}
                        className="w-12 border border-slate-200 rounded-lg px-2 py-1 text-center font-bold font-mono bg-white focus:outline-none"
                      />
                    </div>
                    
                    <span className="text-[10px] text-slate-400 font-medium">Gemini extraction pipeline</span>
                  </div>

                  {forgeError && (
                    <p className="text-[10px] font-semibold text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {forgeError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isForging || (forgeTab === 'text' ? !forgeText.trim() : !forgeFile)}
                    className="w-full bg-primary text-white py-2.5 rounded-xl font-bold text-xs hover:bg-primary/95 transition-all flex justify-center items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {isForging ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Forging Quest...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Forge & Play Quest
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

          </div>

        </div>

        {/* Right Column: Player RPG Stats Card */}
        <div className="space-y-6 lg:sticky lg:top-20">
          
          {/* RPG HUD Profile Center */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm bg-white text-center relative overflow-hidden group">
            
            {/* Background design elements */}
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-indigo-500 via-primary to-purple-600 pointer-events-none" />
            
            {/* Avatar block (Clickable to edit) */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="relative mx-auto mt-10 w-24 h-24 rounded-full border-4 border-white overflow-hidden shadow bg-white flex items-center justify-center text-4xl cursor-pointer hover:brightness-95 transition-all group animate-in zoom-in duration-300"
              title="Click to update profile picture"
            >
              <img src={getAvatarSrc(userProfile.photoURL)} alt="Profile" className="w-full h-full object-cover" />
              
              {/* Plus/Camera icon hover overlay */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <PlusCircle className="w-6 h-6 text-white" />
              </div>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleAvatarChange} 
              accept="image/*" 
              className="hidden" 
            />

            <h2 className="text-xl font-extrabold text-foreground mt-3 leading-tight">{userProfile.displayName}</h2>
            <p className="text-[10px] font-extrabold text-primary uppercase tracking-wider bg-primary/10 px-2.5 py-0.5 rounded-full inline-block mt-1">
              Class {userProfile.classGrade || 10} Scholar
            </p>

            <div className="border-t border-border mt-6 pt-5 grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Level</p>
                <p className="text-2xl font-black text-foreground mt-0.5">{currentLevel}</p>
              </div>
              <div className="text-center border-l border-border">
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Rank</p>
                <p className={`text-2xl font-black mt-0.5 ${rank === 1 ? 'text-yellow-500 font-extrabold' : 'text-foreground'}`}>
                  {rank ? `#${rank}` : '-'}
                </p>
              </div>
            </div>

            {/* circular level progress */}
            <div className="mt-6">
              <div className="flex justify-between items-center text-xs font-bold text-muted-foreground mb-1.5">
                <span>XP Level Progress</span>
                <span className="font-mono relative">
                  {xpInCurrentLevel} / 100 XP
                  {xpAnimation && (
                    <span 
                      key={xpAnimation.key} 
                      className="absolute -top-6 right-0 text-emerald-500 font-extrabold text-xs animate-float-fade z-50 animate-in zoom-in duration-200"
                    >
                      +{xpAnimation.amount} XP
                    </span>
                  )}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 border border-border overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-primary to-purple-500 h-full transition-all duration-500" 
                  style={{ width: `${progressPercentage}%` }} 
                />
              </div>
              <p className="text-[10px] font-medium text-muted-foreground mt-1.5 text-left">
                Earn <span className="font-bold text-primary">{100 - xpInCurrentLevel} XP</span> to reach Level {currentLevel + 1}!
              </p>
            </div>

          </div>

          {/* Active Powerups Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm bg-white relative overflow-hidden">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-blue-500 animate-bounce" /> Active Powerups
            </h3>
            
            <div className="space-y-3">
              
              {/* XP Boost Powerup */}
              <div className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${
                activeMultiplier > 1 
                  ? 'bg-blue-50/50 border-blue-200' 
                  : 'bg-muted/10 border-border opacity-60'
              }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeMultiplier > 1 ? 'bg-blue-500 text-white animate-pulse' : 'bg-gray-200 text-gray-500'}`}>
                  <Zap className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">XP Multiplier</p>
                  <p className="text-[10px] text-muted-foreground font-semibold">
                    {activeMultiplier > 1 ? `Active multiplier boosts study XP!` : 'No active boosts'}
                  </p>
                </div>
                {activeMultiplier > 1 && (
                  <div className="text-right">
                    <span className="text-xs font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{activeMultiplier}x</span>
                    {multiplierTimeLeft && (
                      <p className="text-[9px] font-black text-blue-500 mt-1 animate-pulse">{multiplierTimeLeft}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Daily Quest Stepper */}
              <div className="p-3 bg-muted/10 border border-border rounded-xl">
                <p className="text-xs font-bold text-slate-800 mb-2.5">Today's Daily Challenge</p>
                
                <button
                  onClick={handlePlayDaily}
                  disabled={isGeneratingDaily}
                  className="w-full bg-gradient-to-r from-primary to-indigo-600 text-white py-2.5 rounded-xl font-bold text-xs hover:opacity-95 transition-opacity flex justify-center items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isGeneratingDaily ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-4 h-4" />
                      Play Daily Quest (+50 XP)
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
