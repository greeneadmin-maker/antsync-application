import React, { useState, useEffect } from 'react';
import { Play, Pause, Check, Plus, Leaf, Clock, X, Quote, LogIn, LogOut, Bug } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User as FirebaseUser } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, onSnapshot, query, orderBy, serverTimestamp, getDoc, getDocFromServer } from 'firebase/firestore';

// --- DATA ARCHITECTURE ---

interface Task {
  id: string;
  userId: string;
  title: string;
  timeSpent: number; // in seconds
  estimatedTime: number; // in seconds
  isCompleted: boolean;
  createdAt: number;
}

interface UserProfile {
  userId: string;
  totalFood: number;
}

const VERSES = [
  "Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up.",
  "Commit your work to the Lord, and your plans will be established.",
  "The hardworking farmer should be the first to receive a share of the crops.",
  "Be still, and know that I am God.",
  "Those who plant in tears will harvest with shouts of joy.",
  "Whatever you do, work at it with all your heart.",
  "Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid."
];

const CrawlingAnts = () => {
  return (
    <div className="w-full max-w-xl mx-auto h-16 relative overflow-hidden mt-8 opacity-40 pointer-events-none">
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ x: -50, y: Math.sin(i) * 5 }}
          animate={{ x: 600, y: Math.sin(i * 2) * 5 }}
          transition={{
            duration: 12 + (i % 3) * 2, // Varies speed slightly
            repeat: Infinity,
            delay: i * 1.5,
            ease: "linear"
          }}
          className="absolute top-1/2 -translate-y-1/2 text-[#6F4E37]"
        >
          <Bug className="w-4 h-4 rotate-90" />
        </motion.div>
      ))}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('25');
  
  // Timer State
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [timerState, setTimerState] = useState<'idle' | 'running' | 'paused'>('idle');
  const [elapsedTime, setElapsedTime] = useState(0); 
  
  // Spirit Sync Modal State
  const [showSpiritSync, setShowSpiritSync] = useState(false);
  const [currentVerse, setCurrentVerse] = useState('');
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstall, setShowIOSInstall] = useState(false);

  // Install Prompt event listener
  useEffect(() => {
    // Check if it's iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Check if app is already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstall(true);
      return;
    }
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    if (outcome === 'accepted') {
      setInstallPromptEvent(null);
    }
  };

  // Firebase Error Handler
  const handleFirestoreError = (error: unknown, operationType: string, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  };

  // Auth and Data Fetching
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch or create user profile
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDocFromServer(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              userId: currentUser.uid,
              totalFood: 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
          
          // Listen to user profile
          const unsubUser = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
              setUserProfile(docSnap.data() as UserProfile);
            }
          }, (error) => handleFirestoreError(error, 'get', `users/${currentUser.uid}`));

          // Listen to tasks
          const tasksQuery = query(
            collection(db, `users/${currentUser.uid}/tasks`), 
            orderBy('createdAt', 'desc')
          );
          const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
            const fetchedTasks: Task[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              fetchedTasks.push({
                id: doc.id,
                userId: data.userId,
                title: data.title,
                timeSpent: data.timeSpent || 0,
                estimatedTime: data.estimatedTime || 0,
                isCompleted: data.isCompleted,
                createdAt: data.createdAt?.toMillis() || Date.now(),
              });
            });
            setTasks(fetchedTasks);
          }, (error) => handleFirestoreError(error, 'list', `users/${currentUser.uid}/tasks`));

          setLoading(false);
          return () => {
            unsubUser();
            unsubTasks();
          };
        } catch (error) {
          handleFirestoreError(error, 'get', `users/${currentUser.uid}`);
          setLoading(false);
        }
      } else {
        setTasks([]);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Timer Tick Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timerState === 'running') {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
        
        // Also update local task state to reflect time ticking without hitting firestore every second
        if (activeTaskId) {
           setTasks(prevTasks => 
             prevTasks.map(t => {
               if (t.id === activeTaskId) {
                 const newTimeSpent = t.timeSpent + 1;
                 
                 // Notifications check
                 if ('Notification' in window && Notification.permission === 'granted') {
                   // When the timer is exactly 60 seconds from ending
                   if (t.estimatedTime > 60 && newTimeSpent === t.estimatedTime - 60) {
                     new Notification('Task almost due!', {
                       body: `You have 1 minute left for "${t.title}"`,
                     });
                   }
                   // When the timer is due 
                   if (newTimeSpent === t.estimatedTime) {
                     new Notification('Task Due Tracker', {
                       body: `Time is up for "${t.title}"!`,
                     });
                   }
                 }
                 
                 return { ...t, timeSpent: newTimeSpent };
               }
               return t;
             })
           );
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerState, activeTaskId]);

  const login = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed", error);
      let message = error.message;
      if (error.code === 'auth/unauthorized-domain') {
        message = "This domain is not authorized in Firebase. Please add this URL to 'Authorized Domains' in the Firebase Console (Authentication > Settings).";
      } else if (error.code === 'auth/popup-blocked') {
        message = "Sign-in popup was blocked by your browser. Please allow popups for this site.";
      }
      setAuthError(message);
    }
  };

  const logout = () => {
    if (timerState === 'running') setTimerState('paused');
    signOut(auth);
  };

  const handlePlantSeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !user) return;
    
    const newTaskId = crypto.randomUUID();
    const taskData = {
      userId: user.uid,
      title: newTaskTitle.trim(),
      timeSpent: 0,
      estimatedTime: parseInt(newTaskTime, 10) * 60 || 1500, // default 25 min
      isCompleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    try {
      await setDoc(doc(db, `users/${user.uid}/tasks`, newTaskId), taskData);
      setNewTaskTitle('');
    } catch (error) {
      handleFirestoreError(error, 'create', `users/${user.uid}/tasks/${newTaskId}`);
    }
  };

  const saveTaskTime = async (taskId: string, forceComplete = false) => {
    if (!user) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    try {
      if (forceComplete) {
         // Also update user profile with new food (1 crumb per minute, minimum 1 if > 0 seconds)
         const minutesSpent = Math.max(0, Math.ceil(task.timeSpent / 60));
         const userRef = doc(db, 'users', user.uid);
         const currentUserSnap = await getDoc(userRef);
         if (currentUserSnap.exists()) {
           const currentFood = currentUserSnap.data().totalFood || 0;
           await updateDoc(userRef, {
             totalFood: currentFood + minutesSpent,
             updatedAt: serverTimestamp()
           });
         }

         await updateDoc(doc(db, `users/${user.uid}/tasks`, taskId), {
           isCompleted: true,
           timeSpent: task.timeSpent,
           updatedAt: serverTimestamp()
         });
      } else {
         await updateDoc(doc(db, `users/${user.uid}/tasks`, taskId), {
           timeSpent: task.timeSpent,
           updatedAt: serverTimestamp()
         });
      }
    } catch (error) {
       handleFirestoreError(error, 'update', `users/${user.uid}/tasks/${taskId}`);
    }
  };

  const handleSelectTask = async (taskId: string) => {
    if (activeTaskId && timerState === 'running') {
      setTimerState('paused');
      await saveTaskTime(activeTaskId);
    } else if (activeTaskId && activeTaskId !== taskId) {
      await saveTaskTime(activeTaskId);
    }
    setActiveTaskId(taskId);
    setElapsedTime(0);
    setTimerState('idle');
  };

  const triggerSpiritSync = () => {
    const randomVerse = VERSES[Math.floor(Math.random() * VERSES.length)];
    setCurrentVerse(randomVerse);
    setShowSpiritSync(true);
  };

  const toggleTimer = async () => {
    if (timerState === 'running') {
      setTimerState('paused');
      if (activeTaskId) await saveTaskTime(activeTaskId);
      triggerSpiritSync();
    } else {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      setTimerState('running');
    }
  };

  const completeTask = async (taskId: string) => {
    await saveTaskTime(taskId, true);
    if (activeTaskId === taskId) {
      setTimerState('idle');
      setActiveTaskId(null);
      setElapsedTime(0);
    }
    triggerSpiritSync();
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
     return <div className="min-h-screen flex items-center justify-center bg-[#F9F8F6] text-[#7D9A7A]"><Leaf className="w-8 h-8 animate-pulse" /></div>;
  }

  const activeTask = tasks.find(t => t.id === activeTaskId);
  const pendingTasks = tasks.filter(t => !t.isCompleted);
  const completedTasks = tasks.filter(t => t.isCompleted);

  return (
    <div className="min-h-screen font-sans flex flex-col items-center py-12 px-4 selection:bg-[#7D9A7A] selection:text-white">
      
      {/* Header */}
      <header className="mb-10 w-full max-w-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
          <Leaf className="w-8 h-8 text-[#7D9A7A]" />
          <div>
            <h1 className="text-3xl font-serif text-[#6F4E37] tracking-tight text-center sm:text-left">AntSync</h1>
            <p className="text-[#8B7E74] text-xs font-medium tracking-widest uppercase text-center sm:text-left">Grow at your own pace</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-3">
          {(!isStandalone && (installPromptEvent || isIOS)) && (
            <button 
              onClick={handleInstallClick} 
              className="bg-[#D4A373] text-white hover:bg-[#C29367] text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors shadow-sm"
            >
              Install App
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-4 border border-[#E5EFE4] bg-white rounded-full px-4 py-2 shadow-sm">
              <span className="text-[#8B7E74] text-sm hidden sm:inline-block">
                {user.email}
              </span>
              <button onClick={logout} className="text-[#A8A099] hover:text-[#6F4E37] transition-colors" title="Log out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={login} className="flex items-center gap-2 bg-[#7D9A7A] hover:bg-[#688265] text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm">
               <LogIn className="w-4 h-4" /> Start Growing
            </button>
          )}
        </div>
      </header>

      {user ? (
      <main className="w-full max-w-xl flex flex-col gap-8 relative">
        
        {/* Active Timer Section */}
        <AnimatePresence mode="popLayout">
          {activeTask && !activeTask.isCompleted && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#E5EFE4] text-center"
            >
              <h2 className="text-[#6F4E37] font-serif text-2xl mb-1">{activeTask.title}</h2>
              <p className="text-[#8B7E74] text-sm mb-6 flex items-center justify-center gap-1">
                <Clock className="w-4 h-4" /> actively tending
              </p>
              
              <div className="text-6xl font-sans font-semibold text-[#4A4A4A] tracking-tight mb-6">
                {activeTask.estimatedTime > 0 ? (
                  activeTask.timeSpent > activeTask.estimatedTime ? (
                    <span className="text-[#D4A373]">+{formatTime(activeTask.timeSpent - activeTask.estimatedTime)}</span>
                  ) : (
                    formatTime(activeTask.estimatedTime - activeTask.timeSpent)
                  )
                ) : (
                  formatTime(activeTask.timeSpent)
                )}
              </div>
              
              {activeTask.estimatedTime > 0 && (
                <div className="w-full max-w-xs mx-auto mb-8">
                  <div className="flex justify-between text-[10px] text-[#A8A099] mb-1 font-mono uppercase tracking-widest">
                    <span>Progress</span>
                    <span>{Math.floor((activeTask.timeSpent / activeTask.estimatedTime) * 100)}%</span>
                  </div>
                  <div className="h-3 bg-[#E5EFE4] rounded-full overflow-hidden relative shadow-inner">
                    <div 
                      className="absolute top-0 left-0 h-full bg-[#7D9A7A] transition-all duration-1000 ease-linear flex items-center justify-end pr-1 overflow-hidden"
                      style={{ width: `${Math.min(100, (activeTask.timeSpent / activeTask.estimatedTime) * 100)}%` }}
                    >
                      <div className="flex items-center gap-1 opacity-80">
                        {timerState === 'running' && (
                          <>
                            <motion.div animate={{ rotate: [-10, 10, -10] }} transition={{ repeat: Infinity, duration: 0.3, delay: 0.2 }}>
                              <Bug className="w-2 h-2 text-[#E5EFE4]" />
                            </motion.div>
                            <motion.div animate={{ rotate: [-10, 10, -10] }} transition={{ repeat: Infinity, duration: 0.3, delay: 0.1 }}>
                              <Bug className="w-2 h-2 text-[#E5EFE4]" />
                            </motion.div>
                          </>
                        )}
                        <motion.div 
                          animate={{ rotate: timerState === 'running' ? [-15, 15, -15] : 0 }} 
                          transition={{ repeat: Infinity, duration: 0.3 }}
                        >
                          <Bug className="w-3 h-3 text-white" />
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={toggleTimer}
                  className={`flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 shadow-sm ${
                    timerState === 'running' 
                      ? 'bg-[#FDF4E3] text-[#D4A373] hover:bg-[#F9E8CD]' 
                      : 'bg-[#7D9A7A] text-white hover:bg-[#688265]'
                  }`}
                >
                  {timerState === 'running' ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 ml-1 fill-current" />}
                </button>
                
                <button
                  onClick={() => completeTask(activeTask.id)}
                  className="flex items-center justify-center w-16 h-16 rounded-full bg-[#E5EFE4] text-[#7D9A7A] hover:bg-[#D5E5D4] transition-all duration-300 shadow-sm"
                  title="Harvest (Complete)"
                >
                  <Check className="w-6 h-6 stroke-[3]" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The Anthill (Stats) */}
        {userProfile && (
          <div className="bg-[#6F4E37] text-[#FDF4E3] rounded-3xl p-6 shadow-lg relative overflow-hidden">
             <div className="absolute -bottom-4 -right-4 opacity-10">
               <Bug className="w-32 h-32" />
             </div>
             <div className="relative z-10 flex items-center justify-between">
                <div>
                  <h3 className="text-xs uppercase tracking-widest text-[#D4AA7D] font-bold mb-1">The Anthill</h3>
                  <p className="text-sm text-[#E5D3B3] max-w-[200px] leading-relaxed">
                    Hard work brings a harvest. Time spent translates to food stored.
                  </p>
                </div>
                <div className="text-center bg-[#5A3F2C] p-4 rounded-2xl border border-[#7A5A43]">
                   <div className="text-3xl font-serif text-[#FDF4E3] mb-1">{userProfile.totalFood}</div>
                   <div className="text-[10px] uppercase font-bold text-[#D4AA7D] tracking-widest">Crumbs</div>
                </div>
             </div>
          </div>
        )}

        {/* The Garden Dashboard */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white/50">
          <form onSubmit={handlePlantSeed} className="flex gap-3 mb-8 flex-wrap sm:flex-nowrap">
            <input
              type="text"
              placeholder="What seed will you plant today?"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="flex-1 min-w-[200px] bg-[#F9F8F6] border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-[#7D9A7A]/30 outline-none text-[#4A4A4A] placeholder:text-[#A8A099] transition-all shadow-inner"
            />
            <div className="flex gap-3">
              <input
                type="number"
                min="1"
                placeholder="25"
                value={newTaskTime}
                onChange={(e) => setNewTaskTime(e.target.value)}
                className="w-20 bg-[#F9F8F6] border-none rounded-2xl px-4 py-4 focus:ring-2 focus:ring-[#7D9A7A]/30 outline-none text-[#4A4A4A] text-center transition-all shadow-inner"
                title="Estimated time in minutes"
              />
              <button
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="bg-[#6F4E37] hover:bg-[#5A3F2C] text-white rounded-2xl px-6 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </form>

          <div className="space-y-6">
            {/* Pending Tasks */}
            <div>
              <h3 className="text-xs font-bold text-[#A8A099] uppercase tracking-wider mb-4 px-2">Your Garden</h3>
              {pendingTasks.length === 0 ? (
                <div className="text-center py-8 text-[#A8A099] border-2 border-dashed border-[#E5EFE4] rounded-2xl bg-white/50">
                  <p>Your garden is resting. Plant a seed to begin.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  <AnimatePresence initial={false}>
                    {pendingTasks.map(task => (
                      <motion.li
                        key={task.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`group flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                          activeTaskId === task.id 
                            ? 'bg-[#F4F9F4] border-[#7D9A7A] shadow-md' 
                            : 'bg-white border-transparent hover:border-[#E5EFE4] hover:shadow-sm'
                        }`}
                        onClick={() => handleSelectTask(task.id)}
                      >
                        <div className="flex flex-col">
                          <span className={`font-medium ${activeTaskId === task.id ? 'text-[#6F4E37]' : 'text-[#4A4A4A]'}`}>
                            {task.title}
                          </span>
                          <span className="text-xs text-[#A8A099] font-mono mt-1">
                            {formatTime(task.timeSpent)} {task.estimatedTime > 0 && `/ ${formatTime(task.estimatedTime)}`} spent
                          </span>
                        </div>
                        {activeTaskId !== task.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              completeTask(task.id);
                            }}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[#A8A099] hover:bg-[#E5EFE4] hover:text-[#7D9A7A] opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {/* Harvested (Completed) Tasks */}
            {completedTasks.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center justify-between px-2 mb-4">
                  <h3 className="text-xs font-bold text-[#A8A099] uppercase tracking-wider">The Harvest</h3>
                  <span className="text-xs font-mono text-[#A8A099]">{completedTasks.length} tasks</span>
                </div>
                <ul className="space-y-2 opacity-60 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {completedTasks.map(task => (
                    <li key={task.id} className="flex items-center justify-between p-4 rounded-2xl bg-[#F9F8F6] border border-transparent">
                      <span className="line-through text-[#8B7E74]">{task.title}</span>
                      <div className="flex items-center gap-3">
                         <span className="text-[10px] text-[#A8A099] uppercase tracking-widest">{Math.max(0, Math.ceil(task.timeSpent / 60))} crumbs</span>
                         <span className="text-xs text-[#A8A099] font-mono">{formatTime(task.timeSpent)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

      </main>
      ) : (
         <main className="w-full max-w-xl text-center py-20">
           <div className="bg-white p-12 rounded-3xl shadow-xl border border-[#E5EFE4] relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-[#FDF4E3] rounded-bl-full opacity-40"></div>
             <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#E5EFE4] rounded-tr-full opacity-40"></div>
             
             <Leaf className="w-16 h-16 text-[#7D9A7A] mx-auto mb-6" />
             <h2 className="text-3xl font-serif text-[#6F4E37] mb-4">AntSync - Beta Application</h2>
             <p className="text-[#8B7E74] mb-8 max-w-md mx-auto leading-relaxed">
               AntSync helps you plant seeds of productivity. Track your time, earn crumbs for your anthill, and sync your spirit with peaceful moments of reflection.
             </p>
             
             {authError && (
               <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm">
                 <p className="font-semibold mb-1">Sign-in Error:</p>
                 {authError}
               </div>
             )}

             <button onClick={login} className="bg-[#6F4E37] hover:bg-[#5A3F2C] text-white px-8 py-3 rounded-full font-medium transition-all shadow-lg transform hover:-translate-y-0.5 inline-flex items-center gap-2">
                <LogIn className="w-5 h-5" /> Sign in with Google
             </button>
           </div>
           
           <CrawlingAnts />
         </main>
      )}

      {/* Spirit Sync Modal overlay */}
      <AnimatePresence>
        {showSpiritSync && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#F9F8F6]/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-8 md:p-12 rounded-[3.5rem] max-w-lg w-full shadow-[0_20px_60px_rgb(111,78,55,0.1)] relative border border-[#E5EFE4] overflow-hidden"
            >
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#FDF4E3] rounded-full opacity-30"></div>
              
              <button 
                onClick={() => setShowSpiritSync(false)}
                className="absolute top-8 right-8 text-[#A8A099] hover:text-[#4A4A4A] transition-colors bg-white/50 rounded-full p-2 hover:bg-[#F9F8F6]"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex flex-col items-center text-center space-y-6 relative z-10">
                <div className="w-16 h-16 bg-[#FDF4E3] rounded-full flex items-center justify-center text-[#D4A373] shadow-inner mb-2">
                  <Quote className="w-6 h-6 fill-current" />
                </div>
                
                <h3 className="text-xs font-bold text-[#7D9A7A] uppercase tracking-widest">Spirit Sync</h3>
                
                <p className="text-2xl md:text-3xl font-serif text-[#6F4E37] leading-tight px-4">
                  "{currentVerse}"
                </p>
                
                <button
                  onClick={() => setShowSpiritSync(false)}
                  className="mt-8 px-10 py-4 bg-[#7D9A7A] text-white rounded-full font-medium hover:bg-[#688265] transition-all transform hover:scale-105 active:scale-95 shadow-xl shadow-[#7D9A7A]/20 uppercase tracking-wide text-sm"
                >
                  Amen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showIOSInstall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowIOSInstall(false)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl w-full max-w-sm border border-[#E5EFE4] relative sm:mb-0"
            >
              <button 
                onClick={() => setShowIOSInstall(false)}
                className="absolute top-4 right-4 text-[#A8A099] hover:text-[#4A4A4A] bg-[#F9F8F6] rounded-full p-1.5 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-[#E5EFE4] rounded-2xl flex items-center justify-center text-[#7D9A7A] mb-2 shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="5"/></svg>
                </div>
                
                <h3 className="text-xl font-serif text-[#6F4E37]">Install AntSync</h3>
                
                <div className="text-[#8B7E74] text-sm space-y-4 pt-2">
                  <p>Install this application on your home screen for quick and easy access when you're on the go.</p>
                  
                  <div className="bg-[#F9F8F6] p-4 rounded-2xl border border-[#E5EFE4] text-left">
                    <ol className="list-decimal list-inside space-y-2 text-[#6F4E37]">
                      <li className="flex items-center gap-2">
                        <span>Tap the <strong>Share</strong> button</span>
                        <svg className="w-5 h-5 text-[#8B7E74] ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                      </li>
                      <li className="flex items-center gap-2 border-t border-[#E5EFE4] pt-2">
                         <span>Select <strong>Add to Home Screen</strong></span>
                         <Plus className="w-5 h-5 text-[#8B7E74] ml-auto shrink-0" />
                      </li>
                    </ol>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowIOSInstall(false)}
                  className="w-full mt-4 py-3 bg-[#7D9A7A] hover:bg-[#688265] text-white rounded-xl font-medium transition-colors"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-auto pt-16 pb-4 w-full text-center flex flex-col items-center justify-center opacity-70">
        <p className="text-xs font-medium tracking-wide text-[#8B7E74]">Coded and Developed by siejeihyung.digital</p>
        <p className="text-[10px] uppercase tracking-widest text-[#A8A099] mt-1 hover:text-[#7D9A7A] transition-colors">All Rights Reserved</p>
      </footer>
    </div>
  );
}


