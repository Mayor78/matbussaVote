function formatTime(date) {
  if (!date) return '';
  return date.toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTimeShort(date) {
  if (!date) return '';
  return date.toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function groupLabel(levels) {
  return (levels || []).join(' & ');
}

export function getLevelWindowStatus(election, studentLevel) {
  if (!election) return { status: 'loading', message: '', title: '' };

  const windows = election.levelWindows;
  if (!windows || !Array.isArray(windows) || windows.length === 0) {
    return { status: 'open', message: '', title: '' };
  }

  const now = new Date();
  const myWindow = windows.find(
    (w) => Array.isArray(w.levels) && w.levels.some((l) => l === studentLevel),
  );

  if (!myWindow) {
    return {
      status: 'not_eligible',
      title: `Not eligible`,
      message: `Only ${windows.map((w) => groupLabel(w.levels)).join(' and ')} students can vote in this election. Ask your admin if you think this is a mistake.`,
    };
  }

  const opensAt = myWindow.opensAt ? new Date(myWindow.opensAt) : null;
  const closesAt = myWindow.closesAt ? new Date(myWindow.closesAt) : null;
  const label = groupLabel(myWindow.levels);

  if (opensAt && now < opensAt) {
    const mins = Math.ceil((opensAt - now) / 60000);
    const human =
      mins <= 1
        ? 'less than a minute'
        : mins <= 60
        ? `${mins} minute${mins !== 1 ? 's' : ''}`
        : mins <= 1440
        ? `${Math.ceil(mins / 60)} hour${Math.ceil(mins / 60) !== 1 ? 's' : ''}`
        : `${Math.ceil(mins / 1440)} day${Math.ceil(mins / 1440) !== 1 ? 's' : ''}`;

    return {
      status: 'pending',
      title: `Voting for ${label} is not open yet`,
      message:
        mins <= 120
          ? `Your voting starts in ${human} (from ${formatTimeShort(opensAt)} to ${formatTimeShort(closesAt)}). Please come back then.`
          : `Your voting window: ${formatTime(opensAt)} — ${formatTime(closesAt)}. Come back when it opens.`,
      opensAt,
      closesAt,
    };
  }

  if (closesAt && now > closesAt) {
    return {
      status: 'closed',
      title: `Voting for ${label} has ended`,
      message: `The voting window was from ${formatTime(opensAt)} to ${formatTime(closesAt)}. Results will be announced soon.`,
      opensAt,
      closesAt,
    };
  }

  return {
    status: 'open',
    title: `Voting open — ${label}`,
    message: closesAt
      ? `Voting ends at ${formatTime(closesAt)}. Make sure you vote before then!`
      : '',
    opensAt,
    closesAt,
  };
}

export const LEVEL_GROUPS = {
  ND1: 'ND 1',
  ND2: 'ND 2',
  HND1: 'HND 1',
  HND2: 'HND 2',
};

export const DEFAULT_LEVEL_WINDOWS = [
  { levels: ['ND1', 'ND2'], opensAt: '', closesAt: '' },
  { levels: ['HND1', 'HND2'], opensAt: '', closesAt: '' },
];
