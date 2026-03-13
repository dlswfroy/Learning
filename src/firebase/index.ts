'use client';

import { getFirebaseApp } from './config';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export function initializeFirebase() {
  const app = getFirebaseApp();
  const firestore = getFirestore(app);
  const auth = getAuth(app);
  return { app, firestore, auth };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './auth/use-user';
