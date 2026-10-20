import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ordersService from '../../../services/orders-service';
import { useAuthStore } from '../../../store/auth-store';
import type { RouteRemainingItemsInput } from '../../../types/models';

export function useMyOrders() {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: ['orders', 'mine'],
    queryFn: () => ordersService.listMyOrders(accessToken!),
    enabled: Boolean(accessToken),
  });
}

export function useOrder(orderId: string | undefined) {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: ['orders', orderId],
    queryFn: () => ordersService.getOrder(orderId!, accessToken!),
    enabled: Boolean(accessToken && orderId),
  });
}

export function useEligibleFacilitiesForRemainingItems(
  orderId: string,
  itemIds: string[],
  enabled: boolean,
) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const sortedIds = [...itemIds].sort();

  return useQuery({
    queryKey: ['orders', orderId, 'remaining-items', 'facilities', sortedIds],
    queryFn: () =>
      ordersService.getEligibleFacilitiesForRemainingItems(orderId, sortedIds, accessToken!),
    enabled: Boolean(enabled && accessToken && orderId && sortedIds.length > 0),
  });
}

export function useRouteRemainingItems(orderId: string) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RouteRemainingItemsInput) =>
      ordersService.routeRemainingItems(orderId, input, accessToken!),
    onSuccess: (order) => {
      queryClient.setQueryData(['orders', orderId], order);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
