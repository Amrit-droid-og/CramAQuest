import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Sparkles, Trophy, ShieldAlert, Zap, Flame, ArrowRight, Users, MessageSquare, Brain, Smartphone } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleCTA = () => {
    if (currentUser) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 md:py-20 flex flex-col items-center overflow-x-hidden">
      {/* Hero Section */}
      <header className="text-center max-w-3xl mb-16 md:mb-24 flex flex-col items-center">
        {/* Floating AI Badge */}
        <div className="opacity-0 animate-fade-in-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/50 text-xs font-semibold text-muted-foreground mb-6 uppercase tracking-wider shadow-sm hover:border-primary/30 transition-colors cursor-default">
          <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse-subtle" />
          AI-Powered EdTech Gamification
        </div>
        
        {/* Animated Headline */}
        <h1 className="opacity-0 animate-fade-in-up delay-100 text-5xl md:text-6xl font-bold tracking-tight text-primary leading-tight mb-6 hover:scale-[1.01] transition-transform duration-300 select-none">
          CramAQuest
        </h1>
        
        {/* Animated Subtitle */}
        <p className="opacity-0 animate-fade-in-up delay-200 text-2xl md:text-3xl text-muted-foreground font-medium tracking-tight mb-8">
          "Study can be addicting!"
        </p>

        {/* Animated Description */}
        <p className="opacity-0 animate-fade-in-up delay-300 text-lg text-muted-foreground/80 max-w-xl mx-auto mb-10 leading-relaxed">
          Dynamically transform boring study materials, question banks, and lecture slides into interactive, highly addictive quests and XP-driven learning modules.
        </p>

        {/* Action Buttons with Hover Effects */}
        <div className="opacity-0 animate-fade-in-up delay-400 flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto">
          <button
            onClick={handleCTA}
            className="group bg-primary text-primary-foreground h-12 px-8 rounded-lg font-medium hover:bg-primary/95 transition-all duration-300 flex items-center justify-center gap-2 text-base shadow-sm hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)] active:scale-[0.98]"
          >
            {currentUser ? "Go to Dashboard" : "Enter the Quest"}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          
          <a
            href="#features"
            className="border border-border bg-background hover:bg-muted text-foreground h-12 px-8 rounded-lg font-medium transition-all duration-300 flex items-center justify-center text-base hover:-translate-y-[1px] active:translate-y-0"
          >
            Explore Features
          </a>
        </div>
      </header>

      {/* Feature Grid */}
      <section id="features" className="w-full mb-24 md:mb-32">
        <div className="text-center mb-16 opacity-0 animate-fade-in-up delay-200">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Core Mechanics</h2>
          <p className="text-muted-foreground max-w-md mx-auto">Everything you need to turn standard lectures into an epic learning progression.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Card 1: AI Transformation */}
          <div className="opacity-0 animate-fade-in-up delay-200 group bg-card border border-border rounded-2xl p-8 hover:-translate-y-1.5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-primary/20 transition-all duration-300">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Sparkles className="w-6 h-6 text-blue-500 group-hover:rotate-12 transition-transform" />
            </div>
            <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">AI Transformation</h3>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Upload PDFs, lecture slides, or paste raw textbook excerpts. Our robust Gemini pipeline instantly generates gamified, interactive quests.
            </p>
          </div>

          {/* Card 2: Co-op Boss Raids */}
          <div className="opacity-0 animate-fade-in-up delay-300 group bg-card border border-primary/30 rounded-2xl p-8 hover:-translate-y-1.5 hover:shadow-[0_8px_30px_rgba(147,51,234,0.1)] hover:border-primary/60 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">New</div>
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Users className="w-6 h-6 text-purple-500 group-hover:scale-110 transition-transform" />
            </div>
            <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">Co-op Boss Raids</h3>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Team up with classmates to defeat "Boss Exams". Your collective correct answers deal damage. Heal struggling teammates by sending hints in the team chat.
            </p>
          </div>

          {/* Card 3: TikTok-Style Doomscrolling */}
          <div className="opacity-0 animate-fade-in-up delay-400 group bg-card border border-primary/30 rounded-2xl p-8 hover:-translate-y-1.5 hover:shadow-[0_8px_30px_rgba(16,185,129,0.1)] hover:border-primary/60 transition-all duration-300 relative overflow-hidden lg:col-span-2">
            <div className="absolute top-0 right-0 bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">Addictive</div>
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Smartphone className="w-6 h-6 text-emerald-500 group-hover:rotate-12 transition-transform" />
            </div>
            <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">TikTok-Style Doomscrolling</h3>
            <p className="text-muted-foreground leading-relaxed text-sm">
              We've hijacked the most addictive UI pattern on earth for studying. Swipe through a personalized, infinite vertical feed of bite-sized flashcards and mini-quests. Gamified learning that feels exactly like scrolling social media.
            </p>
          </div>

          {/* Card 4: Competitive Dash */}
          <div className="opacity-0 animate-fade-in-up delay-500 group bg-card border border-border rounded-2xl p-8 hover:-translate-y-1.5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-primary/20 transition-all duration-300">
            <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Trophy className="w-6 h-6 text-orange-500 group-hover:rotate-6 transition-transform" />
            </div>
            <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">Competitive Dash</h3>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Earn XP to scale a live, global student leaderboard. Foster friendly peer-to-peer competition to stay consistently engaged.
            </p>
          </div>

          {/* Card 5: Adaptive Memory Ambushes */}
          <div className="opacity-0 animate-fade-in-up delay-600 group bg-card border border-primary/30 rounded-2xl p-8 hover:-translate-y-1.5 hover:shadow-[0_8px_30px_rgba(59,130,246,0.1)] hover:border-primary/60 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">AI Powered</div>
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Brain className="w-6 h-6 text-blue-500 group-hover:scale-110 transition-transform" />
            </div>
            <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">Memory Ambushes</h3>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Our AI tracks your forgetting curve in the background. When your knowledge decays, it spawns a sudden "Ambush Quest" to reinforce memory and save your XP.
            </p>
          </div>

          {/* Card 6: Anti-Cheat Focus */}
          <div className="opacity-0 animate-fade-in-up delay-700 group bg-card border border-border rounded-2xl p-8 hover:-translate-y-1.5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-primary/20 transition-all duration-300">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <ShieldAlert className="w-6 h-6 text-red-500 group-hover:scale-105 transition-transform" />
            </div>
            <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">Anti-Cheat Focus</h3>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Maintain leaderboard integrity. The system detects tab-switching during active exams, enforcing strict focus rules.
            </p>
          </div>

          {/* Card 7: Solo Leveling Streaks */}
          <div className="opacity-0 animate-fade-in-up delay-800 group bg-card border border-border rounded-2xl p-8 hover:-translate-y-1.5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-primary/20 transition-all duration-300">
            <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Flame className="w-6 h-6 text-orange-500 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">Solo Leveling Streaks</h3>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Consistently study each day to build your login streak. Unlocking higher streaks awards a powerful "Awakening" XP multiplier.
            </p>
          </div>
        </div>
      </section>

      {/* Trust Banner / Bottom CTA */}
      <section className="opacity-0 animate-fade-in-up delay-300 w-full text-center bg-card border border-border rounded-3xl p-12 md:p-16 max-w-4xl hover:shadow-[0_12px_40px_rgba(0,0,0,0.03)] hover:border-primary/10 transition-all duration-500">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Are you ready to level up your grades?</h2>
        <p className="text-muted-foreground max-w-lg mx-auto mb-8">
          Join students converting boring study notes into engaging quests. Prove your knowledge on the global leaderboard.
        </p>
        <button
          onClick={handleCTA}
          className="group bg-primary text-primary-foreground h-12 px-8 rounded-lg font-medium hover:bg-primary/95 transition-all duration-300 flex items-center justify-center gap-2 text-base mx-auto hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)] active:scale-[0.98]"
        >
          {currentUser ? "Go to Dashboard" : "Start For Free"}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </section>
    </div>
  );
}
