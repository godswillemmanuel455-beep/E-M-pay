import { initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const phoneApiKey = import.meta.env.VITE_PHONE_FIREBASE_API_KEY?.trim();
const phoneAuthDomain = import.meta.env.VITE_PHONE_FIREBASE_AUTH_DOMAIN?.trim();
const phoneProjectId = import.meta.env.VITE_PHONE_FIREBASE_PROJECT_ID?.trim();
const phoneStorageBucket = import.meta.env.VITE_PHONE_FIREBASE_STORAGE_BUCKET?.trim();
const phoneMessagingSenderId = import.meta.env.VITE_PHONE_FIREBASE_MESSAGING_SENDER_ID?.trim();
const phoneAppId = import.meta.env.VITE_PHONE_FIREBASE_APP_ID?.trim();

export const isFirebasePhoneAuthConfigured = Boolean(
  phoneApiKey && phoneAuthDomain && phoneProjectId && phoneAppId
);

const phoneAuthApp = isFirebasePhoneAuthConfigured
  ? initializeApp(
      {
        apiKey: phoneApiKey,
        authDomain: phoneAuthDomain,
        projectId: phoneProjectId,
        ...(phoneStorageBucket ? { storageBucket: phoneStorageBucket } : {}),
        ...(phoneMessagingSenderId ? { messagingSenderId: phoneMessagingSenderId } : {}),
        appId: phoneAppId,
      },
      'phone-auth'
    )
  : null;

export const phoneAuth: Auth | null = phoneAuthApp ? getAuth(phoneAuthApp) : null;
export const phoneFirebaseProjectId = phoneProjectId || '';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
