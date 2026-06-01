
// Updated content for storage.ts
export const getStorageValue = (key: string): any => {
  return localStorage.getItem(key);
};

export const setStorageValue = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value));
};
