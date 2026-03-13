'use client';

import React, { useEffect, useState } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth } from 'firebase/auth';

export const FirebaseClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebase, setFirebase] = useState<{
    app: FirebaseApp;
    firestore: Firestore;
    auth: Auth;
  } | null>(null);

  useEffect(() => {
    setFirebase(initializeFirebase());
  }, []);

  if (!firebase) return null;

  return (
    <FirebaseProvider app={firebase.app} firestore={firebase.firestore} auth={firebase.auth}>
      {children}
    </FirebaseProvider>
  );
};
