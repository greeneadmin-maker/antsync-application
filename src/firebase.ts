import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import localConfig from '../firebase-applet-config.json';

// Support both local config file and environment variables for deployment
const getFirebaseValue = (envKey: string, localValue: string) => {
  const envValue = import.meta.env[envKey];
  // If the env value is missing, empty, or a placeholder, use local value
  if (!envValue || envValue === "" || envValue.includes("YOUR_") || envValue.includes("MY_")) {
    return localValue;
  }
  return envValue;
};

const getFirebaseConfig = () => {
  return {
    apiKey: getFirebaseValue('VITE_FIREBASE_API_KEY', localConfig.apiKey),
    authDomain: getFirebaseValue('VITE_FIREBASE_AUTH_DOMAIN', localConfig.authDomain),
    projectId: getFirebaseValue('VITE_FIREBASE_PROJECT_ID', localConfig.projectId),
    storageBucket: getFirebaseValue('VITE_FIREBASE_STORAGE_BUCKET', localConfig.storageBucket),
    messagingSenderId: getFirebaseValue('VITE_FIREBASE_MESSAGING_SENDER_ID', localConfig.messagingSenderId),
    appId: getFirebaseValue('VITE_FIREBASE_APP_ID', localConfig.appId),
  };
};

const firebaseConfig = getFirebaseConfig();
const databaseId = getFirebaseValue('VITE_FIREBASE_DATABASE_ID', localConfig.firestoreDatabaseId);

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);
