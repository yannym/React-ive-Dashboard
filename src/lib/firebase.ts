import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { Applet } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Log indicator on configuration validity
const isConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'dummy-api-key-replace-this' && 
  firebaseConfig.projectId;

let firebaseApp;
let db: any = null;
let auth: any = null;

if (isConfigured) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || undefined);
    auth = getAuth(firebaseApp);
  } catch (err) {
    console.warn('Firebase failed to load with configured credentials:', err);
  }
} else {
  console.info('Firebase is in Local Sandbox mode. Config is currently dummy value. Configure Firestore in Settings for multi-device sync.');
}

export { db, auth, isConfigured };

// 1. Core Error Handling conforming to structural FirebaseErrorInfo spec
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
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentAuth = auth;
  const currentUser = currentAuth?.currentUser;
  
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || null,
      isAnonymous: currentUser?.isAnonymous || null,
      tenantId: currentUser?.tenantId || null,
      providerInfo: currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  const loggedMessage = JSON.stringify(errInfo);
  console.error('Firestore Error Payload: ', loggedMessage);
  throw new Error(loggedMessage);
}

// Connection Validation as REQUIRED by the skill guidelines
export async function testFirestoreConnection() {
  if (!db) return false;
  try {
    // Tests connection against test doc reference to catch offline/permission configurations early
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase Firestore connection tested successfully.');
    return true;
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firebase client reported offline. Please check network or Firestore provision status.');
    } else {
      console.debug('First run check succeeded (test doc handles correctly).');
    }
    return false;
  }
}

// Run connection diagnostic lazily if activated
if (isConfigured && db) {
  testFirestoreConnection();
}

// 2. Google OAuth helper triggers sign in pops
export async function signInWithGoogle(): Promise<User | null> {
  if (!auth) {
    throw new Error('Firebase Auth is not configured. Please supply parameters in Settings.');
  }
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error('Popup Google authentication trigger failed:', error);
    throw error;
  }
}

export async function logOutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

// 3. Database operations
// fetch list from Firestore
export async function fetchUserApplets(userId: string): Promise<Applet[]> {
  if (!db) return [];
  const collPath = 'applets';
  try {
    const q = query(collection(db, collPath), where('ownerId', '==', userId));
    const snapshot = await getDocs(q);
    const list: Applet[] = [];
    snapshot.forEach((docRef) => {
      list.push(docRef.data() as Applet);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collPath);
    return [];
  }
}

// sync / Save applet
export async function saveAppletToCloud(applet: Applet): Promise<void> {
  if (!db) return;
  const path = `applets/${applet.id}`;
  try {
    await setDoc(doc(db, 'applets', applet.id), {
      ...applet,
      updatedAt: Timestamp.now().toDate().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// delete applet
export async function deleteAppletFromCloud(appletId: string): Promise<void> {
  if (!db) return;
  const path = `applets/${appletId}`;
  try {
    await deleteDoc(doc(db, 'applets', appletId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
