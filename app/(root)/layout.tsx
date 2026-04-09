import Footer from "@/components/shared/Footer"
import Header from "@/components/shared/Header"
import { auth } from "@clerk/nextjs"
import { syncUserFromClerk } from "@/lib/actions/user.actions"

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = auth()

  if (userId) {
    try {
      await syncUserFromClerk(userId)
    } catch (error) {
      console.error('User sync failed in root layout:', error)
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
