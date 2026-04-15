"use server"

import Stripe from 'stripe';
import { CheckoutOrderParams, CreateOrderParams, GetOrdersByEventParams, GetOrdersByUserParams } from "@/types"
import { redirect } from 'next/navigation';
import { handleError } from '../utils';
import { connectToDatabase } from '../database';
import Order from '../database/models/order.model';
import Event from '../database/models/event.model';
import {ObjectId} from 'mongodb';
import User from '../database/models/user.model';
import { resolveMongoUserId } from './user.actions';

export const checkoutOrder = async (order: CheckoutOrderParams) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable')
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const configuredBaseUrl = process.env.NEXT_PUBLIC_SERVER_URL?.trim()
  const vercelUrl = process.env.VERCEL_URL?.trim()
  const baseUrl = configuredBaseUrl
    ? configuredBaseUrl.replace(/\/$/, '')
    : vercelUrl
      ? `https://${vercelUrl.replace(/\/$/, '')}`
      : 'http://localhost:3000'

  const price = order.isFree ? 0 : Math.round(Number(order.price) * 100);

  try {
    const resolvedBuyerId = await resolveMongoUserId(order.buyerId)
    if (!resolvedBuyerId) throw new Error('Buyer not found')

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: price,
            product_data: {
              name: order.eventTitle
            }
          },
          quantity: 1
        },
      ],
      metadata: {
        eventId: order.eventId,
        buyerId: resolvedBuyerId,
      },
      mode: 'payment',
      success_url: `${baseUrl}/profile`,
      cancel_url: `${baseUrl}/`,
    });

    redirect(session.url!)
  } catch (error) {
    throw error;
  }
}

export const createOrder = async (order: CreateOrderParams) => {
  try {
    await connectToDatabase();
    
    const newOrder = await Order.create({
      ...order,
      event: order.eventId,
      buyer: order.buyerId,
    });

    return JSON.parse(JSON.stringify(newOrder));
  } catch (error) {
    handleError(error);
  }
}

// GET ORDERS BY EVENT
export async function getOrdersByEvent({ searchString, eventId }: GetOrdersByEventParams) {
  try {
    await connectToDatabase()

    if (!eventId) throw new Error('Event ID is required')
    const eventObjectId = new ObjectId(eventId)

    const orders = await Order.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'buyer',
          foreignField: '_id',
          as: 'buyer',
        },
      },
      {
        $unwind: '$buyer',
      },
      {
        $lookup: {
          from: 'events',
          localField: 'event',
          foreignField: '_id',
          as: 'event',
        },
      },
      {
        $unwind: '$event',
      },
      {
        $project: {
          _id: 1,
          totalAmount: 1,
          createdAt: 1,
          eventTitle: '$event.title',
          eventId: '$event._id',
          buyer: {
            $concat: ['$buyer.firstName', ' ', '$buyer.lastName'],
          },
        },
      },
      {
        $match: {
          $and: [{ eventId: eventObjectId }, { buyer: { $regex: RegExp(searchString, 'i') } }],
        },
      },
    ])

    return JSON.parse(JSON.stringify(orders))
  } catch (error) {
    handleError(error)
  }
}

// GET ORDERS BY USER
export async function getOrdersByUser({ userId, limit = 3, page }: GetOrdersByUserParams) {
  try {
    await connectToDatabase()

    if (!userId) {
      return { data: [], totalPages: 0 }
    }

    const resolvedUserId = await resolveMongoUserId(userId)
    if (!resolvedUserId) {
      return { data: [], totalPages: 0 }
    }

    const skipAmount = (Number(page) - 1) * limit
    const conditions = { buyer: resolvedUserId }

    const orders = await Order.distinct('event._id')
      .find(conditions)
      .sort({ createdAt: 'desc' })
      .skip(skipAmount)
      .limit(limit)
      .populate({
        path: 'event',
        model: Event,
        populate: {
          path: 'organizer',
          model: User,
          select: '_id firstName lastName',
        },
      })

    const ordersCount = await Order.distinct('event._id').countDocuments(conditions)

    return { data: JSON.parse(JSON.stringify(orders)), totalPages: Math.ceil(ordersCount / limit) }
  } catch (error) {
    handleError(error)
  }
}

export async function hasUserOrderedEvent({ userId, eventId }: { userId: string; eventId: string }) {
  try {
    await connectToDatabase()

    if (!userId || !eventId) return false

    const resolvedUserId = await resolveMongoUserId(userId)
    if (!resolvedUserId) return false

    const existingOrder = await Order.exists({
      event: eventId,
      buyer: resolvedUserId,
    })

    return !!existingOrder
  } catch (error) {
    handleError(error)
  }
}
