import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import localConfig from '../firebase-applet-config.json';

// Support both local config file and environment variables for deployment
const getFirebaseConfig = () => {
  const env = import.meta.env;
  
  // Use environment variables if they exist and aren't empty, otherwise fall back to local config
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || localConfig.apiKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || localConfig.authDomain,
    projectId: env.VITE_FIREBASE_PROJECT_ID || localConfig.projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || localConfig.storageBucket,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || localConfig.messagingSenderId,
    appId: env.VITE_FIREBASE_APP_ID || localConfig.appId,
  };
};

const firebaseConfig = getFirebaseConfig();
const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || localConfig.firestoreDatabaseId;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);
