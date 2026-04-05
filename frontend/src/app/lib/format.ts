export function formatDate(value?: string | null) {
  if (!value) {
    return 'Not available';
  }

  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

export function formatTime(value?: string | null) {
  if (!value) {
    return '';
  }

  try {
    return new Date(value).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export function titleCase(value?: string | null) {
  if (!value) {
    return 'Unknown';
  }

  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function initialLetters(value?: string | null) {
  if (!value) {
    return 'FW';
  }

  const cleaned = value.trim();
  if (!cleaned) {
    return 'FW';
  }

  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

export function jsonPreview(value: unknown, maxLength = 120) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!text) {
    return 'No data available.';
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function safePrettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function computeHealthScore(input: {
  recordsCount: number;
  connectionsCount: number;
  hasInsights: boolean;
  apiHealthy: boolean;
}) {
  let score = 48;
  score += Math.min(input.recordsCount * 8, 24);
  score += Math.min(input.connectionsCount * 5, 15);
  score += input.hasInsights ? 8 : 0;
  score += input.apiHealthy ? 5 : 0;
  return Math.max(0, Math.min(100, score));
}

export function deriveSummaryHighlights(result: any) {
  const highlights: Array<{ label: string; value: string }> = [];

  if (result?.status) {
    highlights.push({ label: 'Status', value: titleCase(result.status) });
  }

  if (result?.llm_result?.model_used) {
    highlights.push({ label: 'Model', value: result.llm_result.model_used });
  }

  if (result?.completed_at) {
    highlights.push({ label: 'Completed', value: formatDate(result.completed_at) });
  }

  if (result?.extracted_data?.validation_status) {
    highlights.push({ label: 'Validation', value: titleCase(result.extracted_data.validation_status) });
  }

  return highlights;
}
