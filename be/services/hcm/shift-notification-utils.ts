const formatTime = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(date);

const formatDate = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(date);

const formatDateTime = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(date);

export const formatShiftRange = (startIso: string, endIso: string, timeZone: string = 'UTC') => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay = formatDate(start, timeZone) === formatDate(end, timeZone);

  if (sameDay) {
    return `${formatDate(start, timeZone)} · ${formatTime(start, timeZone)} - ${formatTime(end, timeZone)}`;
  }

  return `${formatDateTime(start, timeZone)} - ${formatDateTime(end, timeZone)}`;
};

export interface ShiftNotification {
  notificationType: string;
  title: string;
  body: string;
}

export const getShiftCreatedNotification = (
  shift: {
    shift_status: string;
    shift_start_time: string;
    shift_end_time: string;
  },
  timeZone: string = 'UTC'
): ShiftNotification => {
  const dateRange = formatShiftRange(shift.shift_start_time, shift.shift_end_time, timeZone);

  switch (shift.shift_status) {
    case 'timeoff':
      return {
        notificationType: 'TIME_OFF_REQUESTED',
        title: 'Time off requested',
        body: `Your time off request for ${dateRange} has been submitted.`,
      };
    case 'vacation':
      return {
        notificationType: 'VACATION_REQUESTED',
        title: 'Vacation requested',
        body: `Your vacation request for ${dateRange} has been submitted.`,
      };
    default:
      return {
        notificationType: 'SHIFT_CREATED',
        title: 'New shift scheduled',
        body: `You have a new shift on ${dateRange}.`,
      };
  }
};

export const getShiftUpdatedNotification = (
  shift: {
    shift_start_time: string;
    shift_end_time: string;
  },
  timeZone: string = 'UTC'
): ShiftNotification => {
  const dateRange = formatShiftRange(shift.shift_start_time, shift.shift_end_time, timeZone);

  return {
    notificationType: 'SHIFT_UPDATED',
    title: 'Shift updated',
    body: `Your shift on ${dateRange} has been updated.`,
  };
};

export const getUnavailabilityApprovalNotification = (
  shift: {
    shift_status: string;
    shift_start_time: string;
    shift_end_time: string;
  },
  isApproved: boolean,
  timeZone: string = 'UTC'
): ShiftNotification => {
  const dateRange = formatShiftRange(shift.shift_start_time, shift.shift_end_time, timeZone);
  const statusLabel = shift.shift_status === 'vacation' ? 'vacation' : 'time off';
  const capitalizedStatus = statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1);

  if (isApproved) {
    return {
      notificationType:
        shift.shift_status === 'vacation' ? 'VACATION_APPROVED' : 'TIME_OFF_APPROVED',
      title: `${capitalizedStatus} approved`,
      body: `Your ${statusLabel} request for ${dateRange} has been approved.`,
    };
  }

  return {
    notificationType: shift.shift_status === 'vacation' ? 'VACATION_REJECTED' : 'TIME_OFF_REJECTED',
    title: `${capitalizedStatus} rejected`,
    body: `Your ${statusLabel} request for ${dateRange} has been rejected.`,
  };
};

export const getShiftDeletedNotification = (
  shift: {
    shift_start_time: string;
    shift_end_time: string;
  },
  timeZone: string = 'UTC'
): ShiftNotification => {
  const dateRange = formatShiftRange(shift.shift_start_time, shift.shift_end_time, timeZone);

  return {
    notificationType: 'SHIFT_DELETED',
    title: 'Shift removed',
    body: `Your shift on ${dateRange} has been removed.`,
  };
};
