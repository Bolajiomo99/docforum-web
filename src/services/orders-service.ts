import { apiFetch } from './api-client';
import type {
  FacilityWithDistance,
  PatientOrder,
  RouteRemainingItemsInput,
} from '../types/models';

/** Patient orders list + detail (issue #5, assumed docforum-core#11/#73). */
export function listMyOrders(accessToken: string): Promise<PatientOrder[]> {
  return apiFetch<PatientOrder[]>('/orders/mine', { accessToken });
}

export function getOrder(orderId: string, accessToken: string): Promise<PatientOrder> {
  return apiFetch<PatientOrder>(`/orders/${orderId}`, { accessToken });
}

/**
 * Facilities qualified to dispense the given outstanding items only.
 * `itemIds` are the remaining items, not the whole order.
 */
export function getEligibleFacilitiesForRemainingItems(
  orderId: string,
  itemIds: string[],
  accessToken: string,
): Promise<FacilityWithDistance[]> {
  const query = new URLSearchParams({ itemIds: itemIds.join(',') });
  return apiFetch<FacilityWithDistance[]>(
    `/orders/${orderId}/remaining-items/facilities?${query.toString()}`,
    { accessToken },
  );
}

/** Routes the remaining quantities to a second facility (new fulfillment record). */
export function routeRemainingItems(
  orderId: string,
  input: RouteRemainingItemsInput,
  accessToken: string,
): Promise<PatientOrder> {
  return apiFetch<PatientOrder>(`/orders/${orderId}/route-remaining`, {
    method: 'POST',
    body: input,
    accessToken,
  });
}
