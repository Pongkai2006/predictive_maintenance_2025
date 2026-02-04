import { database } from './firebase.config';
import { ref, onValue, query, limitToLast, off, DatabaseReference, onChildAdded } from 'firebase/database';

// Type definitions matching the architecture
export interface RawSensorData {
    X: number;  // ESP32 uses capital letters
    Y: number;
    Z: number;
    timestamp: number;
}

export interface MachineStatusData {
    state: 'GOOD' | 'BAD';
    prob_bad: number;
    updated_at: number;
    data_timestamp?: number; // Sync key
}

/**
 * Subscribe to AI-processed machine status updates from /sensor/status
 * This is where the AI backend writes its classification results
 */
export const subscribeToStatus = (
    callback: (status: MachineStatusData) => void
): (() => void) => {
    const statusRef = ref(database, 'sensor/status');

    const unsubscribe = onValue(
        statusRef,
        (snapshot) => {
            const data = snapshot.val();
            if (data) {
                callback(data);
            }
        },
        (error) => {
            console.error('Error subscribing to status:', error);
        }
    );

    // Return unsubscribe function
    return () => off(statusRef);
};

/**
 * Subscribe to batch sensor data from /sensor/batchAcceleration
 * ESP32 sends data in batches of ~50 samples.
 * We use limitToLast(1) with onChildAdded to get the most recent and subsequent batches.
 */
export const subscribeToRawData = (
    callback: (data: RawSensorData) => void
): (() => void) => {
    const rawDataRef = ref(database, 'sensor/batchAcceleration');
    // Listen to new children added (new batches), starting from the last one
    const recentQuery = query(rawDataRef, limitToLast(1));

    const unsubscribe = onChildAdded(
        recentQuery,
        (snapshot) => {
            const batch = snapshot.val();
            if (batch && Array.isArray(batch)) {
                // Each batch is an array of sensor readings
                batch.forEach((dataPoint: RawSensorData) => {
                    callback(dataPoint);
                });
            }
        },
        (error) => {
            console.error('Error subscribing to raw data:', error);
        }
    );

    // Return unsubscribe function
    return () => off(rawDataRef);
};

/**
 * Get the latest batch for initial chart population
 */
export const getLatestRawData = (
    limit: number,
    callback: (data: RawSensorData[]) => void
): void => {
    const rawDataQuery = query(ref(database, 'sensor/batchAcceleration'), limitToLast(3));

    onValue(
        rawDataQuery,
        (snapshot) => {
            const dataArray: RawSensorData[] = [];
            snapshot.forEach((batchSnapshot) => {
                const batch = batchSnapshot.val();
                if (batch && Array.isArray(batch)) {
                    // Flatten all batches into single array
                    batch.forEach((dataPoint: RawSensorData) => {
                        dataArray.push(dataPoint);
                    });
                }
            });
            callback(dataArray);
        },
        { onlyOnce: true }
    );
};

/**
 * Check Firebase connection status
 */
export const checkConnection = (callback: (connected: boolean) => void): (() => void) => {
    const connectedRef = ref(database, '.info/connected');

    const unsubscribe = onValue(connectedRef, (snapshot) => {
        const connected = snapshot.val() === true;
        callback(connected);
    });

    return () => off(connectedRef);
};
