import { AppLayout } from "@/components/dashboard/app-layout"
import { MyApplications } from "@/components/sprout/my-applications"

export const metadata = { title: "My Applications | QuillGlow" }

export default function MyApplicationsPage() {
  return (
    <AppLayout>
      <MyApplications />
    </AppLayout>
  )
}
