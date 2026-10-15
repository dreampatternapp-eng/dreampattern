import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { getSetting } from '@/lib/db';
import { unlock } from '@/lib/lock';
import { colors, space } from '@/lib/theme';
import { Button } from './ui';

/** Covers the app with a lock screen on launch and whenever it returns from the background. */
export function LockGate({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [locked, setLockedState] = useState<boolean | null>(null);
  const lockedRef = useRef<boolean | null>(null);
  const prompting = useRef(false);
  const setLocked = (v: boolean) => {
    lockedRef.current = v;
    setLockedState(v);
  };

  const tryUnlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      if (await unlock()) setLocked(false);
    } finally {
      prompting.current = false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const enabled = (await getSetting(db, 'lock_enabled')) === '1';
      setLocked(enabled);
      if (enabled) tryUnlock();
    })();
  }, [db, tryUnlock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background') {
        if ((await getSetting(db, 'lock_enabled')) === '1') setLocked(true);
      } else if (state === 'active' && lockedRef.current) {
        tryUnlock();
      }
    });
    return () => sub.remove();
  }, [db, tryUnlock]);

  if (locked === null) return <View style={s.cover} />;
  return (
    <View style={{ flex: 1 }}>
      {children}
      {locked && (
        <View style={[StyleSheet.absoluteFill, s.cover]}>
          <Text style={{ fontSize: 48 }}>🌙</Text>
          <Text style={s.title}>DreamPattern is locked</Text>
          <Button title="Unlock" onPress={tryUnlock} style={{ alignSelf: 'stretch' }} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  cover: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    padding: space.xxl,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '600' },
});
