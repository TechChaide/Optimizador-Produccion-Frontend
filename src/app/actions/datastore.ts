
'use server';

import { dataStore } from '@/services/DataStore';
import type { DataSnapshot } from '@/services/DataStore';

/**
 * Server Actions para sincronizar el DataStore entre cliente y servidor
 */

export async function syncDataToStore(
  key: string,
  data: unknown,
  source: string,
  metadata?: DataSnapshot['metadata']
) {
  try {
    dataStore.setData(key, data, source, metadata);
    return { success: true };
  } catch (error) {
    console.error('[syncDataToStore] Error:', error);
    return { success: false, error: String(error) };
  }
}

export async function getDataFromStore(key?: string) {
  try {
    if (key) {
      const snapshot = dataStore.getData(key);
      return { success: true, data: snapshot };
    }
    
    const allData = dataStore.getAllData();
    return { success: true, data: allData };
  } catch (error) {
    console.error('[getDataFromStore] Error:', error);
    return { success: false, error: String(error) };
  }
}

export async function getDataStoreSummary() {
  try {
    const summary = dataStore.getSummary();
    return { success: true, summary };
  } catch (error) {
    console.error('[getDataStoreSummary] Error:', error);
    return { success: false, error: String(error) };
  }
}

export async function clearDataStore(key?: string) {
  try {
    if (key) {
      dataStore.clearData(key);
    } else {
      dataStore.clearAll();
    }
    return { success: true };
  } catch (error) {
    console.error('[clearDataStore] Error:', error);
    return { success: false, error: String(error) };
  }
}
