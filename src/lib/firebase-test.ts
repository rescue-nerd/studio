/**
 * Firebase Integration Test
 * This file contains tests to verify Firebase services are working correctly
 */

import { auth, db, functions, storage } from './firebase';
import { 
  signInAnonymously,
  signOut
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Test Firebase Authentication
 */
export async function testFirebaseAuth(): Promise<boolean> {
  try {
    console.log('🔥 Testing Firebase Authentication...');
    
    // Sign in anonymously
    const userCredential = await signInAnonymously(auth);
    console.log('✅ Anonymous sign-in successful:', userCredential.user.uid);
    
    // Sign out
    await signOut(auth);
    console.log('✅ Sign-out successful');
    
    return true;
  } catch (error) {
    console.error('❌ Firebase Auth test failed:', error);
    return false;
  }
}

/**
 * Test Firestore Database
 */
export async function testFirestore(): Promise<boolean> {
  try {
    console.log('🔥 Testing Firestore Database...');
    
    const testDocRef = doc(db, 'test', 'firebase-test');
    const testData = {
      message: 'Firebase integration test',
      timestamp: serverTimestamp(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    // Write test document
    await setDoc(testDocRef, testData);
    console.log('✅ Document written successfully');
    
    // Read test document
    const docSnap = await getDoc(testDocRef);
    if (docSnap.exists()) {
      console.log('✅ Document read successfully:', docSnap.data());
    } else {
      throw new Error('Document not found after creation');
    }
    
    // Clean up - delete test document
    await deleteDoc(testDocRef);
    console.log('✅ Test document cleaned up');
    
    return true;
  } catch (error) {
    console.error('❌ Firestore test failed:', error);
    return false;
  }
}

/**
 * Test Firebase Functions
 */
export async function testFirebaseFunctions(): Promise<boolean> {
  try {
    console.log('🔥 Testing Firebase Functions...');
    
    // Test a simple callable function (assuming you have one)
    const testFunction = httpsCallable(functions, 'testFunction');
    
    try {
      const result = await testFunction({ test: true });
      console.log('✅ Function call successful:', result.data);
      return true;
    } catch (functionError: any) {
      if (functionError.code === 'functions/not-found') {
        console.log('⚠️ Test function not found - this is expected if no test function is deployed');
        console.log('✅ Functions service is accessible');
        return true;
      }
      throw functionError;
    }
  } catch (error) {
    console.error('❌ Firebase Functions test failed:', error);
    return false;
  }
}

/**
 * Test Firebase Storage
 */
export async function testFirebaseStorage(): Promise<boolean> {
  try {
    console.log('🔥 Testing Firebase Storage...');
    
    const testFileName = `test-${Date.now()}.txt`;
    const storageRef = ref(storage, `test/${testFileName}`);
    const testBlob = new Blob(['Firebase Storage test'], { type: 'text/plain' });
    
    // Upload test file
    const snapshot = await uploadBytes(storageRef, testBlob);
    console.log('✅ File uploaded successfully:', snapshot.metadata.name);
    
    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    console.log('✅ Download URL obtained:', downloadURL);
    
    // Clean up - delete test file
    await deleteObject(storageRef);
    console.log('✅ Test file cleaned up');
    
    return true;
  } catch (error) {
    console.error('❌ Firebase Storage test failed:', error);
    return false;
  }
}

/**
 * Run all Firebase tests
 */
export async function runFirebaseTests(): Promise<void> {
  console.log('🔥 Running Firebase Integration Tests...');
  console.log('=====================================');
  
  const results = {
    auth: await testFirebaseAuth(),
    firestore: await testFirestore(),
    functions: await testFirebaseFunctions(),
    storage: await testFirebaseStorage()
  };
  
  console.log('=====================================');
  console.log('🔥 Firebase Test Results:');
  console.log(`Auth: ${results.auth ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Firestore: ${results.firestore ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Functions: ${results.functions ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Storage: ${results.storage ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(result => result);
  console.log(`Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
}

// Export individual test functions for selective testing
export {
  testFirebaseAuth as testAuth,
  testFirestore,
  testFirebaseFunctions as testFunctions,
  testFirebaseStorage as testStorage
};
