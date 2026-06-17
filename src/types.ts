export type OpenMode = 'iframe' | 'new_tab';

export interface SandboxConfig {
  allowScripts: boolean;
  allowSameOrigin: boolean;
  allowForms: boolean;
  allowPopups: boolean;
}

export interface Applet {
  id: string;
  name: string;
  description: string;
  url?: string;
  embedCode?: string;
  isCustomEmbed: boolean;
  icon: string; // Lucide icon key name or emoji
  category: string;
  tags: string[];
  openMode: OpenMode;
  accentColor: string; // Tailwind accent border/text class, e.g., 'emerald', 'sky', 'rose'
  isPinned: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  sandboxConfig?: SandboxConfig;
  orderIndex?: number;
}

export interface FirebaseConnectionDetails {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

export interface Settings {
  storageType: 'local' | 'firebase';
  firebaseConfig?: FirebaseConnectionDetails;
}
