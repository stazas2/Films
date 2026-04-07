import { useEffect } from 'react';
import { attachVideo, detachVideo } from '../sync/sync-manager';
import { startPeriodicSync, stopPeriodicSync } from '../sync/time-sync';
import { startDriftCorrection, stopDriftCorrection, startHostSync, stopHostSync } from '../sync/drift';
import { useRoomStore } from '../store/room';
import { socket } from '../lib/socket';

export function useSync(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const isHost = useRoomStore((s) => s.isHost);

  useEffect(() => {
    startPeriodicSync();

    return () => {
      stopPeriodicSync();
      detachVideo();
      stopDriftCorrection();
      stopHostSync();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    attachVideo(video);
    startDriftCorrection(video);

    if (isHost) {
      startHostSync(video);
    }

    // Request current state from host
    socket.emit('sync:request-state');

    return () => {
      detachVideo();
      stopDriftCorrection();
      stopHostSync();
    };
  }, [videoRef.current, isHost]);
}
