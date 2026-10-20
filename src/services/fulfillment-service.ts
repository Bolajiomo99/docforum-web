import { apiFetch } from './api-client';
import type { DispenseFulfillmentItemInput, FulfillmentQueueItem } from '../types/models';

/**
 * Item-level partial dispensing (issue #54, assumed docforum-core#73).
 * The backend rejects quantities above the outstanding amount and any
 * attempt to dispense an item another facility already dispensed.
 */
export function dispenseFulfillmentItem(
  facilityId: string,
  itemId: string,
  input: DispenseFulfillmentItemInput,
  accessToken: string,
): Promise<FulfillmentQueueItem> {
  return apiFetch<FulfillmentQueueItem>(
    `/facilities/${facilityId}/fulfillment-queue/${itemId}/dispense`,
    {
      method: 'POST',
      body: input,
      accessToken,
    },
  );
}
