import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, BookOpen, Trophy, Settings, User, Menu, X, Home, Swords, Trash2, Sun, Moon, PlusCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function Navbar() {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();

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

  const getAvatarSrc = (url) => {
    if (url && (url.startsWith('http') || url.startsWith('data:image'))) {
      return url;
    }
    return 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp';
  };
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [isLightTheme, setIsLightTheme] = useState(() => {
    return localStorage.getItem('theme') === 'light';
  });

  useEffect(() => {
    if (isLightTheme) {
      document.documentElement.classList.add('light-theme');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark');
    }
  }, [isLightTheme]);

  const mobileFileInputRef = useRef(null);

  const handleMobileFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 200 * 1024) {
      alert("Profile image must be under 200KB!");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result;
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { photoURL: base64Data });
      } catch (err) {
        console.error("Failed to update profile image", err);
        alert("Failed to update profile picture.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleMobileNav = (path) => {
    setIsMobileMenuOpen(false);
    navigate(path);
  };

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full">
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
      <div className="container flex h-16 items-center justify-between mx-auto px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
          <BookOpen className="w-6 h-6 text-accent-foreground" />
          CramAQuest
        </Link>

        {currentUser && userProfile && (
          <>
            {/* Desktop Navigation */}
            <div className="hidden sm:flex items-center gap-6">
              <Link 
                to="/leaderboard" 
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                title="Leaderboard"
              >
                <Trophy className="w-5 h-5" />
                <span>Leaderboard</span>
              </Link>

              <div className="flex flex-col items-end border-l border-border pl-6 relative">
                <span className="text-sm font-medium">{userProfile.displayName}</span>
                <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-full mt-1 relative transition-all duration-300">
                  {userProfile.totalXP} XP
                  {xpAnimation && (
                    <span 
                      key={`desktop-${xpAnimation.key}`} 
                      className="absolute -top-6 right-0 text-emerald-500 font-extrabold text-xs animate-float-fade z-50"
                    >
                      +{xpAnimation.amount} XP
                    </span>
                  )}
                </span>
              </div>

              <div className="relative flex items-center">
                <img 
                  src={getAvatarSrc(userProfile.photoURL)} 
                  alt="Profile" 
                  className="w-10 h-10 rounded-full border-2 border-primary/20 object-cover shadow-sm bg-white"
                />
                
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="absolute -bottom-1 -right-1 p-1 bg-background border border-border rounded-full hover:bg-muted transition-colors shadow-sm"
                  title="Settings"
                >
                  <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-lg overflow-hidden py-1 z-50">
                    <button
                      onClick={() => { navigate('/settings'); setIsDropdownOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                    >
                      <User className="w-4 h-4" /> Settings
                    </button>
                    <button
                      onClick={() => { logout(); setIsDropdownOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Hamburger Icon */}
            <div className="sm:hidden flex items-center gap-4">
              <span className="text-sm font-bold text-primary relative">
                {userProfile.totalXP} XP
                {xpAnimation && (
                  <span 
                    key={`mobile-${xpAnimation.key}`} 
                    className="absolute -top-6 right-0 text-emerald-500 font-extrabold text-[10px] animate-float-fade z-50"
                  >
                    +{xpAnimation.amount} XP
                  </span>
                )}
              </span>
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 text-foreground hover:bg-muted rounded-full transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && currentUser && userProfile && (
        <div className="fixed inset-0 z-[100] sm:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Sidebar */}
          <div className="absolute top-0 right-0 w-3/4 max-w-xs h-full bg-card/98 backdrop-blur-xl border-l border-border shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
            
            {/* Header / Profile section */}
            <div className="p-6 border-b border-border/80 flex justify-between items-center bg-muted/20">
              <div className="flex items-center gap-3">
                <div 
                  onClick={() => mobileFileInputRef.current?.click()}
                  className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-primary/20 cursor-pointer hover:brightness-90 transition-all group bg-slate-800 flex items-center justify-center flex-shrink-0"
                  title="Click to change profile photo"
                >
                  <img 
                    src={getAvatarSrc(userProfile.photoURL)} 
                    alt="Profile" 
                    className="w-full h-full object-cover" 
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <PlusCircle className="w-4 h-4 text-white" />
                  </div>
                </div>
                <input 
                  type="file" 
                  ref={mobileFileInputRef} 
                  onChange={handleMobileFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
                <div>
                  <p className="font-extrabold text-sm text-foreground leading-tight truncate max-w-[120px]">{userProfile.displayName}</p>
                  <p className="text-[10px] font-bold text-muted-foreground mt-1 flex">
                    <span className="bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full">
                      Class {userProfile.classGrade || 10}
                    </span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-5.5 h-5.5" />
              </button>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              <button 
                onClick={() => handleMobileNav('/dashboard')} 
                className={`w-full flex items-center gap-3.5 p-3 rounded-xl transition-all text-left font-semibold text-sm duration-200 cursor-pointer ${
                  window.location.pathname === '/dashboard'
                    ? 'bg-primary/5 text-primary border-l-4 border-primary pl-2.5 shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-1'
                }`}
              >
                <Home className="w-5 h-5 flex-shrink-0" />
                <span>Dashboard</span>
              </button>
              
              <button 
                onClick={() => handleMobileNav('/leaderboard')} 
                className={`w-full flex items-center gap-3.5 p-3 rounded-xl transition-all text-left font-semibold text-sm duration-200 cursor-pointer ${
                  window.location.pathname === '/leaderboard'
                    ? 'bg-primary/5 text-primary border-l-4 border-primary pl-2.5 shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-1'
                }`}
              >
                <Trophy className="w-5 h-5 flex-shrink-0" />
                <span>Leaderboard</span>
              </button>

              <button 
                onClick={() => handleMobileNav('/divyam-setup')} 
                className={`w-full flex items-center gap-3.5 p-3 rounded-xl transition-all text-left font-semibold text-sm duration-200 cursor-pointer ${
                  window.location.pathname === '/divyam-setup' || window.location.pathname === '/divyam-play'
                    ? 'bg-primary/5 text-primary border-l-4 border-primary pl-2.5 shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-1'
                }`}
              >
                <Swords className="w-5 h-5 flex-shrink-0" />
                <span>Divyam Sandbox</span>
              </button>
              
              <div className="border-t border-border/80 my-4" />
              
              <button 
                onClick={() => { navigate('/settings'); setIsMobileMenuOpen(false); }} 
                className={`w-full flex items-center gap-3.5 p-3 rounded-xl transition-all text-left font-semibold text-sm duration-200 cursor-pointer ${
                  window.location.pathname === '/settings'
                    ? 'bg-primary/5 text-primary border-l-4 border-primary pl-2.5 shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-1'
                }`}
              >
                <Settings className="w-5 h-5 flex-shrink-0" />
                <span>Account Settings</span>
              </button>

              <div className="border-t border-border/80 my-4" />

              {/* Theme switcher with interactive switch */}
              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3.5 text-muted-foreground">
                  {isLightTheme ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-indigo-400" />}
                  <span className="font-semibold text-sm text-foreground">Theme Mode</span>
                </div>
                <button
                  onClick={() => setIsLightTheme(!isLightTheme)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                    isLightTheme ? 'bg-primary' : 'bg-slate-700'
                  }`}
                  aria-label="Toggle Theme"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isLightTheme ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Logout and Delete Actions footer */}
            <div className="p-4 border-t border-border/80 bg-muted/10 space-y-2">
              <button 
                onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 font-bold hover:bg-slate-700 hover:text-white transition-all duration-200 shadow-sm cursor-pointer"
              >
                <LogOut className="w-4.5 h-4.5" />
                <span className="text-sm">Logout</span>
              </button>
              <button 
                onClick={() => { 
                  setIsMobileMenuOpen(false); 
                  navigate('/settings', { state: { confirmDelete: true } }); 
                }}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-500/10 text-red-500 font-bold hover:bg-red-50 hover:text-white transition-all duration-200 shadow-sm cursor-pointer border border-red-500/20"
              >
                <Trash2 className="w-4.5 h-4.5" />
                <span className="text-sm">Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
