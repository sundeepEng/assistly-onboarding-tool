// services/use-comment-users.ts
import { useQueries } from '@tanstack/react-query';
import { fetchById } from '../services/getById';

interface UseCommentUsersParams {
  userIds: string[];
  path: string;
}

const useCommentUsers = ({ userIds, path }: UseCommentUsersParams) => {
  const uniqueUserIds = Array.from(new Set(userIds));

  const queries = useQueries({
    queries: uniqueUserIds.map(userId => ({
      queryKey: ['user', userId, path],
      queryFn: () => fetchById({ id: userId, path }),
    })),
  });
  const userMap = queries.reduce((acc, query, idx) => {
    const userId = uniqueUserIds[idx];
    if (query.data) {
      acc[userId] = query.data;
    }
    return acc;
  }, {} as Record<string, any>);

  return { userMap, isLoading: queries.some(q => q.isLoading) };
};

export default useCommentUsers;
