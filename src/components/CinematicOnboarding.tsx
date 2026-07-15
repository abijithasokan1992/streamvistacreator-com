import React, { useState, useEffect } from 'react';

import { Film, CheckCircle, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { useCreatorPaygPrice } from '@/hooks/usePublicPlans';

export default function CinematicOnboarding({ onComplete }: { onComplete: () => void }) {
  const payg = useCreatorPaygPrice();

  const [step, setStep] = useState(0); 

  const [loadingText, setLoadingText] = useState('Initializing Vault Clusters...');

  const [progress, setProgress] = useState(0);

  // Step 0: The Cinema Intro & Simulated Backend Setup Progress Loop

  useEffect(() => {

    if (step === 0) {

      const timer = setInterval(() => {

        setProgress((oldProgress) => {

          if (oldProgress >= 100) {

            clearInterval(timer);

            setTimeout(() => setStep(1), 800); // Automatically slide to terms after loading finishes

            return 100;

          }

          

          // Dynamic mass text changes to make it look highly complex

          if (oldProgress === 30) setLoadingText('Syncing with C CLOUD Node-1...');

          if (oldProgress === 65) setLoadingText('Optimizing ProRes & RAW Pipeline...');

          if (oldProgress === 85) setLoadingText('Securing Nilavara Storage Layers...');

          

          return oldProgress + 5;

        });

      }, 150);

      return () => clearInterval(timer);

    }

  }, [step]);

  // Audio Playback Handler for the Success Screen

  const playSuccessSound = () => {

    try {

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

      const osc = ctx.createOscillator();

      const gain = ctx.createGain();

      

      osc.type = 'sine';

      // Deep Auspicious Temple Bell resonant frequency structure

      osc.frequency.setValueAtTime(240, ctx.currentTime); 

      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 1.5);

      

      gain.gain.setValueAtTime(0.5, ctx.currentTime);

      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);

      

      osc.connect(gain);

      gain.connect(ctx.destination);

      osc.start();

      osc.stop(ctx.currentTime + 2);

    } catch (e) {

      console.log("Audio couldn't auto-play due to browser flags:", e);

    }

  };

  useEffect(() => {

    if (step === 2) {

      playSuccessSound();

      // Simulate backend outbounding ping (WhatsApp/Email trigger event log)

      console.log("Kammattam Outbound Trigger: Dispatched production access welcome ping.");

    }

  }, [step]);

  return (

    <div className="fixed inset-0 bg-black text-zinc-100 flex items-center justify-center font-sans z-50 selection:bg-amber-500 selection:text-black">

      

      {/* STEP 0: THE CINEMATIC LOGO DROP & LOADING SCREEN */}

      {step === 0 && (

        <div className="text-center space-y-8 max-w-md px-6 animate-fade-in">

          <div className="relative inline-flex items-center justify-center p-5 bg-zinc-900 border border-zinc-800 rounded-full shadow-2xl">

            <Film className="w-12 h-12 text-amber-500 animate-pulse" />

          </div>

          

          <div className="space-y-2">

            <h1 className="text-3xl font-black tracking-widest text-zinc-100 uppercase">STREAMVISTA</h1>

            <p className="text-xs tracking-widest text-zinc-500 uppercase font-mono">Kammattam Storage Engine</p>

          </div>

          <div className="w-full bg-zinc-900 border border-zinc-800 h-2 rounded-full overflow-hidden">

            <div 

              className="bg-gradient-to-r from-amber-600 to-amber-400 h-full transition-all duration-150 rounded-full"

              style={{ width: `${progress}%` }}

            />

          </div>

          

          <p className="text-xs font-mono text-zinc-400 flex items-center justify-center gap-2">

            <Loader2 className="w-3 h-3 animate-spin text-amber-500" />

            {loadingText}

          </p>

        </div>

      )}

      {/* STEP 1: THE CONTRACT SIGN-OFF SERIES */}

      {step === 1 && (

        <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-2xl max-w-xl w-full mx-4 shadow-2xl space-y-6 border-t-2 border-t-amber-500 animate-fade-in">

          <div>

            <span className="text-xs font-bold text-amber-500 font-mono tracking-widest uppercase">Workspace Terms</span>

            <h2 className="text-2xl font-black tracking-tight text-white mt-1">Accept Production Terms</h2>

          </div>

          <div className="space-y-4 font-mono text-xs text-zinc-400">

            <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl flex items-start gap-3">

              <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />

              <div>

                <p className="text-zinc-200 font-bold uppercase text-xs">Nilavara A: Baseline Storage</p>

                <p className="mt-1 leading-relaxed">Your secure project workspace unlocks up to 1 TB of dedicated, localized scratch storage.</p>

              </div>

            </div>

            <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl flex items-start gap-3">

              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />

              <div>

                <p className="text-zinc-200 font-bold uppercase text-xs">Nilavara B: Automated Top-up</p>

                <p className="mt-1 leading-relaxed">Overage expands dynamically at {payg.totalLabel} per additional TB. No hard locks or interruption mid-render.</p>

              </div>

            </div>

            <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl flex items-start gap-3">

              <ShieldCheck className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />

              <div>

                <p className="text-zinc-200 font-bold uppercase text-xs">Nilavara C: 90/120 Day Inactivity Lifecycle</p>

                <p className="mt-1 leading-relaxed">Idle directories are flagged at 90 days. Total freeze and C CLOUD data cold-archiving takes place at 120 days.</p>

              </div>

            </div>

          </div>

          <button 

            onClick={() => setStep(2)}

            className="w-full bg-amber-500 hover:bg-amber-600 text-black py-4 rounded-xl font-bold text-sm tracking-wider flex items-center justify-center gap-2 group transition-all"

          >

            ACCEPT &amp; CONTINUE

            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />

          </button>

        </div>

      )}

      {/* STEP 2: OUTRO VICTORY SCREEN */}

      {step === 2 && (

        <div className="text-center space-y-6 max-w-md px-6 animate-fade-in">

          <div className="inline-flex items-center justify-center p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 shadow-xl shadow-emerald-950/20">

            <CheckCircle className="w-14 h-14" />

          </div>

          <div className="space-y-2">

            <h2 className="text-3xl font-black text-white tracking-tight">Workspace Ready</h2>

            <p className="text-zinc-400 text-sm max-w-xs mx-auto">

              Terms accepted. Continue to your control panel to set up your workspace.

            </p>

          </div>

          <div className="pt-4">

            <button

              onClick={onComplete}

              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all"

            >

              Enter Control Panel

            </button>

          </div>

        </div>

      )}

    </div>

  );

}