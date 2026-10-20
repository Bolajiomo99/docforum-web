// Patient orders, item-level fulfilment and routing remaining items.
import { http } from 'msw';
import { db } from '../db';
import { conflict, notFound, paramId, respond } from '../helpers';
import type {
  FulfillmentOrderType,
  FulfillmentQueueItem,
  PatientOrder,
} from '../../types/models';

function deriveFulfillmentStatus(order: PatientOrder): PatientOrder['fulfillmentStatus'] {
  const items = order.items;
  if (items.length === 0) return 'unfulfilled';
  if (items.every((item) => item.status === 'rejected')) return 'rejected';
  if (items.every((item) => item.quantityOutstanding <= 0)) return 'fulfilled';
  if (items.some((item) => item.quantityDispensed > 0)) return 'partially_fulfilled';
  return 'unfulfilled';
}

function toQueueType(order: PatientOrder): FulfillmentOrderType {
  return order.orderType === 'prescription' ? 'prescription' : 'lab';
}

export const ordersHandlers = [
  http.get('*/orders/mine', respond('list', () => db.orders)),

  http.get(
    '*/orders/:orderId/remaining-items/facilities',
    respond('list', ({ params, request }) => {
      const order = db.orders.find((o) => o.id === paramId(params, 'orderId'));
      if (!order) return [];
      const url = new URL(request.url);
      const itemIds = new Set(
        (url.searchParams.get('itemIds') ?? '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      );
      const remaining = order.items.filter(
        (item) =>
          itemIds.has(item.id) &&
          item.quantityOutstanding > 0 &&
          !item.routedToFacilityId &&
          item.status !== 'dispensed_elsewhere',
      );
      if (remaining.length === 0) return [];

      const wantedType = order.orderType === 'prescription' ? 'pharmacy' : 'lab';
      return db.facilities
        .filter((facility) => facility.type === wantedType && facility.id !== order.facilityId)
        .map((facility) => ({ ...facility }));
    }),
  ),

  http.post(
    '*/orders/:orderId/route-remaining',
    respond('json', async ({ params, request }) => {
      const order = db.orders.find((o) => o.id === paramId(params, 'orderId'));
      if (!order) return notFound('order');
      const body = (await request.json().catch(() => ({}))) as {
        facilityId?: string;
        itemIds?: string[];
      };
      const destination = db.facilities.find((f) => f.id === body.facilityId);
      if (!destination) return notFound('facility');

      const requested = order.items.filter((item) => body.itemIds?.includes(item.id));
      if (requested.length === 0) return conflict('no items selected to route');

      for (const item of requested) {
        if (item.status === 'dispensed_elsewhere' || item.quantityOutstanding <= 0) {
          return conflict(`${item.name} was already dispensed elsewhere`);
        }
        if (item.routedToFacilityId) {
          return conflict(`${item.name} was already routed to another facility`);
        }
      }

      const orderType = toQueueType(order);
      const now = new Date().toISOString();

      for (const item of requested) {
        item.routedToFacilityId = destination.id;
        item.routedToFacilityName = destination.name;
        item.canDispense = false;
        item.blockedReason = `Remaining items routed to ${destination.name}.`;

        for (const queueItem of db.fulfillmentQueue) {
          if (queueItem.orderItemId === item.id) {
            queueItem.canDispense = false;
            queueItem.blockedReason = `Remaining items routed to ${destination.name}.`;
          }
        }

        const queueItem: FulfillmentQueueItem = {
          id: `fuq-route-${item.id}-${destination.id}`,
          facilityId: destination.id,
          orderId: order.id,
          orderItemId: item.id,
          orderType,
          patientName: order.patientName,
          patientProfileId: order.patientProfileId,
          itemName: item.name,
          instructions: item.instructions ?? null,
          status: 'pending',
          receivedAt: now,
          quantityPrescribed: item.quantityOutstanding,
          quantityDispensed: 0,
          quantityOutstanding: item.quantityOutstanding,
          unit: item.unit,
          canDispense: true,
          blockedReason: null,
          attribution: null,
        };
        db.fulfillmentQueue.push(queueItem);
      }

      order.fulfillmentStatus = deriveFulfillmentStatus(order);
      return order;
    }),
  ),

  http.get(
    '*/orders/:orderId',
    respond('json', ({ params }) => {
      const order = db.orders.find((o) => o.id === paramId(params, 'orderId'));
      return order ?? notFound('order');
    }),
  ),
];
