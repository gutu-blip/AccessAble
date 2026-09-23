import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyB8W_vZp4BoH0c4SsZ_jFyk6vWMiujEMiA",
  authDomain: "accessablebyhex.firebaseapp.com",
  databaseURL: "https://accessablebyhex-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "accessablebyhex",
  storageBucket: "accessablebyhex.firebasestorage.app",
  messagingSenderId: "1013950080604",
  appId: "1:1013950080604:web:3d23a4667b10d61e1a2899",
  measurementId: "G-CLQC4RG1M8"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);

export { app, db, storage };
export default app;
