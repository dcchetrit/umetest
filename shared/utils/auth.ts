import { auth } from '../firebase/config';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  User
} from 'firebase/auth';

export const authService = {
  // Sign in with email and password
  signIn: async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  },

  // Create new user account
  signUp: async (email: string, password: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  },

  // Sign out current user
  signOut: async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  },

  // Get current user
  getCurrentUser: (): User | null => {
    return auth.currentUser;
  },

  // Check if user is admin (requires custom claims)
  isAdmin: async (user: User): Promise<boolean> => {
    try {
      const idTokenResult = await user.getIdTokenResult();
      return idTokenResult.claims.role === 'admin';
    } catch (error) {
      console.error('Admin check error:', error);
      return false;
    }
  }
};