import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

// Generic CRUD hook factory: useResource<Asset>("assets") gives list/create/
// update/delete hooks wired to /api/assets and keeps the cache in sync.
export function useResource<T extends { id: string }>(endpoint: string) {
  const queryClient = useQueryClient();
  const key = [endpoint];

  const list = useQuery({
    queryKey: key,
    queryFn: async () => (await api.get<T[]>(`/${endpoint}`)).data,
  });

  const create = useMutation({
    mutationFn: async (payload: Partial<T>) => (await api.post<T>(`/${endpoint}`, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<T> }) =>
      (await api.put<T>(`/${endpoint}/${id}`, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/${endpoint}/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { list, create, update, remove };
}
