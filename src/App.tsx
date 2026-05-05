import React, { useState, useEffect } from 'react';
import { Play, Pause, Check, Plus, Leaf, Clock, X, Quote, LogIn, LogOut, Bug, Maximize2, Minimize2, Medal, Target, Shield, Crown, MessageSquare, Star, Gift } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, User as FirebaseUser } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, onSnapshot, query, orderBy, serverTimestamp, getDoc, getDocFromServer, addDoc } from 'firebase/firestore';

// --- DATA ARCHITECTURE ---

interface Task {
  id: string;
  userId: string;
  title: string;
  timeSpent: number; // in seconds
  estimatedTime: number; // in seconds
  isCompleted: boolean;
  createdAt: number;
  updatedAt: number;
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
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  
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
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Feedback State
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    rating: 5,
    useCase: '',
    bestFeature: '',
    painPoint: '',
    zenModeFeedback: '',
    themeFeedback: '',
    desiredFeatures: '',
    dailyUseFactor: '',
    bugs: '',
    additionalComments: ''
  });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [lastFeedbackId, setLastFeedbackId] = useState<string | null>(null);

  // Reward State
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [canvaEmail, setCanvaEmail] = useState('');
  const [submittingReward, setSubmittingReward] = useState(false);
  const [rewardSuccess, setRewardSuccess] = useState(false);

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
    if (installPromptEvent) {
      installPromptEvent.prompt();
      const { outcome } = await installPromptEvent.userChoice;
      if (outcome === 'accepted') {
        setInstallPromptEvent(null);
      }
    } else {
      setShowInstallDialog(true);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setSubmittingFeedback(true);
    try {
      const docRef = await addDoc(collection(db, 'feedback'), {
        userId: user.uid,
        ...feedbackForm,
        createdAt: serverTimestamp()
      });
      setLastFeedbackId(docRef.id);
      setFeedbackSuccess(true);
      
      // After 2 seconds, show the reward modal
      setTimeout(() => {
        setShowFeedback(false);
        setFeedbackSuccess(false);
        setShowRewardModal(true);
        setFeedbackForm({
          rating: 5,
          useCase: '',
          bestFeature: '',
          painPoint: '',
          zenModeFeedback: '',
          themeFeedback: '',
          desiredFeatures: '',
          dailyUseFactor: '',
          bugs: '',
          additionalComments: ''
        });
      }, 2000);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleClaimReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !lastFeedbackId || !canvaEmail) return;

    setSubmittingReward(true);
    try {
      await addDoc(collection(db, 'rewards'), {
        userId: user.uid,
        feedbackId: lastFeedbackId,
        canvaEmail: canvaEmail,
        createdAt: serverTimestamp()
      });
      setRewardSuccess(true);
      setTimeout(() => {
        setShowRewardModal(false);
        setRewardSuccess(false);
        setCanvaEmail('');
      }, 3000);
    } catch (error) {
      console.error("Error claiming reward:", error);
      alert("Failed to claim reward. Please try again.");
    } finally {
      setSubmittingReward(false);
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
    let unsubUser: (() => void) | null = null;
    let unsubTasks: (() => void) | null = null;

    const cleanupListeners = () => {
      if (unsubUser) { unsubUser(); unsubUser = null; }
      if (unsubTasks) { unsubTasks(); unsubTasks = null; }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        cleanupListeners(); // ensure previous are cleaned just in case
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
          unsubUser = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
              setUserProfile(docSnap.data() as UserProfile);
            }
          }, (error) => handleFirestoreError(error, 'get', `users/${currentUser.uid}`));

          // Listen to tasks
          const tasksQuery = query(
            collection(db, `users/${currentUser.uid}/tasks`), 
            orderBy('createdAt', 'desc')
          );
          unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
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
                updatedAt: data.updatedAt?.toMillis() || Date.now(),
              });
            });
            setTasks(fetchedTasks);
          }, (error) => handleFirestoreError(error, 'list', `users/${currentUser.uid}/tasks`));

          setLoading(false);
        } catch (error) {
          handleFirestoreError(error, 'get', `users/${currentUser.uid}`);
          setLoading(false);
        }
      } else {
        cleanupListeners();
        setTasks([]);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      cleanupListeners();
      unsubscribeAuth();
    };
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
      if (error.code === 'auth/popup-closed-by-user') {
        return;
      }
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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
    } catch (error: any) {
      console.error("Auth failed", error);
      let message = error.message;
      if (error.code === 'auth/email-already-in-use') {
         message = 'Email is already in use.';
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
         message = 'Invalid email or password.';
      } else if (error.code === 'auth/wrong-password') {
         message = 'Incorrect password.';
      } else if (error.code === 'auth/operation-not-allowed') {
         message = 'Email/Password sign-in is not enabled. Please enable it in the Firebase Console (Authentication > Sign-in method).';
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

  const formatTimeLarge = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    if (h > 0) {
      return (
        <span className="flex items-baseline justify-center">
          <span>{h}</span><span className="text-3xl ml-1 mr-3 text-[#A8A099] font-medium tracking-normal">h</span>
          <span>{m.toString().padStart(2, '0')}</span><span className="text-3xl ml-1 mr-3 text-[#A8A099] font-medium tracking-normal">m</span>
          <span>{s.toString().padStart(2, '0')}</span><span className="text-3xl ml-1 text-[#A8A099] font-medium tracking-normal">s</span>
        </span>
      );
    }
    return (
      <span className="flex items-baseline justify-center">
        <span>{m.toString().padStart(2, '0')}</span><span className="text-3xl ml-1 mr-3 text-[#A8A099] font-medium tracking-normal">m</span>
        <span>{s.toString().padStart(2, '0')}</span><span className="text-3xl ml-1 text-[#A8A099] font-medium tracking-normal">s</span>
      </span>
    );
  };

  const formatTimeSmall = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    if (h > 0) {
      return (
        <span className="inline-flex items-baseline">
          <span>{h}</span><span className="text-[10px] ml-0.5 mr-1 font-sans text-[#A8A099] tracking-normal">h</span>
          <span>{m}</span><span className="text-[10px] ml-0.5 mr-1 font-sans text-[#A8A099] tracking-normal">m</span>
          <span>{s}</span><span className="text-[10px] ml-0.5 font-sans text-[#A8A099] tracking-normal">s</span>
        </span>
      );
    }
    if (m > 0) {
      return (
        <span className="inline-flex items-baseline">
          <span>{m}</span><span className="text-[10px] ml-0.5 mr-1 font-sans text-[#A8A099] tracking-normal">m</span>
          <span>{s}</span><span className="text-[10px] ml-0.5 font-sans text-[#A8A099] tracking-normal">s</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-baseline">
        <span>{s}</span><span className="text-[10px] ml-0.5 font-sans text-[#A8A099] tracking-normal">s</span>
      </span>
    );
  };

  const activeTask = tasks.find(t => t.id === activeTaskId);
  const pendingTasks = tasks.filter(t => !t.isCompleted);
  const completedTasks = tasks.filter(t => t.isCompleted);

  const getColonyRank = (crumbs: number) => {
    if (crumbs < 50) return 'Lone Forager';
    if (crumbs < 150) return 'Scout Ant';
    if (crumbs < 350) return 'Worker Ant';
    if (crumbs < 700) return 'Soldier Ant';
    if (crumbs < 1200) return 'Queen\'s Guard';
    return 'Colony Builder';
  };

  const getRankIcon = (crumbs: number) => {
    if (crumbs < 50) return <Leaf className="w-5 h-5 text-[#8B7E74]" />;
    if (crumbs < 150) return <Target className="w-5 h-5 text-[#7D9A7A]" />;
    if (crumbs < 350) return <Bug className="w-5 h-5 text-[#6F4E37]" />;
    if (crumbs < 700) return <Shield className="w-5 h-5 text-[#D4A373]" />;
    if (crumbs < 1200) return <Medal className="w-5 h-5 text-[#E5D3B3]" />;
    return <Crown className="w-5 h-5 text-[#F5E6CC]" />;
  };

  const getDailyCrumbs = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return completedTasks
      .filter(t => t.updatedAt >= today.getTime())
      .reduce((acc, task) => acc + Math.max(0, Math.ceil(task.timeSpent / 60)), 0);
  };

  if (loading) {
     return <div className="min-h-screen flex items-center justify-center bg-[#F9F8F6] text-[#7D9A7A]"><Leaf className="w-8 h-8 animate-pulse" /></div>;
  }

  return (
    <div className="min-h-screen font-sans flex flex-col items-center py-12 px-4 selection:bg-[#7D9A7A] selection:text-white">
      
      {/* Header */}
      {!isZenMode && (
      <header className="mb-10 w-full max-w-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-3 justify-center sm:justify-start">
            <Leaf className="w-8 h-8 text-[#7D9A7A]" />
            <div>
              <h1 className="text-3xl font-serif text-[#6F4E37] tracking-tight text-center sm:text-left">AntSync</h1>
              <p className="text-[#8B7E74] text-[10px] font-bold tracking-[0.2em] uppercase text-center sm:text-left">Grow Together</p>
            </div>
          </div>
          
          {user && (
            <div className="h-8 w-[1px] bg-[#E5EFE4] hidden sm:block"></div>
          )}

          {user && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-center sm:text-left"
            >
              <h3 className="text-sm font-medium text-[#6F4E37] leading-tight">
                {getGreeting()}, <span className="text-[#7D9A7A] font-bold">{user.displayName?.split(' ')[0] || 'Forager'}</span>
              </h3>
              <p className="text-[10px] text-[#A8A099] font-medium">Welcome back to the colony!</p>
            </motion.div>
          )}
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-3">
          {!isStandalone && (
            <button 
              onClick={handleInstallClick} 
              className="bg-[#D4A373] text-white hover:bg-[#C29367] text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors shadow-sm"
            >
              Install App
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-2 border border-[#E5EFE4] bg-white rounded-full p-2 shadow-sm">
              <button 
                onClick={logout} 
                className="text-[#A8A099] hover:text-red-500 transition-colors p-1" 
                title="Log out"
              >
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
      )}

      {user ? (
      <main className={`w-full max-w-xl flex flex-col gap-8 relative ${isZenMode ? 'flex-1 justify-center' : ''}`}>
        
        {/* Active Timer Section */}
        <AnimatePresence mode="popLayout">
          {activeTask && !activeTask.isCompleted && (
            <motion.div
              layout
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`bg-white/95 backdrop-blur-md rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#E5EFE4] text-center transition-all duration-500 z-[60] ${
                isZenMode ? 'fixed inset-0 flex flex-col justify-center items-center w-full h-full rounded-none md:p-24' : ''
              }`}
            >
              <h2 className={`text-[#6F4E37] font-serif mb-1 transition-all ${isZenMode ? 'text-4xl md:text-6xl mb-4' : 'text-2xl'}`}>{activeTask.title}</h2>
              <p className={`text-[#8B7E74] mb-6 flex items-center justify-center gap-2 transition-all ${isZenMode ? 'text-lg mb-12' : 'text-sm'}`}>
                <Clock className="w-4 h-4" /> actively tending
              </p>
              
              <div className={`font-sans font-semibold text-[#4A4A4A] tracking-tight mb-6 transition-all ${isZenMode ? 'text-8xl md:text-9xl mb-16' : 'text-6xl'}`}>
                {activeTask.estimatedTime > 0 ? (
                  activeTask.timeSpent > activeTask.estimatedTime ? (
                    <span className="text-[#D4A373] flex items-center justify-center">
                      <span className="mr-1 inline-block pb-4">+</span>{formatTimeLarge(activeTask.timeSpent - activeTask.estimatedTime)}
                    </span>
                  ) : (
                    formatTimeLarge(activeTask.estimatedTime - activeTask.timeSpent)
                  )
                ) : (
                  formatTimeLarge(activeTask.timeSpent)
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

                <button
                  onClick={() => setIsZenMode(!isZenMode)}
                  className={`flex items-center justify-center w-12 h-12 rounded-full border border-[#E5EFE4] transition-all duration-300 ml-2 ${isZenMode ? 'bg-[#7D9A7A] text-white' : 'text-[#A8A099] hover:bg-[#F9F8F6] hover:text-[#7D9A7A]'}`}
                  title="Zen Focus Mode"
                >
                  {isZenMode ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The Anthill (Stats) */}
        {userProfile && (
          <div className="bg-[#6F4E37] text-[#FDF4E3] rounded-3xl p-6 sm:p-8 shadow-lg relative overflow-hidden flex flex-col gap-6">
             <div className="absolute -bottom-4 -right-4 opacity-10">
               <Bug className="w-48 h-48 sm:w-64 sm:h-64" />
             </div>
             
             <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-xs uppercase tracking-widest text-[#D4AA7D] font-bold mb-2">Colony Status</h3>
                  <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                    <div className="bg-[#5A3F2C] p-2.5 rounded-xl border border-[#7A5A43]">
                      {getRankIcon(userProfile.totalFood)}
                    </div>
                    <div className="text-2xl font-serif text-[#FDF4E3]">
                      {getColonyRank(userProfile.totalFood)}
                    </div>
                  </div>
                  <p className="text-sm text-[#E5D3B3] leading-relaxed">
                    Hard work brings a harvest. Your dedication makes the colony stronger.
                  </p>
                </div>
                
                <div className="flex gap-4 w-full sm:w-auto">
                  <div className="flex-1 sm:flex-none text-center bg-[#5A3F2C] p-4 rounded-2xl border border-[#7A5A43] min-w-[100px]">
                     <div className="text-3xl font-serif text-[#FDF4E3] mb-1">{userProfile.totalFood}</div>
                     <div className="text-[10px] uppercase font-bold text-[#D4AA7D] tracking-widest">Total Crumbs</div>
                  </div>
                  <div className="flex-1 sm:flex-none text-center bg-[#5A3F2C]/50 p-4 rounded-2xl border border-[#7A5A43]/50 min-w-[100px] relative overflow-hidden">
                     {/* Daily progress background fill */}
                     <div 
                       className="absolute bottom-0 left-0 w-full bg-[#7D9A7A]/20 transition-all duration-1000 ease-out"
                       style={{ height: `${Math.min(100, (getDailyCrumbs() / 50) * 100)}%` }}
                     />
                     <div className="relative z-10">
                       <div className="text-3xl font-serif text-[#FDF4E3] mb-1">{getDailyCrumbs()}</div>
                       <div className="text-[10px] uppercase font-bold text-[#D4AA7D] tracking-widest">Today's Crumbs</div>
                     </div>
                  </div>
                </div>
             </div>

             <div className="relative z-10 bg-[#5A3F2C]/30 rounded-xl p-4 border border-[#7A5A43]/30">
               <div className="flex justify-between text-[10px] uppercase font-bold text-[#D4AA7D] tracking-widest mb-2">
                 <span>Daily Foraging Goal</span>
                 <span>{Math.min(50, getDailyCrumbs())} / 50</span>
               </div>
               <div className="h-2 bg-[#5A3F2C] rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-[#D4AA7D] rounded-full transition-all duration-1000 ease-out" 
                   style={{ width: `${Math.min(100, (getDailyCrumbs() / 50) * 100)}%` }}
                 />
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
                          <span className="text-xs text-[#A8A099] font-mono mt-1 inline-flex items-center gap-1">
                            {formatTimeSmall(task.timeSpent)} {task.estimatedTime > 0 && <><span className="mx-0.5">/</span> {formatTimeSmall(task.estimatedTime)}</>} <span className="ml-1 tracking-wider uppercase text-[9px]">spent</span>
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
                         <span className="text-xs text-[#A8A099] font-mono inline-flex items-center">{formatTimeSmall(task.timeSpent)}</span>
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
         <main className="w-full max-w-xl text-center py-10 px-4">
           <div className="bg-white p-8 sm:p-12 rounded-3xl shadow-xl border border-[#E5EFE4] relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-[#FDF4E3] rounded-bl-full opacity-40"></div>
             <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#E5EFE4] rounded-tr-full opacity-40"></div>
             
             <Leaf className="w-16 h-16 text-[#7D9A7A] mx-auto mb-6 relative z-10" />
             <h2 className="text-3xl font-serif text-[#6F4E37] mb-4 relative z-10">AntSync - Beta Application</h2>
             <p className="text-[#8B7E74] mb-8 max-w-sm mx-auto leading-relaxed relative z-10">
               AntSync helps you plant seeds of productivity. Track your time, earn crumbs for your anthill, and sync your spirit with peaceful moments of reflection.
             </p>
             
             {authError && (
               <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm relative z-10">
                 <p className="font-semibold mb-1">Sign-in Error:</p>
                 {authError}
               </div>
             )}

             <form onSubmit={handleEmailAuth} className="flex flex-col gap-4 relative z-10 max-w-xs mx-auto">
               <input
                 type="email"
                 placeholder="Email Address"
                 value={authEmail}
                 onChange={(e) => setAuthEmail(e.target.value)}
                 required
                 className="w-full bg-[#F9F8F6] border border-[#E5EFE4] text-[#6F4E37] px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#7D9A7A] focus:border-transparent transition-all placeholder:text-[#A8A099]"
               />
               <input
                 type="password"
                 placeholder="Password"
                 value={authPassword}
                 onChange={(e) => setAuthPassword(e.target.value)}
                 required
                 minLength={6}
                 className="w-full bg-[#F9F8F6] border border-[#E5EFE4] text-[#6F4E37] px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#7D9A7A] focus:border-transparent transition-all placeholder:text-[#A8A099]"
               />
               
               <button type="submit" className="w-full bg-[#7D9A7A] hover:bg-[#688265] text-white px-8 py-3 rounded-2xl font-medium transition-all shadow-lg transform hover:-translate-y-0.5 inline-flex items-center justify-center gap-2 mt-2">
                  <LogIn className="w-5 h-5" /> {isSignUp ? 'Sign Up' : 'Log In'}
               </button>
             </form>

             <div className="mt-8 relative z-10 flex flex-col items-center gap-4">
                <button 
                 type="button"
                 onClick={() => {
                   setIsSignUp(!isSignUp);
                   setAuthError(null);
                 }}
                 className="text-sm font-medium tracking-wide text-[#8B7E74] hover:text-[#7D9A7A] transition-colors"
                >
                  {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
                </button>

                <div className="flex items-center w-full max-w-xs mx-auto my-2 opacity-50">
                  <div className="flex-1 h-px bg-[#E5EFE4]"></div>
                  <span className="px-2 text-xs font-medium text-[#A8A099] uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-[#E5EFE4]"></div>
                </div>

                <button onClick={login} type="button" className="bg-white border text-sm border-[#E5EFE4] hover:bg-[#F9F8F6] text-[#6F4E37] px-8 py-2.5 rounded-full font-medium transition-all inline-flex items-center gap-2 shadow-sm">
                   Continue with Google
                </button>
             </div>
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
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-[#FDF4E3] rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-[#E5D3B3] relative"
            >
              <div className="p-6 border-b border-[#E5D3B3] flex items-center justify-between sticky top-0 bg-[#FDF4E3] z-10 shrink-0">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#6F4E37]" />
                  <h3 className="font-serif text-2xl text-[#6F4E37]">Feedback</h3>
                </div>
                <button 
                  onClick={() => setShowFeedback(false)}
                  className="text-[#A8A099] hover:text-[#4A4A4A] bg-[#F9F8F6] rounded-full p-2 transition-colors border border-[#E5EFE4]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar text-sm space-y-6">
                {feedbackSuccess ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                    <div className="w-16 h-16 bg-[#7D9A7A] rounded-full flex items-center justify-center mb-4">
                      <Check className="w-8 h-8 text-white" />
                    </div>
                    <h4 className="text-2xl font-serif text-[#6F4E37] mb-2">Thank You!</h4>
                    <p className="text-[#8B7E74]">Your feedback helps the colony grow stronger.</p>
                  </div>
                ) : (
                  <form id="feedback-form" onSubmit={handleFeedbackSubmit} className="space-y-6 flex-1 text-[#4A4A4A]">
                    {/* 1. Rating */}
                    <div className="space-y-3">
                      <label className="block font-medium text-[#6F4E37] text-base">1. How would you rate your overall experience with AntSync?</label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setFeedbackForm({...feedbackForm, rating: star})}
                            className={`p-2 rounded-xl transition-all ${feedbackForm.rating >= star ? 'text-[#D4A373]' : 'text-[#A8A099] opacity-50'}`}
                          >
                            <Star className={`w-8 h-8 ${feedbackForm.rating >= star ? 'fill-current' : ''}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* 2. Use Case */}
                    <div className="space-y-2">
                      <label className="block font-medium text-[#6F4E37]">2. What do you primarily use AntSync for?</label>
                      <input 
                        type="text" 
                        value={feedbackForm.useCase}
                        onChange={(e) => setFeedbackForm({...feedbackForm, useCase: e.target.value})}
                        className="w-full bg-white border border-[#E5EFE4] rounded-xl px-4 py-3 outline-none focus:border-[#7D9A7A] transition-colors focus:ring-2 focus:ring-[#7D9A7A]/20"
                        placeholder="e.g., studying, coding, reading..."
                      />
                    </div>
                    
                    {/* 3. Best Feature */}
                    <div className="space-y-2">
                      <label className="block font-medium text-[#6F4E37]">3. What is your favorite feature?</label>
                      <input 
                        type="text" 
                        value={feedbackForm.bestFeature}
                        onChange={(e) => setFeedbackForm({...feedbackForm, bestFeature: e.target.value})}
                        className="w-full bg-white border border-[#E5EFE4] rounded-xl px-4 py-3 outline-none focus:border-[#7D9A7A] transition-colors focus:ring-2 focus:ring-[#7D9A7A]/20"
                        placeholder="What do you like the most?"
                      />
                    </div>
                    
                    {/* 4. Pain Point */}
                    <div className="space-y-2">
                      <label className="block font-medium text-[#6F4E37]">4. What's the biggest pain point or challenge you've faced?</label>
                      <textarea 
                        value={feedbackForm.painPoint}
                        onChange={(e) => setFeedbackForm({...feedbackForm, painPoint: e.target.value})}
                        rows={2}
                        className="w-full bg-white border border-[#E5EFE4] rounded-xl px-4 py-3 outline-none focus:border-[#7D9A7A] transition-colors focus:ring-2 focus:ring-[#7D9A7A]/20 resize-none"
                        placeholder="Tell us what's frustrating..."
                      />
                    </div>
                    
                    {/* 5. Zen Mode */}
                    <div className="space-y-2">
                      <label className="block font-medium text-[#6F4E37]">5. Have you tried "Zen Mode"? How useful is it to you?</label>
                      <input 
                        type="text" 
                        value={feedbackForm.zenModeFeedback}
                        onChange={(e) => setFeedbackForm({...feedbackForm, zenModeFeedback: e.target.value})}
                        className="w-full bg-white border border-[#E5EFE4] rounded-xl px-4 py-3 outline-none focus:border-[#7D9A7A] transition-colors focus:ring-2 focus:ring-[#7D9A7A]/20"
                        placeholder="Your thoughts on full-screen focus..."
                      />
                    </div>
                    
                    {/* 6. Theme Feedback */}
                    <div className="space-y-2">
                      <label className="block font-medium text-[#6F4E37]">6. How do you like the overall Ant / Colony theme?</label>
                      <input 
                        type="text" 
                        value={feedbackForm.themeFeedback}
                        onChange={(e) => setFeedbackForm({...feedbackForm, themeFeedback: e.target.value})}
                        className="w-full bg-white border border-[#E5EFE4] rounded-xl px-4 py-3 outline-none focus:border-[#7D9A7A] transition-colors focus:ring-2 focus:ring-[#7D9A7A]/20"
                        placeholder="Suggestions for the ant theme..."
                      />
                    </div>
                    
                    {/* 7. Desired Features */}
                    <div className="space-y-2">
                      <label className="block font-medium text-[#6F4E37]">7. What is one feature you wish AntSync had?</label>
                      <textarea 
                        value={feedbackForm.desiredFeatures}
                        onChange={(e) => setFeedbackForm({...feedbackForm, desiredFeatures: e.target.value})}
                        rows={2}
                        className="w-full bg-white border border-[#E5EFE4] rounded-xl px-4 py-3 outline-none focus:border-[#7D9A7A] transition-colors focus:ring-2 focus:ring-[#7D9A7A]/20 resize-none"
                        placeholder="Share your ideas..."
                      />
                    </div>
                    
                    {/* 8. Daily Use Factor */}
                    <div className="space-y-2">
                      <label className="block font-medium text-[#6F4E37]">8. What would make you use this app every single day?</label>
                      <input 
                        type="text" 
                        value={feedbackForm.dailyUseFactor}
                        onChange={(e) => setFeedbackForm({...feedbackForm, dailyUseFactor: e.target.value})}
                        className="w-full bg-white border border-[#E5EFE4] rounded-xl px-4 py-3 outline-none focus:border-[#7D9A7A] transition-colors focus:ring-2 focus:ring-[#7D9A7A]/20"
                        placeholder="The specific feature or tweak..."
                      />
                    </div>
                    
                    {/* 9. Bugs */}
                    <div className="space-y-2">
                      <label className="block font-medium text-[#6F4E37]">9. Did you encounter any bugs? If so, please specify.</label>
                      <textarea 
                        value={feedbackForm.bugs}
                        onChange={(e) => setFeedbackForm({...feedbackForm, bugs: e.target.value})}
                        rows={2}
                        className="w-full bg-white border border-[#E5EFE4] rounded-xl px-4 py-3 outline-none focus:border-[#7D9A7A] transition-colors focus:ring-2 focus:ring-[#7D9A7A]/20 resize-none"
                        placeholder="Bugs, glitches, errors..."
                      />
                    </div>
                    
                    {/* 10. Additional Comments */}
                    <div className="space-y-2">
                      <label className="block font-medium text-[#6F4E37]">10. Any additional comments or suggestions?</label>
                      <textarea 
                        value={feedbackForm.additionalComments}
                        onChange={(e) => setFeedbackForm({...feedbackForm, additionalComments: e.target.value})}
                        rows={3}
                        className="w-full bg-white border border-[#E5EFE4] rounded-xl px-4 py-3 outline-none focus:border-[#7D9A7A] transition-colors focus:ring-2 focus:ring-[#7D9A7A]/20 resize-none"
                        placeholder="Anything else on your mind?"
                      />
                    </div>

                  </form>
                )}
              </div>
              
              {!feedbackSuccess && (
                <div className="p-6 border-t border-[#E5D3B3] bg-[#F9F8F6] shrink-0">
                  <button
                    form="feedback-form"
                    type="submit"
                    disabled={submittingFeedback}
                    className="w-full py-4 bg-[#7D9A7A] hover:bg-[#688265] text-white rounded-xl font-medium transition-all shadow shadow-[#7D9A7A]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                  >
                    {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRewardModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2rem] p-8 shadow-2xl w-full max-w-md border-4 border-[#7D9A7A] relative overflow-hidden"
            >
              {/* Decorative background elements */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#E5EFE4] rounded-full blur-3xl opacity-50" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#D4A373] rounded-full blur-3xl opacity-20" />

              <div className="relative z-10 text-center">
                <div className="w-20 h-20 bg-[#7D9A7A] rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3 shadow-lg">
                  <Gift className="w-10 h-10 text-white" />
                </div>

                <h3 className="text-3xl font-serif text-[#6F4E37] mb-3 leading-tight">Congratulations!</h3>
                <p className="text-[#8B7E74] mb-6">
                  We appreciate your feedback! As a reward, we're giving you a <strong className="text-[#7D9A7A]">free 1 Month Canva Subscription</strong>.
                </p>

                {rewardSuccess ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#E5EFE4] p-6 rounded-2xl border border-[#7D9A7A]/30"
                  >
                    <Check className="w-8 h-8 text-[#7D9A7A] mx-auto mb-2" />
                    <p className="text-[#6F4E37] font-medium">Claim request sent!</p>
                    <p className="text-xs text-[#8B7E74] mt-1">We'll reach out to your Canva email soon.</p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleClaimReward} className="space-y-4">
                    <div className="text-left">
                      <label className="block text-xs font-bold text-[#6F4E37] uppercase tracking-widest mb-2 ml-1">
                        Canva Email Account
                      </label>
                      <input 
                        type="email"
                        required
                        value={canvaEmail}
                        onChange={(e) => setCanvaEmail(e.target.value)}
                        placeholder="your-email@example.com"
                        className="w-full bg-[#F9F8F6] border-2 border-[#E5EFE4] rounded-xl px-4 py-4 outline-none focus:border-[#7D9A7A] transition-all"
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={submittingReward}
                      className="w-full py-4 bg-[#7D9A7A] hover:bg-[#688265] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#7D9A7A]/20 disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                    >
                      {submittingReward ? 'Processing...' : 'Claim Reward'}
                    </button>

                    <p className="text-[10px] text-[#A8A099] italic leading-relaxed px-4">
                      We ensure that your data will not be compromised upon entering your email.
                    </p>
                  </form>
                )}

                {!rewardSuccess && (
                  <button 
                    onClick={() => setShowRewardModal(false)}
                    className="mt-6 text-[#A8A099] hover:text-[#6F4E37] text-xs font-medium underline underline-offset-4"
                  >
                    Close without claiming
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInstallDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowInstallDialog(false)}
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
                onClick={() => setShowInstallDialog(false)}
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
                  
                  {isIOS ? (
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
                  ) : (
                    <div className="bg-[#F9F8F6] p-4 rounded-2xl border border-[#E5EFE4] text-left space-y-3 text-[#6F4E37]">
                      <p>1. Ensure you are viewing this app in a <strong>new browser tab</strong> (not inside a preview window).</p>
                      <p className="border-t border-[#E5EFE4] pt-2">2. Tap your browser's menu (⋮) and select <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => setShowInstallDialog(false)}
                  className="w-full mt-4 py-3 bg-[#7D9A7A] hover:bg-[#688265] text-white rounded-xl font-medium transition-colors"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-auto pt-8 pb-4 w-full text-center flex flex-col items-center justify-center opacity-70 relative">
        <CrawlingAnts />
        
        {user && (
          <button
            onClick={() => setShowFeedback(true)}
            className="flex items-center gap-2 mb-4 text-[#8B7E74] hover:text-[#7D9A7A] transition-colors text-xs font-medium bg-[#F9F8F6] border border-[#E5EFE4] px-4 py-2 rounded-full cursor-pointer z-10"
          >
            <MessageSquare className="w-4 h-4" />
            Send Feedback
          </button>
        )}

        <div className="mt-4">
          <p className="text-xs font-medium tracking-wide text-[#8B7E74]">Coded and Developed by siejeihyung.digital</p>
          <p className="text-[10px] uppercase tracking-widest text-[#A8A099] mt-1 hover:text-[#7D9A7A] transition-colors">All Rights Reserved</p>
        </div>
      </footer>
    </div>
  );
}


