import type { User } from 'firebase/auth';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Transaction, UserProfile } from '../types/banking';

export async function ensureFirebaseAuthUser(): Promise<User | null> {
  if (!auth) return null;
  return auth.currentUser;
}

export async function syncWalletToFirestore(
  uid: string,
  profile: UserProfile,
  balance: number,
  earnedToday: number,
  businessSalesToday: number,
  cashbackBalance: number,
  checkedInToday: boolean,
  hideBalance: boolean,
  loanLimit: number,
  loanActive: number,
  virtualAccount?: unknown
): Promise<void> {
  if (!db || !uid) return;
  try {
    const safeProfile: Record<string, unknown> = { ...profile };
    delete safeProfile.pin;
    const ref = doc(db, 'users', uid);
    await setDoc(ref, {
      profile: safeProfile,
      balance,
      earnedToday,
      businessSalesToday,
      cashbackBalance,
      checkedInToday,
      hideBalance,
      loanLimit,
      loanActive,
      virtualAccount: virtualAccount ?? null,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.error('Error syncing wallet:', err);
  }
}

export async function syncPrivateProfileToFirestore(uid: string, profile: UserProfile): Promise<void> {
  if (!db || !uid) return;
  try {
    const ref = doc(db, 'private_users', uid);
    await setDoc(ref, {
      fullName: profile.fullName,
      phone: profile.phone,
      email: profile.email,
      tier: profile.tier,
      bvnVerified: profile.bvnVerified,
      ninVerified: profile.ninVerified,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.error('Error syncing private profile:', err);
  }
}

export async function syncTransactionToFirestore(uid: string, transaction: Transaction): Promise<void> {
  if (!db || !uid) return;
  try {
    const colRef = collection(db, 'users', uid, 'transactions');
    await addDoc(colRef, {
      ...transaction,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error syncing transaction:', err);
  }
}
