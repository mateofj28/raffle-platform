import { getStorage, ref, uploadBytes, getDownloadURL, type FirebaseStorage } from "firebase/storage";
import { getFirebaseApp } from "./config";

let _storage: FirebaseStorage | null = null;

function getStorageInstance(): FirebaseStorage {
    if (_storage) return _storage;
    _storage = getStorage(getFirebaseApp());
    return _storage;
}

export function storageRef(path: string) {
    return ref(getStorageInstance(), path);
}

export { uploadBytes, getDownloadURL };
