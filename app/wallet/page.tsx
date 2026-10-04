import { AppLayout } from "@/components/dashboard/app-layout"
import { WalletView } from "@/components/wallet/wallet-view"

export const metadata = { title: "Wallet | QuillGlow" }

export default function WalletPage() {
  return (
    <AppLayout>
      <WalletView />
    </AppLayout>
  )
}
