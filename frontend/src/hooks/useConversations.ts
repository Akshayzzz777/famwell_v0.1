import { useCallback, useEffect, useState } from 'react';
import { fetchConversations, type ConversationItem } from '../services/api';
import { useRole } from '../context/RoleContext';

export function useConversations() {
  const { selectedRole } = useRole();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchConversations(selectedRole);
      setConversations(data.conversations);
    } catch (err: any) {
      setError({ message: err?.message || 'Failed to load conversations' });
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useEffect(() => {
    load();
  }, [load]);

  return { conversations, loading, error, reload: load };
}
