import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp, 
  orderBy,
  doc,
  getDocFromServer
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface ReferenceAudio {
  id?: string;
  storyId: string;
  audioData: string; // Base64
  language: string;
  createdAt?: any;
}

export interface StoryImage {
  id?: string;
  storyId: number;
  imageUrl: string;
  labels: { word: string; x: number; y: number }[];
}

const COLLECTION_NAME = 'reference_audio';
const IMAGES_COLLECTION = 'story_images';

export const saveReferenceAudio = async (audio: Omit<ReferenceAudio, 'id' | 'createdAt'>) => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...audio,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
  }
};

export const getReferenceAudioForStory = async (storyId: string): Promise<ReferenceAudio[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME), 
      where('storyId', '==', storyId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ReferenceAudio));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    return [];
  }
};

export const saveStoryImage = async (image: Omit<StoryImage, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, IMAGES_COLLECTION), image);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, IMAGES_COLLECTION);
  }
};

export const getStoryImages = async (storyId: number): Promise<StoryImage[]> => {
  try {
    const q = query(collection(db, IMAGES_COLLECTION), where('storyId', '==', storyId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as StoryImage));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, IMAGES_COLLECTION);
    return [];
  }
};

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
