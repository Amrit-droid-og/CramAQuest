import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, googleProvider } from '../lib/firebase';
import { onAuthStateChanged, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, deleteUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Core Streak Calculation Logic (Calendar-Day based)
  const handleStreakCheck = async (userRef, profileData) => {
    try {
      const lastQuestDate = profileData.lastQuestDate; // format: YYYY-MM-DD
      if (!lastQuestDate) return; // No quests completed yet

      const todayStr = new Date().toLocaleDateString('sv');
      if (lastQuestDate === todayStr) return; // Played today, streak is active

      const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString('sv');
      if (lastQuestDate === yesterdayStr) return; // Played yesterday, streak is active

      // If lastQuestDate is before yesterday, the streak is broken! Reset to 0.
      if (profileData.streakDays > 0) {
        await updateDoc(userRef, {
          streakDays: 0
        });
      }
    } catch (error) {
      console.error("Error checking daily streak:", error);
    }
  };

  useEffect(() => {
    let unsubscribeProfile = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        
        // 1. One-time check for daily streak updates
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const profileData = userSnap.data();
          await handleStreakCheck(userRef, profileData);
        }

        // 2. Setup Realtime Listener for profile updates (XP, streaks, quests)
        unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          }
        }, (error) => {
          console.error("Firestore Profile snapshot listener error:", error);
        });

      } else {
        setUserProfile(null);
        unsubscribeProfile();
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile();
    };
  }, []);

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const userRef = doc(db, 'users', result.user.uid);
    const userSnap = await getDoc(userRef);
    const exists = userSnap.exists();
    
    if (exists) {
      const profileData = userSnap.data();
      await handleStreakCheck(userRef, profileData);
      
      // Auto-repair profile picture to Google profile photo if it was set to default
      const defaultDicebear = 'https://api.dicebear.com/7.x/pixel-art/svg?seed=cramaquest';
      if ((!profileData.photoURL || profileData.photoURL === defaultDicebear) && result.user.photoURL) {
        try {
          await updateDoc(userRef, { photoURL: result.user.photoURL });
          profileData.photoURL = result.user.photoURL;
        } catch (updateErr) {
          console.error("Failed to auto-update profile photo:", updateErr);
        }
      }
      
      setUserProfile(profileData);
    }
    return { user: result.user, isNewUser: !exists };
  };

  const registerWithEmail = (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const loginWithEmail = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  const logout = () => {
    return signOut(auth);
  };

  const deleteAccount = async () => {
    if (!currentUser) return;
    try {
      // 1. Delete user profile from Firestore
      const userRef = doc(db, 'users', currentUser.uid);
      await deleteDoc(userRef);
      
      // 2. Delete user from Firebase Auth
      await deleteUser(currentUser);
      
      // 3. Clear local state
      setUserProfile(null);
      setCurrentUser(null);
    } catch (error) {
      console.error("Error deleting account:", error);
      throw error;
    }
  };

  const value = {
    currentUser,
    userProfile,
    loginWithGoogle,
    registerWithEmail,
    loginWithEmail,
    resetPassword,
    setUserProfile,
    logout,
    deleteAccount,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
