const maxHistoryDepth = 50;

export function createEntityNavigationHistory(initialEntityId) {
  return {
    past: [],
    current: initialEntityId,
    future: [],
  };
}

export function visitEntity(history, entityId) {
  if (!entityId || entityId === history.current) return history;

  return {
    past: [...history.past, history.current].filter(Boolean).slice(-maxHistoryDepth),
    current: entityId,
    future: [],
  };
}

export function goBackInEntityHistory(history) {
  if (history.past.length === 0) return history;

  const past = history.past.slice(0, -1);
  const current = history.past[history.past.length - 1];

  return {
    past,
    current,
    future: [history.current, ...history.future],
  };
}

export function goForwardInEntityHistory(history) {
  if (history.future.length === 0) return history;

  const [current, ...future] = history.future;

  return {
    past: [...history.past, history.current].filter(Boolean).slice(-maxHistoryDepth),
    current,
    future,
  };
}

export function selectEntityNavigationState(history) {
  return {
    current: history.current,
    canGoBack: history.past.length > 0,
    canGoForward: history.future.length > 0,
  };
}
