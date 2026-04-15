"use client"

import { IEvent } from '@/lib/database/models/event.model'
import { SignedIn, SignedOut, useUser } from '@clerk/nextjs'
import Link from 'next/link'
import React from 'react'
import { Button } from '../ui/button'
import Checkout from './Checkout'

const CheckoutButton = ({ event, hasPurchased = false }: { event: IEvent; hasPurchased?: boolean }) => {
  const { user } = useUser();
  const userId = (user?.publicMetadata.userId as string) || user?.id;
  const hasEventFinished = new Date(event.endDateTime) < new Date();

  return (
    <div className="flex items-center gap-3">
      {hasEventFinished ? (
        <p className="p-2 text-red-400">Sorry, tickets are no longer available.</p>
      ) : hasPurchased ? (
        <SignedIn>
          <Button type="button" size="lg" className="button sm:w-fit" disabled>
            {event.isFree ? 'Ticket Claimed' : 'Ticket Already Purchased'}
          </Button>
        </SignedIn>
      ): (
        <>
          <SignedOut>
            <Button asChild className="button rounded-full" size="lg">
              <Link href="/sign-in">
                Get Tickets
              </Link>
            </Button>
          </SignedOut>

          <SignedIn>
            {userId ? <Checkout event={event} userId={userId} /> : null}
          </SignedIn>
        </>
      )}
    </div>
  )
}

export default CheckoutButton