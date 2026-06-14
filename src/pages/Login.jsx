import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { BookOpen, Sparkles, ArrowRight, ArrowLeft, Check, Lock, Mail, User, Flame, Compass } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const AVATARS = [
  { emoji: '🎓', label: 'Scholar', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=scholar' },
  { emoji: '🦉', label: 'Sage Owl', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=owl' },
  { emoji: '🦊', label: 'Fox', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=fox' },
  { emoji: '🚀', label: 'Explorer', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=explorer' },
  { emoji: '⚡', label: 'Bolt', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=bolt' },
  { emoji: '🧠', label: 'Brainiac', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=brain' },
  { emoji: '🛡️', label: 'Guardian', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=guardian' },
  { emoji: '🎨', label: 'Creator', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=creator' },
];

const STUDY_GOALS = [
  { id: 'Casual', label: 'Casual', desc: '1 Quest (20 XP) per day', xp: 20 },
  { id: 'Regular', label: 'Regular', desc: '2 Quests (50 XP) per day', xp: 50 },
  { id: 'Hardcore', label: 'Hardcore', desc: '4+ Quests (100 XP) per day', xp: 100 },
];

export default function Login() {
  const navigate = useNavigate();
  const { currentUser, userProfile, loginWithGoogle, registerWithEmail, loginWithEmail, resetPassword, setUserProfile, logout } = useAuth();
  
  const [authMode, setAuthMode] = useState('signin'); // 'signin', 'signup', or 'forgot'
  const [signupStep, setSignupStep] = useState(1); // 1, 2, or 3
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [studyGoal, setStudyGoal] = useState('Regular');
  const [classGrade, setClassGrade] = useState(10);
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [googlePhotoURL, setGooglePhotoURL] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer interval tick
  React.useEffect(() => {
    let interval;
    if (cooldown > 0) {
      interval = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [cooldown]);

  // Auto-redirect authenticated users without profiles to Step 2 (Awaken Character)
  React.useEffect(() => {
    if (currentUser && !userProfile && !isSubmitting) {
      setAuthMode('signup');
      setSignupStep(2);
      if (!displayName && currentUser.displayName) {
        setDisplayName(currentUser.displayName);
      }
    }
  }, [currentUser, userProfile, isSubmitting, displayName]);

  if (currentUser && userProfile) {
    return <Navigate to="/dashboard" replace />;
  }

  // Password strength check
  const getPasswordStrength = () => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 6) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  };

  const strengthLabels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['bg-muted', 'bg-red-500', 'bg-orange-500', 'bg-blue-500', 'bg-green-500'];

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill out all fields.");
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await loginWithEmail(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError("Invalid email or password.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (cooldown > 0) return;
    if (!email.trim()) {
      setError("Please enter your email address first.");
      return;
    }
    setError('');
    setMessage('');
    setIsSubmitting(true);
    try {
      await resetPassword(email);
      setMessage("A password reset link has been dispatched to your inbox!");
      setCooldown(60); // 60s cooldown limit
    } catch (err) {
      setError("Failed to send reset link. Ensure the email address is correct.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const { user, isNewUser } = await loginWithGoogle();
      if (user && user.photoURL) {
        setGooglePhotoURL(user.photoURL);
      }
      if (!isNewUser) {
        navigate('/dashboard');
      } else {
        setAuthMode('signup');
        setSignupStep(2);
      }
    } catch (err) {
      setError("Failed to sign in with Google.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupNext = (e) => {
    e.preventDefault();
    setError('');
    
    if (signupStep === 1) {
      if (!email.trim() || !password) {
        setError("Please enter your credentials.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      setSignupStep(2);
    } else if (signupStep === 2) {
      if (!displayName.trim()) {
        setError("Please enter your name.");
        return;
      }
      handleSignupComplete();
    }
  };

  const handleBack = async () => {
    if (currentUser) {
      try {
        setError('');
        setIsSubmitting(true);
        await logout();
        setSignupStep(1);
        setAuthMode('signup');
      } catch (err) {
        console.error("Error signing out:", err);
        setError("Failed to reset authentication state.");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setSignupStep(1);
    }
  };

  const getGravatarUrl = async (emailStr) => {
    try {
      const cleanEmail = emailStr.trim().toLowerCase();
      const msgBuffer = new TextEncoder().encode(cleanEmail);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return `https://www.gravatar.com/avatar/${hashHex}?d=mp`;
    } catch (err) {
      console.error("Error generating gravatar:", err);
      return 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp';
    }
  };

  const handleSignupComplete = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      let user = currentUser;
      
      // 1. If not authenticated yet (Email/Password flow), register
      if (!user) {
        const credential = await registerWithEmail(email, password);
        user = credential.user;
      }
      
      const defaultAvatar = await getGravatarUrl(user.email || email);
      
      // 2. Set Firestore User Profile
      const userProfileData = {
        displayName: displayName,
        email: user.email || email,
        photoURL: googlePhotoURL || user.photoURL || defaultAvatar,
        studyGoal: studyGoal,
        totalXP: 0,
        divyamXP: 0,
        streakDays: 0,
        classGrade: classGrade,
        activeMultiplier: 1.0,
        multiplierExpiry: null,
        dailyQuestsCompleted: 0,
        createdAt: serverTimestamp(),
        lastQuestDate: null,
        lastQuestTimestamp: null
      };
      
      await setDoc(doc(db, 'users', user.uid), userProfileData);
      setUserProfile(userProfileData);
      navigate('/dashboard');
    } catch (err) {
      // UX Fallback: If email is already in use, try logging them in automatically using the password they entered!
      if (err.code === 'auth/email-already-in-use') {
        try {
          console.log("Email already in use. Attempting automatic login...");
          await loginWithEmail(email, password);
          navigate('/dashboard');
        } catch (loginErr) {
          setError("This email is already registered, and the password provided is incorrect.");
          console.error("Auto-login failed:", loginErr);
        }
      } else {
        setError(err.message || "Failed to create account.");
        console.error(err);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center py-10 px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-sm p-8 transition-all duration-300">
        
        {/* Header / Brand */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center mx-auto mb-4 hover:scale-105 transition-transform duration-300">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {authMode === 'signin' ? 'Welcome Back' : authMode === 'forgot' ? 'Reset Password' : 'Create Your Character'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {authMode === 'forgot' 
              ? 'Enter your email to receive a password reset link.'
              : authMode === 'signin' 
              ? 'Level up your studies and climb the leaderboards.' 
              : `Step ${signupStep} of 2: ${signupStep === 1 ? 'Credentials' : 'Customize Profile'}`
            }
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20 flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="mb-5 p-3 bg-green-500/10 text-green-700 text-sm rounded-lg border border-green-500/20 flex items-center gap-2">
            <span>{message}</span>
          </div>
        )}

        {/* --- SIGN IN MODE --- */}
        {authMode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-shadow"
                disabled={isSubmitting}
              />
            </div>
            
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-shadow"
                disabled={isSubmitting}
              />
            </div>

            <div className="flex justify-end text-xs pb-1">
              <button
                type="button"
                onClick={() => { setAuthMode('forgot'); setError(''); setMessage(''); }}
                className="font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary text-primary-foreground h-11 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-75"
            >
              Sign In
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-border"></div>
              <span className="flex-shrink mx-4 text-muted-foreground text-xs uppercase font-semibold">Or</span>
              <div className="flex-grow border-t border-border"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="w-full border border-border bg-background hover:bg-muted text-foreground h-11 rounded-lg font-medium transition-colors flex items-center justify-center gap-3 disabled:opacity-75"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <p className="text-center text-xs text-muted-foreground mt-4">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setAuthMode('signup'); setSignupStep(1); setError(''); setMessage(''); }}
                className="font-semibold text-primary underline"
              >
                Sign Up
              </button>
            </p>
          </form>
        )}

        {/* --- FORGOT PASSWORD MODE --- */}
        {authMode === 'forgot' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="Enter registered Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-shadow"
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || cooldown > 0}
              className="w-full bg-primary text-primary-foreground h-11 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-75"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Send Reset Link'}
            </button>

            <button
              type="button"
              onClick={() => { setAuthMode('signin'); setError(''); setMessage(''); }}
              className="w-full border border-border bg-background hover:bg-muted text-foreground h-11 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </button>
          </form>
        )}

        {/* --- MULTISTEP SIGN UP WIZARD --- */}
        {authMode === 'signup' && (
          <div className="space-y-6">
            
            {/* STEP 1: CREDENTIALS */}
            {signupStep === 1 && (
              <form onSubmit={handleSignupNext} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-shadow"
                  />
                </div>
                
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    placeholder="Create Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-shadow"
                  />
                </div>

                {/* Password Strength Indicator */}
                {password && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                      <span>Strength</span>
                      <span>{strengthLabels[getPasswordStrength()]}</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex gap-0.5">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-full flex-1 transition-colors duration-300 ${
                            i < getPasswordStrength()
                              ? strengthColors[getPasswordStrength()]
                              : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground h-11 rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 mt-2"
                >
                  Next Step
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-border"></div>
                  <span className="flex-shrink mx-4 text-muted-foreground text-xs uppercase font-semibold">Or</span>
                  <div className="flex-grow border-t border-border"></div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting}
                  className="w-full border border-border bg-background hover:bg-muted text-foreground h-11 rounded-lg font-medium transition-colors flex items-center justify-center gap-3 disabled:opacity-75"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>
              </form>
            )}

            {/* STEP 2: PROFILE & DAILY GOAL */}
            {signupStep === 2 && (
              <form onSubmit={handleSignupNext} className="space-y-5">
                <div className="relative">
                  <User className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Your Display Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-shadow"
                  />
                </div>

                <div className="space-y-2.5">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-orange-500" /> Choose Daily study Goal
                  </label>
                  <div className="space-y-2.5">
                    {STUDY_GOALS.map((goal) => (
                      <button
                        key={goal.id}
                        type="button"
                        onClick={() => setStudyGoal(goal.id)}
                        className={`w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-center justify-between ${
                          studyGoal === goal.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30 bg-background'
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-sm">{goal.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{goal.desc}</p>
                        </div>
                        {studyGoal === goal.id && (
                          <div className="w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-blue-500" /> Choose Your Class
                  </label>
                  <select
                    value={classGrade}
                    onChange={(e) => setClassGrade(Number(e.target.value))}
                    className="w-full p-3.5 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm font-medium"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i+1} value={i+1}>Class {i+1}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 border border-border bg-background hover:bg-muted text-foreground h-11 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-primary text-primary-foreground h-11 rounded-lg font-medium hover:bg-primary/95 transition-all flex items-center justify-center gap-2 disabled:opacity-75"
                  >
                    {isSubmitting ? 'Awakening...' : 'Awaken character'}
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            <p className="text-center text-xs text-muted-foreground mt-4">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setAuthMode('signin'); setError(''); }}
                className="font-semibold text-primary underline"
              >
                Sign In
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
