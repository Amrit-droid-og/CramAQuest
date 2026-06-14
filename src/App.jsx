import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';

import GenerateQuest from './pages/GenerateQuest';
import PlayQuest from './pages/PlayQuest';
import Leaderboard from './pages/Leaderboard';
import DivyamSetup from './pages/DivyamSetup';
import DivyamPlay from './pages/DivyamPlay';
import DoomscrollFeed from './pages/DoomscrollFeed';
import FeynmanChat from './pages/FeynmanChat';
import BossRaid from './pages/BossRaid';
import Settings from './pages/Settings';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/feed" element={<DoomscrollFeed />} />
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Landing />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="generate" element={<GenerateQuest />} />
            <Route path="play" element={<PlayQuest />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="divyam-setup" element={<DivyamSetup />} />
            <Route path="divyam-play" element={<DivyamPlay />} />
            <Route path="feynman" element={<FeynmanChat />} />
            <Route path="raid" element={<BossRaid />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
