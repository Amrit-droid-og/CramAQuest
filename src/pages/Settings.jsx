import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import { Save, LogOut, Trash2, AlertTriangle, PlusCircle, User, ArrowLeft, ShieldAlert } from 'lucide-react';

export default function Settings() {
  const { currentUser, userProfile, setUserProfile, deleteAccount, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [classGrade, setClassGrade] = useState(userProfile?.classGrade || 10);
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || '');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (location.state?.confirmDelete) {
      setShowConfirmDelete(true);
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 200);
    }
  }, [location.state]);

  const getAvatarSrc = (url) => {
    if (url && (url.startsWith('http') || url.startsWith('data:image'))) {
      return url;
    }
    return 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp';
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 200 * 1024) { // 200KB limit for Firestore document size safety
      setError("Profile image must be under 200KB!");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoURL(reader.result);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!displayName.trim()) {
      setError("Display Name cannot be empty.");
      return;
    }
    
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const updatedData = {
        displayName: displayName.trim(),
        classGrade: Number(classGrade),
        photoURL: photoURL
      };
      
      await updateDoc(userRef, updatedData);
      
      setUserProfile(prev => ({
        ...prev,
        ...updatedData
      }));

      setSuccessMsg("Account settings saved successfully! ✨");
    } catch (err) {
      console.error("Failed to save account settings", err);
      setError("Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error("Failed to log out", err);
      setError("Failed to log out.");
    }
  };

  const handleDelete = async () => {
    setError('');
    setIsDeleting(true);
    try {
      await deleteAccount();
      navigate('/login');
    } catch (err) {
      console.error("Failed to delete account", err);
      if (err.code === 'auth/requires-recent-login') {
        setError("For security, you must log out and log back in before deleting your account.");
      } else {
        setError("Failed to permanently delete your account.");
      }
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  const minClass = 1;

  return (
    <div className="max-w-2xl mx-auto px-1 py-4 animate-in fade-in duration-500">
      
      {/* Header breadcrumb navigation */}
      <div className="flex items-center gap-3 mb-8">
        <button 
          onClick={() => navigate('/dashboard')}
          className="p-2 hover:bg-slate-800/50 rounded-xl text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Account Settings</h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">Manage your scholar profile, log out, or delete your account data.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 text-red-400 text-sm rounded-xl border border-red-500/25 flex items-center gap-2 animate-in slide-in-from-top-2">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-500/10 text-emerald-400 text-sm rounded-xl border border-emerald-500/25 flex items-center gap-2 animate-in slide-in-from-top-2">
          <span>{successMsg}</span>
        </div>
      )}

      <div className="space-y-6">
        
        {/* Profile Details Form Card */}
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2 border-b border-border pb-3">
            <User className="w-5 h-5 text-primary" /> Profile Settings
          </h2>

          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Clickable Profile Picture */}
            <div className="flex flex-col items-center justify-center gap-2 mb-6">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-slate-700 shadow-md cursor-pointer hover:brightness-95 transition-all group bg-slate-800 flex items-center justify-center"
                title="Click to upload custom picture"
              >
                <img src={getAvatarSrc(photoURL)} alt="Profile Avatar" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <PlusCircle className="w-6 h-6 text-white" />
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-400">Click avatar to upload photo</span>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>

            {/* Display Name Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isSaving}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background focus:outline-none focus:border-primary transition-colors text-sm font-semibold"
                placeholder="Enter your display name"
              />
            </div>

            {/* Class Grade Select */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Class Grade</label>
              <select
                value={classGrade}
                onChange={(e) => setClassGrade(Number(e.target.value))}
                disabled={isSaving}
                className="w-full px-4 py-3 rounded-xl border border-input bg-background focus:outline-none focus:border-primary transition-colors text-sm font-semibold text-slate-300"
              >
                {[...Array(12)].map((_, i) => {
                  const grade = i + 1;
                  return (
                    <option key={grade} value={grade} disabled={grade < minClass}>
                      Class {grade} {grade < minClass ? '(Locked)' : ''}
                    </option>
                  );
                })}
              </select>
              <p className="text-[10px] text-slate-500 font-medium leading-normal">
                Choose your Indian CBSE Class Grade level. This shapes the AI syllabus generation.
              </p>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-primary text-white py-3 px-6 rounded-xl font-bold text-sm shadow-md hover:bg-primary/90 transition-all flex justify-center items-center gap-2 disabled:opacity-75 cursor-pointer"
            >
              {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
              <Save className="w-4.5 h-4.5" />
            </button>
          </form>
        </div>

        {/* Danger zone / safety configuration */}
        <div className="bg-card border border-red-500/20 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-red-400 flex items-center gap-2 border-b border-red-500/10 pb-3">
            <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" /> Danger Zone
          </h2>

          <div className="flex flex-col sm:flex-row gap-4">
            {/* Logout button */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-3.5 px-6 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4.5 h-4.5" /> Log Out Account
            </button>

            {/* Delete button (trigger confirming) */}
            {!showConfirmDelete && (
              <button
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                className="flex-1 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/30 py-3.5 px-6 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4.5 h-4.5" /> Delete Account
              </button>
            )}
          </div>

          {/* Confirm delete block */}
          {showConfirmDelete && (
            <div className="bg-red-500/5 border border-red-500/25 p-5 rounded-2xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-red-500">Are you absolutely sure?</h4>
                  <p className="text-xs text-red-200/80 mt-1 leading-relaxed">
                    This action is final and permanent. Deleting your account will completely erase your profile, all cumulative win/loss logs, streak counts, and all total study XP from our servers.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold text-xs border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold text-xs bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-75 flex justify-center items-center gap-1.5 cursor-pointer"
                >
                  {isDeleting ? 'Deleting data...' : 'Permanently Delete Account'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
