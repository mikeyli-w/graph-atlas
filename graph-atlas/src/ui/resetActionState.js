export function createResetActionState() {
  return {
    pending: false,
  };
}

export function requestReset() {
  return {
    pending: true,
  };
}

export function cancelReset() {
  return createResetActionState();
}

export function confirmReset() {
  return createResetActionState();
}
