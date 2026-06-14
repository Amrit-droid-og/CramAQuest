import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { generateFeynmanResponse } from '../lib/gemini';
import { useParticleEffects } from '../lib/useParticleEffects';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ArrowLeft, Send, User, Bot, Loader2, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function FeynmanChat() {
  const [topic, setTopic] = useState('');
  const [isTopicSet, setIsTopicSet] = useState(false);
  const [messages, setMessages] = useState([]); // { role: 'user' | 'assistant', content: '' }
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [finalScore, setFinalScore] = useState(null);
  
  const messagesEndRef = useRef(null);
  const { currentUser } = useAuth();
  const { spawnFloatingText, triggerScreenShake } = useParticleEffects();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.topic && !isTopicSet) {
      const startTopic = location.state.topic;
      setTopic(startTopic);
      setIsTopicSet(true);
      
      const assistantIntro = `Hi! So you're going to teach me about ${startTopic}? I don't really know anything about it. Where should we start?`;
      
      if (location.state?.initialMessage) {
        const userMsg = { role: 'user', content: location.state.initialMessage };
        setMessages([
          { role: 'assistant', content: assistantIntro },
          userMsg
        ]);
        
        // Auto-submit initial comment to get Feynman student's response
        const triggerInitialResponse = async () => {
          setIsTyping(true);
          try {
            const response = await generateFeynmanResponse([
              { role: 'assistant', content: assistantIntro },
              userMsg
            ], startTopic);
            
            const scoreMatch = response.match(/\[SCORE:\s*(\d+)\s*\/\s*100\]/i);
            let cleanResponse = response;
            let earnedXP = 0;

            if (scoreMatch) {
              const score = parseInt(scoreMatch[1], 10);
              setFinalScore(score);
              cleanResponse = response.replace(/\[SCORE:\s*\d+\s*\/\s*100\]/i, '').trim();
              earnedXP = Math.floor(score * 1.5);
              if (score >= 80) {
                triggerScreenShake();
                spawnFloatingText(`Mastery! +${earnedXP} XP`, window.innerWidth / 2, window.innerHeight / 2, 'text-yellow-400', true);
              } else {
                spawnFloatingText(`+${earnedXP} XP`, window.innerWidth / 2, window.innerHeight / 2, 'text-green-500', false);
              }
              if (currentUser && earnedXP > 0) {
                const userRef = doc(db, 'users', currentUser.uid);
                updateDoc(userRef, { totalXP: increment(earnedXP) }).catch(console.error);
              }
            }
            setMessages(prev => [...prev, { role: 'assistant', content: cleanResponse }]);
          } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, my brain froze! Can you say that again?" }]);
          } finally {
            setIsTyping(false);
          }
        };
        triggerInitialResponse();
      } else {
        setMessages([
          { role: 'assistant', content: assistantIntro }
        ]);
      }
    }
  }, [location.state, currentUser]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSetTopic = (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setIsTopicSet(true);
    setMessages([
      { role: 'assistant', content: `Hi! So you're going to teach me about ${topic}? I don't really know anything about it. Where should we start?` }
    ]);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping || finalScore !== null) return;

    const userMessage = { role: 'user', content: input.trim() };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput('');
    setIsTyping(true);

    try {
      const response = await generateFeynmanResponse(newHistory, topic);
      
      // Check for score regex [SCORE: X/100]
      const scoreMatch = response.match(/\[SCORE:\s*(\d+)\s*\/\s*100\]/i);
      let cleanResponse = response;
      let earnedXP = 0;

      if (scoreMatch) {
        const score = parseInt(scoreMatch[1], 10);
        setFinalScore(score);
        cleanResponse = response.replace(/\[SCORE:\s*\d+\s*\/\s*100\]/i, '').trim();
        
        earnedXP = Math.floor(score * 1.5); // Up to 150 XP
        
        if (score >= 80) {
          triggerScreenShake();
          spawnFloatingText(`Mastery! +${earnedXP} XP`, window.innerWidth / 2, window.innerHeight / 2, 'text-yellow-400', true);
        } else {
          spawnFloatingText(`+${earnedXP} XP`, window.innerWidth / 2, window.innerHeight / 2, 'text-green-500', false);
        }

        if (currentUser && earnedXP > 0) {
          const userRef = doc(db, 'users', currentUser.uid);
          updateDoc(userRef, {
            totalXP: increment(earnedXP)
          }).catch(console.error);
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: cleanResponse }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, my brain froze! Can you say that again?" }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-80px)] flex flex-col bg-card border border-border shadow-sm rounded-2xl overflow-hidden mt-4">
      {/* Header */}
      <header className="bg-muted border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-background rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-500" />
              Feynman AI Student
            </h1>
            <p className="text-xs text-muted-foreground">The best way to learn is to teach.</p>
          </div>
        </div>
        {isTopicSet && (
          <div className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
            Topic: {topic}
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!isTopicSet ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto animate-in fade-in duration-500">
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6">
              <Sparkles className="w-10 h-10 text-blue-500 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold mb-3">What are you teaching me today?</h2>
            <p className="text-muted-foreground mb-8 text-sm">
              Enter a topic you just studied. I will act as a confused 5th grader. Explain it to me simply to earn massive XP!
            </p>
            <form onSubmit={handleSetTopic} className="w-full flex gap-2">
              <input 
                type="text" 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Photosynthesis, Supply & Demand..." 
                className="flex-1 bg-background border border-input rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
              />
              <button 
                type="submit"
                disabled={!topic.trim()}
                className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Start
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6 pb-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-blue-100 text-blue-600'}`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`max-w-[80%] rounded-2xl p-4 ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                    : 'bg-muted border border-border text-foreground rounded-tl-sm'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-muted border border-border rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      {isTopicSet && (
        <div className="p-4 bg-background border-t border-border">
          {finalScore !== null ? (
            <div className="text-center p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <h3 className="text-xl font-bold text-green-600 mb-1">Session Complete!</h3>
              <p className="text-sm text-green-700 font-medium mb-4">Teaching Score: {finalScore}/100</p>
              <button 
                onClick={() => navigate('/dashboard')}
                className="bg-green-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-600 transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Explain it simply..."
                disabled={isTyping}
                className="flex-1 bg-muted border border-input rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="bg-primary text-primary-foreground p-3 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
